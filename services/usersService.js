function createUsersService({ pool, bcrypt, generateToken, getAdminPanelForEmail, getViewerContext }) {
  function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    error.publicMessage = message;
    return error;
  }

  async function register(body) {
    const { name, email, password } = body || {};

    if (!name || !email || !password) {
      throw createHttpError(400, "Faltan datos");
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO users (name, email, password, role, balance)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, role, balance`,
        [name.trim(), email.trim().toLowerCase(), hashedPassword, "user", 0]
      );

      const user = result.rows[0];
      const token = generateToken(user);

      return {
        token,
        message: "Usuario registrado con éxito"
      };
    } catch (_) {
      throw createHttpError(400, "El usuario ya existe o los datos son inválidos");
    }
  }

  async function login(body) {
    const { email, password } = body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();

    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE lower(regexp_replace(trim(email), '\\s+', '', 'g')) = lower(regexp_replace($1, '\\s+', '', 'g'))
       ORDER BY id DESC
       LIMIT 1`,
      [cleanEmail]
    );

    let user = result.rows[0];

    if (!user) {
      const panel = await getAdminPanelForEmail(cleanEmail);
      if (!panel) {
        throw createHttpError(404, "Usuario no encontrado");
      }

      if (String(panel.status || "activo").toLowerCase() !== "activo") {
        throw createHttpError(403, "Panel suspendido o inactivo");
      }

      const panelPass = await pool.query(`SELECT password FROM admin_panels WHERE id = $1`, [panel.id]);
      const matchPanel = await bcrypt.compare(password || "", panelPass.rows[0]?.password || "");
      if (!matchPanel) {
        throw createHttpError(401, "Contraseña incorrecta");
      }

      const created = await pool.query(
        `INSERT INTO users (name, email, password, role, balance, is_subadmin)
         VALUES ($1, $2, $3, 'admin', 0, false)
         RETURNING *`,
        [panel.admin_name || panel.business_name || cleanEmail, cleanEmail, panelPass.rows[0].password]
      );
      user = created.rows[0];
    }

    const panel = await getAdminPanelForEmail(user.email);
    if (panel && String(panel.status || "activo").toLowerCase() !== "activo") {
      throw createHttpError(403, "Panel suspendido o inactivo");
    }

    const match = await bcrypt.compare(password || "", user.password);
    if (!match) {
      throw createHttpError(401, "Contraseña incorrecta");
    }

    return { token: generateToken(user) };
  }

  async function getMe(userId) {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.balance,
              COALESCE(u.is_subadmin, false) AS is_subadmin,
              u.owner_user_id,
              ap.id AS admin_panel_id,
              ap.business_name AS admin_panel_business_name,
              ap.status AS admin_panel_status,
              CASE WHEN ap.id IS NULL THEN false ELSE true END AS is_panel_admin,
              CASE
                WHEN ap.id IS NOT NULL THEN 'panel_propietario'
                WHEN COALESCE(u.is_subadmin, false) = true THEN 'admin_distribuidor'
                WHEN u.role = 'admin' THEN 'admin_global'
                ELSE 'usuario'
              END AS account_type,
              CASE
                WHEN ap.id IS NOT NULL THEN 'Panel propietario'
                WHEN COALESCE(u.is_subadmin, false) = true THEN 'Admin distribuidor'
                WHEN u.role = 'admin' THEN 'Admin global'
                ELSE 'Usuario'
              END AS role_label
       FROM users u
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
       WHERE u.id = $1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      throw createHttpError(404, "Usuario no encontrado");
    }

    if (user.is_panel_admin && String(user.admin_panel_status || "activo").toLowerCase() !== "activo") {
      throw createHttpError(403, "Panel suspendido o inactivo");
    }

    return user;
  }

  async function listAdminUsers(viewerId, isPanelAdmin) {
    if (isPanelAdmin) {
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.balance, COALESCE(u.is_subadmin, false) AS is_subadmin, u.owner_user_id,
                owner.name AS owner_name,
                owner.email AS owner_email,
                own_panel.business_name AS owner_panel_name,
                own_panel.id AS owner_panel_id,
                CASE WHEN ap.id IS NULL THEN false ELSE true END AS is_panel_admin,
                CASE WHEN own_panel.id IS NULL THEN false ELSE true END AS belongs_to_panel_owner,
                CASE WHEN ap.id IS NOT NULL THEN 'panel_propietario'
                     WHEN own_panel.id IS NOT NULL AND COALESCE(u.is_subadmin, false) = true THEN 'distribuidor_del_panel'
                     WHEN own_panel.id IS NOT NULL THEN 'vendedor_panel'
                     WHEN COALESCE(u.is_subadmin, false) = true THEN 'admin_distribuidor'
                     WHEN u.role = 'admin' THEN 'admin_global'
                     ELSE 'usuario' END AS account_type
         FROM users u
         LEFT JOIN users owner ON owner.id = u.owner_user_id
         LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
         LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
         WHERE u.owner_user_id = $1
         ORDER BY u.id DESC`,
        [viewerId]
      );
      return result.rows;
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.balance, COALESCE(u.is_subadmin, false) AS is_subadmin, u.owner_user_id,
              owner.name AS owner_name,
              owner.email AS owner_email,
              own_panel.business_name AS owner_panel_name,
              own_panel.id AS owner_panel_id,
              CASE WHEN ap.id IS NULL THEN false ELSE true END AS is_panel_admin,
              CASE WHEN own_panel.id IS NULL THEN false ELSE true END AS belongs_to_panel_owner,
              CASE WHEN ap.id IS NOT NULL THEN 'panel_propietario'
                   WHEN own_panel.id IS NOT NULL AND COALESCE(u.is_subadmin, false) = true THEN 'distribuidor_del_panel'
                   WHEN own_panel.id IS NOT NULL THEN 'vendedor_panel'
                   WHEN COALESCE(u.is_subadmin, false) = true THEN 'admin_distribuidor'
                   WHEN u.role = 'admin' THEN 'admin_global'
                   ELSE 'usuario' END AS account_type
       FROM users u
       LEFT JOIN users owner ON owner.id = u.owner_user_id
       LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
       ORDER BY u.id DESC`
    );

    return result.rows;
  }

  async function addBalance(viewerId, isPanelAdmin, body) {
    const { user_id, amount, note } = body || {};

    if (!user_id || !amount) {
      throw createHttpError(400, "ID de usuario y cantidad son obligatorios");
    }

    const amountNumber = Number(amount);
    if (amountNumber <= 0) {
      throw createHttpError(400, "La cantidad debe ser mayor a 0");
    }

    const result = await pool.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 AND ($3::int IS NULL OR owner_user_id = $3)`,
      [amountNumber, user_id, isPanelAdmin ? viewerId : null]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, "Usuario no encontrado");
    }

    return {
      message: `Saldo agregado correctamente${note ? ": " + note : ""}`
    };
  }

  async function toggleSubadmin(viewerId, isPanelAdmin, userId, body) {
    const isSubadmin = body?.is_subadmin === true;

    if (!Number.isInteger(userId) || userId <= 0) {
      throw createHttpError(400, "Usuario inválido");
    }

    const targetResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.owner_user_id,
              owner.name AS owner_name,
              own_panel.id AS owner_panel_id,
              own_panel.business_name AS owner_panel_name,
              ap.id AS target_panel_id
       FROM users u
       LEFT JOIN users owner ON owner.id = u.owner_user_id
       LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    const target = targetResult.rows[0];
    if (!target || target.role === "admin" || target.target_panel_id) {
      throw createHttpError(404, "Usuario no encontrado o no se puede modificar");
    }

    if (isPanelAdmin && Number(target.owner_user_id || 0) !== Number(viewerId)) {
      throw createHttpError(403, "Solo puedes modificar vendedores de tu propio panel");
    }

    const result = await pool.query(
      `UPDATE users SET is_subadmin = $1 WHERE id = $2 AND role <> 'admin'
       RETURNING id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id`,
      [isSubadmin, userId]
    );

    const isPanelSeller = Boolean(target.owner_panel_id);
    const label = isPanelSeller ? "distribuidor del panel" : "admin distribuidor";

    return {
      message: isSubadmin ? `Usuario convertido en ${label}` : `${label.charAt(0).toUpperCase() + label.slice(1)} desactivado`,
      user: result.rows[0]
    };
  }

  async function getSubadminPrices(userId) {
    const result = await pool.query(
      `SELECT
         products.id AS product_id,
         products.name,
         products.category,
         products.price AS general_price,
         products.cost_price,
         COALESCE(user_product_prices.sale_price, products.price) AS sale_price
       FROM products
       LEFT JOIN user_product_prices
         ON user_product_prices.product_id = products.id
        AND user_product_prices.user_id = $1
       WHERE products.active = 1
       ORDER BY products.category ASC, products.name ASC`,
      [userId]
    );

    return result.rows;
  }

  async function updateSubadminPrice(body) {
    const { user_id, product_id, sale_price } = body || {};
    const priceNumber = Number(sale_price);

    if (!user_id || !product_id || !priceNumber || priceNumber <= 0) {
      throw createHttpError(400, "Usuario, producto y precio válido son obligatorios");
    }

    const updateResult = await pool.query(
      `UPDATE user_product_prices
       SET sale_price = $3, updated_at = NOW()
       WHERE user_id = $1 AND product_id = $2`,
      [user_id, product_id, priceNumber]
    );

    if (updateResult.rowCount === 0) {
      await pool.query(
        `INSERT INTO user_product_prices (user_id, product_id, sale_price, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [user_id, product_id, priceNumber]
      );
    }

    return { message: "Precio del admin independiente actualizado" };
  }

  async function listResellers(ownerUserId) {
    const result = await pool.query(
      `SELECT id, name, email, role, balance, owner_user_id, created_at
       FROM users
       WHERE owner_user_id = $1
       ORDER BY id DESC`,
      [ownerUserId]
    );

    return result.rows;
  }

  async function createReseller(ownerUserId, body) {
    const { name, email, password } = body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      throw createHttpError(400, "Nombre, correo y contraseña son obligatorios");
    }

    if (String(password).length < 6) {
      throw createHttpError(400, "La contraseña debe tener mínimo 6 caracteres");
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const existing = await pool.query(
        `SELECT id, name, email, owner_user_id
         FROM users
         WHERE lower(trim(email)) = lower($1)
         LIMIT 1`,
        [cleanEmail]
      );

      if (existing.rows[0]) {
        const existingUser = existing.rows[0];
        if (existingUser.owner_user_id && Number(existingUser.owner_user_id) !== Number(ownerUserId)) {
          throw createHttpError(400, "Ese correo ya pertenece a otro panel");
        }

        const updated = await pool.query(
          `UPDATE users
           SET name = $1,
               email = $5,
               password = $2,
               role = 'user',
               owner_user_id = $3,
               is_subadmin = FALSE
           WHERE id = $4
           RETURNING id, name, email, role, balance, owner_user_id`,
          [cleanName, hashedPassword, ownerUserId, existingUser.id, cleanEmail]
        );

        return { message: "Vendedor actualizado y acceso habilitado correctamente", user: updated.rows[0] };
      }

      const result = await pool.query(
        `INSERT INTO users (name, email, password, role, balance, owner_user_id, is_subadmin)
         VALUES ($1, $2, $3, 'user', 0, $4, FALSE)
         RETURNING id, name, email, role, balance, owner_user_id`,
        [cleanName, cleanEmail, hashedPassword, ownerUserId]
      );

      return { message: "Vendedor creado correctamente y acceso de login habilitado", user: result.rows[0] };
    } catch (error) {
      if (error.status) throw error;
      throw createHttpError(400, "No se pudo crear vendedor. Revisa si el correo ya existe.");
    }
  }

  async function deleteReseller(ownerUserId, resellerId) {
    const client = await pool.connect();
    try {
      if (!resellerId) {
        throw createHttpError(400, "ID de vendedor inválido");
      }

      await client.query("BEGIN");

      const sellerResult = await client.query(
        `SELECT id, name, email, owner_user_id
         FROM users
         WHERE id = $1 AND owner_user_id = $2
         LIMIT 1`,
        [resellerId, ownerUserId]
      );

      const seller = sellerResult.rows[0];
      if (!seller) {
        throw createHttpError(404, "Vendedor no encontrado en tu panel");
      }

      const usage = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM orders WHERE user_id = $1) AS orders_count,
           (SELECT COUNT(*)::int FROM balance_requests WHERE user_id = $1) AS balance_count,
           (SELECT COUNT(*)::int FROM account_reports WHERE user_id = $1) AS reports_count`,
        [resellerId]
      );

      const counts = usage.rows[0] || {};
      const hasMovements = Number(counts.orders_count || 0) > 0 || Number(counts.balance_count || 0) > 0 || Number(counts.reports_count || 0) > 0;

      if (hasMovements) {
        throw createHttpError(400, "No se puede eliminar porque este vendedor ya tiene pedidos, solicitudes de saldo o reportes. Así se evita perder historial.");
      }

      await client.query(`DELETE FROM subadmin_reseller_prices WHERE owner_user_id = $1`, [resellerId]);
      await client.query(`DELETE FROM user_product_prices WHERE user_id = $1`, [resellerId]);
      await client.query(`DELETE FROM users WHERE id = $1 AND owner_user_id = $2`, [resellerId, ownerUserId]);

      await client.query("COMMIT");
      return { message: "Vendedor eliminado correctamente" };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (_) {}
      throw error;
    } finally {
      client.release();
    }
  }

  async function resetResellerAccess(ownerUserId, resellerId, body) {
    const { password } = body || {};

    if (!resellerId || !password || String(password).length < 6) {
      throw createHttpError(400, "ID y contraseña mínima de 6 caracteres son obligatorios");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `UPDATE users
       SET email = lower(trim(email)),
           password = $1,
           role = 'user',
           owner_user_id = $2,
           is_subadmin = FALSE
       WHERE id = $3
         AND (owner_user_id = $2 OR owner_user_id IS NULL OR owner_user_id = 0)
       RETURNING id, name, email, role, balance, owner_user_id`,
      [hashedPassword, ownerUserId, resellerId]
    );

    if (!result.rows[0]) {
      throw createHttpError(404, "Vendedor no encontrado en tu panel");
    }

    return { message: "Acceso del vendedor reparado correctamente", user: result.rows[0] };
  }

  async function repairResellerByEmail(ownerUserId, body) {
    const cleanEmail = String(body?.email || "").trim().toLowerCase();
    const cleanName = String(body?.name || "").trim() || cleanEmail;
    const password = String(body?.password || "");

    if (!cleanEmail || !password || password.length < 6) {
      throw createHttpError(400, "Correo y contraseña mínima de 6 caracteres son obligatorios");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await pool.query(
      `SELECT id, owner_user_id
       FROM users
       WHERE lower(regexp_replace(trim(email), '\s+', '', 'g')) = lower(regexp_replace($1, '\s+', '', 'g'))
       ORDER BY id DESC
       LIMIT 1`,
      [cleanEmail]
    );

    let result;

    if (existing.rows[0]) {
      const existingUser = existing.rows[0];
      if (existingUser.owner_user_id && Number(existingUser.owner_user_id) !== Number(ownerUserId)) {
        throw createHttpError(400, "Ese correo ya pertenece a otro panel");
      }

      result = await pool.query(
        `UPDATE users
         SET name = $1,
             email = $2,
             password = $3,
             role = 'user',
             owner_user_id = $4,
             is_subadmin = FALSE
         WHERE id = $5
         RETURNING id, name, email, role, balance, owner_user_id`,
        [cleanName, cleanEmail, hashedPassword, ownerUserId, existingUser.id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO users (name, email, password, role, balance, owner_user_id, is_subadmin)
         VALUES ($1, $2, $3, 'user', 0, $4, FALSE)
         RETURNING id, name, email, role, balance, owner_user_id`,
        [cleanName, cleanEmail, hashedPassword, ownerUserId]
      );
    }

    return {
      message: "Acceso reparado correctamente. Ya puede iniciar sesión con esa contraseña.",
      user: result.rows[0]
    };
  }

  async function getDistributorPrices(userId) {
    const viewer = await getViewerContext(userId);

    if (viewer && viewer.is_panel_admin) {
      const result = await pool.query(
        `SELECT
           products.id AS product_id,
           products.name,
           products.category,
           products.price AS general_price,
           COALESCE(products.cost_price, products.price, 0) AS owner_price,
           COALESCE(subadmin_reseller_prices.sale_price, products.price) AS reseller_price
         FROM products
         LEFT JOIN subadmin_reseller_prices
           ON subadmin_reseller_prices.product_id = products.id
          AND subadmin_reseller_prices.owner_user_id = $1
         WHERE products.active = 1
           AND products.owner_admin_id = $1
         ORDER BY products.category ASC, products.name ASC`,
        [userId]
      );
      return result.rows;
    }

    const result = await pool.query(
      `SELECT
         products.id AS product_id,
         products.name,
         products.category,
         products.price AS general_price,
         COALESCE(user_product_prices.sale_price, products.price) AS owner_price,
         COALESCE(subadmin_reseller_prices.sale_price, user_product_prices.sale_price, products.price) AS reseller_price
       FROM products
       LEFT JOIN user_product_prices
         ON user_product_prices.product_id = products.id
        AND user_product_prices.user_id = $1
       LEFT JOIN subadmin_reseller_prices
         ON subadmin_reseller_prices.product_id = products.id
        AND subadmin_reseller_prices.owner_user_id = $1
       WHERE products.active = 1
         AND (products.owner_admin_id IS NULL OR products.owner_admin_id = 0)
       ORDER BY products.category ASC, products.name ASC`,
      [userId]
    );

    return result.rows;
  }

  async function updateDistributorPrice(userId, body) {
    const { product_id, sale_price } = body || {};
    const priceNumber = Number(sale_price);

    if (!product_id || !priceNumber || priceNumber <= 0) {
      throw createHttpError(400, "Producto y precio válido son obligatorios");
    }

    const viewer = await getViewerContext(userId);
    const productParams = viewer?.is_panel_admin ? [product_id, userId] : [product_id];
    const productWhere = viewer?.is_panel_admin
      ? `id = $1 AND active = 1 AND owner_admin_id = $2`
      : `id = $1 AND active = 1 AND (owner_admin_id IS NULL OR owner_admin_id = 0)`;

    const productCheck = await pool.query(`SELECT id FROM products WHERE ${productWhere} LIMIT 1`, productParams);
    if (!productCheck.rows.length) {
      throw createHttpError(404, "Producto no disponible para este panel");
    }

    const updateResult = await pool.query(
      `UPDATE subadmin_reseller_prices
       SET sale_price = $3, updated_at = NOW()
       WHERE owner_user_id = $1 AND product_id = $2`,
      [userId, product_id, priceNumber]
    );

    if (updateResult.rowCount === 0) {
      await pool.query(
        `INSERT INTO subadmin_reseller_prices (owner_user_id, product_id, sale_price, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [userId, product_id, priceNumber]
      );
    }

    return { message: "Precio para vendedores actualizado" };
  }

  async function addResellerBalance(ownerUserId, body) {
    const { user_id, amount, note } = body || {};
    const amountNumber = Number(amount);

    if (!user_id || !amountNumber || amountNumber <= 0) {
      throw createHttpError(400, "Vendedor y cantidad son obligatorios");
    }

    const result = await pool.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 AND owner_user_id = $3`,
      [amountNumber, user_id, ownerUserId]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, "Vendedor no encontrado");
    }

    return { message: `Saldo agregado al vendedor${note ? ": " + note : ""}` };
  }

  return {
    register,
    login,
    getMe,
    listAdminUsers,
    addBalance,
    toggleSubadmin,
    getSubadminPrices,
    updateSubadminPrice,
    listResellers,
    createReseller,
    deleteReseller,
    resetResellerAccess,
    repairResellerByEmail,
    getDistributorPrices,
    updateDistributorPrice,
    addResellerBalance
  };
}

module.exports = createUsersService;
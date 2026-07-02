function createUsersAccessService({ pool, jwt, secret }) {
  function generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      secret,
      {
        expiresIn: "24h"
      }
    );
  }

  function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Token faltante" });
    }

    try {
      req.user = jwt.verify(token, secret);
      next();
    } catch {
      return res.status(403).json({ error: "Token inválido" });
    }
  }

  async function adminMiddleware(req, res, next) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin requerido" });
      }

      const userResult = await pool.query(
        `SELECT u.id, u.email, u.name, u.role, u.balance,
                COALESCE(u.is_subadmin, false) AS is_subadmin,
                u.owner_user_id,
                ap.id AS admin_panel_id,
                ap.business_name AS admin_panel_business_name,
                ap.status AS admin_panel_status
         FROM users u
         LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
         WHERE u.id = $1`,
        [req.user.id]
      );

      const user = userResult.rows[0];
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      if (user.admin_panel_id && String(user.admin_panel_status || "activo").toLowerCase() !== "activo") {
        return res.status(403).json({ error: "Panel suspendido o inactivo" });
      }

      req.adminUser = user;
      req.isPanelAdmin = Boolean(user.admin_panel_id);
      req.isMainAdmin = !req.isPanelAdmin;
      next();
    } catch (err) {
      console.error("Error validando admin:", err.message);
      return res.status(500).json({ error: "Error validando permisos" });
    }
  }

  function mainAdminMiddleware(req, res, next) {
    if (!req.isMainAdmin) {
      return res.status(403).json({ error: "Admin principal requerido" });
    }
    next();
  }

  async function distributorMiddleware(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT id, role, COALESCE(is_subadmin, false) AS is_subadmin FROM users WHERE id = $1`,
        [req.user.id]
      );

      const user = result.rows[0];

      if (!user || (user.role !== "admin" && user.is_subadmin !== true)) {
        return res.status(403).json({ error: "Distribuidor requerido" });
      }

      req.distributor = user;
      next();
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: "Error validando distribuidor" });
    }
  }

  async function getAdminPanelForEmail(email, client = pool) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) return null;

    const result = await client.query(
      `SELECT id, business_name, admin_name, email, status, plan_type, expires_at,
              bank_name, bank_holder, bank_clabe, payment_concept, notification_email
       FROM admin_panels
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [cleanEmail]
    );

    return result.rows[0] || null;
  }

  async function getViewerContext(userId, client = pool) {
    const result = await client.query(
      `SELECT u.id, u.name, u.email, u.role, u.balance,
              COALESCE(u.is_subadmin, false) AS is_subadmin,
              u.owner_user_id,
              ap.id AS admin_panel_id,
              ap.business_name AS admin_panel_business_name,
              ap.bank_name, ap.bank_holder, ap.bank_clabe, ap.payment_concept,
              ap.notification_email, ap.status AS admin_panel_status,
              owner_panel.id AS owner_panel_id
       FROM users u
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
       LEFT JOIN users owner_user ON owner_user.id = u.owner_user_id
       LEFT JOIN admin_panels owner_panel ON lower(owner_panel.email) = lower(owner_user.email)
       WHERE u.id = $1`,
      [userId]
    );
    const viewer = result.rows[0] || null;
    if (!viewer) return null;
    viewer.is_panel_admin = Boolean(viewer.admin_panel_id);
    viewer.owner_is_panel_admin = Boolean(viewer.owner_panel_id);
    viewer.owner_admin_id = viewer.is_panel_admin ? viewer.id : (viewer.owner_is_panel_admin ? viewer.owner_user_id : null);
    return viewer;
  }

  async function getOwnerAndNotificationForUser(userId, client = pool) {
    const result = await client.query(
      `SELECT
         u.id,
         u.email,
         u.owner_user_id,
         owner.email AS owner_email,
         own_panel.id AS owner_panel_id,
         own_panel.notification_email AS owner_notification_email,
         self_panel.id AS self_panel_id,
         self_panel.notification_email AS self_notification_email
       FROM users u
       LEFT JOIN users owner ON owner.id = u.owner_user_id
       LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
       LEFT JOIN admin_panels self_panel ON lower(self_panel.email) = lower(u.email)
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    const row = result.rows[0] || {};
    const ownerAdminId = row.owner_user_id || (row.self_panel_id ? row.id : null);
    const notificationEmail = row.owner_notification_email || row.self_notification_email || "";

    return { ownerAdminId, notificationEmail };
  }

  function adminOwnedWhere(viewer, alias = "") {
    const prefix = alias ? alias + "." : "";

    if (viewer && viewer.owner_admin_id) {
      return { clause: `${prefix}owner_admin_id = $1`, params: [viewer.owner_admin_id] };
    }

    return { clause: `(${prefix}owner_admin_id IS NULL OR ${prefix}owner_admin_id = 0)`, params: [] };
  }

  async function getEffectiveProductPrice(client, user, product) {
    const fallbackPrice = Number(product.price || 0);

    if (!user) return fallbackPrice;
    if (user.role === "admin") return fallbackPrice;

    if (user.owner_user_id) {
      const resellerPriceResult = await client.query(
        `SELECT sale_price
         FROM subadmin_reseller_prices
         WHERE owner_user_id = $1 AND product_id = $2`,
        [user.owner_user_id, product.id]
      );

      if (resellerPriceResult.rows[0]) {
        return Number(resellerPriceResult.rows[0].sale_price || fallbackPrice);
      }

      const ownerPriceResult = await client.query(
        `SELECT sale_price
         FROM user_product_prices
         WHERE user_id = $1 AND product_id = $2`,
        [user.owner_user_id, product.id]
      );

      if (ownerPriceResult.rows[0]) {
        return Number(ownerPriceResult.rows[0].sale_price || fallbackPrice);
      }

      return fallbackPrice;
    }

    const customPriceResult = await client.query(
      `SELECT sale_price
       FROM user_product_prices
       WHERE user_id = $1 AND product_id = $2`,
      [user.id, product.id]
    );

    if (customPriceResult.rows[0]) {
      return Number(customPriceResult.rows[0].sale_price || fallbackPrice);
    }

    return fallbackPrice;
  }

  function getReportScopeOwnerId(req) {
    try {
      if (req.isPanelAdmin) return Number(req.user.id);
      if (req.adminUser && (req.adminUser.is_subadmin === true || req.adminUser.is_subadmin === "true" || req.adminUser.is_subadmin === 1)) return Number(req.user.id);
      return null;
    } catch {
      return null;
    }
  }

  function getScopedOrdersCondition() {
    return `($2::int IS NULL OR orders.owner_admin_id = $2 OR orders.user_id = $2 OR orders.user_id IN (SELECT id FROM users WHERE owner_user_id = $2))`;
  }

  function getScopedReportsCondition() {
    return `($3::int IS NULL OR account_reports.owner_admin_id = $3 OR account_reports.user_id = $3 OR account_reports.user_id IN (SELECT id FROM users WHERE owner_user_id = $3))`;
  }

  return {
    generateToken,
    authMiddleware,
    adminMiddleware,
    mainAdminMiddleware,
    distributorMiddleware,
    getAdminPanelForEmail,
    getViewerContext,
    getOwnerAndNotificationForUser,
    adminOwnedWhere,
    getEffectiveProductPrice,
    getReportScopeOwnerId,
    getScopedOrdersCondition,
    getScopedReportsCondition
  };
}

module.exports = createUsersAccessService;
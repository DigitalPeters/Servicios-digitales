function createUsersController({ usersService }) {
  function handleError(res, err, fallbackMessage) {
    console.error(err.message);
    return res.status(err.status || 500).json({ error: err.publicMessage || fallbackMessage });
  }

  return {
    register: async (req, res) => {
      try {
        res.json(await usersService.register(req.body));
      } catch (err) {
        handleError(res, err, "El usuario ya existe o los datos son inválidos");
      }
    },

    login: async (req, res) => {
      try {
        res.json(await usersService.login(req.body));
      } catch (err) {
        handleError(res, err, "Error iniciando sesión");
      }
    },

    me: async (req, res) => {
      try {
        res.json(await usersService.getMe(req.user.id));
      } catch (err) {
        handleError(res, err, "Error cargando usuario");
      }
    },

    adminUsers: async (req, res) => {
      try {
        res.json(await usersService.listAdminUsers(req.user.id, req.isPanelAdmin));
      } catch (err) {
        handleError(res, err, "Error cargando usuarios");
      }
    },

    addBalance: async (req, res) => {
      try {
        res.json(await usersService.addBalance(req.user.id, req.isPanelAdmin, req.body));
      } catch (err) {
        handleError(res, err, "Error agregando saldo");
      }
    },

    toggleSubadmin: async (req, res) => {
      try {
        res.json(await usersService.toggleSubadmin(req.user.id, req.isPanelAdmin, Number(req.params.userId), req.body));
      } catch (err) {
        handleError(res, err, "Error actualizando distribuidor");
      }
    },

    subadminPrices: async (req, res) => {
      try {
        res.json(await usersService.getSubadminPrices(req.params.userId));
      } catch (err) {
        handleError(res, err, "Error cargando precios del admin independiente");
      }
    },

    updateSubadminPrices: async (req, res) => {
      try {
        res.json(await usersService.updateSubadminPrice(req.body));
      } catch (err) {
        handleError(res, err, "Error guardando precio");
      }
    },

    distributorResellers: async (req, res) => {
      try {
        res.json(await usersService.listResellers(req.user.id));
      } catch (err) {
        handleError(res, err, "Error cargando vendedores");
      }
    },

    createReseller: async (req, res) => {
      try {
        res.json(await usersService.createReseller(req.user.id, req.body));
      } catch (err) {
        handleError(res, err, "No se pudo crear vendedor. Revisa si el correo ya existe.");
      }
    },

    deleteReseller: async (req, res) => {
      try {
        res.json(await usersService.deleteReseller(req.user.id, Number(req.params.id)));
      } catch (err) {
        handleError(res, err, "Error eliminando vendedor");
      }
    },

    resetResellerAccess: async (req, res) => {
      try {
        res.json(await usersService.resetResellerAccess(req.user.id, Number(req.params.id), req.body));
      } catch (err) {
        handleError(res, err, "Error reparando acceso del vendedor");
      }
    },

    repairResellerByEmail: async (req, res) => {
      try {
        res.json(await usersService.repairResellerByEmail(req.user.id, req.body));
      } catch (err) {
        handleError(res, err, "Error reparando acceso por correo");
      }
    },

    distributorPrices: async (req, res) => {
      try {
        res.json(await usersService.getDistributorPrices(req.user.id));
      } catch (err) {
        handleError(res, err, "Error cargando precios para vendedores");
      }
    },

    updateDistributorPrices: async (req, res) => {
      try {
        res.json(await usersService.updateDistributorPrice(req.user.id, req.body));
      } catch (err) {
        handleError(res, err, "Error guardando precio para vendedores");
      }
    },

    addResellerBalance: async (req, res) => {
      try {
        res.json(await usersService.addResellerBalance(req.user.id, req.body));
      } catch (err) {
        handleError(res, err, "Error agregando saldo al vendedor");
      }
    }
  };
}

module.exports = createUsersController;
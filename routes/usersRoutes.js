const express = require("express");
const createUsersService = require("../services/usersService");
const createUsersController = require("../controllers/usersController");

function createUsersRoutes(deps) {
  const router = express.Router();
  const usersService = createUsersService(deps);
  const usersController = createUsersController({ usersService });

  router.post("/api/register", usersController.register);
  router.post("/api/login", usersController.login);
  router.get("/api/me", deps.authMiddleware, usersController.me);

  router.get("/api/admin/users", deps.authMiddleware, deps.adminMiddleware, usersController.adminUsers);
  router.post("/api/admin/add-balance", deps.authMiddleware, deps.adminMiddleware, usersController.addBalance);
  router.patch("/api/admin/users/:userId/subadmin", deps.authMiddleware, deps.adminMiddleware, usersController.toggleSubadmin);
  router.get("/api/admin/subadmin-prices/:userId", deps.authMiddleware, deps.adminMiddleware, usersController.subadminPrices);
  router.patch("/api/admin/subadmin-prices", deps.authMiddleware, deps.adminMiddleware, usersController.updateSubadminPrices);

  router.get("/api/distributor/resellers", deps.authMiddleware, deps.distributorMiddleware, usersController.distributorResellers);
  router.post("/api/distributor/resellers", deps.authMiddleware, deps.distributorMiddleware, usersController.createReseller);
  router.delete("/api/distributor/resellers/:id", deps.authMiddleware, deps.distributorMiddleware, usersController.deleteReseller);
  router.post("/api/distributor/resellers/:id/reset-access", deps.authMiddleware, deps.distributorMiddleware, usersController.resetResellerAccess);
  router.post("/api/distributor/resellers/repair-by-email", deps.authMiddleware, deps.distributorMiddleware, usersController.repairResellerByEmail);
  router.get("/api/distributor/prices", deps.authMiddleware, deps.distributorMiddleware, usersController.distributorPrices);
  router.patch("/api/distributor/prices", deps.authMiddleware, deps.distributorMiddleware, usersController.updateDistributorPrices);
  router.post("/api/distributor/add-balance", deps.authMiddleware, deps.distributorMiddleware, usersController.addResellerBalance);

  return router;
}

module.exports = createUsersRoutes;
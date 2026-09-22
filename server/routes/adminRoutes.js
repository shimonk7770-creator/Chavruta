// server/routes/adminRoutes.js
// לוח בקרה למנהל מערכת - כל הראוטים כאן דורשים role="admin" (isAdminUser)

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { isAdminUser } = require("../middleware/permissions");
const adminController = require("../controllers/adminController");

router.get("/admin/dashboard", isAuthenticated, isAdminUser, adminController.dashboard);

module.exports = router;

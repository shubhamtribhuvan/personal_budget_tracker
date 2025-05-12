const express = require("express");
const router = express.Router();

// Import all the route modules
const authRoutes = require("./authRoutes");
const categoryRoutes = require("./categoryRoutes");
const transactionRoutes = require("./transactionRoutes");
const budgetRoutes = require("./budgetRoutes");
const dashboardRoutes = require("./dashboardRoutes");

// Set up the routes
router.use("/", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/transactions", transactionRoutes);
router.use("/budgets", budgetRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;
const express = require("express");
const {
  getSummary,
  getMonthlyOverview,
  getCategoryAnalysis,
} = require("../controllers/dashboardController");
const validateJWT = require("../middleware/authMiddleware");

const router = express.Router();

// All dashboard routes require authentication
router.use(validateJWT);

// Get financial summary
router.get("/summary", getSummary);

// Get monthly overview
router.get("/monthly-overview", getMonthlyOverview);

// Get category analysis
router.get("/category-analysis", getCategoryAnalysis);

module.exports = router;
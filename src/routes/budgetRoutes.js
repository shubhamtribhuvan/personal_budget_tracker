const express = require("express");
const {
  setBudget,
  getBudgets,
  deleteBudget,
} = require("../controllers/budgetController");
const validateJWT = require("../middleware/authMiddleware");

const router = express.Router();

// All budget routes require authentication
router.use(validateJWT);

// Set budget
router.post("/", setBudget);

// Get all budgets for a month
router.get("/", getBudgets);

// Delete budget
router.delete("/:id", deleteBudget);

module.exports = router;
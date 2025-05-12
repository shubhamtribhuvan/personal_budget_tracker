const express = require("express");
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");
const validateJWT = require("../middleware/authMiddleware");

const router = express.Router();

// All transaction routes require authentication
router.use(validateJWT);

// Create transaction
router.post("/", createTransaction);

// Get all transactions with filtering and pagination
router.get("/", getTransactions);

// Get transaction by ID
router.get("/:id", getTransactionById);

// Update transaction
router.put("/:id", updateTransaction);

// Delete transaction
router.delete("/:id", deleteTransaction);

module.exports = router;
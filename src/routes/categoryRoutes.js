const express = require("express");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const validateJWT = require("../middleware/authMiddleware");

const router = express.Router();

// All category routes require authentication
router.use(validateJWT);

// Create category
router.post("/", createCategory);

// Get all categories
router.get("/", getCategories);

// Update category
router.put("/:id", updateCategory);

// Delete category
router.delete("/:id", deleteCategory);

module.exports = router;
const Category = require("../models/categoryModel");
const { createResponse } = require("../services/responseService");

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, type, color } = req.body;
    const userId = req.user.id;

    console.log("userId",userId)

    // Check if category with same name and type already exists for this user
    const existingCategory = await Category.findOne({
      name,
      type,
      user: userId,
    });

    if (existingCategory) {
      return res.status(400).json(
        createResponse(400, "Category already exists with this name")
      );
    }

    const category = new Category({
      name,
      type,
      color: color || "#" + Math.floor(Math.random() * 16777215).toString(16), 
      user: userId,
    });

    await category.save();

    return res.status(201).json(
      createResponse(201, "Category created successfully", {
        category: {
          id: category._id,
          name: category.name,
          type: category.type,
          color: category.color,
        },
      })
    );
  } catch (error) {
    console.error("Create category error:", error);
    if (error.code === 11000) {
      return res.status(400).json(createResponse(400, "Category already exists with this name"));
    }
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Get all categories for a user
exports.getCategories = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    // Build filter based on query parameters
    const filter = { user: userId, isActive: true };
    if (type && (type === "income" || type === "expense")) {
      filter.type = type;
    }

    const categories = await Category.find(filter).sort({ name: 1 });

    return res.status(200).json(
      createResponse(200, "Categories retrieved successfully", {
        categories: categories.map((category) => ({
          id: category._id,
          name: category.name,
          type: category.type,
          color: category.color,
        })),
      })
    );
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const userId = req.user.id;

    // Find category by id and user
    const category = await Category.findOne({ _id: id, user: userId });

    if (!category) {
      return res.status(404).json(createResponse(404, "Category not found"));
    }

    // Update fields if provided
    if (name) category.name = name;
    if (color) category.color = color;

    await category.save();

    return res.status(200).json(
      createResponse(200, "Category updated successfully", {
        category: {
          id: category._id,
          name: category.name,
          type: category.type,
          color: category.color,
        },
      })
    );
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Delete a category (soft delete)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find category by id and user
    const category = await Category.findOne({ _id: id, user: userId });

    if (!category) {
      return res.status(404).json(createResponse(404, "Category not found"));
    }

    // Mark as inactive instead of deleting
    category.isActive = false;
    await category.save();

    return res.status(200).json(
      createResponse(200, "Category deleted successfully")
    );
  } catch (error) {
    console.error("Delete category error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};
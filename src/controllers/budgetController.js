const Budget = require("../models/budgetModel");
const Category = require("../models/categoryModel");
const Transaction = require("../models/transactionModel");
const { createResponse } = require("../services/responseService");
const mongoose = require("mongoose");

// Set budget for a category and month
exports.setBudget = async (req, res) => {
  try {
    const { month, year, category, amount } = req.body;
    const userId = req.user.id;

    // Validate month and year
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json(
        createResponse(400, "Invalid month or year")
      );
    }

    // Validate category exists and belongs to user
    const categoryObj = await Category.findOne({
      name: category,
      user: userId,
      isActive: true,
    });

    if (!categoryObj) {
      return res.status(404).json(createResponse(404, "Category not found"));
    }

    // Only allow setting budget for expense categories
    if (categoryObj.type !== "expense") {
      return res.status(400).json(
        createResponse(400, "Budget can only be set for expense categories")
      );
    }

    // Check if budget already exists for this month, year, and category
    let budget = await Budget.findOne({
      month,
      year,
      category: categoryObj._id, // Corrected to use categoryObj._id instead of category string
      user: userId,
    });

    if (budget) {
      // Update existing budget
      budget.amount = amount;
    } else {
      // Create new budget
      budget = new Budget({
        month,
        year,
        amount,
        category: categoryObj._id, // Corrected to use categoryObj._id instead of category string
        user: userId,
      });
    }

    await budget.save();

    return res.status(200).json(
      createResponse(
        budget ? 200 : 201,
        `Budget ${budget ? "updated" : "set"} successfully`,
        {
          budget: {
            id: budget._id,
            month,
            year,
            amount,
            category: {
              id: categoryObj._id,
              name: categoryObj.name,
              type: categoryObj.type,
              color: categoryObj.color,
            },
          },
        }
      )
    );
  } catch (error) {
    console.error("Set budget error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Get all budgets for a month and year
exports.getBudgets = async (req, res) => {
  try {
    const userId = req.user.id;
    let { month, year } = req.query;

    // Default to current month and year if not provided
    const currentDate = new Date();
    month = month || currentDate.getMonth() + 1; // getMonth() returns 0-11
    year = year || currentDate.getFullYear();

    // Find all budgets for this month and year
    const budgets = await Budget.find({
      month,
      year,
      user: userId,
    }).populate("category", "name color type");

    // Calculate actual spending for each category
    const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in Date constructor
    const endDate = new Date(year, month, 0); // Last day of the month

    const actualSpending = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          type: "expense",
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Create a map for fast lookup of actual spending by category ID
    const actualSpendingMap = actualSpending.reduce((map, item) => {
      map[item._id.toString()] = item.total;
      return map;
    }, {});

    return res.status(200).json(
      createResponse(200, "Budgets retrieved successfully", {
        budgets: budgets.map((budget) => ({
          id: budget._id,
          month,
          year,
          amount: budget.amount,
          spent: actualSpendingMap[budget.category._id.toString()] || 0,
          remaining:
            budget.amount - (actualSpendingMap[budget.category._id.toString()] || 0),
          category: {
            id: budget.category._id,
            name: budget.category.name,
            color: budget.category.color,
          },
        })),
        month,
        year,
      })
    );
  } catch (error) {
    console.error("Get budgets error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Delete a budget
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(createResponse(400, "Invalid budget ID"));
    }

    const budget = await Budget.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      user: userId,
    });

    if (!budget) {
      return res.status(404).json(createResponse(404, "Budget not found"));
    }

    return res.status(200).json(
      createResponse(200, "Budget deleted successfully")
    );
  } catch (error) {
    console.error("Delete budget error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};
const Transaction = require("../models/transactionModel");
const Category = require("../models/categoryModel");
const { createResponse } = require("../services/responseService");
const mongoose = require("mongoose");

// Create a new transaction
exports.createTransaction = async (req, res) => {
  try {
    const { amount, description, type, category, date } = req?.body;
    console.log("req.body;",req?.body)
    const userId = req.user.id;

    console.log("userId", userId);

    // Validate the category exists and belongs to user
    const categoryObj = await Category.findOne({
    categoryName: category,
      user: userId,
      isActive: true,
    });


    console.log("categoryObj", categoryObj);

    if (!categoryObj) {
      return res.status(404).json(createResponse(404, "Category not found"));
    }

    // Validate category type matches transaction type
    if (categoryObj.type !== type) {
      return res.status(400).json(
        createResponse(400, `Category type must be ${type}`)
      );
    }

    const transaction = new Transaction({
      amount,
      description,
      type,
      category: categoryObj._id, // Corrected to use the category object's _id
      date: date || new Date(),
      user: userId,
    });

    await transaction.save();

    return res.status(201).json(
      createResponse(201, "Transaction created successfully", {
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          description: transaction.description,
          type: transaction.type,
          category: {
            id: categoryObj._id,
            name: categoryObj.name,
            color: categoryObj.color,
          },
          date: transaction.date,
        },
      })
    );
  } catch (error) {
    console.error("Create transaction error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Get all transactions for a user with filtering and pagination
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      type,
      category,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = req.query;

    // Build filter based on query parameters
    const filter = { user: userId };

    if (type && (type === "income" || type === "expense")) {
      filter.type = type;
    }

    if (category) {
      filter.category = category;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) {
        filter.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        filter.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Count total documents for pagination info
    const totalDocs = await Transaction.countDocuments(filter);

    // Get paginated results with category details
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate("category", "name color type");

    return res.status(200).json(
      createResponse(200, "Transactions retrieved successfully", {
        transactions: transactions.map((transaction) => ({
          id: transaction._id,
          amount: transaction.amount,
          description: transaction.description,
          type: transaction.type,
          category: {
            id: transaction.category._id,
            name: transaction.category.name,
            color: transaction.category.color,
          },
          date: transaction.date,
          createdAt: transaction.createdAt,
        })),
        pagination: {
          totalDocs,
          limit: parseInt(limit),
          page: parseInt(page),
          totalPages: Math.ceil(totalDocs / parseInt(limit)),
          hasNextPage: parseInt(page) < Math.ceil(totalDocs / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1,
        },
      })
    );
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Get transaction by ID
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(createResponse(400, "Invalid transaction ID"));
    }

    const transaction = await Transaction.findOne({
      _id: id,
      user: userId,
    }).populate("category", "name color type");

    if (!transaction) {
      return res
        .status(404)
        .json(createResponse(404, "Transaction not found"));
    }

    return res.status(200).json(
      createResponse(200, "Transaction retrieved successfully", {
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          description: transaction.description,
          type: transaction.type,
          category: {
            id: transaction.category._id,
            name: transaction.category.name,
            color: transaction.category.color,
          },
          date: transaction.date,
        },
      })
    );
  } catch (error) {
    console.error("Get transaction by ID error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Update a transaction
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, category, date } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(createResponse(400, "Invalid transaction ID"));
    }

    // First find the transaction
    const transaction = await Transaction.findOne({
      _id: id,
      user: userId,
    });

    if (!transaction) {
      return res
        .status(404)
        .json(createResponse(404, "Transaction not found"));
    }

    // If category is updated, validate the new category
    if (category && category !== transaction.category.toString()) {
      const categoryObj = await Category.findOne({
        categoryName: category,
        user: userId,
        isActive: true,
      });

      if (!categoryObj) {
        return res.status(404).json(createResponse(404, "Category not found"));
      }

      // Validate category type matches transaction type
      if (categoryObj.type !== transaction.type) {
        return res.status(400).json(
          createResponse(400, `Category type must be ${transaction.type}`)
        );
      }

      transaction.category = category;
    }

    // Update other fields if provided
    if (amount !== undefined) transaction.amount = amount;
    if (description) transaction.description = description;
    if (date) transaction.date = new Date(date);

    await transaction.save();

    // Get updated transaction with category details
    const updatedTransaction = await Transaction.findById(id).populate(
      "category",
      "name color type"
    );

    return res.status(200).json(
      createResponse(200, "Transaction updated successfully", {
        transaction: {
          id: updatedTransaction._id,
          amount: updatedTransaction.amount,
          description: updatedTransaction.description,
          type: updatedTransaction.type,
          category: {
            id: updatedTransaction.category._id,
            name: updatedTransaction.category.name,
            color: updatedTransaction.category.color,
          },
          date: updatedTransaction.date,
        },
      })
    );
  } catch (error) {
    console.error("Update transaction error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Delete a transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(createResponse(400, "Invalid transaction ID"));
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      user: userId,
    });

    if (!transaction) {
      return res
        .status(404)
        .json(createResponse(404, "Transaction not found"));
    }

    return res.status(200).json(
      createResponse(200, "Transaction deleted successfully")
    );
  } catch (error) {
    console.error("Delete transaction error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};
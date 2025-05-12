const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Add unique index for month, year, category, and user
budgetSchema.index({ month: 1, year: 1, category: 1, user: 1 }, { unique: true });

const Budget = mongoose.model("Budget", budgetSchema);
module.exports = Budget;
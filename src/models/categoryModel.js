const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    color: {
      type: String,
      default: "#000000", // Default color for visualization
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Add index for faster queries
categorySchema.index({ user: 1, name: 1 }, { unique: true });

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
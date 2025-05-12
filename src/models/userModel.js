const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    verifytoken: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    refreshTokens: [String], 
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;

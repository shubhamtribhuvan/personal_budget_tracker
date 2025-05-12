const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// Middleware to validate JWT
const validateJWT = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1]; // Assuming 'Bearer <token>'

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access Denied: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // TODO: Add status validation to check if user is active
    req.user = user; // Save decoded token to the request object
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

module.exports = validateJWT;

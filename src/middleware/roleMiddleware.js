// Middleware to validate user roles
const validateRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res
        .status(403)
        .json({ message: "Access Denied: No role assigned" });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        message: "Access Denied: You do not have the required permissions",
      });
    }

    next();
  };
};

module.exports = validateRole;

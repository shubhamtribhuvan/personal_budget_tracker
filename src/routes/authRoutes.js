const express = require("express");

const {
  handleLogin,
  handleSignup,
  testRoute,
  handleLogout,
  verifyAccount,
  refreshTokens
} = require("../controllers/authController");

const validateJWT = require("../middleware/authMiddleware");
const validateRole = require("../middleware/roleMiddleware");
const { roles } = require("../constants");

const router = express.Router();

router.route("/test").get(testRoute);


router.route("/auth/test").get(testRoute);

// Test role and JWT validation
router
  .route("/auth/test")
  .post(validateJWT, validateRole(roles.user), testRoute);

router.route("/auth/login").post(handleLogin);
router.route("/auth/signup").post(handleSignup);
router.route("/auth/accountVerify/:verifytoken/:userid").post(verifyAccount);
router.route("/auth/logout").post(handleLogout);
router.route("/refresh-token").post(refreshTokens);

module.exports = router;

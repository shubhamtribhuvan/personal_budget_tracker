const { validateRequest } = require("../services/validationService");
const authController = require("../controllers/authController");
const { createResponse } = require("../services/responseService");
const { connectToDatabase } = require("../services/dbService");

exports.handler = async (event) => {
  const { path: requestPath, body } = event;
  // Regular API logic
  const validationError = validateRequest(event);
  if (validationError) {
    return createResponse(400, validationError);
  }

  await connectToDatabase();

  let response;

  switch (requestPath) {
    case "/login":
      response = await authController.handleLogin(event);
      break;
    case "/signup":
      response = await authController.handleSignup(event);
      break;
    // Add other API routes here
    default:
      response = createResponse(404, "Path not found");
      break;
  }

  return response;
};

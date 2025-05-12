require("dotenv").config();
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createResponse } = require("../services/responseService");
const crypto = require("crypto");
const { roles } = require("../constants");

// Helper function to generate tokens
const generateTokens = (userId) => {
  // Generate access token (short-lived)
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  
  // Generate refresh token (long-lived)
  const refreshTokens = jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );
  
  return { accessToken, refreshTokens };
};

// Save refresh token to database with proper security
const saveRefreshToken = async (userId, refreshTokens) => {
  try {
    // Create a hash of the refresh token for storage
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshTokens)
      .digest('hex');
      
    // Save to user document
    await User.findByIdAndUpdate(userId, {
      refreshTokens: refreshTokenHash,
      refreshTokenExpiresAt: new Date(
        Date.now() + 
        parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_MS || 7 * 24 * 60 * 60 * 1000)
      )
    });
  } catch (error) {
    console.error("Error saving refresh token:", error);
    throw error;
  }
};

exports.testRoute = async (req, res) => {
  return res.status(200).json(
    createResponse(200, "successful!", {
      message: "Testing Route",
    })
  );
};

exports.handleSignup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json(createResponse(400, "User already exists"));
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    let verifytoken = Math.floor(10000 + Math.random() * 90000).toString();
    
    // Create a new user
    user = new User({
      name,
      email,
      password: hashedPassword,
      verifytoken,
      isActive: true, // Consider setting this to false if email verification is required
      refreshTokens: null,
      refreshTokenExpiresAt: null
    });

    await user.save();

    // Generate both tokens
    const { accessToken, refreshTokens } = generateTokens(user._id);
    
    // Save refresh token to database
    await saveRefreshToken(user._id, refreshTokens);

    return res.status(201).json(
      createResponse(201, "Signup successful!", {
        email,
        name: user.name,
        accessToken,
        refreshTokens
      })
    );
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

exports.handleLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json(createResponse(401, "Invalid email or password"));
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json(createResponse(401, "Invalid email or password"));
    }
    
    if (!user.isActive) {
      return res.status(400).json(createResponse(400, "Account Not Active"));
    }
    
    // Generate both tokens
    const { accessToken, refreshTokens } = generateTokens(user._id);
    
    // Save refresh token to database
    await saveRefreshToken(user._id, refreshTokens);
    
    // Set refresh token in HTTP-only cookie for better security
    res.cookie('refreshTokens', refreshTokens, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // secure in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    let resObj = {
      email,
      name: user.name,
      accessToken
    };
    
    if (user.role === roles.admin) {
      resObj.isAdmin = true;
    }
    
    return res
      .status(200)
      .json(createResponse(200, "Login Successful!", resObj));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

exports.handleLogout = async (req, res) => {
  try {
    const refreshTokens = req.cookies?.refreshTokens;
    
    if (refreshTokens) {
      // Hash the token for comparison
      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshTokens)
        .digest('hex');
        
      // Find user with this refresh token and clear it
      await User.findOneAndUpdate(
        { refreshTokens: refreshTokenHash },
        { refreshTokens: null, refreshTokenExpiresAt: null }
      );
      
      // Clear the cookie
      res.clearCookie('refreshTokens');
    }
    
    return res.status(200).json(
      createResponse(200, "Logout successful!", {
        message: "You have been successfully logged out.",
      })
    );
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

exports.refreshTokens = async (req, res) => {
  try {
    // Get refresh token from cookie or authorization header
    const refreshTokens = req.cookies?.refreshTokens || 
                          req.body.refreshTokens ||
                          req.header("X-Refresh-Token");
                          
    if (!refreshTokens) {
      return res.status(401).json(
        createResponse(401, "No refresh token provided")
      );
    }
    
    // Verify the refresh token
    const decoded = jwt.verify(refreshTokens, process.env.REFRESH_TOKEN_SECRET);
    
    // Hash the token for lookup
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshTokens)
      .digest('hex');
      
    // Find user with this refresh token
    const user = await User.findOne({
      _id: decoded.id,
      refreshTokens: refreshTokenHash,
      refreshTokenExpiresAt: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(403).json(
        createResponse(403, "Invalid or expired refresh token")
      );
    }
    
    // Generate new tokens
    const tokens = generateTokens(user._id);
    
    // Update refresh token in database
    await saveRefreshToken(user._id, tokens.refreshTokens);
    
    // Set new refresh token in cookie
    res.cookie('refreshTokens', tokens.refreshTokens, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return res.status(200).json(
      createResponse(200, "Token refreshed successfully", {
        accessToken: tokens.accessToken
      })
    );
  } catch (error) {
    console.error("Token refresh error:", error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json(
        createResponse(403, "Invalid refresh token")
      );
    }
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

exports.verifyAccount = async (req, res) => {
  const { verifytoken, userid } = req.params;

  try {
    let user = await User.findById(userid);
    if (!user) {
      return res.status(404).json(createResponse(404, "User not found"));
    }
    if (user.isActive) {
      return res
        .status(400)
        .json(createResponse(400, "Account already verified"));
    }
    if (user.verifytoken !== verifytoken) {
      return res
        .status(400)
        .json(createResponse(400, "Invalid verification token"));
    }

    // Mark the user as verified
    user.verifytoken = null;
    user.isActive = true;
    await user.save();

    return res
      .status(200)
      .json(createResponse(200, "Account verified successfully"));
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json(createResponse(500, "Invalid credentials"));
  }
};
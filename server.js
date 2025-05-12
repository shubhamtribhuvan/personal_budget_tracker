const serverless = require("serverless-http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require('cookie-parser');

const app = express();

app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());

app.use(cors({
  origin: 'http://localhost:3000', // Frontend URL
  credentials: true, // Allow credentials (cookies)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token', 'Accept']
}));

const { connectToDatabase } = require("./src/services/dbService"); 
const router = require("./src/routes/index");

app.use("/api", router);

app.use("/test", (req, res) => {
  res.status(200).json({ message: "Test endpoint working!" });
});

// Serverless handler export
module.exports.handler = serverless(app);

const startServer = async () => {
  try {
    await connectToDatabase(); // Wait for DB connection first
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB", error);
  }
};

startServer();

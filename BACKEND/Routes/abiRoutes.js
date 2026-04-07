const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/authMiddleware");
const {
  getSession,
  onboardUser,
  fetchRemoteAbiUser,
} = require("../Controllers/abiController");

router.get("/session", authMiddleware, getSession);
router.post("/onboard", authMiddleware, onboardUser);
router.get("/remote", authMiddleware, fetchRemoteAbiUser);

module.exports = router;

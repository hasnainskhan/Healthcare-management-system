const express = require("express");
const router = express.Router();
const { handleAbiWebhook } = require("../Controllers/abiWebhookController");

router.post("/", handleAbiWebhook);

module.exports = router;

const crypto = require("crypto");
const User = require("../Models/UserModel");

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), "utf8");
    const bb = Buffer.from(String(b), "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyAbiSignature(rawBuffer, headerValue, secret) {
  if (!secret || !headerValue) return false;
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBuffer)
    .digest("hex");

  const trimmed = String(headerValue).trim();
  const withoutPrefix = trimmed.replace(/^sha256=/i, "").replace(/^v\d+=/i, "");

  if (timingSafeEqualHex(withoutPrefix, expectedHex)) return true;

  try {
    const expectedB64 = crypto
      .createHmac("sha256", secret)
      .update(rawBuffer)
      .digest("base64");
    return timingSafeEqualHex(trimmed, expectedB64);
  } catch {
    return false;
  }
}

/**
 * POST /api/abi/webhook — raw JSON body (mounted with express.raw).
 */
const handleAbiWebhook = async (req, res) => {
  const secret = process.env.ABI_WEBHOOK_SECRET;
  const rawBuffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body || {}), "utf8");

  const sigHeader =
    req.get("X-Abby-Signature") ||
    req.get("X-Abi-Signature") ||
    req.get("x-abby-signature");

  if (secret) {
    if (!sigHeader || !verifyAbiSignature(rawBuffer, sigHeader, secret)) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.warn(
      "ABI_WEBHOOK_SECRET is not set; webhook signatures are not verified."
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawBuffer.toString("utf8") || "{}");
  } catch {
    return res.status(400).json({ message: "Invalid JSON" });
  }

  const event = payload.event;
  const data = payload.data || {};

  try {
    switch (event) {
      case "user.created":
        break;
      case "gp.review.completed": {
        const abbyId = data.abby_user_id;
        if (abbyId) {
          await User.updateOne(
            { abiUserId: abbyId },
            {
              $set: {
                abiGpReviewSummary: data.review_summary || "",
                abiGpReviewedAt: data.reviewed_at
                  ? new Date(data.reviewed_at)
                  : new Date(),
              },
            }
          );
        }
        break;
      }
      case "payment.status.changed": {
        const abbyId = data.abby_user_id;
        if (abbyId && data.payment_status) {
          await User.updateOne(
            { abiUserId: abbyId },
            { $set: { abiPaymentStatus: data.payment_status } }
          );
        }
        break;
      }
      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("ABI webhook handler error:", err.message);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};

module.exports = { handleAbiWebhook, verifyAbiSignature };

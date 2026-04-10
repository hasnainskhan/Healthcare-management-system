const User = require("../Models/UserModel");
const {
  createAbiUser,
  getAbiUser,
  newIdempotencyKey,
} = require("../Services/abiApiClient");

function splitName(full) {
  const t = (full || "").trim();
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "User", last_name: "User" };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function formatDob(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function buildWidgetUrl(uniqueId) {
  const base =
    process.env.ABI_WIDGET_BASE_URL || "http://goapp.abi.ai";
  const partner = process.env.ABI_WIDGET_PARTNER || "goodpeople";
  return `${base.replace(/\/$/, "")}/${partner}/${uniqueId}`;
}

function buildAbiPayload(user, body = {}) {
  const useTestIdentity =
    process.env.NODE_ENV !== "production" &&
    String(process.env.ABI_USE_TEST_IDENTITY || "").toLowerCase() === "true";

  const identityName = useTestIdentity
    ? process.env.ABI_TEST_NAME || "Test Name"
    : user.name;
  const identityEmail = useTestIdentity
    ? process.env.ABI_TEST_EMAIL || "support@clienttask.com"
    : user.email;

  const { first_name, last_name } = splitName(identityName);
  const dob = formatDob(user.dateOfBirth) || body.dateOfBirth || body.dob;
  if (!dob) {
    const err = new Error("DOB_REQUIRED");
    err.code = "DOB_REQUIRED";
    throw err;
  }

  const language = body.language || process.env.ABI_DEFAULT_LANGUAGE;
  const physicianCountry =
    body.physicianCountry || process.env.ABI_DEFAULT_PHYSICIAN_COUNTRY;
  const partnerName = body.partnerName || process.env.ABI_PARTNER_NAME;
  if (!language || !physicianCountry) {
    const err = new Error("ABI_LANGUAGE_COUNTRY_REQUIRED");
    err.code = "ABI_LANGUAGE_COUNTRY_REQUIRED";
    throw err;
  }
  if (!partnerName) {
    const err = new Error("ABI_PARTNER_NAME_REQUIRED");
    err.code = "ABI_PARTNER_NAME_REQUIRED";
    throw err;
  }

  return {
    // Minimal required fields from Abi docs:
    partnerName,
    language,
    physicianCountry,

    // Common optional fields (sent when we have them)
    firstName: body.firstName ?? body.first_name ?? first_name,
    lastName: body.lastName ?? body.last_name ?? last_name,
    email: body.email ?? identityEmail,
    phone: body.phone ?? user.mobile ?? undefined,
    dateOfBirth: dob,
    gender: body.gender ?? undefined,

    // If Abi expects you to set uniqueId, keep it stable so the GoApp URL works.
    uniqueId: body.uniqueId || `shms_${String(user._id)}`,

    // Avoid sending notifications unless explicitly enabled
    shouldNotify: body.shouldNotify ?? false,
  };
}

const getSession = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const onboarded = Boolean(user.abiUserId);
    res.status(200).json({
      onboarded,
      abi_user_id: user.abiUserId || null,
      widget_url: onboarded ? buildWidgetUrl(user.abiUserId) : null,
      instance_url: user.abiInstanceUrl || null,
      gp_review_summary: user.abiGpReviewSummary || null,
      gp_reviewed_at: user.abiGpReviewedAt || null,
      abi_payment_status: user.abiPaymentStatus || null,
    });
  } catch (err) {
    console.error("ABI getSession:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

const onboardUser = async (req, res) => {
  try {
    if (!process.env.ABI_API_BASE_URL || !process.env.ABI_API_KEY) {
      return res.status(503).json({
        message:
          "ABI API is not configured. Set ABI_API_BASE_URL and ABI_API_KEY on the server.",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.abiUserId) {
      return res.status(200).json({
        alreadyOnboarded: true,
        uniqueId: user.abiUserId,
        instance_url: user.abiInstanceUrl,
        widget_url: buildWidgetUrl(user.abiUserId),
      });
    }

    let payload;
    try {
      payload = buildAbiPayload(user, req.body || {});
    } catch (e) {
      if (e.code === "DOB_REQUIRED") {
        return res.status(400).json({
          message:
            "Date of birth is required. Update your profile or include dob in the request body.",
        });
      }
      if (e.code === "ABI_LANGUAGE_COUNTRY_REQUIRED") {
        return res.status(400).json({
          message:
            "ABI requires language and physicianCountry. Set ABI_DEFAULT_LANGUAGE and ABI_DEFAULT_PHYSICIAN_COUNTRY or pass them in the request body.",
        });
      }
      if (e.code === "ABI_PARTNER_NAME_REQUIRED") {
        return res.status(400).json({
          message:
            "ABI requires partnerName. Set ABI_PARTNER_NAME or pass partnerName in the request body.",
        });
      }
      throw e;
    }

    const idempotencyKey = newIdempotencyKey();
    const data = await createAbiUser(payload, idempotencyKey);

    user.abiUserId = data.uniqueId;
    user.abiInstanceUrl = null;
    user.abiOnboardIdempotencyKey = idempotencyKey;
    user.abiOnboardedAt = new Date();
    await user.save();

    return res.status(201).json({
      uniqueId: data.uniqueId,
      widget_url: buildWidgetUrl(data.uniqueId),
      userStatus: data.userStatus,
      id: data.id,
    });
  } catch (err) {
    if (err.code === "ABI_NOT_CONFIGURED") {
      return res.status(503).json({ message: "ABI API is not configured." });
    }
    const netCode = err?.cause?.code || err?.code;
    if (
      netCode === "UND_ERR_CONNECT_TIMEOUT" ||
      netCode === "ETIMEDOUT" ||
      netCode === "ECONNREFUSED" ||
      netCode === "ENOTFOUND"
    ) {
      return res.status(504).json({
        message:
          "Could not reach Abi API (network timeout). Check internet/DNS/firewall/VPN and that https://client-api.abi.ai is reachable from the backend host.",
        ...(process.env.NODE_ENV !== "production" && { detail: String(netCode) }),
      });
    }
    if (err.code === "ABI_LANGUAGE_COUNTRY_REQUIRED") {
      return res.status(400).json({
        message:
          "ABI requires language and physicianCountry. Set ABI_DEFAULT_LANGUAGE and ABI_DEFAULT_PHYSICIAN_COUNTRY on the server or pass them in the request body.",
      });
    }
    if (err.code === "ABI_PARTNER_NAME_REQUIRED") {
      return res.status(400).json({
        message:
          "ABI requires partnerName. Set ABI_PARTNER_NAME on the server or pass partnerName in the request body.",
      });
    }
    if (err.status === 400) {
      if (err.data?.errors) {
        return res.status(400).json({ errors: err.data.errors });
      }
      if (err.data?.message) {
        return res.status(400).json({ message: err.data.message });
      }
    }
    if (err.status === 401) {
      return res.status(502).json({
        message:
          "ABI API rejected credentials. Check ABI_API_KEY or token exchange.",
      });
    }
    if (err.status === 409) {
      return res.status(409).json({
        message: "Idempotency conflict with ABI. Contact support.",
        details: err.data,
      });
    }
    console.error("ABI onboard:", err.message, err.data || err);
    res.status(500).json({
      message: "Could not complete ABI registration.",
      ...(process.env.NODE_ENV !== "production" && { detail: err.message }),
    });
  }
};

const fetchRemoteAbiUser = async (req, res) => {
  try {
    if (!process.env.ABI_API_BASE_URL || !process.env.ABI_API_KEY) {
      return res.status(503).json({ message: "ABI API is not configured." });
    }

    const user = await User.findById(req.user.id);
    if (!user?.abiUserId) {
      return res.status(400).json({ message: "Not onboarded with ABI yet." });
    }

    const remote = await getAbiUser(user.abiUserId);
    res.status(200).json(remote);
  } catch (err) {
    if (err.code === "ABI_NOT_CONFIGURED") {
      return res.status(503).json({ message: "ABI API is not configured." });
    }
    if (err.status) {
      return res.status(err.status).json(err.data || { message: err.message });
    }
    console.error("ABI remote fetch:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getSession,
  onboardUser,
  fetchRemoteAbiUser,
};

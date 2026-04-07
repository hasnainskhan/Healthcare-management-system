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
  const { first_name, last_name } = splitName(user.name);
  const dob = formatDob(user.dateOfBirth) || body.dob;
  if (!dob) {
    const err = new Error("DOB_REQUIRED");
    err.code = "DOB_REQUIRED";
    throw err;
  }

  const consentTs =
    body.consent?.timestamp || new Date().toISOString();
  const consentVer =
    body.consent?.version ||
    process.env.ABI_CONSENT_VERSION ||
    "v1";

  return {
    local_user_id: String(user._id),
    first_name: body.first_name ?? first_name,
    last_name: body.last_name ?? last_name,
    dob,
    email: user.email,
    phone: body.phone ?? user.mobile ?? "",
    address:
      body.address ?? {
        line1: user.city ? String(user.city) : "",
        city: user.city || "",
        postal: body.address?.postal || "",
      },
    consent: { timestamp: consentTs, version: consentVer },
    assessment_form: body.assessment_form ?? {},
    user_type: body.user_type ?? "free",
    payment_status: body.payment_status ?? "not_paid",
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
        abby_user_id: user.abiUserId,
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
      throw e;
    }

    const idempotencyKey = newIdempotencyKey();
    const data = await createAbiUser(payload, idempotencyKey);

    user.abiUserId = data.abby_user_id;
    user.abiInstanceUrl = data.instance_url || null;
    user.abiOnboardIdempotencyKey = idempotencyKey;
    user.abiOnboardedAt = new Date();
    await user.save();

    return res.status(201).json({
      abby_user_id: data.abby_user_id,
      instance_url: data.instance_url,
      widget_url: buildWidgetUrl(data.abby_user_id),
      created_at: data.created_at,
    });
  } catch (err) {
    if (err.code === "ABI_NOT_CONFIGURED") {
      return res.status(503).json({ message: "ABI API is not configured." });
    }
    if (err.status === 400 && err.data?.errors) {
      return res.status(400).json({ errors: err.data.errors });
    }
    if (err.status === 401) {
      return res.status(502).json({
        message: "ABI API rejected credentials. Check ABI_API_KEY.",
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

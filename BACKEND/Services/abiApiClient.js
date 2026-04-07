const crypto = require("crypto");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getConfig() {
  const base = process.env.ABI_API_BASE_URL;
  const key = process.env.ABI_API_KEY;
  if (!base || !key) {
    const err = new Error("ABI API is not configured");
    err.code = "ABI_NOT_CONFIGURED";
    throw err;
  }
  return { base: base.replace(/\/$/, ""), key };
}

/**
 * Low-level ABI HTTP call (no retry).
 */
async function abiFetch(path, init = {}) {
  const { base, key } = getConfig();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Authorization: `Bearer ${key}`,
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

async function abiFetchWithRetry(path, init, options = {}) {
  const delays = options.delays || [500, 1000, 2000, 4000];
  let lastResult;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    lastResult = await abiFetch(path, init);
    const retryable =
      lastResult.status >= 500 && lastResult.status < 600;
    if (!retryable || attempt === delays.length) {
      return lastResult;
    }
    await sleep(delays[attempt]);
  }
  return lastResult;
}

async function createAbiUser(payload, idempotencyKey) {
  const result = await abiFetchWithRetry(
    "/v1/users",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    }
  );

  if (result.status === 201 && result.data?.abby_user_id) {
    return result.data;
  }

  const err = new Error("ABI user creation failed");
  err.status = result.status;
  err.data = result.data;
  throw err;
}

async function getAbiUser(abbyUserId) {
  const id = encodeURIComponent(abbyUserId);
  const result = await abiFetchWithRetry(`/v1/users/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (result.status === 200) {
    return result.data;
  }

  const err = new Error("ABI user fetch failed");
  err.status = result.status;
  err.data = result.data;
  throw err;
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

module.exports = {
  abiFetch,
  createAbiUser,
  getAbiUser,
  newIdempotencyKey,
};

const crypto = require("crypto");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let tokenCache = {
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAtMs: 0,
};

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

async function fetchAccessToken() {
  const { base, key } = getConfig();

  // If cached and valid for at least 30s, reuse it.
  if (
    tokenCache.accessToken &&
    tokenCache.accessTokenExpiresAtMs - Date.now() > 30_000
  ) {
    return tokenCache.accessToken;
  }

  // Try refresh first if we have a refresh token.
  if (tokenCache.refreshToken) {
    const res = await fetch(`${base}/partner/authorization/token/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        refresh_token: tokenCache.refreshToken,
      },
    });
    const text = await res.text();
    if (res.ok) {
      const data = text ? JSON.parse(text) : {};
      tokenCache.accessToken = data.access_token || null;
      tokenCache.refreshToken = data.refresh_token || tokenCache.refreshToken;
      tokenCache.accessTokenExpiresAtMs = Date.now() + 3600 * 1000;
      if (tokenCache.accessToken) return tokenCache.accessToken;
    }
  }

  // Full token request (docs show x-api-key header).
  const res = await fetch(`${base}/partner/authorization/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
  });
  const text = await res.text();
  let data = {};
  try {
    if (text) data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok || !data.access_token) {
    const err = new Error("ABI authentication failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  tokenCache.accessToken = data.access_token;
  tokenCache.refreshToken = data.refresh_token || null;
  tokenCache.accessTokenExpiresAtMs = Date.now() + 3600 * 1000;
  return tokenCache.accessToken;
}

/**
 * Low-level ABI HTTP call (no retry).
 */
async function abiFetch(path, init = {}) {
  const { base } = getConfig();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const accessToken = await fetchAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
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
    try {
      lastResult = await abiFetch(path, init);
    } catch (e) {
      // If auth failed, don't retry here.
      throw e;
    }
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
    "/user",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    }
  );

  if ((result.status === 200 || result.status === 201) && result.data?.uniqueId) {
    return result.data;
  }

  const err = new Error("ABI user creation failed");
  err.status = result.status;
  err.data = result.data;
  throw err;
}

async function getAbiUser(uniqueId) {
  const id = encodeURIComponent(uniqueId);
  // Docs support user search using query params.
  const result = await abiFetchWithRetry(`/user/search?uniqueId=${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (result.status === 200) {
    // Search endpoints typically return an array; normalize.
    if (Array.isArray(result.data)) return result.data[0] || null;
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

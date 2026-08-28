const { ipKeyGenerator } = require("express-rate-limit");

// Which address a rate-limit bucket belongs to.
//
// Cloudflare fronts the origin and nginx does not restore the visitor address, so
// `$remote_addr` — and therefore the X-Forwarded-For entry that `trust proxy: 1` resolves
// req.ip to — is a Cloudflare EDGE address, not the person using the app. Cloudflare pins a
// visitor to an edge, so a single busy session could spend the whole budget for that edge and
// every unrelated user routed through it got 429s across the entire API. That took the app
// down on 2026-08-27.
//
// CF-Connecting-IP carries the true client address. It is trusted ONLY as a bucket key —
// never for authentication or authorization — so the worst a spoofed value can do is let a
// caller dodge their own limit, which rotating IPs would achieve anyway. Falls back to req.ip
// so dev (no Cloudflare) keeps working.
//
// ipKeyGenerator() normalizes IPv6 to a /56 so a single client can't walk its own subnet.
const rateLimitKey = (req) => {
  const forwarded = req.headers["cf-connecting-ip"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.ip || "";
  return ipKeyGenerator(String(ip).trim());
};

module.exports = { rateLimitKey };

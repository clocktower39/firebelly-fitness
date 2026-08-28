// Reproduces the 2026-08-27 outage: with Cloudflare in front, every visitor on the same edge
// shared one rate-limit bucket, so one busy session 429'd everyone else.
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const rateLimit = require("express-rate-limit");
const request = require("supertest");
const { rateLimitKey } = require("../utils/rateLimitKey");

const CF_EDGE = "104.23.195.5";

// Mirrors production: nginx appends the Cloudflare edge to XFF, trust proxy 1 resolves req.ip
// to that edge, and Cloudflare passes the true visitor in CF-Connecting-IP.
const makeApp = (keyGenerator) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: true, legacyHeaders: false, ...(keyGenerator ? { keyGenerator } : {}) }));
  app.get("/ping", (req, res) => res.send("ok"));
  return app;
};

const hit = (app, visitor) =>
  request(app).get("/ping")
    .set("X-Forwarded-For", `${visitor}, ${CF_EDGE}`)
    .set("CF-Connecting-IP", visitor);

test("the bug: without a key generator, one visitor's burst 429s a different visitor", async () => {
  const app = makeApp(null);
  for (let i = 0; i < 3; i += 1) assert.equal((await hit(app, "203.0.113.9")).status, 200);
  const bystander = await hit(app, "198.51.100.7");
  assert.equal(bystander.status, 429, "a different visitor should have been blocked by the shared edge bucket");
});

test("the fix: buckets follow the visitor, so a bystander is unaffected", async () => {
  const app = makeApp(rateLimitKey);
  for (let i = 0; i < 3; i += 1) assert.equal((await hit(app, "203.0.113.9")).status, 200);
  assert.equal((await hit(app, "203.0.113.9")).status, 429, "the heavy visitor should still be limited");
  assert.equal((await hit(app, "198.51.100.7")).status, 200, "an unrelated visitor must not be collateral damage");
});

test("the heavy visitor is still limited on their own budget", async () => {
  const app = makeApp(rateLimitKey);
  const codes = [];
  for (let i = 0; i < 5; i += 1) codes.push((await hit(app, "203.0.113.9")).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

test("falls back to req.ip when Cloudflare is absent (dev, direct origin)", async () => {
  const app = makeApp(rateLimitKey);
  const direct = () => request(app).get("/ping");
  for (let i = 0; i < 3; i += 1) assert.equal((await direct()).status, 200);
  assert.equal((await direct()).status, 429);
});

test("IPv6 visitors are bucketed by /56, not by individual address", () => {
  const a = rateLimitKey({ headers: { "cf-connecting-ip": "2001:db8:1234:5678::1" }, ip: "::1" });
  const b = rateLimitKey({ headers: { "cf-connecting-ip": "2001:db8:1234:56ff::9" }, ip: "::1" });
  assert.equal(a, b, "same /56 should share a bucket so one client can't walk its own subnet");
  const c = rateLimitKey({ headers: { "cf-connecting-ip": "2001:db8:9999:0::1" }, ip: "::1" });
  assert.notEqual(a, c);
});

test("a comma-separated or array header value does not become the key verbatim", () => {
  const k = rateLimitKey({ headers: { "cf-connecting-ip": ["203.0.113.9"] }, ip: CF_EDGE });
  assert.equal(k, "203.0.113.9");
});

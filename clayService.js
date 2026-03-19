// ============================================================
//  services/clayService.js
//  Clay API integration — company enrichment
//  Docs: https://docs.clay.com/
//  API Key is read from: process.env.CLAY_API_KEY
// ============================================================

const axios = require("axios");
const logger = require("./logger");

// ⚠️  Set CLAY_API_KEY and CLAY_WEBHOOK_URL in your .env file
const CLAY_BASE = "https://api.clay.com/v1";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.CLAY_API_KEY}`,
});

// ── Enrich a company domain via Clay ─────────────────────────
// Returns enriched data: company size, LinkedIn URL, tech stack, etc.
async function enrichCompany(domain) {
  try {
    const response = await axios.post(
      `${CLAY_BASE}/enrichment/company`,
      { domain },
      { headers: headers() }
    );
    logger.info(`Clay enriched company: ${domain}`);
    return response.data || {};
  } catch (err) {
    logger.warn(`Clay enrichCompany failed for ${domain}:`, err.response?.data || err.message);
    // Return empty object — enrichment failure should not stop the pipeline
    return {};
  }
}

// ── Enrich a person's LinkedIn profile ───────────────────────
async function enrichLinkedIn(linkedinUrl) {
  try {
    const response = await axios.post(
      `${CLAY_BASE}/enrichment/linkedin`,
      { linkedin_url: linkedinUrl },
      { headers: headers() }
    );
    return response.data || {};
  } catch (err) {
    logger.warn(`Clay enrichLinkedIn failed for ${linkedinUrl}:`, err.message);
    return {};
  }
}

// ── Trigger a Clay table run via webhook (optional) ──────────
// Use this if you have a Clay table that auto-enriches on webhook trigger
async function triggerClayWebhook(payload = {}) {
  const url = process.env.CLAY_WEBHOOK_URL;
  if (!url) {
    logger.warn("CLAY_WEBHOOK_URL not set — skipping Clay webhook trigger");
    return null;
  }
  try {
    const response = await axios.post(url, payload);
    logger.info("Clay webhook triggered successfully");
    return response.data;
  } catch (err) {
    logger.error("Clay webhook trigger failed:", err.message);
    return null;
  }
}

module.exports = { enrichCompany, enrichLinkedIn, triggerClayWebhook };

// ============================================================
//  routes/leads.js
//  GET  /api/leads/recent        — Recent leads from HubSpot
//  POST /api/leads/score         — Score a single lead (test)
//  POST /api/leads/enrich        — Enrich a single domain
// ============================================================

const express = require("express");
const router = express.Router();
const { getRecentContacts } = require("../services/hubspotService");
const { scoreLeadICP } = require("../services/openaiService");
const { enrichCompany } = require("../services/clayService");
const logger = require("../services/logger");

// ── GET /api/leads/recent ────────────────────────────────────
router.get("/recent", async (req, res) => {
  try {
    const contacts = await getRecentContacts(20);
    res.json({ contacts });
  } catch (err) {
    logger.error("GET /leads/recent error:", err.message);
    res.status(500).json({ error: "Failed to fetch recent leads" });
  }
});

// ── POST /api/leads/score ────────────────────────────────────
// Body: { lead: {...}, icpConfig: {...} }
router.post("/score", async (req, res) => {
  const { lead, icpConfig } = req.body;
  if (!lead) return res.status(400).json({ error: "lead is required" });

  try {
    const result = await scoreLeadICP(lead, icpConfig || {});
    res.json(result);
  } catch (err) {
    logger.error("POST /leads/score error:", err.message);
    res.status(500).json({ error: "Scoring failed" });
  }
});

// ── POST /api/leads/enrich ───────────────────────────────────
// Body: { domain: "example.com" }
router.post("/enrich", async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: "domain is required" });

  try {
    const data = await enrichCompany(domain);
    res.json(data);
  } catch (err) {
    logger.error("POST /leads/enrich error:", err.message);
    res.status(500).json({ error: "Enrichment failed" });
  }
});

module.exports = router;

// ============================================================
//  routes/stats.js
//  GET /api/stats  — Dashboard summary stats
// ============================================================

const express = require("express");
const router = express.Router();
const { getLastRunLog } = require("../services/pipelineOrchestrator");
const { getRecentContacts } = require("../services/hubspotService");
const logger = require("../services/logger");

router.get("/", async (req, res) => {
  try {
    const lastRun = getLastRunLog();
    const recentContacts = await getRecentContacts(50);

    // Compute average ICP score from recent contacts
    const scores = recentContacts
      .map((c) => Number(c.properties?.icp_score))
      .filter((s) => !isNaN(s) && s > 0);

    const avgScore =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : 0;

    res.json({
      totalLeadsInCRM: recentContacts.length,
      avgIcpScore: avgScore,
      lastRun: lastRun
        ? {
            date: lastRun.startTime,
            pushed: lastRun.pushed,
            duplicatesSkipped: lastRun.duplicatesSkipped,
            durationSeconds: lastRun.durationSeconds,
          }
        : null,
    });
  } catch (err) {
    logger.error("GET /stats error:", err.message);
    res.status(500).json({ error: "Stats fetch failed" });
  }
});

module.exports = router;

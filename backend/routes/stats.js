const express = require("express");
const router = express.Router();
const { getLastRunLog } = require("../services/pipelineOrchestrator");
const { getRecentContacts } = require("../services/hubspotService");
const { getRunHistory } = require("../services/db");
const logger = require("../services/logger");

router.get("/", async (req, res) => {
  try {
    const [lastRun, recentContacts, history] = await Promise.all([
      getLastRunLog(),
      getRecentContacts(50),
      getRunHistory(5),
    ]);

    const scores = recentContacts
      .map((c) => Number(c.properties?.icp_score))
      .filter((s) => !isNaN(s) && s > 0);

    const avgScore = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : 0;

    res.json({
      totalLeadsInCRM: recentContacts.length,
      avgIcpScore: avgScore,
      lastRun: lastRun ? {
        date: lastRun.startTime,
        pushed: lastRun.pushed,
        duplicatesSkipped: lastRun.duplicatesSkipped,
        durationSeconds: lastRun.durationSeconds,
        fetched: lastRun.fetched,
        enriched: lastRun.enriched,
        scored: lastRun.scored,
        errors: lastRun.errors || [],
      } : null,
      history: history.map(r => ({
        date: r.start_time,
        pushed: r.pushed,
        durationSeconds: r.duration_seconds,
      })),
    });
  } catch (err) {
    logger.error("GET /stats error:", err.message);
    res.status(500).json({ error: "Stats fetch failed" });
  }
});

module.exports = router;

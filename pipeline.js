// ============================================================
//  routes/pipeline.js
//  POST /api/pipeline/run  — Trigger a full agent run
//  GET  /api/pipeline/status — Last run status
// ============================================================

const express = require("express");
const router = express.Router();
const { runFullPipeline, getLastRunLog } = require("../services/pipelineOrchestrator");
const logger = require("../services/logger");

// Track in-progress runs
let isRunning = false;

// ── POST /api/pipeline/run ───────────────────────────────────
// Accepts optional ICP config in the request body
router.post("/run", async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: "A pipeline run is already in progress." });
  }

  const icpConfig = req.body || {};
  logger.info("Manual pipeline run triggered via API");

  // Respond immediately — don't wait for pipeline to finish
  res.json({ message: "Pipeline started", runId: Date.now() });

  // Run async
  isRunning = true;
  try {
    await runFullPipeline(icpConfig);
  } catch (err) {
    logger.error("Pipeline run error:", err.message);
  } finally {
    isRunning = false;
  }
});

// ── GET /api/pipeline/status ─────────────────────────────────
router.get("/status", (req, res) => {
  res.json({
    isRunning,
    lastRun: getLastRunLog(),
  });
});

module.exports = router;

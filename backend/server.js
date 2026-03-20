// ============================================================
//  server.js — B2B Lead Research Agent
//  Express server that orchestrates the full agent pipeline
// ============================================================

require("dotenv").config(); // Loads .env — make sure .env exists!

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const logger = require("./services/logger");

const leadsRouter = require("./routes/leads");
const pipelineRouter = require("./routes/pipeline");
const statsRouter = require("./routes/stats");

const app = express();
const PORT = process.env.PORT || 4000; // ← Change PORT in .env if needed

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "*", // ← Lock this down in production
}));
app.use(express.json());

// Rate limiting — prevents API key abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please slow down." },
});
app.use("/api/", limiter);

// ── Routes ───────────────────────────────────────────────────
app.use("/api/leads", leadsRouter);       // Lead management & enrichment
app.use("/api/pipeline", pipelineRouter); // Trigger full agent run
app.use("/api/stats", statsRouter);       // Dashboard stats

// ── Health check ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Scheduled run (optional) ─────────────────────────────────
// Runs the full pipeline automatically every weekday at 08:00 (server timezone)
// Change the cron expression to match your schedule
// Disable by commenting this block out
cron.schedule("0 8 * * 1-5", async () => {
  logger.info("⏰ Scheduled pipeline run starting...");
  try {
    const { runFullPipeline } = require("./services/pipelineOrchestrator");
    await runFullPipeline({ scheduled: true });
    logger.info("✅ Scheduled pipeline run completed");
  } catch (err) {
    logger.error("❌ Scheduled pipeline run failed:", err.message);
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 B2B Lead Agent backend running on port ${PORT}`);
});


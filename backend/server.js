// ============================================================
//  server.js — B2B Lead Research Agent
//  Express server — serves React frontend + API
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const logger = require("./services/logger");
const { initDB } = require("./services/db");

const leadsRouter = require("./routes/leads");
const pipelineRouter = require("./routes/pipeline");
const statsRouter = require("./routes/stats");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please slow down." },
});
app.use("/api/", limiter);

app.use("/api/leads", leadsRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/stats", statsRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve React frontend
const frontendBuild = path.join(__dirname, "public");
app.use(express.static(frontendBuild));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuild, "index.html"));
});

// Scheduled pipeline — weekdays at 08:00
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

// ── Init DB then start server ────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`🚀 B2B Lead Agent running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("Failed to init DB, starting without DB:", err.message);
    app.listen(PORT, () => {
      logger.info(`🚀 B2B Lead Agent running on port ${PORT} (no DB)`);
    });
  });

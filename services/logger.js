// ============================================================
//  services/logger.js
//  Centralised logging with Winston
// ============================================================

const { createLogger, format, transports } = require("winston");
const path = require("path");

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
        : `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new transports.Console(),
    // Writes logs to /logs/combined.log on your VPS
    new transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
      maxsize: 5 * 1024 * 1024, // 5 MB per file
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
    }),
  ],
});

module.exports = logger;

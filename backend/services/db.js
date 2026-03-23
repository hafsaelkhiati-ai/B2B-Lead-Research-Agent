// ============================================================
//  services/db.js
//  PostgreSQL connection + table setup
//  Uses DATABASE_URL from Railway environment
// ============================================================

const { Pool } = require("pg");
const logger = require("./logger");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway.internal")
    ? false
    : { rejectUnauthorized: false },
});

// ── Create tables if they don't exist ───────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id SERIAL PRIMARY KEY,
        run_id BIGINT UNIQUE,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration_seconds INT,
        fetched INT DEFAULT 0,
        enriched INT DEFAULT 0,
        scored INT DEFAULT 0,
        duplicates_skipped INT DEFAULT 0,
        pushed INT DEFAULT 0,
        config JSONB,
        errors JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        run_id BIGINT,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        title VARCHAR(255),
        company_name VARCHAR(255),
        domain VARCHAR(255),
        industry VARCHAR(255),
        employee_count INT,
        location VARCHAR(255),
        icp_score INT,
        icp_reason TEXT,
        personalised_opener TEXT,
        hubspot_contact_id VARCHAR(50),
        hubspot_company_id VARCHAR(50),
        linkedin_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    logger.info("✅ Database tables ready");
  } catch (err) {
    logger.error("❌ DB init error:", err.message);
    throw err;
  }
}

// ── Save a pipeline run ──────────────────────────────────────
async function saveRun(results) {
  try {
    await pool.query(
      `INSERT INTO pipeline_runs
        (run_id, start_time, end_time, duration_seconds, fetched, enriched, scored, duplicates_skipped, pushed, config, errors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (run_id) DO UPDATE SET
        end_time=$3, duration_seconds=$4, fetched=$5, enriched=$6,
        scored=$7, duplicates_skipped=$8, pushed=$9, errors=$11`,
      [
        results.runId,
        results.startTime,
        results.endTime,
        results.durationSeconds,
        results.fetched,
        results.enriched,
        results.scored,
        results.duplicatesSkipped,
        results.pushed,
        JSON.stringify(results.config),
        JSON.stringify(results.errors),
      ]
    );
  } catch (err) {
    logger.error("DB saveRun error:", err.message);
  }
}

// ── Save individual leads ────────────────────────────────────
async function saveLead(lead, runId) {
  try {
    await pool.query(
      `INSERT INTO leads
        (run_id, first_name, last_name, email, title, company_name, domain,
         industry, employee_count, location, icp_score, icp_reason,
         personalised_opener, hubspot_contact_id, hubspot_company_id, linkedin_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        runId,
        lead.first_name,
        lead.last_name,
        lead.email,
        lead.title,
        lead.company_name,
        lead.domain,
        lead.industry,
        lead.employee_count,
        lead.location,
        lead.icp_score,
        lead.icp_reason,
        lead.personalised_opener,
        lead.contactId || null,
        lead.companyId || null,
        lead.linkedin_url,
      ]
    );
  } catch (err) {
    logger.error("DB saveLead error:", err.message);
  }
}

// ── Get last pipeline run ────────────────────────────────────
async function getLastRun() {
  try {
    const res = await pool.query(
      `SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT 1`
    );
    return res.rows[0] || null;
  } catch (err) {
    logger.error("DB getLastRun error:", err.message);
    return null;
  }
}

// ── Get all runs (history) ───────────────────────────────────
async function getRunHistory(limit = 10) {
  try {
    const res = await pool.query(
      `SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (err) {
    logger.error("DB getRunHistory error:", err.message);
    return [];
  }
}

// ── Get recent leads from DB ─────────────────────────────────
async function getLeadsFromDB(limit = 50) {
  try {
    const res = await pool.query(
      `SELECT * FROM leads ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (err) {
    logger.error("DB getLeads error:", err.message);
    return [];
  }
}

module.exports = { initDB, saveRun, saveLead, getLastRun, getRunHistory, getLeadsFromDB };

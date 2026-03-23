// ============================================================
//  services/pipelineOrchestrator.js
//  Agent brain — Apollo → Clay → OpenAI → HubSpot → DB
// ============================================================

const apolloService = require("./apolloService");
const clayService = require("./clayService");
const openaiService = require("./openaiService");
const hubspotService = require("./hubspotService");
const slackService = require("./slackService");
const db = require("./db");
const logger = require("./logger");

// In-memory fallback (used if DB is down)
let lastRunLog = null;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runFullPipeline(icpConfig = {}) {
  const runId = Date.now();
  const startTime = new Date();

  const config = {
    industries: icpConfig.industries || process.env.ICP_INDUSTRIES?.split(",") || ["SaaS"],
    locations: icpConfig.locations || process.env.ICP_LOCATIONS?.split(",") || ["Morocco"],
    minEmployees: Number(icpConfig.minEmployees || process.env.ICP_MIN_EMPLOYEES || 5),
    maxEmployees: Number(icpConfig.maxEmployees || process.env.ICP_MAX_EMPLOYEES || 100),
    minIcpScore: Number(icpConfig.minIcpScore || 6),
    perPage: Number(icpConfig.perPage || 25),
  };

  const results = {
    runId,
    startTime: startTime.toISOString(),
    config,
    fetched: 0,
    enriched: 0,
    scored: 0,
    duplicatesSkipped: 0,
    pushed: 0,
    leads: [],
    errors: [],
  };

  try {
    // STEP 1: Fetch from Apollo
    const people = await apolloService.searchPeople(config);
    results.fetched = people.length;
    logger.info(`Fetched ${people.length} people from Apollo`);

    for (let i = 0; i < people.length; i++) {
      const person = people[i];

      const lead = {
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        email: person.email || "",
        title: person.title || "",
        linkedin_url: person.linkedin_url || "",
        phone: person.phone_numbers?.[0]?.raw_number || "",
        company_name: person.organization?.name || "",
        domain: person.organization?.website_url?.replace(/https?:\/\//, "") || "",
        industry: person.organization?.industry || "",
        employee_count: person.organization?.estimated_num_employees || 0,
        location: person.organization?.raw_address || "",
        company_linkedin_url: person.organization?.linkedin_url || "",
      };

      // STEP 2: Enrich with Clay
      if (lead.domain) {
        try {
          const clayData = await clayService.enrichCompany(lead.domain);
          Object.assign(lead, {
            employee_count: clayData.employee_count || lead.employee_count,
            linkedin_summary: clayData.linkedin_description || "",
            recent_news: clayData.recent_news || "",
          });
          results.enriched++;
        } catch (e) {
          logger.warn(`Clay failed for ${lead.domain}`);
        }
        await sleep(300);
      }

      // STEP 3: Score with GPT-4o
      const scoring = await openaiService.scoreLeadICP(lead, config);
      lead.icp_score = scoring.icp_score;
      lead.icp_reason = scoring.icp_reason;
      results.scored++;
      await sleep(200);

      if (lead.icp_score < config.minIcpScore) {
        logger.info(`Skipping ${lead.company_name} — score ${lead.icp_score} < ${config.minIcpScore}`);
        continue;
      }

      // STEP 4: Deduplication
      if (lead.email) {
        const exists = await hubspotService.contactExists(lead.email);
        if (exists) {
          results.duplicatesSkipped++;
          continue;
        }
      }

      // STEP 5: Generate opener
      lead.personalised_opener = await openaiService.generatePersonalisedOpener(lead);
      await sleep(200);

      // STEP 6: Push to HubSpot
      const companyId = await hubspotService.upsertCompany(lead);
      const contactId = await hubspotService.createContact(lead, companyId);

      if (contactId) {
        lead.contactId = contactId;
        lead.companyId = companyId;
        results.pushed++;
        results.leads.push(lead);

        // STEP 7: Save lead to DB
        await db.saveLead(lead, runId);
      }

      await sleep(400);
    }

    // STEP 8: Slack alert
    if (results.pushed > 0) {
      const avgScore = results.leads.reduce((s, l) => s + l.icp_score, 0) / results.leads.length;
      await slackService.sendLeadAlert({
        totalAdded: results.pushed,
        avgScore: avgScore.toFixed(1),
        topLeads: results.leads.sort((a, b) => b.icp_score - a.icp_score).slice(0, 3),
      });
    }

    results.endTime = new Date().toISOString();
    results.durationSeconds = Math.round((Date.now() - startTime) / 1000);
    lastRunLog = results;

    // Save run to DB
    await db.saveRun(results);

    logger.info(`Pipeline done. Pushed: ${results.pushed}, Skipped: ${results.duplicatesSkipped}`);
    return results;

  } catch (err) {
    logger.error(`Pipeline fatal error: ${err.message}`);
    results.errors.push(err.message);
    results.endTime = new Date().toISOString();
    lastRunLog = results;
    await db.saveRun(results);
    throw err;
  }
}

async function getLastRunLog() {
  try {
    const dbRun = await db.getLastRun();
    if (dbRun) return {
      runId: dbRun.run_id,
      startTime: dbRun.start_time,
      endTime: dbRun.end_time,
      durationSeconds: dbRun.duration_seconds,
      fetched: dbRun.fetched,
      enriched: dbRun.enriched,
      scored: dbRun.scored,
      duplicatesSkipped: dbRun.duplicates_skipped,
      pushed: dbRun.pushed,
      errors: dbRun.errors || [],
    };
  } catch (e) {
    // fallback to in-memory
  }
  return lastRunLog;
}

module.exports = { runFullPipeline, getLastRunLog };

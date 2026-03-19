// ============================================================
//  services/pipelineOrchestrator.js
//  The agent brain — chains Apollo → Clay → OpenAI → HubSpot
//
//  Pipeline steps:
//  1. Search leads via Apollo
//  2. Enrich each company via Clay
//  3. Score each lead via GPT-4o
//  4. Check HubSpot for duplicates
//  5. Push new leads to HubSpot (Contact + Company)
//  6. Generate personalised opener via GPT-4o
//  7. Send Slack alert
// ============================================================

const apolloService = require("./apolloService");
const clayService = require("./clayService");
const openaiService = require("./openaiService");
const hubspotService = require("./hubspotService");
const slackService = require("./slackService");
const logger = require("./logger");

// In-memory run log (resets on server restart — use a DB for persistence)
let lastRunLog = null;

// ── Helper: sleep between API calls to avoid rate limits ─────
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ── Main pipeline function ───────────────────────────────────
async function runFullPipeline(icpConfig = {}, onProgress = null) {
  const runId = Date.now();
  const startTime = new Date();

  const config = {
    industries: icpConfig.industries || process.env.ICP_INDUSTRIES?.split(",") || ["SaaS", "Manufacturing"],
    locations: icpConfig.locations || process.env.ICP_LOCATIONS?.split(",") || ["Germany"],
    minEmployees: Number(icpConfig.minEmployees || process.env.ICP_MIN_EMPLOYEES || 50),
    maxEmployees: Number(icpConfig.maxEmployees || process.env.ICP_MAX_EMPLOYEES || 5000),
    minIcpScore: Number(icpConfig.minIcpScore || 6), // Only push leads ≥ this score
    perPage: Number(icpConfig.perPage || 25),
  };

  logger.info(`Pipeline run #${runId} started with config: ${JSON.stringify(config)}`);

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

  const emit = (step, data = {}) => {
    if (onProgress) onProgress({ step, ...data });
  };

  try {
    // ── STEP 1: Fetch leads from Apollo ─────────────────────
    emit("fetching", { message: "Searching Apollo for prospects..." });
    const people = await apolloService.searchPeople({
      industries: config.industries,
      locations: config.locations,
      minEmployees: config.minEmployees,
      maxEmployees: config.maxEmployees,
      perPage: config.perPage,
    });
    results.fetched = people.length;
    emit("fetched", { count: people.length });
    logger.info(`Step 1 complete: fetched ${people.length} people`);

    // ── STEP 2–6: Process each lead ──────────────────────────
    for (let i = 0; i < people.length; i++) {
      const person = people[i];

      // Build base lead object from Apollo data
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
        revenue: person.organization?.annual_revenue || "",
        location: person.organization?.raw_address || "",
        company_linkedin_url: person.organization?.linkedin_url || "",
      };

      emit("processing", { index: i + 1, total: people.length, name: `${lead.first_name} ${lead.last_name}` });

      // ── STEP 2: Enrich with Clay ───────────────────────────
      if (lead.domain) {
        try {
          const clayData = await clayService.enrichCompany(lead.domain);
          // Merge Clay enrichment data (non-destructive)
          Object.assign(lead, {
            employee_count: clayData.employee_count || lead.employee_count,
            revenue: clayData.annual_revenue || lead.revenue,
            linkedin_summary: clayData.linkedin_description || "",
            tech_stack: clayData.technologies?.join(", ") || "",
            recent_news: clayData.recent_news || "",
          });
          results.enriched++;
        } catch (e) {
          logger.warn(`Clay enrichment failed for ${lead.domain}: ${e.message}`);
        }
        await sleep(300); // Respect Clay rate limits
      }

      // ── STEP 3: ICP Score via GPT-4o ──────────────────────
      const scoring = await openaiService.scoreLeadICP(lead, config);
      lead.icp_score = scoring.icp_score;
      lead.icp_reason = scoring.icp_reason;
      results.scored++;
      await sleep(200);

      // Filter: skip low-score leads
      if (lead.icp_score < config.minIcpScore) {
        logger.info(`Skipping ${lead.company_name} — ICP score ${lead.icp_score} < ${config.minIcpScore}`);
        continue;
      }

      // ── STEP 4: Deduplication check ───────────────────────
      if (lead.email) {
        const exists = await hubspotService.contactExists(lead.email);
        if (exists) {
          results.duplicatesSkipped++;
          emit("duplicate", { email: lead.email });
          logger.info(`Duplicate skipped: ${lead.email}`);
          continue;
        }
      }

      // ── STEP 5: Generate personalised opener ──────────────
      lead.personalised_opener = await openaiService.generatePersonalisedOpener(lead);
      await sleep(200);

      // ── STEP 6: Push to HubSpot ───────────────────────────
      const companyId = await hubspotService.upsertCompany(lead);
      const contactId = await hubspotService.createContact(lead, companyId);

      if (contactId) {
        results.pushed++;
        results.leads.push({ ...lead, contactId, companyId });
        emit("pushed", { name: `${lead.first_name} ${lead.last_name}`, icp_score: lead.icp_score });
      }

      await sleep(400); // Respect HubSpot rate limits
    }

    // ── STEP 7: Slack alert ────────────────────────────────
    if (results.pushed > 0) {
      const avgScore =
        results.leads.reduce((sum, l) => sum + l.icp_score, 0) / results.leads.length;
      await slackService.sendLeadAlert({
        totalAdded: results.pushed,
        avgScore: avgScore.toFixed(1),
        topLeads: results.leads
          .sort((a, b) => b.icp_score - a.icp_score)
          .slice(0, 3),
      });
    }

    results.endTime = new Date().toISOString();
    results.durationSeconds = Math.round((Date.now() - startTime) / 1000);
    lastRunLog = results;

    logger.info(
      `Pipeline #${runId} done. Pushed: ${results.pushed}, Skipped: ${results.duplicatesSkipped}, Errors: ${results.errors.length}`
    );
    return results;
  } catch (err) {
    logger.error(`Pipeline #${runId} fatal error: ${err.message}`);
    results.errors.push(err.message);
    results.endTime = new Date().toISOString();
    lastRunLog = results;
    throw err;
  }
}

function getLastRunLog() {
  return lastRunLog;
}

module.exports = { runFullPipeline, getLastRunLog };

// ============================================================
//  services/apolloService.js
//  Apollo.io API integration
//  Docs: https://developer.apollo.io/
//  API Key is read from: process.env.APOLLO_API_KEY
// ============================================================

const axios = require("axios");
const logger = require("./logger");

// ── API Base ─────────────────────────────────────────────────
const APOLLO_BASE = "https://api.apollo.io/v1";

// Helper: authenticated headers
// ⚠️  Set APOLLO_API_KEY in your .env file
const headers = () => ({
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
  "X-Api-Key": process.env.APOLLO_API_KEY,
});

// ── Search for people (decision-makers) ─────────────────────
// Returns an array of contacts matching your ICP filters
async function searchPeople({
  industries = [],
  locations = [],
  titles = ["CEO", "CTO", "Head of Sales", "VP Marketing"],
  minEmployees = 50,
  maxEmployees = 5000,
  perPage = 25,
} = {}) {
  try {
    const response = await axios.post(
      `${APOLLO_BASE}/mixed_people/search`,
      {
        api_key: process.env.APOLLO_API_KEY, // Apollo also accepts key in body
        person_titles: titles,
        organization_num_employees_ranges: [`${minEmployees},${maxEmployees}`],
        organization_locations: locations,
        q_organization_keyword_tags: industries,
        page: 1,
        per_page: perPage,
      },
      { headers: headers() }
    );

    const people = response.data?.people || [];
    logger.info(`Apollo: found ${people.length} people`);
    return people;
  } catch (err) {
    logger.error("Apollo searchPeople error:", err.response?.data || err.message);
    throw new Error("Apollo people search failed");
  }
}

// ── Enrich a single person by email ─────────────────────────
async function enrichPerson(email) {
  try {
    const response = await axios.post(
      `${APOLLO_BASE}/people/match`,
      { api_key: process.env.APOLLO_API_KEY, email },
      { headers: headers() }
    );
    return response.data?.person || null;
  } catch (err) {
    logger.error("Apollo enrichPerson error:", err.response?.data || err.message);
    return null;
  }
}

// ── Search organisations (companies) ────────────────────────
async function searchOrganisations({
  industries = [],
  locations = [],
  minEmployees = 50,
  maxEmployees = 5000,
  perPage = 25,
} = {}) {
  try {
    const response = await axios.post(
      `${APOLLO_BASE}/mixed_companies/search`,
      {
        api_key: process.env.APOLLO_API_KEY,
        organization_locations: locations,
        q_organization_keyword_tags: industries,
        organization_num_employees_ranges: [`${minEmployees},${maxEmployees}`],
        page: 1,
        per_page: perPage,
      },
      { headers: headers() }
    );

    const orgs = response.data?.organizations || [];
    logger.info(`Apollo: found ${orgs.length} organisations`);
    return orgs;
  } catch (err) {
    logger.error("Apollo searchOrganisations error:", err.response?.data || err.message);
    throw new Error("Apollo organisation search failed");
  }
}

module.exports = { searchPeople, enrichPerson, searchOrganisations };

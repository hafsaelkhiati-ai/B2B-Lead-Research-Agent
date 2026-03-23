// ============================================================
//  services/apolloService.js
//  Apollo.io People Search — Basic Plan
//  Docs: https://apolloio.github.io/apollo-api-docs/
// ============================================================

const axios = require("axios");
const logger = require("./logger");

async function searchPeople({ industries, locations, minEmployees, maxEmployees, perPage = 25 }) {
  try {
    logger.info(`Apollo search: industries=${industries}, locations=${locations}, employees=${minEmployees}-${maxEmployees}`);

    const response = await axios.post(
      "https://api.apollo.io/api/v1/mixed_people/search",
      {
        per_page: perPage,
        page: 1,
        person_titles: ["CEO", "CTO", "Founder", "Co-Founder", "Head of Sales", "VP Marketing", "CMO", "Director"],
        organization_num_employees_ranges: [`${minEmployees},${maxEmployees}`],
        person_locations: locations,
        organization_industry_tag_ids: [],
        q_organization_keyword_tags: industries,
        contact_email_status: ["verified", "unverified"],
      },
      {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "accept": "application/json",
          "x-api-key": process.env.APOLLO_API_KEY,
        },
      }
    );

    const people = response.data?.people || [];
    logger.info(`Apollo returned ${people.length} people`);

    if (people.length === 0) {
      logger.warn(`Apollo returned 0 results. Check API key and plan limits.`);
      logger.warn(`Response: ${JSON.stringify(response.data).slice(0, 300)}`);
    }

    return people;

  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    logger.error(`Apollo searchPeople error (HTTP ${status}): ${JSON.stringify(data) || err.message}`);
    return [];
  }
}

module.exports = { searchPeople };

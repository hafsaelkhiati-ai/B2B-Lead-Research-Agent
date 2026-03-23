// ============================================================
//  services/apolloService.js
//  Hunter.io Domain Search — replaces Apollo
//  Docs: https://hunter.io/api-documentation/v2
//  Free plan: 25 searches/month
// ============================================================

const axios = require("axios");
const logger = require("./logger");

const HUNTER_KEY = process.env.APOLLO_API_KEY; // reusing same env var

// ── Target company domains to search ────────────────────────
const DOMAIN_SEEDS = {
  "saas": ["notion.so", "monday.com", "hubspot.com", "pipedrive.com", "intercom.com"],
  "ecommerce": ["shopify.com", "bigcommerce.com", "klaviyo.com", "gorgias.com"],
  "marketing agencies": ["wpromote.com", "webfx.com", "ignitevisibility.com", "tinuiti.com"],
  "default": ["salesforce.com", "zendesk.com", "mailchimp.com", "stripe.com", "twilio.com"],
};

async function searchPeople({ industries = [], locations = [], perPage = 25 }) {
  const people = [];

  try {
    let domains = [];
    for (const industry of industries) {
      const key = industry.toLowerCase().trim();
      const matched = DOMAIN_SEEDS[key] || [];
      domains = [...domains, ...matched];
    }
    if (domains.length === 0) domains = DOMAIN_SEEDS["default"];
    domains = [...new Set(domains)].slice(0, Math.min(perPage, 10));

    logger.info(`Hunter.io searching ${domains.length} domains for industries: ${industries.join(", ")}`);

    for (const domain of domains) {
      try {
        const response = await axios.get("https://api.hunter.io/v2/domain-search", {
          params: {
            domain,
            api_key: HUNTER_KEY,
            limit: 5,
            type: "personal",
          },
        });

        const data = response.data?.data;
        if (!data) continue;

        const emails = data.emails || [];
        logger.info(`Hunter.io: ${domain} → ${emails.length} contacts`);

        for (const contact of emails) {
          const title = (contact.position || "").toLowerCase();
          const isDecisionMaker = ["ceo", "cto", "founder", "director", "head", "vp", "chief", "manager", "owner"].some(t => title.includes(t));
          if (!isDecisionMaker && contact.position) continue;

          people.push({
            first_name: contact.first_name || "",
            last_name: contact.last_name || "",
            email: contact.value || "",
            title: contact.position || "",
            linkedin_url: contact.linkedin || "",
            phone_numbers: [],
            organization: {
              name: data.organization || domain,
              website_url: `https://${domain}`,
              industry: industries[0] || "",
              estimated_num_employees: data.company?.size || 0,
              raw_address: data.company?.country || locations[0] || "",
              linkedin_url: "",
              annual_revenue: "",
            },
          });
        }

        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        logger.warn(`Hunter.io failed for ${domain}: ${err.response?.data?.errors?.[0]?.details || err.message}`);
      }
    }

    logger.info(`Hunter.io total people found: ${people.length}`);
    return people;

  } catch (err) {
    logger.error(`Hunter searchPeople error: ${err.message}`);
    return [];
  }
}

module.exports = { searchPeople };

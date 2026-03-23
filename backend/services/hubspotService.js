// ============================================================
//  services/hubspotService.js
//  HubSpot CRM API — create contacts, companies, deduplicate
//  Docs: https://developers.hubspot.com/docs/api/crm
//  Token is read from: process.env.HUBSPOT_ACCESS_TOKEN
//
//  Required HubSpot Private App scopes:
//    crm.objects.contacts.write
//    crm.objects.contacts.read
//    crm.objects.companies.write
//    crm.objects.companies.read
// ============================================================

const axios = require("axios");
const logger = require("./logger");

// ⚠️  Set HUBSPOT_ACCESS_TOKEN in your .env file
const HS_BASE = "https://api.hubapi.com";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
});

// ── Check if contact already exists (deduplication) ─────────
async function contactExists(email) {
  try {
    const response = await axios.post(
      `${HS_BASE}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [{
          filters: [{
            propertyName: "email",
            operator: "EQ",
            value: email,
          }],
        }],
        properties: ["email", "firstname", "lastname"],
        limit: 1,
      },
      { headers: headers() }
    );
    return response.data.total > 0;
  } catch (err) {
    logger.error("HubSpot contactExists error:", err.response?.data || err.message);
    return false;
  }
}

// ── Create or update a Company record ───────────────────────
async function upsertCompany(companyData) {
  const properties = {
    name: companyData.company_name || "",
    domain: companyData.domain || "",
    industry: companyData.industry || "",
    numberofemployees: String(companyData.employee_count || ""),
    annualrevenue: String(companyData.revenue || ""),
    city: companyData.city || "",
    country: companyData.location || "",
    // Custom properties — create these in HubSpot first:
    // HubSpot → Properties → Create Property
    icp_score: String(companyData.icp_score || ""),
    icp_reason: companyData.icp_reason || "",
    linkedin_company_page: companyData.company_linkedin_url || "",
  };

  try {
    // Search for existing company by domain
    const searchRes = await axios.post(
      `${HS_BASE}/crm/v3/objects/companies/search`,
      {
        filterGroups: [{
          filters: [{
            propertyName: "domain",
            operator: "EQ",
            value: companyData.domain,
          }],
        }],
        limit: 1,
      },
      { headers: headers() }
    );

    if (searchRes.data.total > 0) {
      // Update existing
      const existingId = searchRes.data.results[0].id;
      await axios.patch(
        `${HS_BASE}/crm/v3/objects/companies/${existingId}`,
        { properties },
        { headers: headers() }
      );
      logger.info(`HubSpot: Updated company ${companyData.company_name}`);
      return existingId;
    } else {
      // Create new
      const createRes = await axios.post(
        `${HS_BASE}/crm/v3/objects/companies`,
        { properties },
        { headers: headers() }
      );
      logger.info(`HubSpot: Created company ${companyData.company_name}`);
      return createRes.data.id;
    }
  } catch (err) {
    logger.error("HubSpot upsertCompany error:", err.response?.data || err.message);
    return null;
  }
}

// ── Create a Contact record ──────────────────────────────────
async function createContact(contactData, companyId = null) {
  const properties = {
    firstname: contactData.first_name || "",
    lastname: contactData.last_name || "",
    email: contactData.email || "",
    phone: contactData.phone || "",
    jobtitle: contactData.title || "",
    linkedin_url: contactData.linkedin_url || "",  // Custom property
    // Custom properties — create in HubSpot → Properties:
    icp_score: String(contactData.icp_score || ""),
    icp_reason: contactData.icp_reason || "",
    personalised_opener: contactData.personalised_opener || "",
    lead_source: "B2B Lead Agent",
  };

  try {
    const response = await axios.post(
      `${HS_BASE}/crm/v3/objects/contacts`,
      { properties },
      { headers: headers() }
    );
    const contactId = response.data.id;
    logger.info(`HubSpot: Created contact ${contactData.first_name} ${contactData.last_name}`);

    // Associate contact with company if we have a companyId
    if (companyId) {
      await associateContactWithCompany(contactId, companyId);
    }

    return contactId;
  } catch (err) {
    logger.error("HubSpot createContact error:", err.response?.data || err.message);
    return null;
  }
}

// ── Associate contact ↔ company ──────────────────────────────
async function associateContactWithCompany(contactId, companyId) {
  try {
    await axios.put(
      `${HS_BASE}/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/contact_to_company`,
      {},
      { headers: headers() }
    );
  } catch (err) {
    logger.warn("HubSpot association error:", err.response?.data || err.message);
  }
}

// ── Fetch recent contacts (for dashboard stats) ──────────────
async function getRecentContacts(limit = 20) {
  try {
    const response = await axios.get(
      `${HS_BASE}/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,icp_score,lead_source,hs_createdate&sort=-hs_createdate`,
      { headers: headers() }
    );
    return response.data.results || [];
  } catch (err) {
    logger.error("HubSpot getRecentContacts error:", err.message);
    return [];
  }
}

module.exports = {
  contactExists,
  upsertCompany,
  createContact,
  getRecentContacts,
};

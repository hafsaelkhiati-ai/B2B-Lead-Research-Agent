// ============================================================
//  services/openaiService.js
//  GPT-4o ICP scoring + personalised opener generation
//  API Key is read from: process.env.OPENAI_API_KEY
// ============================================================

const OpenAI = require("openai");
const logger = require("./logger");

// ⚠️  Set OPENAI_API_KEY in your .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── ICP Score (1–10) + one-sentence reason ───────────────────
// Pass in the lead object and your ICP criteria config
async function scoreLeadICP(lead, icpConfig = {}) {
  const {
    industries = ["SaaS", "Manufacturing", "Chemical"],
    locations = ["Germany", "Austria", "Switzerland"],
    minEmployees = 50,
    maxEmployees = 5000,
  } = icpConfig;

  const prompt = `
You are a B2B sales analyst. Score this lead's fit with the Ideal Customer Profile (ICP).

ICP Criteria:
- Industries: ${industries.join(", ")}
- Locations: ${locations.join(", ")}
- Company size: ${minEmployees}–${maxEmployees} employees
- Target decision-maker titles: CEO, CTO, Head of Sales, VP Marketing, CMO

Lead Data:
- Company: ${lead.company_name || "Unknown"}
- Industry: ${lead.industry || "Unknown"}
- Location: ${lead.location || "Unknown"}
- Employees: ${lead.employee_count || "Unknown"}
- Contact Title: ${lead.title || "Unknown"}
- LinkedIn: ${lead.linkedin_url || "N/A"}
- Website: ${lead.domain || "N/A"}
- Revenue: ${lead.revenue || "Unknown"}

Return ONLY valid JSON with this exact structure:
{
  "icp_score": <integer 1-10>,
  "icp_reason": "<one sentence explaining the score, max 20 words>"
}
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // ← Model name — update if needed
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    const result = JSON.parse(raw);
    logger.info(`GPT-4o scored ${lead.company_name}: ${result.icp_score}/10`);
    return result;
  } catch (err) {
    logger.error("OpenAI scoreLeadICP error:", err.message);
    return { icp_score: 5, icp_reason: "Could not score — defaulted to 5." };
  }
}

// ── Personalised first-line opener ───────────────────────────
// Generates a one-liner based on the lead's recent news or LinkedIn activity
async function generatePersonalisedOpener(lead) {
  const prompt = `
You are a senior B2B sales copywriter. Write a single personalised opening line 
for a cold outreach email to this contact.

Contact:
- Name: ${lead.first_name} ${lead.last_name}
- Title: ${lead.title}
- Company: ${lead.company_name}
- Industry: ${lead.industry}
- Recent activity or news: ${lead.recent_news || lead.linkedin_summary || "N/A"}
- Company size: ${lead.employee_count} employees

Rules:
- Maximum 25 words
- Sound human, not robotic
- Reference something specific about their company or role
- No "I hope this email finds you well" clichés
- Return ONLY the opening line, no quotes, no explanation

`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 60,
    });

    const opener = completion.choices[0].message.content.trim();
    logger.info(`Generated opener for ${lead.first_name} ${lead.last_name}`);
    return opener;
  } catch (err) {
    logger.error("OpenAI generateOpener error:", err.message);
    return null;
  }
}

module.exports = { scoreLeadICP, generatePersonalisedOpener };

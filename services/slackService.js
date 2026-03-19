// ============================================================
//  services/slackService.js
//  Sends sales alert to Slack when new leads are added
//  Webhook URL is read from: process.env.SLACK_WEBHOOK_URL
// ============================================================

const axios = require("axios");
const logger = require("./logger");

// ⚠️  Set SLACK_WEBHOOK_URL in your .env file
// Create webhook at: https://api.slack.com/messaging/webhooks

async function sendLeadAlert({ totalAdded, avgScore, topLeads = [] }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("REPLACE")) {
    logger.warn("Slack webhook not configured — skipping alert");
    return;
  }

  const topLeadLines = topLeads
    .slice(0, 3)
    .map(
      (l) =>
        `• *${l.first_name} ${l.last_name}* @ ${l.company_name} — ICP Score: ${l.icp_score}/10`
    )
    .join("\n");

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎯 New B2B Leads Added to HubSpot",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Leads Added:*\n${totalAdded}` },
          { type: "mrkdwn", text: `*Avg ICP Score:*\n${avgScore}/10` },
        ],
      },
      topLeadLines && {
        type: "section",
        text: { type: "mrkdwn", text: `*Top Leads:*\n${topLeadLines}` },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_View all leads in <https://app.hubspot.com|HubSpot CRM>_",
        },
      },
    ].filter(Boolean),
  };

  try {
    await axios.post(webhookUrl, payload);
    logger.info("Slack alert sent successfully");
  } catch (err) {
    logger.error("Slack alert failed:", err.message);
  }
}

module.exports = { sendLeadAlert };

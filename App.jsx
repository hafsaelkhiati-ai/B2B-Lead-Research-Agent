// ============================================================
//  src/App.jsx — B2B Lead Research Agent Dashboard
//  Industrial/utilitarian aesthetic — dark command centre
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

// ⚠️  Backend URL comes from .env file (REACT_APP_API_URL)
const API = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

// ── Utility: poll pipeline status ────────────────────────────
let pollInterval = null;

export default function App() {
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runLog, setRunLog] = useState(null);
  const [config, setConfig] = useState({
    industries: "SaaS,Manufacturing,Chemical,Logistics",
    locations: "Germany,Austria,Switzerland",
    minEmployees: 50,
    maxEmployees: 5000,
    minIcpScore: 6,
    perPage: 25,
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  // ── Load dashboard data ─────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/leads/recent`),
      ]);
      setStats(statsRes.data);
      setLeads(leadsRes.data.contacts || []);
    } catch (err) {
      console.error("Load stats error:", err);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/pipeline/status`);
      setIsRunning(res.data.isRunning);
      if (res.data.lastRun) setRunLog(res.data.lastRun);
      if (!res.data.isRunning && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        loadStats();
        showToast("✅ Pipeline run complete!", "success");
      }
    } catch (err) {
      console.error("Status check error:", err);
    }
  }, [loadStats]);

  useEffect(() => {
    loadStats();
    checkStatus();
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [loadStats, checkStatus]);

  // ── Start pipeline run ──────────────────────────────────
  const triggerPipeline = async () => {
    try {
      const icpPayload = {
        industries: config.industries.split(",").map((s) => s.trim()),
        locations: config.locations.split(",").map((s) => s.trim()),
        minEmployees: Number(config.minEmployees),
        maxEmployees: Number(config.maxEmployees),
        minIcpScore: Number(config.minIcpScore),
        perPage: Number(config.perPage),
      };
      await axios.post(`${API}/pipeline/run`, icpPayload);
      setIsRunning(true);
      showToast("🚀 Pipeline started...", "info");
      // Poll every 5s while running
      pollInterval = setInterval(checkStatus, 5000);
    } catch (err) {
      showToast("❌ Failed to start pipeline", "error");
    }
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const scoreColor = (score) => {
    if (score >= 8) return "#00ff9d";
    if (score >= 6) return "#ffd700";
    return "#ff6b6b";
  };

  return (
    <div style={styles.root}>
      {/* ── Grid background ── */}
      <div style={styles.gridBg} />

      {/* ── Toast ── */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "success" ? "#00ff9d22" : toast.type === "error" ? "#ff6b6b22" : "#ffffff11", borderColor: toast.type === "success" ? "#00ff9d" : toast.type === "error" ? "#ff6b6b" : "#888" }}>
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>◈</span>
            <span style={styles.logoText}>LEAD<span style={styles.logoAccent}>AGENT</span></span>
          </div>
          <div style={styles.headerMeta}>B2B Lead Research · DACH Region</div>
        </div>
        <div style={styles.headerRight}>
          <StatusIndicator isRunning={isRunning} />
          <button
            style={{ ...styles.runBtn, opacity: isRunning ? 0.5 : 1 }}
            disabled={isRunning}
            onClick={triggerPipeline}
          >
            {isRunning ? "⟳  RUNNING..." : "▶  RUN PIPELINE"}
          </button>
        </div>
      </header>

      {/* ── Nav ── */}
      <nav style={styles.nav}>
        {["dashboard", "leads", "config"].map((tab) => (
          <button
            key={tab}
            style={{ ...styles.navBtn, ...(activeTab === tab ? styles.navBtnActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* ── Main ── */}
      <main style={styles.main}>

        {/* ─── DASHBOARD TAB ─────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div>
            {/* Stats row */}
            <div style={styles.statsRow}>
              <StatCard label="LEADS IN CRM" value={stats?.totalLeadsInCRM ?? "—"} accent="#00ff9d" />
              <StatCard label="AVG ICP SCORE" value={stats?.avgIcpScore ? `${stats.avgIcpScore}/10` : "—"} accent="#ffd700" />
              <StatCard label="LAST RUN PUSHED" value={stats?.lastRun?.pushed ?? "—"} accent="#00d4ff" />
              <StatCard label="LAST RUN DURATION" value={stats?.lastRun ? `${stats.lastRun.durationSeconds}s` : "—"} accent="#c084fc" />
            </div>

            {/* Last run log */}
            {runLog && (
              <div style={styles.panel}>
                <div style={styles.panelHeader}>LAST RUN LOG</div>
                <div style={styles.logGrid}>
                  <LogRow label="Started" value={runLog.startTime ? new Date(runLog.startTime).toLocaleString() : "—"} />
                  <LogRow label="Fetched" value={runLog.fetched} />
                  <LogRow label="Enriched" value={runLog.enriched} />
                  <LogRow label="Scored" value={runLog.scored} />
                  <LogRow label="Duplicates Skipped" value={runLog.duplicatesSkipped} />
                  <LogRow label="Pushed to HubSpot" value={runLog.pushed} accent="#00ff9d" />
                  <LogRow label="Duration" value={runLog.durationSeconds ? `${runLog.durationSeconds}s` : "—"} />
                </div>
                {runLog.errors?.length > 0 && (
                  <div style={styles.errorBox}>
                    {runLog.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
                  </div>
                )}
              </div>
            )}

            {/* Pipeline flow diagram */}
            <div style={styles.panel}>
              <div style={styles.panelHeader}>PIPELINE ARCHITECTURE</div>
              <PipelineFlow isRunning={isRunning} />
            </div>
          </div>
        )}

        {/* ─── LEADS TAB ─────────────────────────────────── */}
        {activeTab === "leads" && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>RECENT LEADS — HUBSPOT CRM</div>
            {leads.length === 0 ? (
              <div style={styles.emptyState}>No leads found. Run the pipeline to populate CRM.</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {["NAME", "COMPANY", "TITLE", "EMAIL", "ICP SCORE"].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((c, i) => {
                      const p = c.properties || {};
                      const score = Number(p.icp_score) || 0;
                      return (
                        <tr key={i} style={styles.tr}>
                          <td style={styles.td}>{p.firstname} {p.lastname}</td>
                          <td style={styles.td}>{p.company || "—"}</td>
                          <td style={styles.td}>{p.jobtitle || "—"}</td>
                          <td style={{ ...styles.td, color: "#888", fontSize: 12 }}>{p.email || "—"}</td>
                          <td style={styles.td}>
                            {score > 0 ? (
                              <span style={{ ...styles.scoreBadge, background: scoreColor(score) + "22", color: scoreColor(score), borderColor: scoreColor(score) }}>
                                {score}/10
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── CONFIG TAB ────────────────────────────────── */}
        {activeTab === "config" && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>ICP CONFIGURATION</div>
            <div style={styles.configGrid}>
              <ConfigField label="TARGET INDUSTRIES (comma-separated)" value={config.industries} onChange={(v) => setConfig({ ...config, industries: v })} />
              <ConfigField label="TARGET LOCATIONS (comma-separated)" value={config.locations} onChange={(v) => setConfig({ ...config, locations: v })} />
              <ConfigField label="MIN EMPLOYEES" value={config.minEmployees} type="number" onChange={(v) => setConfig({ ...config, minEmployees: v })} />
              <ConfigField label="MAX EMPLOYEES" value={config.maxEmployees} type="number" onChange={(v) => setConfig({ ...config, maxEmployees: v })} />
              <ConfigField label="MIN ICP SCORE TO PUSH (1–10)" value={config.minIcpScore} type="number" onChange={(v) => setConfig({ ...config, minIcpScore: v })} />
              <ConfigField label="LEADS PER RUN" value={config.perPage} type="number" onChange={(v) => setConfig({ ...config, perPage: v })} />
            </div>
            <button style={styles.runBtn} onClick={triggerPipeline} disabled={isRunning}>
              {isRunning ? "⟳  RUNNING..." : "▶  SAVE & RUN PIPELINE"}
            </button>
          </div>
        )}

      </main>

      <footer style={styles.footer}>
        B2B LEAD AGENT · Clay + Apollo + GPT-4o + HubSpot · DACH Market
      </footer>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...styles.statCard, borderColor: accent + "44" }}>
      <div style={{ ...styles.statValue, color: accent }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function LogRow({ label, value, accent }) {
  return (
    <div style={styles.logRow}>
      <span style={styles.logLabel}>{label}</span>
      <span style={{ ...styles.logValue, color: accent || "#e0e0e0" }}>{value}</span>
    </div>
  );
}

function ConfigField({ label, value, onChange, type = "text" }) {
  return (
    <div style={styles.configField}>
      <label style={styles.configLabel}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </div>
  );
}

function StatusIndicator({ isRunning }) {
  return (
    <div style={styles.statusIndicator}>
      <span style={{ ...styles.statusDot, background: isRunning ? "#ffd700" : "#00ff9d", boxShadow: `0 0 8px ${isRunning ? "#ffd700" : "#00ff9d"}` }} />
      <span style={styles.statusText}>{isRunning ? "RUNNING" : "IDLE"}</span>
    </div>
  );
}

function PipelineFlow({ isRunning }) {
  const steps = [
    { icon: "⊙", label: "Apollo", sub: "Find prospects" },
    { icon: "◈", label: "Clay", sub: "Enrich data" },
    { icon: "◎", label: "GPT-4o", sub: "Score & write" },
    { icon: "⊕", label: "HubSpot", sub: "Push to CRM" },
    { icon: "✦", label: "Slack", sub: "Alert sales" },
  ];
  return (
    <div style={styles.flow}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ ...styles.flowStep, borderColor: isRunning ? "#ffd70055" : "#ffffff18" }}>
            <div style={{ ...styles.flowIcon, color: isRunning ? "#ffd700" : "#00ff9d" }}>{s.icon}</div>
            <div style={styles.flowLabel}>{s.label}</div>
            <div style={styles.flowSub}>{s.sub}</div>
          </div>
          {i < steps.length - 1 && <div style={styles.flowArrow}>→</div>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0f",
    color: "#e0e0e0",
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    position: "relative",
    overflow: "hidden",
  },
  gridBg: {
    position: "fixed", inset: 0, zIndex: 0,
    backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  header: {
    position: "relative", zIndex: 10,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "20px 32px",
    borderBottom: "1px solid #ffffff12",
    background: "rgba(10,10,15,0.9)",
    backdropFilter: "blur(10px)",
  },
  headerLeft: { display: "flex", flexDirection: "column", gap: 4 },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { fontSize: 22, color: "#00ff9d" },
  logoText: { fontSize: 20, fontWeight: 700, letterSpacing: 4, color: "#fff" },
  logoAccent: { color: "#00ff9d" },
  headerMeta: { fontSize: 11, color: "#555", letterSpacing: 2 },
  headerRight: { display: "flex", alignItems: "center", gap: 20 },
  nav: {
    display: "flex", gap: 0, padding: "0 32px",
    borderBottom: "1px solid #ffffff12",
    background: "rgba(10,10,15,0.7)",
    position: "relative", zIndex: 10,
  },
  navBtn: {
    background: "none", border: "none", color: "#555",
    padding: "14px 24px", cursor: "pointer",
    fontSize: 11, fontFamily: "inherit", letterSpacing: 2,
    borderBottom: "2px solid transparent",
    transition: "all 0.2s",
  },
  navBtnActive: { color: "#00ff9d", borderBottomColor: "#00ff9d" },
  main: { position: "relative", zIndex: 10, padding: "28px 32px", maxWidth: 1400, margin: "0 auto" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 },
  statCard: {
    background: "#0f0f18", border: "1px solid",
    borderRadius: 4, padding: "24px 20px",
    display: "flex", flexDirection: "column", gap: 8,
  },
  statValue: { fontSize: 32, fontWeight: 700, letterSpacing: -1 },
  statLabel: { fontSize: 10, color: "#555", letterSpacing: 2 },
  panel: { background: "#0f0f18", border: "1px solid #ffffff12", borderRadius: 4, marginBottom: 20 },
  panelHeader: {
    padding: "12px 20px", fontSize: 10, letterSpacing: 3, color: "#555",
    borderBottom: "1px solid #ffffff08", background: "#0a0a12",
  },
  logGrid: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 },
  logRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #ffffff06" },
  logLabel: { fontSize: 11, color: "#555", letterSpacing: 1 },
  logValue: { fontSize: 12, fontWeight: 600 },
  errorBox: { margin: "0 20px 16px", padding: 12, background: "#ff6b6b11", border: "1px solid #ff6b6b33", borderRadius: 3, fontSize: 11, color: "#ff6b6b" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "10px 16px", fontSize: 10, letterSpacing: 2, color: "#555", textAlign: "left", borderBottom: "1px solid #ffffff08", background: "#0a0a12" },
  tr: { borderBottom: "1px solid #ffffff06", transition: "background 0.15s", cursor: "default" },
  td: { padding: "10px 16px", fontSize: 12 },
  scoreBadge: {
    padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 700,
    border: "1px solid", letterSpacing: 1,
  },
  emptyState: { padding: "40px 20px", textAlign: "center", color: "#444", fontSize: 13 },
  configGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: 20 },
  configField: { display: "flex", flexDirection: "column", gap: 6 },
  configLabel: { fontSize: 10, color: "#555", letterSpacing: 2 },
  input: {
    background: "#0a0a12", border: "1px solid #ffffff18", borderRadius: 3,
    color: "#e0e0e0", padding: "10px 12px", fontSize: 13,
    fontFamily: "inherit", outline: "none",
  },
  runBtn: {
    background: "transparent", border: "1px solid #00ff9d",
    color: "#00ff9d", padding: "12px 28px", borderRadius: 3,
    cursor: "pointer", fontSize: 11, fontFamily: "inherit",
    letterSpacing: 2, fontWeight: 700, margin: "0 20px 20px",
    transition: "all 0.2s",
  },
  statusIndicator: { display: "flex", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  statusText: { fontSize: 10, letterSpacing: 2, color: "#888" },
  flow: {
    display: "flex", alignItems: "center", padding: "28px 24px", gap: 8,
    flexWrap: "wrap",
  },
  flowStep: {
    border: "1px solid",
    borderRadius: 4, padding: "16px 20px", minWidth: 110,
    display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
    background: "#0a0a12",
  },
  flowIcon: { fontSize: 20 },
  flowLabel: { fontSize: 12, fontWeight: 700, letterSpacing: 1 },
  flowSub: { fontSize: 10, color: "#555" },
  flowArrow: { fontSize: 18, color: "#333", padding: "0 4px" },
  toast: {
    position: "fixed", top: 24, right: 24, zIndex: 9999,
    padding: "12px 20px", borderRadius: 4, border: "1px solid",
    fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1,
    backdropFilter: "blur(10px)",
  },
  footer: {
    position: "relative", zIndex: 10,
    textAlign: "center", padding: "20px",
    fontSize: 10, color: "#333", letterSpacing: 3,
    borderTop: "1px solid #ffffff06",
  },
};

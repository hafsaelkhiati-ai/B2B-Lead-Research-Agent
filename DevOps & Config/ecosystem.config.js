// ============================================================
//  ecosystem.config.js — PM2 process manager config
//  Usage:
//    pm2 start ecosystem.config.js
//    pm2 save
//    pm2 startup   ← makes it auto-restart on VPS reboot
// ============================================================

module.exports = {
  apps: [
    {
      name: "leadagent-backend",
      script: "./backend/server.js",
      cwd: "/var/www/leadagent",  // ⚠️  Change to your deploy path
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      // Auto-restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      // Logging
      out_file: "/var/www/leadagent/logs/pm2-out.log",
      error_file: "/var/www/leadagent/logs/pm2-error.log",
      merge_logs: true,
    },
  ],
};

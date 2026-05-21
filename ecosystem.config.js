/**
 * PM2 process manifest for the ReputaScan scheduler worker.
 *
 * Deploy on the VM:
 *   1. git pull && npm ci
 *   2. npx prisma migrate deploy
 *   3. pm2 start ecosystem.config.js
 *   4. pm2 save && pm2 startup    # survive reboots
 *
 * Monitor:
 *   pm2 logs reputascan-scheduler
 *   pm2 status
 *   pm2 restart reputascan-scheduler
 *
 * Only ONE instance — the claim mechanism in claimAndExecuteOne() assumes
 * a single worker. If you scale up, switch to a real queue (BullMQ).
 */
module.exports = {
  apps: [
    {
      name: 'reputascan-scheduler',
      script: 'node_modules/.bin/tsx',
      args: 'src/scheduler/runner.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Jakarta',
        QUEUE_POLL_MS: '2000',
        STUCK_RESCUE_MS: '900000',
        // Cron schedule: scan setiap jam 09:00, 12:00, 15:00, 18:00, 21:00, 00:00 WIB
        SCAN_CRON: '0 0,9,12,15,18,21 * * *',
      },
      // Restart with exponential backoff if it keeps crashing
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      // Logs (rotated by pm2-logrotate)
      out_file: './logs/scheduler-out.log',
      error_file: './logs/scheduler-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};

#!/bin/bash
set -e
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
cd /var/www/exclusivesources.online

echo "[autoblog-cron] Starting daily news publishing run at $(date)" >> /var/log/autoblog-cron.log
npx tsx scripts/publish-daily-news.ts >> /var/log/autoblog-cron.log 2>&1

echo "[autoblog-cron] Rebuilding Next.js production build..." >> /var/log/autoblog-cron.log
npm run build >> /var/log/autoblog-cron.log 2>&1

echo "[autoblog-cron] Gracefully reloading PM2 service..." >> /var/log/autoblog-cron.log
pm2 reload exclusivesources >> /var/log/autoblog-cron.log 2>&1

echo "[autoblog-cron] Run completed at $(date)" >> /var/log/autoblog-cron.log

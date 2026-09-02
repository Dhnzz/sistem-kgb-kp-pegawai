#!/bin/sh
# pg_dump backup 02:00 WIB (container runs UTC, cron 19:00 UTC = 02:00 WIB) + rotasi 7 hari
set -e
DATE=$(date +%Y%m%d_%H%M%S)
FILE="/backups/kgb_kp_${DATE}.sql.gz"
echo "[backup] dumping to $FILE"
pg_dump -h postgres -U kgb_user -d kgb_kp | gzip > "$FILE"
echo "[backup] done $FILE ($(du -h "$FILE" | cut -f1))"
# rotasi 7 hari
find /backups -name "kgb_kp_*.sql.gz" -mtime +7 -delete || true
echo "[backup] rotation done, kept:"
ls -lh /backups/kgb_kp_*.sql.gz 2>/dev/null || echo "  (no backups yet)"

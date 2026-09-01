#!/bin/bash
# ============================================================
# Just Joshing Media — NAS Photo Auto-Sync
# Place this script on your UGreen NAS and run via cron.
#
# Cron (every 10 minutes):
#   */10 * * * * /bin/bash /volume1/scripts/sync-nas.sh >> /volume1/logs/photo-sync.log 2>&1
#
# One-time setup on NAS:
#   1. Install git:  opkg install git  (or via UGreen App Center)
#   2. Clone repo:   git clone https://YOUR_TOKEN@github.com/justjoshingmedia/justjoshingmedia.github.io.git /volume1/repo/site
#   3. Install node: opkg install nodejs  (or use Docker node image)
#   4. Make script executable: chmod +x /volume1/scripts/sync-nas.sh
#   5. Add to cron via NAS task scheduler or crontab -e
# ============================================================

REPO="/volume1/repo/site"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# ---- SOURCE FOLDERS ON NAS (your actual photo locations) ----
ELLIS_SRC="/volume1/Photos/Ellis Football 2026"
HHS_SRC="/volume1/Photos/HHS Football 2026"   # update path once confirmed

# ---- DESTINATION INSIDE REPO ----
ELLIS_DEST="$REPO/images/ellis-football"
HHS_DEST="$REPO/images/hhs-football"

# ---- Sync new photos (never overwrites existing) ----
sync_folder() {
  local src="$1"
  local dest="$2"
  local label="$3"
  if [ ! -d "$src" ]; then
    echo "$LOG_PREFIX SKIP $label — folder not found: $src"
    return 0
  fi
  mkdir -p "$dest"
  local count_before=$(ls "$dest"/*.jpg "$dest"/*.jpeg "$dest"/*.JPG "$dest"/*.JPEG 2>/dev/null | wc -l)
  rsync -av --ignore-existing --include="*.jpg" --include="*.jpeg" \
        --include="*.JPG" --include="*.JPEG" --include="*.png" \
        --exclude="*" "$src/" "$dest/" 2>/dev/null
  local count_after=$(ls "$dest"/*.jpg "$dest"/*.jpeg "$dest"/*.JPG "$dest"/*.JPEG 2>/dev/null | wc -l)
  local added=$((count_after - count_before))
  if [ "$added" -gt 0 ]; then
    echo "$LOG_PREFIX $label: +$added new photos (total $count_after)"
    return 1  # signal: changes were made
  fi
  return 0
}

cd "$REPO" || { echo "$LOG_PREFIX ERROR: repo not found at $REPO"; exit 1; }
git pull origin main --quiet

changed=0
sync_folder "$ELLIS_SRC" "$ELLIS_DEST" "Ellis Football" || changed=1
sync_folder "$HHS_SRC"   "$HHS_DEST"   "HHS Football"  || changed=1

if [ "$changed" -eq 1 ]; then
  echo "$LOG_PREFIX Rebuilding data.json..."
  node "$REPO/scripts/gen-data.js"
  git add data.json
  git commit -m "Auto-sync: new football photos from NAS ($(date '+%Y-%m-%d'))"
  git push origin main
  echo "$LOG_PREFIX Done — site will update in ~1 minute."
else
  echo "$LOG_PREFIX No new photos found."
fi

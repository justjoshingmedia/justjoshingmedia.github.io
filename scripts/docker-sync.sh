#!/bin/sh
# Runs inside the Docker container on the NAS.
# Mount HHS photos at /photos/hhs and Ellis photos at /photos/ellis.
# Requires GITHUB_TOKEN env var to be set.

REPO=/repo
HHS_IMG="$REPO/images/hhs-football"
ELLIS_IMG="$REPO/images/ellis-football"

git config --global user.email "joshhodges388@yahoo.com"
git config --global user.name "Josh Hodges"
git config --global --add safe.directory "$REPO"

mkdir -p "$HHS_IMG" "$ELLIS_IMG"

while true; do
  echo "[sync] $(date): Checking for new photos..."

  git -C "$REPO" fetch origin main --quiet
  git -C "$REPO" reset --hard origin/main --quiet

  # Remove any photos previously copied from Media Day subfolders
  find /photos/hhs -ipath '*Media*Day*' -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | while read f; do
    dest="$HHS_IMG/$(basename "$f")"
    [ -f "$dest" ] && rm -f "$dest" && echo "[sync] Removed Media Day photo: $(basename "$f")"
  done

  # Copy all photos from HHS folder tree, skipping Video and Media Day subfolders
  find /photos/hhs -not -path '*/Video/*' -not -ipath '*Media*Day*' -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | while read f; do
    dest="$HHS_IMG/$(basename "$f")"
    [ -f "$dest" ] || cp "$f" "$dest"
  done

  # Copy all photos from Ellis folder tree, skipping Video subfolders
  find /photos/ellis -not -path '*/Video/*' -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | while read f; do
    dest="$ELLIS_IMG/$(basename "$f")"
    [ -f "$dest" ] || cp "$f" "$dest"
  done

  # Rebuild data.json with new photo list
  node "$REPO/scripts/gen-data.js"

  # Commit and push only if something changed
  git -C "$REPO" add data.json
  if ! git -C "$REPO" diff --cached --quiet; then
    git -C "$REPO" commit -m "Auto-sync: new photos from NAS ($(date +%Y-%m-%d))"
    git -C "$REPO" push origin main
    echo "[sync] Pushed new photos to GitHub. Site updates in ~1 minute."
  else
    echo "[sync] No new photos found."
  fi

  sleep 600
done

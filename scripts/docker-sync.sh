#!/bin/sh
# Runs inside the Docker container on the NAS.
# Mount HHS game folder at /photos/hhs and Ellis game folder at /photos/ellis.
# Requires GITHUB_TOKEN env var to be set.

REPO=/repo
HHS_IMG="$REPO/images/hhs-football"
ELLIS_IMG="$REPO/images/ellis-football"

git config --global user.email "joshhodges388@yahoo.com"
git config --global user.name "Josh Hodges"
git config --global --add safe.directory "$REPO"

mkdir -p "$HHS_IMG" "$ELLIS_IMG"

copy_game_folders() {
  src="$1"    # e.g. /photos/hhs
  dest="$2"   # e.g. /repo/images/hhs-football

  find "$src" -mindepth 1 -maxdepth 1 -type d | while read gamedir; do
    gamename=$(basename "$gamedir")
    # Skip Video and Media Day folders
    echo "$gamename" | grep -qi 'video\|media.*day' && continue
    destdir="$dest/$gamename"
    mkdir -p "$destdir"
    find "$gamedir" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | while read f; do
      [ -f "$destdir/$(basename "$f")" ] || cp "$f" "$destdir/$(basename "$f")"
    done
  done
}

while true; do
  echo "[sync] $(date): Checking for new photos..."

  git -C "$REPO" fetch origin main --quiet
  git -C "$REPO" reset --hard origin/main --quiet

  # Keep remote URL using token from env (survives reset --hard)
  git -C "$REPO" remote set-url origin "https://$GITHUB_TOKEN@github.com/justjoshingmedia/justjoshingmedia.github.io.git"

  copy_game_folders /photos/hhs "$HHS_IMG"
  copy_game_folders /photos/ellis "$ELLIS_IMG"

  # Rebuild data.json with new photo list
  node "$REPO/scripts/gen-data.js"

  # Commit and push only if something changed
  git -C "$REPO" add data.json
  if ! git -C "$REPO" diff --cached --quiet; then
    git -C "$REPO" commit -m "Auto-sync: new photos from NAS ($(date +%Y-%m-%d))"
    git -C "$REPO" push origin main && echo "[sync] Pushed new photos to GitHub. Site updates in ~1 minute." || echo "[sync] Push failed — check GITHUB_TOKEN"
  else
    echo "[sync] No new photos found."
  fi

  sleep 600
done

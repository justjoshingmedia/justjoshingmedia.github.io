#!/usr/bin/env node
// NAS auto-sync script: scans image folders and rebuilds data.json gallery entries.
// Run this on your UGreen NAS after photos are dropped into the watch folders.
// Requires Node.js. Cron example: */5 * * * * node /path/to/repo/scripts/gen-data.js

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DATA_FILE = path.join(REPO, 'data.json');

// Map each gallery name to its images folder (relative to repo root).
// Update these paths to match your NAS folder structure once photos are synced.
const GALLERY_FOLDERS = {
  'HHS Football': {
    folder: 'images/hhs-football',
    cover: 'images/hhs-football/cover.jpg',
    sport: 'football',
    prefix: 'HHS'
  },
  'Ellis Football': {
    folder: 'images/ellis-football',
    cover: 'images/ellis-football/cover.jpg',
    sport: 'football',
    prefix: 'ELI'
  }
};

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG']);

function scanPhotos(folderRel, prefix) {
  const folderAbs = path.join(REPO, folderRel);
  if (!fs.existsSync(folderAbs)) return [];
  return fs.readdirSync(folderAbs)
    .filter(f => IMG_EXTS.has(path.extname(f)) && f !== 'cover.jpg' && f !== 'cover.jpeg')
    .sort()
    .map((f, i) => ({
      id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
      file: `${folderRel}/${f}`
    }));
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

data.galleries = Object.entries(GALLERY_FOLDERS).map(([name, cfg]) => ({
  name,
  sport: cfg.sport,
  img: cfg.cover,
  photos: scanPhotos(cfg.folder, cfg.prefix)
}));

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('data.json updated:');
data.galleries.forEach(g => console.log(`  ${g.name}: ${g.photos.length} photos`));

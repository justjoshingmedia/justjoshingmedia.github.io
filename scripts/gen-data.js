#!/usr/bin/env node
// Scans football image folders and updates the football gallery entries in data.json.
// Basketball gallery is preserved unchanged. Run automatically by the Docker sync container.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DATA_FILE = path.join(REPO, 'data.json');

const NAS_BASE = 'https://justjoshing615network.us13.ug.link/photos';

const FOOTBALL_GALLERIES = {
  '2026 HHS Football': { folder: 'images/hhs-football', prefix: 'HHS26', urlFolder: 'hhs-football' },
  '2026 Ellis Football': { folder: 'images/ellis-football', prefix: 'ELI26', urlFolder: 'ellis-football' }
};

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG']);

function scanPhotos(folderRel, urlFolder, prefix) {
  const folderAbs = path.join(REPO, folderRel);
  if (!fs.existsSync(folderAbs)) return [];
  return fs.readdirSync(folderAbs)
    .filter(f => IMG_EXTS.has(path.extname(f)))
    .sort()
    .map((f, i) => ({
      id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
      file: `${NAS_BASE}/${urlFolder}/${f}`
    }));
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Update only football galleries; preserve basketball and any others
data.galleries = data.galleries.map(g => {
  const cfg = FOOTBALL_GALLERIES[g.name];
  if (!cfg) return g;
  const photos = scanPhotos(cfg.folder, cfg.urlFolder, cfg.prefix);
  return {
    ...g,
    img: photos.length > 0 ? photos[0].file : g.img,
    photos
  };
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('data.json updated:');
data.galleries.forEach(g => console.log(`  ${g.name}: ${g.photos.length} photos`));

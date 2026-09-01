#!/usr/bin/env node
// Reads NAS game-folder structure directly to build per-game subgalleries.
// No longer relies on flat local file mapping — works even when game folders
// share filenames (IMG_0001.jpg etc across different games).

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DATA_FILE = path.join(REPO, 'data.json');

const NAS_BASE = 'https://waiver-contained-eur-strap.trycloudflare.com';

const FOOTBALL_GALLERIES = {
  '2026 HHS Football': {
    nasPath: '/photos/hhs',
    prefix: 'HHS26',
    urlFolder: 'hhs-football'
  },
  '2026 Ellis Football': {
    nasPath: '/photos/ellis',
    prefix: 'ELI26',
    urlFolder: 'ellis-football'
  }
};

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG']);

function isExcluded(name) {
  return /video/i.test(name) || /media.*day/i.test(name);
}

function scanPhotos(urlFolder, prefix, nasPath) {
  if (!nasPath || !fs.existsSync(nasPath)) return { photos: [], subgalleries: [] };

  const entries = fs.readdirSync(nasPath, { withFileTypes: true })
    .filter(e => e.isDirectory() && !isExcluded(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!entries.length) return { photos: [], subgalleries: [] };

  const subgalleries = [];
  let gi = 0;

  entries.forEach(entry => {
    const subPath = path.join(nasPath, entry.name);
    const files = fs.readdirSync(subPath)
      .filter(f => IMG_EXTS.has(path.extname(f)))
      .sort();
    if (!files.length) return;
    gi++;
    const photos = files.map((f, i) => ({
      id: `${prefix}-${String(gi).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
      file: `${NAS_BASE}/${urlFolder}/${encodeURIComponent(entry.name)}/${encodeURIComponent(f)}`
    }));
    subgalleries.push({ name: entry.name, photos });
  });

  const photos = subgalleries.flatMap(sg => sg.photos);
  return { photos, subgalleries };
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

data.galleries = data.galleries.map(g => {
  const cfg = FOOTBALL_GALLERIES[g.name];
  if (!cfg) return g;
  const result = scanPhotos(cfg.urlFolder, cfg.prefix, cfg.nasPath);
  return {
    ...g,
    img: result.photos.length > 0 ? result.photos[0].file : g.img,
    photos: result.photos,
    subgalleries: result.subgalleries.length > 0 ? result.subgalleries : undefined
  };
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('data.json updated:');
data.galleries.forEach(g => {
  const sub = g.subgalleries ? ` (${g.subgalleries.length} games)` : '';
  console.log(`  ${g.name}: ${(g.photos || []).length} photos${sub}`);
});

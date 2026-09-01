#!/usr/bin/env node
// Scans football image folders and updates the football gallery entries in data.json.
// Basketball gallery is preserved unchanged. Run automatically by the Docker sync container.
// When NAS source paths are mounted, uses NAS folder structure to create per-game sub-galleries.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DATA_FILE = path.join(REPO, 'data.json');

const NAS_BASE = 'https://waiver-contained-eur-strap.trycloudflare.com';

const FOOTBALL_GALLERIES = {
  '2026 HHS Football': {
    folder: 'images/hhs-football',
    nasPath: '/photos/hhs',
    prefix: 'HHS26',
    urlFolder: 'hhs-football'
  },
  '2026 Ellis Football': {
    folder: 'images/ellis-football',
    nasPath: '/photos/ellis',
    prefix: 'ELI26',
    urlFolder: 'ellis-football'
  }
};

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG']);

function isExcluded(name) {
  return /video/i.test(name) || /media.*day/i.test(name);
}

function scanPhotos(folderRel, urlFolder, prefix, nasPath) {
  const folderAbs = path.join(REPO, folderRel);
  if (!fs.existsSync(folderAbs)) return { photos: [], subgalleries: [] };

  // Flat list of all local image files
  const allFiles = fs.readdirSync(folderAbs)
    .filter(f => IMG_EXTS.has(path.extname(f)))
    .sort();

  if (allFiles.length === 0) return { photos: [], subgalleries: [] };

  // If NAS source is available, use its folder structure to build sub-galleries
  if (nasPath && fs.existsSync(nasPath)) {
    const folderMap = new Map(); // filename -> subfolder name
    const folderOrder = []; // preserve directory order

    const entries = fs.readdirSync(nasPath, { withFileTypes: true });
    entries.forEach(entry => {
      if (!entry.isDirectory() || isExcluded(entry.name)) return;
      const subPath = path.join(nasPath, entry.name);
      folderOrder.push(entry.name);
      fs.readdirSync(subPath)
        .filter(f => IMG_EXTS.has(path.extname(f)))
        .forEach(f => folderMap.set(f, entry.name));
    });

    // Group local flat files by their NAS subfolder
    const grouped = new Map(); // subfolder -> [filename]
    const unassigned = [];
    allFiles.forEach(f => {
      const folder = folderMap.get(f);
      if (folder) {
        if (!grouped.has(folder)) grouped.set(folder, []);
        grouped.get(folder).push(f);
      } else {
        unassigned.push(f);
      }
    });

    // Build subgalleries in NAS folder order
    const subgalleries = [];
    folderOrder.forEach((folderName, gi) => {
      const files = grouped.get(folderName);
      if (!files || files.length === 0) return;
      const photos = files.map((f, i) => ({
        id: `${prefix}-${String(gi + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
        file: `${NAS_BASE}/${urlFolder}/${f}`
      }));
      subgalleries.push({ name: folderName, photos });
    });

    if (unassigned.length > 0) {
      const photos = unassigned.map((f, i) => ({
        id: `${prefix}-00-${String(i + 1).padStart(3, '0')}`,
        file: `${NAS_BASE}/${urlFolder}/${f}`
      }));
      subgalleries.push({ name: 'Other', photos });
    }

    const photos = subgalleries.flatMap(sg => sg.photos);
    return { photos, subgalleries };
  }

  // No NAS path available — just flat list
  const photos = allFiles.map((f, i) => ({
    id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
    file: `${NAS_BASE}/${urlFolder}/${f}`
  }));
  return { photos, subgalleries: [] };
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

data.galleries = data.galleries.map(g => {
  const cfg = FOOTBALL_GALLERIES[g.name];
  if (!cfg) return g;
  const result = scanPhotos(cfg.folder, cfg.urlFolder, cfg.prefix, cfg.nasPath);
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
  console.log(`  ${g.name}: ${g.photos.length} photos${sub}`);
});

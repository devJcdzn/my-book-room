import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceRoot = path.join(root, 'output/sprites-v2');
const output = path.join(root, 'assets/isometric-room');
const TILE = 64;
const MARGIN = 8;
const OUTLINE = '#49372f';
const ROTATIONS = [0, 90, 180, 270];
const viewTurns = new Map([
  ['frente-direita', 0], ['frente-esquerda', 90],
  ['costas-esquerda', 180], ['costas-direita', 270],
]);
const itemKeys = {
  mesa: 'desk', cadeira: 'seat', estante: 'bookcase', luminaria: 'lamp',
  planta: 'plant', tapete: 'rug', quadro: 'frame', almofada: 'pillow', gato: 'cat',
};
const profiles = {
  desk: { materials: ['wood', 'woodShade', 'paper'], prototypes: [[229, 155, 84], [128, 64, 32], [240, 224, 192]] },
  seat: { materials: ['wood', 'paper', 'woodShade'], prototypes: [[192, 112, 32], [240, 224, 192], [96, 48, 16]] },
  bookcase: { materials: ['wood', 'woodShade', 'paper'], prototypes: [[182, 133, 84], [128, 80, 48], [240, 208, 144]] },
  lamp: { materials: ['paper', 'wood', 'woodShade'], prototypes: [[216, 193, 160], [192, 128, 80], [96, 48, 16]] },
  plant: { materials: ['leaf', 'ceramic', 'soil'], prototypes: [[128, 155, 115], [200, 185, 166], [82, 105, 79]] },
  rug: { materials: ['fabric', 'accent', 'paper'], prototypes: [[144, 119, 128], [224, 176, 144], [192, 176, 160]] },
  frame: { materials: ['wood', 'paper', 'accent'], prototypes: [[128, 80, 48], [240, 224, 192], [204, 111, 71]] },
  pillow: { materials: ['fabric', 'accent', 'paper'], prototypes: [[121, 136, 175], [69, 83, 116], [160, 176, 200]] },
  cat: { materials: ['fur', 'accent', 'paper'], prototypes: [[240, 208, 176], [208, 144, 80], [240, 224, 192]] },
  bookLying: { materials: ['accent', 'paper', 'wood'], prototypes: [[120, 140, 92], [240, 224, 192], [80, 80, 48]] },
  bookStanding: { materials: ['accent', 'paper', 'wood'], prototypes: [[120, 140, 92], [240, 224, 192], [80, 80, 48]] },
};
const dayPalette = {
  wood: '#e59b54', woodShade: '#805030', paper: '#f0e0c0', accent: '#cc7048',
  fabric: '#907780', ceramic: '#c8b9a6', metal: '#c08b50', soil: '#52694f',
  leaf: '#809b73', glass: '#91b6b5', fur: '#f0d0b0', ink: OUTLINE,
};
const nightPalette = {
  wood: '#775a42', woodShade: '#563f30', paper: '#c6b99e', accent: '#a75d4b',
  fabric: '#71585e', ceramic: '#a7987d', metal: '#6c5a48', soil: '#514434',
  leaf: '#56654e', glass: '#526f76', fur: '#c5ad83', ink: OUTLINE,
};
const seed = [
  ['desk', [0, 0, 0], 0], ['seat', [-0.5, 0, 1.5], 180], ['bookcase', [2.5, 0, -3.5], 0],
  ['lamp', [-2, 0, -0.5], 0], ['plant', [3, 0, -2], 0], ['rug', [0, 0.015, 0.5], 0],
  ['cat', [3.5, 0, 3.5], 0], ['window', [-3.88, 1, -1.5], 90],
  ['frame', [-1.5, 1.65, -3.88], 0], ['frame', [-3.88, 1.5, 0.5], 90], ['deskPlant', [0.5, 0.88, 0], 0],
];

function colorDistance(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function luminance([r, g, b]) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function hexRgb(value) {
  return [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16));
}

function materialIndex(rgb, prototypeList) {
  let selected = 0;
  let nearest = Number.POSITIVE_INFINITY;
  prototypeList.forEach((prototype, index) => {
    const distance = colorDistance(rgb, prototype);
    if (distance < nearest) { nearest = distance; selected = index; }
  });
  const brightness = Math.max(0.62, Math.min(1.18, luminance(rgb) / luminance(prototypeList[selected])));
  return { selected, brightness };
}

async function readSprite(sourceManifest, entry) {
  const source = path.join(sourceRoot, entry.file);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== entry.width || info.height !== entry.height) throw new Error(`Dimensions changed for ${entry.file}`);
  if (data[3] !== 0 || data[(info.width - 1) * 4 + 3] !== 0 || data[(info.height * info.width - 1) * 4 + 3] !== 0) {
    throw new Error(`Expected transparent corners in ${entry.file}`);
  }
  return { entry, data: Buffer.from(data), width: info.width, height: info.height };
}

function normalizeGroup(sprites) {
  // Preserve source scale while guaranteeing eight transparent pixels around
  // the artwork, including edges with antialiasing coverage.
  const width = Math.max(...sprites.map(sprite => sprite.width)) + 2;
  const height = Math.max(...sprites.map(sprite => sprite.height)) + 2;
  const pivot = [
    sprites[0].entry.pivot[0] + 1,
    Math.round(Math.max(...sprites.map(sprite => sprite.entry.pivot[1]))) + 1,
  ];
  return {
    width,
    height,
    pivot,
    sprites: sprites.map(sprite => {
      const left = Math.round(pivot[0] - sprite.entry.pivot[0]);
      const top = Math.round(pivot[1] - sprite.entry.pivot[1]);
      const data = Buffer.alloc(width * height * 4);
      for (let y = 0; y < sprite.height; y++) {
        const sourceOffset = y * sprite.width * 4;
        const targetOffset = ((y + top) * width + left) * 4;
        sprite.data.copy(data, targetOffset, sourceOffset, sourceOffset + sprite.width * 4);
      }
      return { ...sprite, data, width, height, offset: [left, top], pivot };
    }),
  };
}

function colorPlanes(data, materials, prototypeList) {
  const count = data.length / 4;
  const mask = Buffer.alloc(data.length);
  const line = Buffer.alloc(data.length);
  const hit = Buffer.alloc(data.length);
  const night = Buffer.alloc(data.length);
  const nightColors = materials.map(material => hexRgb(nightPalette[material] ?? nightPalette.paper));
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    const rgb = [data[offset], data[offset + 1], data[offset + 2]];
    const alpha = data[offset + 3];
    if (!alpha) continue;
    hit[offset] = hit[offset + 1] = hit[offset + 2] = 255;
    hit[offset + 3] = alpha;
    if (luminance(rgb) <= 58) {
      line[offset] = rgb[0]; line[offset + 1] = rgb[1]; line[offset + 2] = rgb[2]; line[offset + 3] = alpha;
      night[offset] = rgb[0]; night[offset + 1] = rgb[1]; night[offset + 2] = rgb[2]; night[offset + 3] = alpha;
      continue;
    }
    const { selected, brightness } = materialIndex(rgb, prototypeList);
    mask[offset + selected] = Math.round(255 * Math.min(1, brightness));
    mask[offset + 3] = alpha;
    const shade = nightColors[selected];
    night[offset] = Math.min(255, Math.round(shade[0] * brightness));
    night[offset + 1] = Math.min(255, Math.round(shade[1] * brightness));
    night[offset + 2] = Math.min(255, Math.round(shade[2] * brightness));
    night[offset + 3] = alpha;
  }
  return { mask, line, hit, night };
}

async function writeRaw(file, data, width, height) {
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(path.join(output, file));
}

async function writeShadow(prefix, canvas, pivot, footprint, heightTiles, wall = false) {
  const span = footprint[0] + footprint[1];
  const rx = Math.max(5, (TILE / 2) * span * 0.36);
  const ry = Math.max(3, (TILE / 4) * span * 0.32);
  const ellipse = wall
    ? `<ellipse cx="${pivot[0]}" cy="${pivot[1] - heightTiles * TILE * 0.22}" rx="${Math.max(4, rx * 0.16)}" ry="${Math.max(8, heightTiles * TILE * 0.3)}" fill="#30231d" fill-opacity=".14"/>`
    : `<ellipse cx="${pivot[0]}" cy="${pivot[1]}" rx="${rx}" ry="${ry}" fill="#30231d" fill-opacity=".2"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">${ellipse}</svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(output, `${prefix}-shadow.png`), buffer);
}

function projectedPhotoSocket(turn, sprite, entry) {
  if (turn > 90) return {};
  const local = turn === 0
    ? [[11, 13], [25, 17], [24, 44], [11, 39]]
    : [[14, 17], [28, 11], [28, 40], [14, 45]];
  const quad = local.map(([x, y]) => [x + sprite.offset[0], y + sprite.offset[1]]);
  if (quad.some(([x, y]) => x < 0 || x > sprite.width || y < 0 || y > sprite.height)) return {};
  return { photo: { quad } };
}

function outputFiles(prefix) {
  return {
    file: `${prefix}.png`, nightFile: `${prefix}-night.png`, lineFile: `${prefix}-line.png`,
    shadowFile: `${prefix}-shadow.png`, hitMaskFile: `${prefix}-hit.png`, runtimeMaskFile: `${prefix}-materials.png`,
  };
}

async function buildFamily(key, entries, materialProfile) {
  const sprites = await Promise.all(entries.map(entry => readSprite(null, entry)));
  const normalized = normalizeGroup(sprites);
  const outputEntries = [];
  for (let index = 0; index < normalized.sprites.length; index++) {
    const sprite = normalized.sprites[index];
    const sourceEntry = sprite.entry;
    const turn = viewTurns.get(sourceEntry.view);
    const prefix = key === 'bookLying' || key === 'bookStanding'
      ? `book-${key === 'bookLying' ? 'lying' : 'standing'}-${turn}`
      : `${key}-${turn}`;
    const files = outputFiles(prefix);
    const layers = colorPlanes(sprite.data, materialProfile.materials, materialProfile.prototypes);
    await Promise.all([
      writeRaw(files.file, sprite.data, normalized.width, normalized.height),
      writeRaw(files.nightFile, layers.night, normalized.width, normalized.height),
      writeRaw(files.lineFile, layers.line, normalized.width, normalized.height),
      writeRaw(files.hitMaskFile, layers.hit, normalized.width, normalized.height),
      writeRaw(files.runtimeMaskFile, layers.mask, normalized.width, normalized.height),
      writeShadow(prefix, normalized, normalized.pivot, sourceEntry.footprint, sourceEntry.height_tiles, key === 'frame'),
    ]);
    const isBook = key === 'bookLying' || key === 'bookStanding';
    const turnIndex = turn / 90;
    const footprint = turnIndex % 2 === 0 ? sourceEntry.footprint : [...sourceEntry.footprint].reverse();
    outputEntries.push({
      key: isBook ? (key === 'bookLying' ? 'book-lying' : 'book-standing') : key,
      category: isBook ? 'book' : key,
      ...files,
      width: normalized.width,
      height: normalized.height,
      tilePixels: TILE,
      footprint,
      heightTiles: sourceEntry.height_tiles,
      pivot: normalized.pivot,
      orientationDegrees: turn,
      turn,
      materials: materialProfile.materials,
      runtimeMaterials: materialProfile.materials,
      sourceFile: sourceEntry.file,
      sourceView: sourceEntry.view,
      sourceScale: sourceEntry.uniform_scale,
      sourceOffset: sprite.offset,
      sockets: key === 'frame' ? projectedPhotoSocket(turn, sprite, sourceEntry) : {},
    });
  }
  return { entries: outputEntries, ...normalized };
}

async function buildCat(entries) {
  const sprites = await Promise.all(entries.map(entry => readSprite(null, entry)));
  const normalized = normalizeGroup(sprites);
  const frames = [];
  for (const sprite of normalized.sprites) {
    const turn = viewTurns.get(sprite.entry.view);
    const frame = sprite.entry.frame;
    const prefix = `cat-${turn}-${String(frame).padStart(2, '0')}`;
    const files = outputFiles(prefix);
    const layers = colorPlanes(sprite.data, profiles.cat.materials, profiles.cat.prototypes);
    await Promise.all([
      writeRaw(files.file, sprite.data, normalized.width, normalized.height),
      writeRaw(files.nightFile, layers.night, normalized.width, normalized.height),
      writeRaw(files.lineFile, layers.line, normalized.width, normalized.height),
      writeRaw(files.hitMaskFile, layers.hit, normalized.width, normalized.height),
      writeRaw(files.runtimeMaskFile, layers.mask, normalized.width, normalized.height),
      writeShadow(prefix, normalized, normalized.pivot, sprite.entry.footprint, sprite.entry.height_tiles),
    ]);
    frames.push({
      key: 'cat', category: 'cat', ...files, turn, frame,
      width: normalized.width, height: normalized.height, tilePixels: TILE,
      materials: profiles.cat.materials, runtimeMaterials: profiles.cat.materials,
      sockets: {},
      pivot: normalized.pivot, footprint: sprite.entry.footprint,
      heightTiles: sprite.entry.height_tiles, sourceFile: sprite.entry.file,
      sourceView: sprite.entry.view, sourceDurationMs: sprite.entry.duration_ms,
      sourceOffset: sprite.offset,
    });
  }
  for (const turn of ROTATIONS) {
    const group = frames.filter(frame => frame.turn === turn);
    const rows = await Promise.all(group.map(async frame => {
      const { data, info } = await sharp(path.join(output, frame.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let y = info.height - 1; y >= 0; y--) {
        for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 8) return y;
      }
      return -1;
    }));
    const baseline = Math.max(...rows);
    for (let index = 0; index < group.length; index++) {
      const offset = baseline - rows[index];
      if (!offset) continue;
      for (const file of [group[index].file, group[index].nightFile, group[index].lineFile, group[index].hitMaskFile, group[index].runtimeMaskFile]) {
        const source = path.join(output, file);
        const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const moved = Buffer.alloc(data.length);
        const rowBytes = info.width * 4;
        for (let y = 0; y < info.height - offset; y++) data.copy(moved, (y + offset) * rowBytes, y * rowBytes, (y + 1) * rowBytes);
        await writeRaw(file, moved, info.width, info.height);
      }
    }
  }
  return { width: normalized.width, height: normalized.height, pivot: normalized.pivot, frames };
}

function familyAssetModule() {
  const lines = [
    '// Generated by scripts/generate-isometric-room.mjs. Asset requires stay static for Metro.',
    'const catAssets = {',
  ];
  for (const [property, suffix] of [['views', ''], ['lines', '-line'], ['shadows', '-shadow'], ['hits', '-hit'], ['masks', '-materials']]) {
    lines.push(`  ${property}: [`);
    for (const turn of ROTATIONS) for (let frame = 0; frame < 4; frame++) {
      lines.push(`    require('@/assets/isometric-room/cat-${turn}-${String(frame).padStart(2, '0')}${suffix}.png'),`);
    }
    lines.push('  ],');
  }
  lines.push(`  materials: [${profiles.cat.materials.map(value => `'${value}'`).join(', ')}],`);
  lines.push('} as const;');
  lines.push('export const CAT_ASSETS = { orange: catAssets, black: catAssets, gray: catAssets } as const;');
  return `${lines.join('\n')}\n`;
}

async function makeRoomPreviews(assets, cat, books) {
  const lookup = (key, turn) => assets.find(asset => asset.key === key && asset.turn === turn);
  for (const size of [8, 10, 12]) for (const isNight of [false, true]) {
    const half = size / 2;
    const tile = Math.min(46, 380 / size);
    const width = 520, height = 610, origin = { x: width / 2, y: 285 };
    const project = (x, y, z) => [origin.x + (x - z) * tile / 2, origin.y + (x + z) * tile / 4 - y * tile * 2 / 3];
    const polygon = points => `M ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`;
    const floor = [[-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half]].map(point => project(...point));
    const back = [[-half, 3.5, -half], [half, 3.5, -half], [half, 0, -half], [-half, 0, -half]].map(point => project(...point));
    const left = [[-half, 3.5, -half], [-half, 3.5, half], [-half, 0, half], [-half, 0, -half]].map(point => project(...point));
    const colors = isNight
      ? { back: '#4b4952', left: '#3e3c45', floor: '#605449', line: '#897968', ground: '#302f38' }
      : { back: '#2a3045', left: '#202536', floor: '#ddcfb9', line: '#b7a58d', ground: '#efe6d8' };
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="100%" height="100%" fill="${colors.ground}"/>`,
      `<path d="${polygon(back)}" fill="${colors.back}" stroke="${OUTLINE}" stroke-width="3"/>`,
      `<path d="${polygon(left)}" fill="${colors.left}" stroke="${OUTLINE}" stroke-width="3"/>`,
      `<path d="${polygon(floor)}" fill="${colors.floor}" stroke="${OUTLINE}" stroke-width="3"/>`,
    ];
    for (let index = -half; index <= half; index++) {
      const a = project(index, 0, -half), b = project(index, 0, half);
      const c = project(-half, 0, index), d = project(half, 0, index);
      svg.push(`<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]} M${c[0]} ${c[1]} L${d[0]} ${d[1]}" stroke="${colors.line}" stroke-width="1" opacity=".4"/>`);
    }
    const sorted = [...seed].sort((a, b) => a[0] === 'rug' ? -1 : b[0] === 'rug' ? 1 : (a[1][0] + a[1][2]) - (b[1][0] + b[1][2]));
    for (const [category, position, turn] of sorted) {
      const key = category === 'deskPlant' ? 'plant' : category;
      const catFrame = category === 'cat' ? cat.frames.find(frame => frame.turn === turn && frame.frame === 0) : null;
      const asset = category === 'cat' ? catFrame : lookup(key, turn);
      if (!asset) continue;
      const base = category === 'cat' ? asset.file : asset.file;
      const file = isNight ? base.replace('.png', '-night.png') : base;
      const image = (await fs.readFile(path.join(output, file))).toString('base64');
      const [x, y, z] = category === 'deskPlant' ? [0.4, 0.88, -0.2] : position;
      const [ax, ay] = project(x, y, z);
      const scale = tile / asset.tilePixels * (category === 'deskPlant' ? 0.5 : 1);
      svg.push(`<image href="data:image/png;base64,${image}" x="${ax - asset.pivot[0] * scale}" y="${ay - asset.pivot[1] * scale}" width="${asset.width * scale}" height="${asset.height * scale}"/>`);
    }
    const book = books.lying.files[0];
    const bookBase = isNight ? book.nightFile : book.file;
    const bookImage = (await fs.readFile(path.join(output, bookBase))).toString('base64');
    const bookPoint = project(0.05, 0.94, -0.22);
    const bookScale = tile / book.tilePixels;
    svg.push(`<image href="data:image/png;base64,${bookImage}" x="${bookPoint[0] - book.pivot[0] * bookScale}" y="${bookPoint[1] - book.pivot[1] * bookScale}" width="${book.width * bookScale}" height="${book.height * bookScale}"/>`);
    svg.push('</svg>');
    await sharp(Buffer.from(svg.join(''))).png().toFile(path.join(output, `seed-${size}-${isNight ? 'night' : 'day'}.png`));
  }
}

async function main() {
  const sourceManifest = JSON.parse(await fs.readFile(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  await fs.mkdir(output, { recursive: true });
  const manifestPath = path.join(output, 'manifest.json');
  const previous = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const windowAssets = previous.assets.filter(asset => asset.key === 'window').map(asset => ({ ...asset, tilePixels: 192 }));
  for (const file of await fs.readdir(output)) {
    if (/^(desk|seat|bookcase|lamp|plant|rug|frame|pillow|book|cat)-/.test(file)) await fs.unlink(path.join(output, file));
  }

  const assets = [];
  const families = {};
  for (const [sourceItem, key] of Object.entries(itemKeys)) {
    if (sourceItem === 'gato') continue;
    const familyEntries = sourceManifest.entries
      .filter(entry => entry.item === sourceItem && entry.frame === null)
      .sort((a, b) => viewTurns.get(a.view) - viewTurns.get(b.view));
    const result = await buildFamily(key, familyEntries, profiles[key]);
    families[key] = {
      footprint: familyEntries[0].footprint,
      heightTiles: familyEntries[0].height_tiles,
      width: result.width,
      height: result.height,
      pivot: result.pivot,
      tilePixels: TILE,
      runtimeMaterials: profiles[key].materials,
      files: result.entries,
    };
    assets.push(...result.entries);
  }

  const catEntries = sourceManifest.entries.filter(entry => entry.item === 'gato').sort((a, b) =>
    viewTurns.get(a.view) - viewTurns.get(b.view) || a.frame - b.frame,
  );
  const cat = await buildCat(catEntries);
  const bookAssets = {};
  for (const [key, kind] of [['bookLying', 'lying'], ['bookStanding', 'standing']]) {
    const bookEntries = sourceManifest.entries.filter(entry => entry.item === 'livro' && entry.file.includes(kind === 'lying' ? 'deitado' : 'em-pe'))
      .sort((a, b) => viewTurns.get(a.view) - viewTurns.get(b.view));
    const result = await buildFamily(key, bookEntries, profiles[key]);
    bookAssets[kind] = {
      footprint: bookEntries[0].footprint,
      heightTiles: bookEntries[0].height_tiles,
      width: result.width,
      height: result.height,
      pivot: result.pivot,
      tilePixels: TILE,
      runtimeMaterials: profiles[key].materials,
      files: result.entries,
    };
  }

  assets.push(...windowAssets);
  assets.sort((a, b) => a.key.localeCompare(b.key) || a.turn - b.turn);
  const manifest = {
    version: 4,
    contract: {
      projection: 'orthographic-2:1', tile: TILE, projectedDepth: TILE / 2,
      verticalUnit: TILE / 2, margin: MARGIN, light: 'top-left-fixed',
      sourceReduction: 'already exported once with Lanczos; no additional resampling',
    },
    source: 'output/sprites-v2/manifest.json',
    palette: { day: dayPalette, night: nightPalette, outline: OUTLINE },
    materials: [...new Set(assets.flatMap(asset => asset.runtimeMaterials ?? []))],
    sourceFamilies: Object.fromEntries(Object.entries(families).map(([key, item]) => [key, {
      item: Object.keys(itemKeys).find(sourceName => itemKeys[sourceName] === key),
      footprint: item.footprint, heightTiles: item.heightTiles, materials: item.runtimeMaterials,
      tilePixels: item.tilePixels,
    }])),
    assets,
    cat: {
      variants: ['orange', 'black', 'gray'], variantSource: 'runtime material colors',
      frames: 4, durationSeconds: 4, frameIntervalMs: 1000, sourceFrameIntervalMs: 400,
      directionCount: 4, orientations: ROTATIONS, width: cat.width, height: cat.height,
      tilePixels: TILE, pivot: cat.pivot, footprint: cat.frames[0].footprint,
      heightTiles: cat.frames[0].heightTiles, files: cat.frames,
    },
    books: bookAssets,
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(output, 'cat-manifest.json'), `${JSON.stringify(cat.frames, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'src/components/room/isometric-room-assets.ts'), familyAssetModule());
  await makeRoomPreviews(assets, cat, bookAssets);
  console.log(`Adapted ${assets.length - windowAssets.length} sprites-v2 views, retained ${windowAssets.length} window views, and imported ${cat.frames.length} cat frames.`);
}

await main();

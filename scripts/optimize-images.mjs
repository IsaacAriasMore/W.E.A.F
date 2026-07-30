import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const assets = path.join(root, 'public', 'assets');
const source = path.join(assets, 'wild-evolution-emblem.png');
const sizes = [44, 88, 112, 224];

await mkdir(assets, { recursive: true });

await Promise.all(sizes.flatMap((size) => [
  sharp(source)
    .resize(size, size, { fit: 'contain', withoutEnlargement: true })
    .avif({ quality: 68, effort: 7, chromaSubsampling: '4:4:4' })
    .toFile(path.join(assets, `wild-evolution-emblem-${size}.avif`)),
  sharp(source)
    .resize(size, size, { fit: 'contain', withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(path.join(assets, `wild-evolution-emblem-${size}.webp`)),
]));

const ogBackground = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="18%" cy="50%" r="64%">
        <stop offset="0" stop-color="#1b4665" stop-opacity=".72"/>
        <stop offset="1" stop-color="#0d121b" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="#0d121b"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <path d="M520 112h560" stroke="#33404f" stroke-width="2"/>
    <text x="520" y="248" fill="#f4f0e8" font-family="Arial, sans-serif" font-size="88" font-weight="800">W.E.A.F</text>
    <text x="520" y="326" fill="#e0a34d" font-family="Arial, sans-serif" font-size="38" font-weight="700">ASCENSION FORGE</text>
    <text x="520" y="404" fill="#b3bdc9" font-family="Arial, sans-serif" font-size="28">Herramientas y coordinación para tribus</text>
    <text x="520" y="444" fill="#b3bdc9" font-family="Arial, sans-serif" font-size="28">de ARK: Survival Ascended</text>
    <text x="520" y="516" fill="#7f8b99" font-family="Arial, sans-serif" font-size="22">Proyecto comunitario independiente y no oficial</text>
  </svg>
`);

const emblem = await sharp(source)
  .resize(360, 360, { fit: 'contain' })
  .png()
  .toBuffer();

await sharp(ogBackground)
  .composite([{ input: emblem, left: 88, top: 135 }])
  .webp({ quality: 82, effort: 6, smartSubsample: true })
  .toFile(path.join(assets, 'weaf-og-1200x630.webp'));

console.log(`Optimized ${sizes.length * 2 + 1} brand assets.`);

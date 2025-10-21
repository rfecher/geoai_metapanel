#!/usr/bin/env node
// Offline avatar generator for Automatic1111 Web UI
// Usage: node scripts/generate-avatars-a1111.mjs [endpoint]
// Writes PNGs to public/avatars/<personaId>.png

import fs from 'fs/promises';
import path from 'path';

const endpoint = (process.argv[2] || 'http://127.0.0.1:7860').replace(/\/$/, '');

// Minimal persona metadata (id, name, shortBio)
// Edit to match your personas if you change them
const personas = [
  { id: 'maya', name: 'Maya Ríos', shortBio: 'Indigenous data sovereignty advocate' },
  { id: 'otto', name: 'Prof. Otto Reinhardt', shortBio: 'Spatial ontologist with strong opinions' },
  { id: 'sarah', name: 'Dr. Sarah Chen', shortBio: 'Mozilla Foundation researcher; open geospatial AI advocate' },
  { id: 'marcus', name: 'Dr. Marcus Webb', shortBio: 'VP Geospatial AI, Palantir' },
  { id: 'jessica', name: 'Lt. Colonel Jessica Park', shortBio: 'Director, Geospatial Intelligence Division, US Space Force' },
];

function promptFor(p) {
  return `Professional portrait photograph of ${p.name}, ${p.shortBio}.\nHigh quality headshot, neutral background, professional lighting, photorealistic, detailed facial features, confident expression, business casual attire. Style: corporate headshot, LinkedIn profile photo quality.`;
}

async function generateOne(p) {
  const url = `${endpoint}/sdapi/v1/txt2img`;
  const body = {
    prompt: promptFor(p),
    negative_prompt: 'low quality, worst quality, jpeg artifacts, blurry, distorted, deformed face, extra limbs, extra fingers, bad anatomy, watermark, text',
    steps: 24,
    width: 512,
    height: 512,
    cfg_scale: 5.5,
    sampler_name: 'Euler a',
    batch_size: 1,
    n_iter: 1,
    restore_faces: false,
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  const b64 = data.images?.[0];
  if (!b64) throw new Error('No image returned');
  const buf = Buffer.from(b64, 'base64');
  const outDir = path.resolve('public/avatars');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${p.id}.png`);
  await fs.writeFile(outPath, buf);
  return outPath;
}

(async () => {
  try {
    console.log(`Generating ${personas.length} avatars via ${endpoint} ...`);
    let ok = 0;
    for (const p of personas) {
      try {
        const out = await generateOne(p);
        console.log(`✓ ${p.id} -> ${out}`);
        ok++;
      } catch (e) {
        console.error(`✗ ${p.id} failed:`, e?.message || e);
        console.error('Hint: In Automatic1111 Settings > Stable Diffusion enable "Upcast cross attention layer to float32" and restart with --no-half --no-half-vae. Then re-run this script.');
      }
    }
    console.log(`Done. ${ok}/${personas.length} succeeded. Update src/data/personas.ts to use imageUrl: '/avatars/<id>.png' for each successful persona.`);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
})();


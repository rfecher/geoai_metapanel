#!/usr/bin/env node
// Offline avatar generator using ComfyUI
//
// Prereqs:
// 1) In ComfyUI, open your "flux_dev_full_text_to_image" template
// 2) Export it as API JSON: Workflow menu → Save (API format)
// 3) Save the file to scripts/comfyui_workflow.json and add placeholders:
//    - Replace the positive prompt text field with the string: {{PROMPT}}
//    - Replace the negative prompt text field with the string: {{NEGATIVE}}
//    - (Optional) Replace width/height fields with: {{WIDTH}} / {{HEIGHT}}
//    - (Optional) Replace seed field with: {{SEED}}
//
// Usage:
//   node scripts/generate-avatars-comfyui.mjs [COMFY_BASE=http://127.0.0.1:8188] [WORKFLOW_PATH=scripts/comfyui_workflow.json]
//
// Output:
//   Saves PNGs to public/avatars/<personaId>.png by fetching results from ComfyUI /view endpoint

import fs from 'fs/promises';
import path from 'path';

const comfyBase = (process.argv[2] || 'http://127.0.0.1:8000').replace(/\/$/, '');
const workflowPath = process.argv[3] || 'scripts/comfyui_workflow.json';

const personas = [
  { id: 'maya', name: 'Maya Ríos', shortBio: 'Indigenous data sovereignty policy advisor (Cree Nation); former emergency response director; ethics and field operations.' },
  { id: 'otto', name: 'Prof. Otto Reinhardt', shortBio: 'Professor emeritus of cartography and spatial reference systems; standards-focused spatial ontologist.' },
  { id: 'sarah', name: 'Dr. Sarah Hayes', shortBio: 'Mozilla Foundation principal research scientist; open geospatial AI advocate and community organizer.' },
  { id: 'marcus', name: 'Dr. Marcus Webb', shortBio: 'VP of Geospatial AI at Palantir; deployments in disaster response, counter-terrorism, and critical infrastructure.' },
  { id: 'jessica', name: 'Lt. Colonel Jessica Hayes', shortBio: 'Director of Geospatial Intelligence, US Space Force; 18-year military intelligence officer; operational GEOINT leadership.' },
];
// Optional: limit generation to specific persona IDs via 4th arg or PERSONAS env (comma-separated)
const onlyIdsArg = (process.env.PERSONAS || process.argv[4] || '').split(',').map(s => s.trim()).filter(Boolean);
const selected = onlyIdsArg.length ? personas.filter(p => onlyIdsArg.includes(p.id)) : personas;


const promptOverrides = {
  maya: 'Professional corporate headshot of Maya Ríos, Indigenous (Cree Nation) woman in her late 40s to early 50s; medium warm brown skin; dark wavy hair with a few natural greys; oval face, brown eyes; subtle natural makeup; minimal silver or beadwork earrings. Calm, grounded expression. Mouth gently closed, neutral lips, no visible teeth. Neutral warm-gray studio background, soft key light with gentle fill, 50–85mm portrait lens, shallow depth of field. Business-casual blazer or cardigan; earth-tone palette. Photorealistic, sharp facial detail, natural skin texture, no excessive smoothing.',
  otto: 'Professional headshot of Prof. Otto Reinhardt, white European man in his late 60s to early 70s; fair skin; silver hair with receding hairline; neatly trimmed gray beard or clean-shaven; rectangular eyeglasses; blue-gray eyes; composed, slightly stern expression. Neutral cool-gray studio background, classic three-point lighting, 85mm portrait lens, shallow depth of field. Dark suit, white shirt, conservative tie. Photorealistic, high detail, natural skin texture.',
  sarah: 'Professional headshot of Dr. Sarah Hayes, East Asian woman in her mid 30s with light-medium skin tone, straight black shoulder-length hair, optional thin-frame glasses, almond eyes, subtle natural makeup, friendly intelligent expression. Lips sealed; mouth fully closed; no parted lips; no visible teeth; subtle closed-mouth smile only. Neutral soft gray background, soft key and gentle fill, 50–85mm portrait lens, shallow depth of field. Business-casual blazer or knit top; tech/researcher vibe. Photorealistic, clean color, sharp facial detail, no excessive skin smoothing.',
  marcus: 'Professional headshot of Dr. Marcus Webb, American man in his mid to late 40s; medium tan skin; close-cropped dark hair; clean-shaven; brown eyes; confident but approachable expression. Neutral charcoal studio background, crisp key light with soft rim, 85mm portrait lens, shallow depth of field. Dark tailored suit, white shirt, subtle pocket square. Photorealistic, sharp detail, natural skin texture.',
  jessica: 'Professional headshot of Lt. Colonel Jessica Hayes, white woman in her early 40s; fair skin; neat shoulder-length light brown hair; blue or hazel eyes; minimal natural makeup; composed, serious expression. Mouth closed, neutral lips, no visible teeth. Neutral cool-gray studio background, controlled directional key with soft fill, 85mm portrait lens, shallow depth of field. Tailored navy blazer or military-adjacent professional attire (no insignia). Photorealistic, sharp facial detail, natural skin texture.',
};

function promptFor(p) {
  if (promptOverrides[p.id]) return promptOverrides[p.id];
  return `Professional portrait photograph of ${p.name}, ${p.shortBio}.\nHigh quality headshot, neutral background, professional lighting, photorealistic, detailed facial features, confident expression, business casual attire. Style: corporate headshot, LinkedIn profile photo quality.`;
}

const NEGATIVE_BASE = 'low quality, worst quality, jpeg artifacts, blurry, distorted, deformed face, extra limbs, extra fingers, bad anatomy, watermark, text';
// Stronger teeth suppression for specific personas
const negativeOverrides = {
  maya: `${NEGATIVE_BASE}, visible teeth, upper teeth, lower teeth, tooth, teeth showing, smile with teeth, open mouth, parted lips, slightly open lips, ajar lips, wide smile, smiling teeth, grin, laughing`,
  sarah: `${NEGATIVE_BASE}, visible teeth, upper teeth, lower teeth, tooth, teeth showing, gummy smile, smile with teeth, open mouth, parted lips, slightly open lips, ajar lips, wide smile, smiling, smiling teeth, grin, laughing, smirk, laughter`,
};
const negativeFor = (persona) => negativeOverrides[persona.id] || NEGATIVE_BASE;

function deepReplacePlaceholders(obj, replacements) {
  if (typeof obj === 'string') {
    // If the entire string is exactly a placeholder, return the raw value (keeps numbers as numbers)
    for (const [key, val] of Object.entries(replacements)) {
      if (obj === `{{${key}}}`) return val;
    }
    // Otherwise do string substitution
    let out = obj;
    for (const [key, val] of Object.entries(replacements)) {
      out = out.replaceAll(`{{${key}}}`, String(val));
    }
    return out;
  }
  if (Array.isArray(obj)) return obj.map(v => deepReplacePlaceholders(v, replacements));
  if (obj && typeof obj === 'object') {
    const next = {};
    for (const [k, v] of Object.entries(obj)) next[k] = deepReplacePlaceholders(v, replacements);
    return next;
  }
  return obj;
}

async function queueWorkflow(baseWorkflow, replacements) {
  const client_id = `client_${Math.random().toString(36).slice(2)}`;
  const prompt = deepReplacePlaceholders(baseWorkflow, replacements);

  const res = await fetch(`${comfyBase}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, prompt }),
  });
  if (!res.ok) throw new Error(`queue failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.prompt_id;
}

async function waitForResult(prompt_id, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${comfyBase}/history/${prompt_id}`);
    if (res.ok) {
      const hist = await res.json();
      const item = hist[prompt_id];
      if (item && item.outputs) return item.outputs;
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  throw new Error('timeout waiting for result');
}

async function fetchImage(filename, subfolder = '', type = 'output') {
  const url = `${comfyBase}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function generateOne(baseWorkflow, persona, { width = 768, height = 768, seed = Math.floor(Math.random() * 1e9) } = {}) {
  const replacements = {
    PROMPT: promptFor(persona),
    NEGATIVE: negativeFor(persona),
    WIDTH: width,
    HEIGHT: height,
    SEED: seed,
  };
  const prompt_id = await queueWorkflow(baseWorkflow, replacements);
  const outputs = await waitForResult(prompt_id);

  // outputs is a map: node_id -> { images: [{ filename, subfolder, type, ... }] }
  const images = [];
  for (const v of Object.values(outputs)) {
    if (v && Array.isArray(v.images)) images.push(...v.images);
  }
  if (images.length === 0) throw new Error('no images in result');
  const img = images[0];
  const buf = await fetchImage(img.filename, img.subfolder, img.type);

  const outDir = path.resolve('public/avatars');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${persona.id}.png`);
  await fs.writeFile(outPath, buf);
  return outPath;
}

(async () => {
  try {
    const baseWorkflow = JSON.parse(await fs.readFile(workflowPath, 'utf-8'));
    console.log(`Generating ${personas.length} avatars via ${comfyBase} using workflow ${workflowPath} ...`);
    let ok = 0;
    for (const p of selected) {
      try {
        const out = await generateOne(baseWorkflow, p, { width: 768, height: 768 });
        console.log(`✓ ${p.id} -> ${out}`);
        ok++;
      } catch (e) {
        console.error(`✗ ${p.id} failed:`, e?.message || e);
      }
    }
    console.log(`Done. ${ok}/${personas.length} succeeded. If all succeeded, update src/data/personas.ts to use imageUrl: '/avatars/<id>.png'.`);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
})();


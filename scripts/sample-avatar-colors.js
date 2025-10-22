#!/usr/bin/env node

/**
 * Sample pixel colors from avatar PNG images at specific calibration points
 * and output the exact color values to use in the SVG overlays.
 * 
 * Usage: node scripts/sample-avatar-colors.js <avatar-name>
 * Example: node scripts/sample-avatar-colors.js marcus
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const avatarName = process.argv[2];
if (!avatarName) {
  console.error('Usage: node scripts/sample-avatar-colors.js <avatar-name>');
  console.error('Example: node scripts/sample-avatar-colors.js marcus');
  process.exit(1);
}

const pngPath = path.join(__dirname, '..', 'public', 'avatars', `${avatarName}.png`);
const svgPath = path.join(__dirname, '..', 'public', 'avatars', `${avatarName}_hybrid.svg`);

if (!fs.existsSync(pngPath)) {
  console.error(`PNG file not found: ${pngPath}`);
  process.exit(1);
}

if (!fs.existsSync(svgPath)) {
  console.error(`SVG file not found: ${svgPath}`);
  process.exit(1);
}

// Read the SVG to extract calibration coordinates
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Extract coordinates from SVG elements
function extractCoords(svgContent) {
  const coords = {
    mouth: null,
    eyelids: [],
    pupils: [],
    eyes: []
  };

  // Extract mouth ellipse coordinates
  const mouthMatch = svgContent.match(/<ellipse[^>]*id="mouthShape"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*rx="([^"]+)"[^>]*ry="([^"]+)"/);
  if (mouthMatch) {
    coords.mouth = {
      cx: parseFloat(mouthMatch[1]),
      cy: parseFloat(mouthMatch[2]),
      rx: parseFloat(mouthMatch[3]),
      ry: parseFloat(mouthMatch[4])
    };
  }

  // Extract eyelid rectangles
  const lidMatches = svgContent.matchAll(/<rect[^>]*id="(lid[^"]+)"[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"/g);
  for (const match of lidMatches) {
    coords.eyelids.push({
      id: match[1],
      x: parseFloat(match[2]),
      y: parseFloat(match[3]),
      width: parseFloat(match[4]),
      height: parseFloat(match[5])
    });
  }

  // Extract pupil circles
  const pupilMatches = svgContent.matchAll(/<circle[^>]*id="(pupil[LR])"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"/g);
  for (const match of pupilMatches) {
    coords.pupils.push({
      id: match[1],
      cx: parseFloat(match[2]),
      cy: parseFloat(match[3]),
      r: parseFloat(match[4])
    });
  }

  // Extract eye ellipses (sclera)
  const eyeMatches = svgContent.matchAll(/<ellipse[^>]*id="(eye[LR])"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*rx="([^"]+)"[^>]*ry="([^"]+)"/g);
  for (const match of eyeMatches) {
    coords.eyes.push({
      id: match[1],
      cx: parseFloat(match[2]),
      cy: parseFloat(match[3]),
      rx: parseFloat(match[4]),
      ry: parseFloat(match[5])
    });
  }

  return coords;
}

// Sample a region and return average color
function sampleRegion(imageData, x, y, width, height, canvasWidth, canvasHeight) {
  const samples = [];
  const samplePoints = 25; // 5x5 grid
  const gridSize = Math.sqrt(samplePoints);
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const px = Math.floor(x + (width * i / (gridSize - 1)));
      const py = Math.floor(y + (height * j / (gridSize - 1)));
      
      if (px >= 0 && px < canvasWidth && py >= 0 && py < canvasHeight) {
        const idx = (py * canvasWidth + px) * 4;
        samples.push({
          r: imageData[idx],
          g: imageData[idx + 1],
          b: imageData[idx + 2],
          a: imageData[idx + 3]
        });
      }
    }
  }
  
  if (samples.length === 0) return null;
  
  const avg = samples.reduce((acc, s) => ({
    r: acc.r + s.r,
    g: acc.g + s.g,
    b: acc.b + s.b,
    a: acc.a + s.a
  }), { r: 0, g: 0, b: 0, a: 0 });
  
  return {
    r: Math.round(avg.r / samples.length),
    g: Math.round(avg.g / samples.length),
    b: Math.round(avg.b / samples.length),
    a: avg.a / samples.length
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

async function main() {
  console.log(`\nSampling colors from ${pngPath}...\n`);
  
  const coords = extractCoords(svgContent);
  const image = await loadImage(pngPath);
  
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, image.width, image.height).data;
  
  // SVG viewBox is 400x400, scale coordinates to actual image size
  const scaleX = image.width / 400;
  const scaleY = image.height / 400;
  
  console.log(`Image dimensions: ${image.width}x${image.height}`);
  console.log(`Scale factors: ${scaleX.toFixed(3)}x, ${scaleY.toFixed(3)}y\n`);
  
  const results = {
    mouth: {},
    eyelids: {},
    pupils: {},
    eyes: {}
  };
  
  // Sample mouth region (top, middle, bottom for gradient)
  if (coords.mouth) {
    const m = coords.mouth;
    const mx = m.cx * scaleX;
    const my = m.cy * scaleY;
    const mrx = m.rx * scaleX;
    const mry = m.ry * scaleY;
    
    // Sample top edge of mouth
    const topColor = sampleRegion(imageData, mx - mrx/2, my - mry, mrx, 2, image.width, image.height);
    // Sample middle of mouth
    const midColor = sampleRegion(imageData, mx - mrx/2, my - 1, mrx, 2, image.width, image.height);
    // Sample bottom edge of mouth
    const botColor = sampleRegion(imageData, mx - mrx/2, my + mry - 2, mrx, 2, image.width, image.height);
    
    results.mouth = {
      top: topColor ? rgbToHex(topColor.r, topColor.g, topColor.b) : null,
      middle: midColor ? rgbToHex(midColor.r, midColor.g, midColor.b) : null,
      bottom: botColor ? rgbToHex(botColor.r, botColor.g, botColor.b) : null,
      topRaw: topColor,
      middleRaw: midColor,
      bottomRaw: botColor
    };
    
    console.log('MOUTH GRADIENT COLORS:');
    console.log(`  Top:    ${results.mouth.top} (RGB: ${topColor?.r}, ${topColor?.g}, ${topColor?.b})`);
    console.log(`  Middle: ${results.mouth.middle} (RGB: ${midColor?.r}, ${midColor?.g}, ${midColor?.b})`);
    console.log(`  Bottom: ${results.mouth.bottom} (RGB: ${botColor?.r}, ${botColor?.g}, ${botColor?.b})`);
    console.log();
  }
  
  // Sample eyelid regions
  if (coords.eyelids.length > 0) {
    console.log('EYELID COLORS:');
    for (const lid of coords.eyelids) {
      const lx = lid.x * scaleX;
      const ly = lid.y * scaleY;
      const lw = lid.width * scaleX;
      const lh = lid.height * scaleY;
      
      const color = sampleRegion(imageData, lx, ly, lw, lh, image.width, image.height);
      results.eyelids[lid.id] = color ? rgbToHex(color.r, color.g, color.b) : null;
      
      console.log(`  ${lid.id}: ${results.eyelids[lid.id]} (RGB: ${color?.r}, ${color?.g}, ${color?.b})`);
    }
    console.log();
  }
  
  // Sample pupil regions
  if (coords.pupils.length > 0) {
    console.log('PUPIL COLORS:');
    for (const pupil of coords.pupils) {
      const px = pupil.cx * scaleX;
      const py = pupil.cy * scaleY;
      const pr = pupil.r * scaleX;
      
      const color = sampleRegion(imageData, px - pr, py - pr, pr * 2, pr * 2, image.width, image.height);
      results.pupils[pupil.id] = color ? rgbToHex(color.r, color.g, color.b) : null;
      
      console.log(`  ${pupil.id}: ${results.pupils[pupil.id]} (RGB: ${color?.r}, ${color?.g}, ${color?.b})`);
    }
    console.log();
  }
  
  // Sample eye/sclera regions
  if (coords.eyes.length > 0) {
    console.log('EYE/SCLERA COLORS:');
    for (const eye of coords.eyes) {
      const ex = eye.cx * scaleX;
      const ey = eye.cy * scaleY;
      const erx = eye.rx * scaleX;
      const ery = eye.ry * scaleY;
      
      const color = sampleRegion(imageData, ex - erx, ey - ery, erx * 2, ery * 2, image.width, image.height);
      results.eyes[eye.id] = color ? rgbToHex(color.r, color.g, color.b) : null;
      
      console.log(`  ${eye.id}: ${results.eyes[eye.id]} (RGB: ${color?.r}, ${color?.g}, ${color?.b})`);
    }
    console.log();
  }
  
  // Output suggested SVG gradient updates
  console.log('\n=== SUGGESTED SVG UPDATES ===\n');
  
  if (results.mouth.top) {
    console.log('Mouth gradient (gradMouthVert):');
    console.log(`  <stop offset="0%" stop-color="${results.mouth.top}" stop-opacity="0.76"></stop>`);
    console.log(`  <stop offset="50%" stop-color="${results.mouth.middle}" stop-opacity="0.87"></stop>`);
    console.log(`  <stop offset="100%" stop-color="${results.mouth.bottom}" stop-opacity="0.76"></stop>`);
    console.log();
  }
  
  if (Object.keys(results.eyelids).length > 0) {
    const firstLidColor = Object.values(results.eyelids)[0];
    console.log('Eyelid gradients (gradLidUpper and gradLidLower):');
    console.log(`  stop-color="${firstLidColor}"`);
    console.log();
  }
  
  if (Object.keys(results.pupils).length > 0) {
    const firstPupilColor = Object.values(results.pupils)[0];
    console.log('Pupil gradient (gradPupil):');
    console.log(`  stop-color="${firstPupilColor}"`);
    console.log();
  }
  
  // Save results to JSON
  const outputPath = path.join(__dirname, '..', 'public', 'avatars', `${avatarName}_colors.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nColor data saved to: ${outputPath}\n`);
}

main().catch(console.error);


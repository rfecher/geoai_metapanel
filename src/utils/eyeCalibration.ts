/**
 * Automatic eye calibration utility
 * Analyzes original avatar PNG images to detect pupil positions and calculate calibration parameters
 */

export type EyeCalibrationResult = {
  eyeSeparationPct: number;      // Distance between pupils as % of width
  eyeCenterOffsetPct: number;    // Horizontal offset from center
  leftPupilXPct: number;         // Left pupil X position as %
  rightPupilXPct: number;        // Right pupil X position as %
  leftPupilYPct: number;         // Left pupil Y position as % (independent vertical position)
  rightPupilYPct: number;        // Right pupil Y position as % (independent vertical position)
  pupilYPct: number;             // Averaged pupil Y position as % (for backward compatibility)
  confidence: number;            // 0-1 confidence score
};

/**
 * Load an image and return it as an HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Find the darkest regions in an image (likely pupils) using ADAPTIVE thresholding
 * Returns array of {x, y, darkness} sorted by darkness (darkest first)
 *
 * This approach works for both dark eyes (brown) and light eyes (blue/green) by:
 * 1. Building a histogram of brightness values in the eye region
 * 2. Finding the darkest 1-2% of pixels (adaptive threshold)
 * 3. These will be the pupils regardless of overall image brightness or eye color
 */
function findDarkRegions(imageData: ImageData, minDarkness = 100): Array<{x: number, y: number, darkness: number}> {
  const { data, width, height } = imageData;

  // Focus on eye region: NARROWED to 30-47% from top, 15-85% horizontally
  // Previous range (25-50%) included eyebrows and too much vertical space
  // New range focuses specifically on iris/pupil area, excluding eyebrows
  const yStart = Math.floor(height * 0.30); // Raised from 0.25 to exclude eyebrows
  const yEnd = Math.floor(height * 0.47);   // Lowered from 0.50 to focus on eye area
  const xStart = Math.floor(width * 0.15);
  const xEnd = Math.floor(width * 0.85);

  console.log(`[eyeCalibration] Scanning eye region: x=${xStart}-${xEnd}, y=${yStart}-${yEnd} (image: ${width}x${height})`);

  // STEP 1: Build histogram of brightness values in eye region
  const brightnessValues: number[] = [];
  const pixelData: Array<{x: number, y: number, brightness: number}> = [];

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Only consider opaque pixels
      if (a > 200) {
        const brightness = (r + g + b) / 3;
        brightnessValues.push(brightness);
        pixelData.push({ x, y, brightness });
      }
    }
  }

  // STEP 2: Calculate adaptive threshold (darkest 1.5% of pixels)
  // REVERTED from 0.8% back to 1.5% - the 0.8% was too aggressive and captured too many pixels
  // (e.g., Maya: 13,050 pixels at 0.8% vs expected ~1,000-1,500 at 1.5%)
  brightnessValues.sort((a, b) => a - b);
  let percentile = 0.015; // Darkest 1.5% of pixels (REVERTED from 0.8%)
  let thresholdIndex = Math.floor(brightnessValues.length * percentile);
  let adaptiveThreshold = brightnessValues[thresholdIndex];

  // Calculate some statistics for debugging
  const minBrightness = brightnessValues[0];
  const maxBrightness = brightnessValues[brightnessValues.length - 1];
  const medianBrightness = brightnessValues[Math.floor(brightnessValues.length / 2)];

  // VALIDATION: Reject images with threshold too close to 0
  // This indicates pure black pixels that may not be actual pupils
  if (adaptiveThreshold < 5) {
    console.warn(`[eyeCalibration] Adaptive threshold too low (${adaptiveThreshold}). Adjusting to minimum of 5.`);
    adaptiveThreshold = Math.max(5, minBrightness + 5);
  }

  console.log(`[eyeCalibration] Brightness stats: min=${minBrightness.toFixed(0)}, max=${maxBrightness.toFixed(0)}, median=${medianBrightness.toFixed(0)}`);
  console.log(`[eyeCalibration] Adaptive threshold (darkest ${(percentile * 100).toFixed(1)}%): ${adaptiveThreshold.toFixed(0)}`);

  // STEP 3: Select pixels below adaptive threshold
  let darkPixels: Array<{x: number, y: number, darkness: number}> = [];
  for (const pixel of pixelData) {
    if (pixel.brightness <= adaptiveThreshold) {
      darkPixels.push({
        x: pixel.x,
        y: pixel.y,
        darkness: 255 - pixel.brightness
      });
    }
  }

  console.log(`[eyeCalibration] Found ${darkPixels.length} dark pixels using adaptive threshold (${(percentile * 100).toFixed(1)}% darkest)`);

  // VALIDATION: If too many dark pixels found, threshold is too aggressive
  // This indicates we're capturing eyebrows, hair, or other non-pupil features
  // Automatically adjust to a stricter percentile
  if (darkPixels.length > 2000) {
    console.warn(`[eyeCalibration] Too many dark pixels (${darkPixels.length}). Reducing to darkest 0.5% and retrying...`);
    percentile = 0.005; // Reduce to darkest 0.5%
    thresholdIndex = Math.floor(brightnessValues.length * percentile);
    adaptiveThreshold = Math.max(brightnessValues[thresholdIndex], 10); // Ensure threshold >= 10

    darkPixels = [];
    for (const pixel of pixelData) {
      if (pixel.brightness <= adaptiveThreshold) {
        darkPixels.push({
          x: pixel.x,
          y: pixel.y,
          darkness: 255 - pixel.brightness
        });
      }
    }

    console.log(`[eyeCalibration] Adjusted threshold to ${adaptiveThreshold.toFixed(0)} (darkest ${(percentile * 100).toFixed(1)}%)`);
    console.log(`[eyeCalibration] Found ${darkPixels.length} dark pixels after adjustment`);
  }

  if (darkPixels.length < 100) {
    console.warn(`[eyeCalibration] Very few dark pixels found (${darkPixels.length}). Pupils may not be visible.`);
  }
  if (darkPixels.length > 5000) {
    console.warn(`[eyeCalibration] Many dark pixels found (${darkPixels.length}). May include eyebrows/shadows.`);
  }

  return darkPixels.sort((a, b) => b.darkness - a.darkness);
}

/**
 * Cluster nearby dark pixels into regions
 * Filter for pupil-like regions (circular, appropriate size, horizontally aligned)
 *
 * Uses a small clustering distance to avoid merging pupils with eyelashes or each other
 * But not too small to avoid fragmenting actual pupils into multiple tiny clusters
 */
function clusterDarkPixels(pixels: Array<{x: number, y: number, darkness: number}>, maxDistance = 6): Array<{centerX: number, centerY: number, size: number, avgDarkness: number, width: number, height: number}> {
  const clusters: Array<{pixels: Array<{x: number, y: number, darkness: number}>}> = [];
  const used = new Set<number>();

  // Use a small clustering distance (6px) to balance:
  // 1. Not merging pupils with eyelashes (would need 10px+)
  // 2. Not fragmenting actual pupils into tiny clusters (would happen at 4px)
  // 6px is the sweet spot for compact circular pupil regions
  const clusterRadius = 6; // Increased from 5 to prevent fragmenting pupils

  for (let i = 0; i < pixels.length; i++) {
    if (used.has(i)) continue;

    const cluster = { pixels: [pixels[i]] };
    used.add(i);

    // Find nearby pixels using a seed-based approach
    // This prevents creating one giant cluster from chained connections
    let seedIndex = 0;
    while (seedIndex < cluster.pixels.length) {
      const seed = cluster.pixels[seedIndex];

      for (let j = 0; j < pixels.length; j++) {
        if (used.has(j)) continue;

        const dx = seed.x - pixels[j].x;
        const dy = seed.y - pixels[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < clusterRadius) {
          cluster.pixels.push(pixels[j]);
          used.add(j);
        }
      }

      seedIndex++;
    }

    clusters.push(cluster);
  }

  // Convert clusters to center points with bounding box
  const clusterData = clusters.map(cluster => {
    const centerX = cluster.pixels.reduce((sum, p) => sum + p.x, 0) / cluster.pixels.length;
    const centerY = cluster.pixels.reduce((sum, p) => sum + p.y, 0) / cluster.pixels.length;
    const avgDarkness = cluster.pixels.reduce((sum, p) => sum + p.darkness, 0) / cluster.pixels.length;

    // Calculate bounding box
    const minX = Math.min(...cluster.pixels.map(p => p.x));
    const maxX = Math.max(...cluster.pixels.map(p => p.x));
    const minY = Math.min(...cluster.pixels.map(p => p.y));
    const maxY = Math.max(...cluster.pixels.map(p => p.y));
    const width = maxX - minX + 1; // +1 to include the pixel itself
    const height = maxY - minY + 1;

    return { centerX, centerY, size: cluster.pixels.length, avgDarkness, width, height };
  });

  // DETAILED LOGGING: Show ALL clusters before filtering with rejection reasons
  console.log(`[eyeCalibration] === ALL CLUSTERS (before filtering) ===`);
  const sortedBySize = [...clusterData].sort((a, b) => b.size - a.size);
  sortedBySize.slice(0, 15).forEach((c, i) => {
    const aspectRatio = (c.width / c.height).toFixed(2);

    // Determine why this cluster might be rejected
    const reasons: string[] = [];
    if (c.size < 30 || c.size > 800) reasons.push(`size=${c.size}`);
    if (parseFloat(aspectRatio) < 0.4) reasons.push(`aspect=${aspectRatio} too tall`);
    if (parseFloat(aspectRatio) > 2.5) reasons.push(`aspect=${aspectRatio} too wide`);
    if (c.width < 5 || c.width > 50) reasons.push(`width=${c.width}`);
    if (c.height < 5 || c.height > 50) reasons.push(`height=${c.height}`);

    const rejectStr = reasons.length > 0 ? ` ❌ REJECT: ${reasons.join(', ')}` : ' ✓';
    console.log(`  Cluster ${i}: center=(${c.centerX.toFixed(0)}, ${c.centerY.toFixed(0)}), size=${c.size}, dims=${c.width}x${c.height}, aspect=${aspectRatio}${rejectStr}`);
  });

  // Filter for pupil-like regions with STRICT circularity requirements:
  // - Size: 30-800 pixels (catch smaller/larger pupils)
  // - Aspect ratio: MUST be roughly circular (0.4-2.5) to reject elongated eyelash clusters
  //   - Reject aspect < 0.4 (too tall/thin - likely pupil merged with eyelashes)
  //   - Reject aspect > 2.5 (too wide/flat - likely eyebrow or shadow)
  // - Dimensions: 5-50 pixels wide/tall (increased from 40 to allow slightly larger pupils)
  const pupilLikeClusters = clusterData.filter(c => {
    const aspectRatio = c.width / Math.max(c.height, 1);
    const isPupilSize = c.size >= 30 && c.size <= 800;

    // STRICT: Reject very elongated clusters (aspect < 0.4 means height > 2.5x width)
    // This rejects pupils merged with eyelashes (e.g., 27x99 has aspect=0.27)
    const isCircular = aspectRatio >= 0.4 && aspectRatio <= 2.5;

    // Allow slightly larger dimensions (up to 50px) but reject very tall clusters
    const isReasonableSize = c.width >= 5 && c.width <= 50 && c.height >= 5 && c.height <= 50;

    return isPupilSize && isCircular && isReasonableSize;
  });

  console.log(`[eyeCalibration] === PUPIL-LIKE CLUSTERS (after filtering) ===`);
  console.log(`[eyeCalibration] Found ${clusters.length} total clusters, ${pupilLikeClusters.length} pupil-like clusters`);
  console.log(`[eyeCalibration] Filter criteria: size=30-800px, aspect=0.4-2.5 (STRICT), dims=5-50px`);

  // Show all pupil-like clusters for debugging
  pupilLikeClusters.forEach((c, i) => {
    const aspectRatio = (c.width / c.height).toFixed(2);
    console.log(`  Pupil-like ${i}: center=(${c.centerX.toFixed(0)}, ${c.centerY.toFixed(0)}), size=${c.size}, dims=${c.width}x${c.height}, aspect=${aspectRatio}`);
  });

  // Sort by size (larger clusters are more likely to be pupils)
  return pupilLikeClusters.sort((a, b) => b.size - a.size);
}

/**
 * Analyze an avatar image to detect pupil positions
 */
export async function analyzeEyeImage(avatarImageUrl: string): Promise<EyeCalibrationResult | null> {
  try {
    console.log(`[eyeCalibration] Loading image: ${avatarImageUrl}`);

    // Load the image
    const img = await loadImage(avatarImageUrl);

    console.log(`[eyeCalibration] Image loaded successfully: ${img.width}x${img.height}`);
    
    // Create canvas and get image data
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    
    // Find dark regions using ADAPTIVE thresholding (works for all eye colors)
    // The minDarkness parameter is ignored - using adaptive threshold inside function
    const darkPixels = findDarkRegions(imageData, 45);

    if (darkPixels.length < 50) {
      console.warn(`[eyeCalibration] Not enough dark pixels found (${darkPixels.length}). Pupils may not be visible.`);
      return null;
    }

    // Cluster dark pixels into regions with tight clustering distance (6px)
    // This balances:
    // 1. Not merging pupils with nearby eyelashes (would happen at 10px+)
    // 2. Not fragmenting actual pupils into tiny clusters (would happen at 4-5px)
    // 6px is the sweet spot for compact circular pupil regions
    const clusters = clusterDarkPixels(darkPixels, 6);

    if (clusters.length < 2) {
      console.warn('[eyeCalibration] Could not find two distinct pupil-like regions');
      return null;
    }

    // Find the best pair of clusters that look like left/right pupils
    // They MUST meet criteria:
    // 1. Horizontally aligned (Y difference < 10% of image height - relaxed from 8%)
    // 2. Separated by 15-40% of image width (reject anything outside this range)
    // 3. Both in the upper-middle region of the face
    // 4. Similar sizes (one pupil shouldn't be 4x larger than the other - relaxed from 3x)

    let bestPair: {left: typeof clusters[0], right: typeof clusters[0], score: number} | null = null;

    // Check up to 15 largest clusters (increased from 10 to have more options with relaxed filters)
    const maxClustersToCheck = Math.min(15, clusters.length);

    console.log(`[eyeCalibration] === EVALUATING PUPIL PAIRS ===`);

    for (let i = 0; i < maxClustersToCheck; i++) {
      for (let j = i + 1; j < maxClustersToCheck; j++) {
        const c1 = clusters[i];
        const c2 = clusters[j];

        // Determine left and right
        const left = c1.centerX < c2.centerX ? c1 : c2;
        const right = c1.centerX < c2.centerX ? c2 : c1;

        // Check horizontal alignment (Y difference should be < 10% of image height)
        const yDiff = Math.abs(left.centerY - right.centerY);
        const yDiffPct = (yDiff / img.height) * 100;

        // Check separation (MUST be 15-40% of image width)
        const separation = right.centerX - left.centerX;
        const separationPct = (separation / img.width) * 100;

        // VALIDATION: Reject pairs that don't meet minimum criteria
        let rejectReason = '';

        if (separationPct < 15 || separationPct > 40) {
          rejectReason = `sep=${separationPct.toFixed(1)}% out of range [15-40%]`;
        } else if (yDiffPct > 10) {
          rejectReason = `yDiff=${yDiffPct.toFixed(1)}% > 10%`;
        } else {
          // Check size similarity (one pupil shouldn't be 4x larger than the other)
          const sizeRatio = Math.max(left.size, right.size) / Math.min(left.size, right.size);
          if (sizeRatio > 4) {
            rejectReason = `sizeRatio=${sizeRatio.toFixed(2)} > 4`;
          }
        }

        if (rejectReason) {
          console.log(`  Pair ${i},${j}: REJECTED - ${rejectReason}`);
          continue;
        }

        // Score this pair (higher is better)
        const sizeRatio = Math.max(left.size, right.size) / Math.min(left.size, right.size);
        const alignmentScore = Math.max(0, 1 - yDiffPct / 10); // Penalty for vertical misalignment
        const separationScore = separationPct >= 18 && separationPct <= 34 ? 1.0 : 0.7; // Prefer typical separation
        const sizeScore = Math.min(1, (left.size + right.size) / 400); // Prefer larger clusters (normalized for 30-800 pixel range)
        const sizeSimilarityScore = 1 / sizeRatio; // Prefer similar-sized pupils
        const score = alignmentScore * separationScore * sizeScore * sizeSimilarityScore;

        console.log(`  Pair ${i},${j}: yDiff=${yDiffPct.toFixed(1)}%, sep=${separationPct.toFixed(1)}%, sizeRatio=${sizeRatio.toFixed(2)}, score=${score.toFixed(3)} ✓`);

        if (!bestPair || score > bestPair.score) {
          bestPair = { left, right, score };
        }
      }
    }

    if (!bestPair) {
      console.warn('[eyeCalibration] Could not find a valid pupil pair');
      return null;
    }

    const leftPupil = bestPair.left;
    const rightPupil = bestPair.right;

    // Log detected pixel coordinates for verification
    console.log(`[eyeCalibration] === DETECTED PUPIL COORDINATES ===`);
    console.log(`  Left pupil:  pixel=(${leftPupil.centerX.toFixed(0)}, ${leftPupil.centerY.toFixed(0)}), size=${leftPupil.size}, darkness=${leftPupil.avgDarkness.toFixed(0)}`);
    console.log(`  Right pupil: pixel=(${rightPupil.centerX.toFixed(0)}, ${rightPupil.centerY.toFixed(0)}), size=${rightPupil.size}, darkness=${rightPupil.avgDarkness.toFixed(0)}`);

    // Calculate percentages
    const leftPupilXPct = (leftPupil.centerX / img.width) * 100;
    const rightPupilXPct = (rightPupil.centerX / img.width) * 100;
    const leftPupilYPct = (leftPupil.centerY / img.height) * 100;
    const rightPupilYPct = (rightPupil.centerY / img.height) * 100;
    const pupilYPct = ((leftPupil.centerY + rightPupil.centerY) / 2 / img.height) * 100; // Averaged for backward compatibility

    // Calculate separation and offset
    const eyeSeparationPct = rightPupilXPct - leftPupilXPct;
    const eyeCenterXPct = (leftPupilXPct + rightPupilXPct) / 2;
    const eyeCenterOffsetPct = eyeCenterXPct - 50;

    // VALIDATION: Check if values are in expected ranges and adjust confidence
    let confidencePenalty = 1.0;
    const validationIssues: string[] = [];

    if (eyeSeparationPct < 18) {
      validationIssues.push(`eyeSeparationPct ${eyeSeparationPct.toFixed(2)}% < 18% (pupils too close)`);
      confidencePenalty *= 0.5; // Reduce confidence by 50%
    } else if (eyeSeparationPct > 34) {
      validationIssues.push(`eyeSeparationPct ${eyeSeparationPct.toFixed(2)}% > 34% (pupils too far)`);
      confidencePenalty *= 0.7; // Reduce confidence by 30%
    }

    if (Math.abs(eyeCenterOffsetPct) > 15) {
      validationIssues.push(`eyeCenterOffsetPct ${eyeCenterOffsetPct.toFixed(2)}% outside ±15% (not centered)`);
      confidencePenalty *= 0.6; // Reduce confidence by 40%
    }

    if (validationIssues.length > 0) {
      console.warn(`[eyeCalibration] ⚠️  VALIDATION WARNINGS:`);
      validationIssues.forEach(issue => console.warn(`  - ${issue}`));
      console.warn(`  Confidence reduced by ${((1 - confidencePenalty) * 100).toFixed(0)}%`);
    }

    // Calculate confidence based on cluster quality and alignment
    const minClusterSize = Math.min(leftPupil.size, rightPupil.size);
    const avgDarkness = (leftPupil.avgDarkness + rightPupil.avgDarkness) / 2;
    const yAlignment = 1 - Math.abs(leftPupil.centerY - rightPupil.centerY) / img.height;
    let confidence = Math.min(1, (minClusterSize / 200) * (avgDarkness / 200) * yAlignment);

    // Apply validation penalty to confidence
    confidence *= confidencePenalty;

    console.log(`[eyeCalibration] === CALIBRATION RESULTS ===`);
    console.log(`[eyeCalibration] ✅ Detected pupils:`, {
      leftPupilXPct: leftPupilXPct.toFixed(2),
      rightPupilXPct: rightPupilXPct.toFixed(2),
      leftPupilYPct: leftPupilYPct.toFixed(2),
      rightPupilYPct: rightPupilYPct.toFixed(2),
      pupilYPct: pupilYPct.toFixed(2),
      eyeSeparationPct: eyeSeparationPct.toFixed(2),
      eyeCenterOffsetPct: eyeCenterOffsetPct.toFixed(2),
      confidence: (confidence * 100).toFixed(1) + '%',
      leftPupilPixels: `(${leftPupil.centerX.toFixed(0)}, ${leftPupil.centerY.toFixed(0)})`,
      rightPupilPixels: `(${rightPupil.centerX.toFixed(0)}, ${rightPupil.centerY.toFixed(0)})`,
      leftClusterSize: leftPupil.size,
      rightClusterSize: rightPupil.size,
    });

    return {
      eyeSeparationPct,
      eyeCenterOffsetPct,
      leftPupilXPct,
      rightPupilXPct,
      leftPupilYPct,
      rightPupilYPct,
      pupilYPct,
      confidence,
    };
  } catch (error) {
    console.error('Error analyzing eye image:', error);
    return null;
  }
}

/**
 * Auto-calibrate eye positions for a persona using their avatar PNG file
 *
 * CRITICAL: We MUST use the original .png files (e.g., marcus.png, sarah.png)
 * because they contain the original pupils. The -transparent.png files have
 * the pupils already removed for animation purposes and CANNOT be used for
 * pupil detection.
 */
export async function autoCalibratePupils(personaId: string): Promise<EyeCalibrationResult | null> {
  // ONLY use original .png files - they have visible pupils
  const avatarImageUrl = `/avatars/${personaId}.png`;

  console.log(`[eyeCalibration] ========================================`);
  console.log(`[eyeCalibration] Auto-calibrating: ${personaId}`);
  console.log(`[eyeCalibration] Analyzing image: ${avatarImageUrl}`);
  console.log(`[eyeCalibration] ========================================`);

  const result = await analyzeEyeImage(avatarImageUrl);

  if (!result) {
    console.error(`[eyeCalibration] ❌ Failed to detect pupils in ${avatarImageUrl}`);
    console.error(`[eyeCalibration] This file should contain visible pupils. Check that:`);
    console.error(`[eyeCalibration]   1. The file exists at public${avatarImageUrl}`);
    console.error(`[eyeCalibration]   2. The file contains the original photo with pupils visible`);
    console.error(`[eyeCalibration]   3. The file is NOT the -transparent.png version (pupils removed)`);
  } else {
    console.log(`[eyeCalibration] ✅ Successfully detected pupils in ${avatarImageUrl}`);
  }

  return result;
}

/**
 * Batch auto-calibrate all personas
 */
export async function autoCalibrateBatch(personaIds: string[]): Promise<Record<string, EyeCalibrationResult>> {
  const results: Record<string, EyeCalibrationResult> = {};

  for (const id of personaIds) {
    const result = await autoCalibratePupils(id);
    if (result && result.confidence > 0.3) {
      results[id] = result;
    }
  }

  return results;
}

/**
 * Manual calibration from exact pixel coordinates
 * Use this when you know the exact pupil positions in the original image
 *
 * @param leftPupilX - X coordinate of left pupil center in pixels (0-768)
 * @param leftPupilY - Y coordinate of left pupil center in pixels (0-768)
 * @param rightPupilX - X coordinate of right pupil center in pixels (0-768)
 * @param rightPupilY - Y coordinate of right pupil center in pixels (0-768)
 * @param imageWidth - Width of the image in pixels (default: 768)
 * @param imageHeight - Height of the image in pixels (default: 768)
 * @returns EyeCalibrationResult with percentage-based values
 */
export function manualCalibratePupils(
  leftPupilX: number,
  leftPupilY: number,
  rightPupilX: number,
  rightPupilY: number,
  imageWidth: number = 768,
  imageHeight: number = 768
): EyeCalibrationResult {
  console.log(`[eyeCalibration] === MANUAL CALIBRATION ===`);
  console.log(`[eyeCalibration] Image dimensions: ${imageWidth}x${imageHeight}`);
  console.log(`[eyeCalibration] Left pupil:  pixel=(${leftPupilX}, ${leftPupilY})`);
  console.log(`[eyeCalibration] Right pupil: pixel=(${rightPupilX}, ${rightPupilY})`);

  // Validate inputs
  if (leftPupilX < 0 || leftPupilX > imageWidth || rightPupilX < 0 || rightPupilX > imageWidth) {
    throw new Error(`Pupil X coordinates must be between 0 and ${imageWidth}`);
  }
  if (leftPupilY < 0 || leftPupilY > imageHeight || rightPupilY < 0 || rightPupilY > imageHeight) {
    throw new Error(`Pupil Y coordinates must be between 0 and ${imageHeight}`);
  }
  if (rightPupilX <= leftPupilX) {
    throw new Error('Right pupil X must be greater than left pupil X');
  }

  // Calculate percentages
  const leftPupilXPct = (leftPupilX / imageWidth) * 100;
  const rightPupilXPct = (rightPupilX / imageWidth) * 100;
  const leftPupilYPct = (leftPupilY / imageHeight) * 100;
  const rightPupilYPct = (rightPupilY / imageHeight) * 100;
  const pupilYPct = ((leftPupilY + rightPupilY) / 2 / imageHeight) * 100; // Averaged for backward compatibility

  // Calculate separation and offset
  const eyeSeparationPct = rightPupilXPct - leftPupilXPct;
  const eyeCenterXPct = (leftPupilXPct + rightPupilXPct) / 2;
  const eyeCenterOffsetPct = eyeCenterXPct - 50;

  // Validate results are in expected ranges
  const validationIssues: string[] = [];

  if (eyeSeparationPct < 18) {
    validationIssues.push(`eyeSeparationPct ${eyeSeparationPct.toFixed(2)}% < 18% (pupils too close)`);
  } else if (eyeSeparationPct > 34) {
    validationIssues.push(`eyeSeparationPct ${eyeSeparationPct.toFixed(2)}% > 34% (pupils too far)`);
  }

  if (Math.abs(eyeCenterOffsetPct) > 15) {
    validationIssues.push(`eyeCenterOffsetPct ${eyeCenterOffsetPct.toFixed(2)}% outside ±15% (not centered)`);
  }

  const yDiff = Math.abs(leftPupilY - rightPupilY);
  const yDiffPct = (yDiff / imageHeight) * 100;
  if (yDiffPct > 5) {
    validationIssues.push(`Vertical misalignment ${yDiffPct.toFixed(1)}% > 5% (pupils not horizontally aligned)`);
  }

  if (validationIssues.length > 0) {
    console.warn(`[eyeCalibration] ⚠️  VALIDATION WARNINGS:`);
    validationIssues.forEach(issue => console.warn(`  - ${issue}`));
  }

  console.log(`[eyeCalibration] === CALIBRATION RESULTS ===`);
  console.log(`[eyeCalibration] ✅ Manual calibration complete:`, {
    leftPupilXPct: leftPupilXPct.toFixed(2),
    rightPupilXPct: rightPupilXPct.toFixed(2),
    leftPupilYPct: leftPupilYPct.toFixed(2),
    rightPupilYPct: rightPupilYPct.toFixed(2),
    pupilYPct: pupilYPct.toFixed(2),
    eyeSeparationPct: eyeSeparationPct.toFixed(2),
    eyeCenterOffsetPct: eyeCenterOffsetPct.toFixed(2),
    yDiffPct: yDiffPct.toFixed(2),
  });

  // Return numbers (not strings) to match EyeCalibrationResult type and auto-calibration behavior
  return {
    eyeSeparationPct,
    eyeCenterOffsetPct,
    leftPupilXPct,
    rightPupilXPct,
    leftPupilYPct,
    rightPupilYPct,
    pupilYPct,
    confidence: validationIssues.length === 0 ? 1.0 : 0.75,
  };
}


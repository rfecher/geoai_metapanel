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


/**
 * Find the darkest regions in an image (likely pupils) using ADAPTIVE thresholding
 * Returns array of {x, y, darkness} sorted by darkness (darkest first)
 *
 * This approach works for both dark eyes (brown) and light eyes (blue/green) by:
 * 1. Building a histogram of brightness values in the eye region
 * 2. Finding the darkest 1-2% of pixels (adaptive threshold)
 * 3. These will be the pupils regardless of overall image brightness or eye color
 */


/**
 * Cluster nearby dark pixels into regions
 * Filter for pupil-like regions (circular, appropriate size, horizontally aligned)
 *
 * Uses a small clustering distance to avoid merging pupils with eyelashes or each other
 * But not too small to avoid fragmenting actual pupils into multiple tiny clusters
 */


/**
 * Analyze an avatar image to detect pupil positions
 */



/**
 * Auto-calibrate eye positions for a persona using their avatar PNG file
 *
 * CRITICAL: We MUST use the original .png files (e.g., marcus.png, sarah.png)
 * because they contain the original pupils. The -transparent.png files have
 * the pupils already removed for animation purposes and CANNOT be used for
 * pupil detection.
 */


/**
 * Batch auto-calibrate all personas
 */


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


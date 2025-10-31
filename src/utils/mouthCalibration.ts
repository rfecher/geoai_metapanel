/**
 * Automatic mouth calibration utility
 * Analyzes avatar PNG images to detect mouth dimensions and calculate calibration parameters
 */

export type MouthCalibrationResult = {
  mouthWidthPct: number;    // Horizontal width of mouth as % of image width
  mouthHeightPct: number;   // Vertical height of mouth as % of image height
  mouthCenterXPct: number;  // X position of mouth center as % of image width
  mouthCenterYPct: number;  // Y position of mouth center as % of image height
  confidence: number;       // 0-1 confidence score
};

/**
 * Load an image from a URL
 */


/**
 * Find mouth region by detecting lip-colored pixels in the lower face area
 * 
 * Strategy:
 * 1. Focus on lower 40% of face (where mouth is typically located)
 * 2. Detect pixels with lip-like colors (reddish/pinkish hues)
 * 3. Find horizontal extent (width) and vertical extent (height)
 * 4. Calculate center position
 */


/**
 * Analyze an avatar image to detect mouth dimensions
 */


/**
 * Auto-calibrate mouth dimensions for a persona using their avatar PNG file
 */


/**
 * Batch auto-calibrate all personas
 */


/**
 * Manual calibration from exact pixel coordinates
 * Use this when you know the exact mouth dimensions in the original image
 */
export function manualCalibrateMouth(
  mouthMinX: number,
  mouthMaxX: number,
  mouthMinY: number,
  mouthMaxY: number,
  imageWidth: number = 768,
  imageHeight: number = 768
): MouthCalibrationResult {
  const mouthWidthPx = mouthMaxX - mouthMinX;
  const mouthHeightPx = mouthMaxY - mouthMinY;
  const centerX = (mouthMinX + mouthMaxX) / 2;
  const centerY = (mouthMinY + mouthMaxY) / 2;
  
  const mouthWidthPct = (mouthWidthPx / imageWidth) * 100;
  const mouthHeightPct = (mouthHeightPx / imageHeight) * 100;
  const mouthCenterXPct = (centerX / imageWidth) * 100;
  const mouthCenterYPct = (centerY / imageHeight) * 100;
  
  console.log(`[mouthCalibration] === MANUAL CALIBRATION RESULTS ===`);
  console.log(`[mouthCalibration] ✅ Manual calibration complete:`, {
    mouthWidthPct: mouthWidthPct.toFixed(2) + '%',
    mouthHeightPct: mouthHeightPct.toFixed(2) + '%',
    mouthCenterXPct: mouthCenterXPct.toFixed(2) + '%',
    mouthCenterYPct: mouthCenterYPct.toFixed(2) + '%',
  });
  
  return {
    mouthWidthPct,
    mouthHeightPct,
    mouthCenterXPct,
    mouthCenterYPct,
    confidence: 1.0, // Manual calibration is always high confidence
  };
}


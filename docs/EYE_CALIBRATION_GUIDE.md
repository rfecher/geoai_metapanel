# Eye Calibration Guide for BrandedAvatar

This guide explains how to calibrate pupil positions for personas in the BrandedAvatar component.

## Problem

The BrandedAvatar component overlays dark pupil circles on transparent PNG avatar images to simulate gaze tracking. For the pupils to appear correctly aligned with the actual eyes in the photos, we need to calibrate the following parameters for each persona:

- `eyeSeparationPct`: Distance between left and right pupils as a percentage of avatar width (typically 18-34%)
- `eyeCenterOffsetPct`: Horizontal offset from center if eyes are not perfectly centered (typically -15 to +15%)
- `eyeWidthPct`: Width of each eye region for eyelid overlays (typically 6-22%)
- `pupilSizeScale`: Multiplier for pupil size (typically 0.3-1.3)
- `eyeScale`: Global multiplier for all eye features (typically 0.5-2.0)

## Solution 1: Automatic Calibration (Recommended)

The automatic calibration analyzes the original avatar PNG images (e.g., `sarah.png`, `marcus.png`) to detect pupil positions using image processing.

### How the Algorithm Works

The improved auto-calibration algorithm:
1. **Focuses on the eye region** (20-50% from top, 15-85% horizontally) to avoid detecting hair, eyebrows, or other dark features
2. **Finds dark pixels** (pupils are typically the darkest features in the eye region)
3. **Clusters dark pixels** into regions (pupils are circular, 50-2000 pixels at 768x768 resolution)
4. **Validates pupil pairs** (must be horizontally aligned and separated by 18-34% of image width)
5. **Calculates percentages** for `eyeSeparationPct` and `eyeCenterOffsetPct`

### How to Use

1. **Open the Avatar Calibration Tool**
   - Click **Settings** button (top-right of main application)
   - Scroll to **"🎯 Avatar Calibration"** section
   - Click **"🔧 Open Avatar Calibration Tool"** button

2. **Click "Auto-Calibrate Eyes"**
   - Purple button in the top-right of the calibration tool
   - The tool will analyze all original avatar PNG files (e.g., `sarah.png`, `marcus.png`) in `/public/avatars/`
   - **Check browser console** for detailed detection logs showing pixel positions and cluster analysis

3. **Review Results**
   - The tool shows detected values for each persona
   - **Expected ranges (IMPORTANT):**
     - `eyeSeparationPct`: **18-34%** (typical for human faces at standard framing)
     - `eyeCenterOffsetPct`: **-15% to +15%** (slight left/right offset from center)
   - Confidence scores indicate detection quality:
     - **Green (>60%)**: High confidence, likely accurate
     - **Yellow (40-60%)**: Medium confidence, may need manual adjustment
     - **Red (<40%)**: Low confidence, use manual calibration instead
   - **⚠️ WARNING:** If values are outside expected ranges (e.g., eyeSeparationPct < 15% or > 40%), the detection likely failed and found non-pupil features (hair, eyebrows, etc.). Use manual calibration instead.

4. **Apply Calibration**
   - Click "Copy Code & Close"
   - The tool generates code snippets to add to `src/data/personas.ts`

5. **Update personas.ts**
   - For each persona, add the calibration parameters to their `faceAnchors`:

   ```typescript
   // Example for Sarah Chen
   faceAnchors: {
     "mouth": {
       "xPct": 49.64192708333333,
       "yPct": 54.06982421875,
       "sizePct": 40
     },
     "eyes": {
       "yPct": 36.078287760416664,
       "heightPct": 12
     },
     // Add these auto-calibrated values:
     "eyeSeparationPct": 24.5,
     "eyeCenterOffsetPct": -1.2,
   }
   ```

6. **Rebuild and Test**
   ```bash
   npm run build
   npm run dev
   ```

### How It Works

The auto-calibration algorithm:

1. Loads the original avatar PNG image for each persona (e.g., `sarah.png`)
2. Scans for dark pixels (pupils are typically the darkest regions in the eye area)
3. Clusters nearby dark pixels into regions
4. Identifies the two largest clusters as left and right pupils
5. Calculates center positions and separation distance
6. Converts pixel positions to percentages

### Limitations

- Requires good contrast between pupils and surrounding areas
- May fail if:
  - Pupils are not the darkest regions in the image
  - Image has heavy shadows or dark backgrounds
  - Eyes are partially closed or looking away
  - Image quality is poor

## Solution 2: Manual Calibration

If automatic calibration fails or needs refinement, use the manual calibration tool.

### How to Use

1. **Open the Avatar Calibration Tool**
   - Same as automatic calibration

2. **Select a Persona**
   - Click on the persona in the left sidebar (e.g., "Sarah Chen")

3. **Enable Preview Overlay**
   - Check the "Preview Overlay" checkbox
   - This shows the pupil and eyelid overlays on the avatar

4. **Adjust Eye Separation**
   - Use the "Eye Separation %" slider (18-34%)
   - This controls the distance between left and right pupils
   - **Increase** if pupils are too close together
   - **Decrease** if pupils are too far apart

5. **Adjust Eye Center Offset**
   - Use the "Eye Center Offset %" slider (-15 to +15%)
   - This shifts both pupils left or right together
   - **Positive values** shift pupils right
   - **Negative values** shift pupils left

6. **Adjust Eye Width**
   - Use the "Eye Width %" slider (6-22%)
   - This controls the width of eyelid overlays
   - Match this to the actual eye width in the photo

7. **Adjust Pupil Size**
   - Use the "Pupil Size Scale" slider (0.3-1.3)
   - This makes pupils larger or smaller
   - Default is 1.0

8. **Adjust Eye Scale**
   - Use the "Eye Scale" slider (0.5-2.0)
   - This scales all eye features together
   - Default is 1.0

9. **Save Calibration**
   - Click "Save & Close"
   - Calibration is saved to `avatar-face-anchors.json` in app user data

10. **Export to personas.ts** (Optional but Recommended)
    - The calibration is stored in localStorage/file
    - To make it permanent, copy values to `src/data/personas.ts`
    - Check the saved JSON file for the exact values

### Tips for Manual Calibration

- **Use a reference**: Open the transparent PNG in an image viewer to see exact eye positions
- **Zoom in**: Use browser dev tools to inspect the overlay positioning
- **Test with animation**: Enable gaze tracking to see how pupils move
- **Compare with working personas**: Marcus has good calibration - use as reference

## Current Calibration Status

### Personas with Good Calibration
- ✅ **Marcus Webb**: Default values work well (eyeSeparationPct: 26%, eyeCenterOffsetPct: 0%)

### Personas Needing Calibration
- ⚠️ **Sarah Chen**: Pupils misaligned (needs calibration)
- ⚠️ **Jessica Hayes**: Pupils misaligned (needs calibration)
- ⚠️ **Maya Ríos**: Not tested yet
- ⚠️ **Otto Reinhardt**: Not tested yet

## Recommended Workflow

1. **Start with auto-calibration** for all personas
2. **Review confidence scores**:
   - High confidence (>60%): Use auto-calibrated values
   - Medium confidence (40-60%): Use as starting point, refine manually
   - Low confidence (<40%): Use manual calibration
3. **Test in application** with gaze tracking enabled
4. **Fine-tune manually** if needed
5. **Update personas.ts** with final values
6. **Commit changes** to version control

## Troubleshooting

### Pupils are invisible
- Check that `gazeEnabled: true` in animationConfig
- Verify opacity is not too low (should be 0.75)
- Check z-index and stacking order

### Pupils are in wrong position
- Run auto-calibration first
- If auto-calibration fails, use manual calibration
- Check that faceAnchors includes eyeSeparationPct and eyeCenterOffsetPct

### Pupils are wrong size
- Adjust `pupilSizeScale` (default 1.0)
- Adjust `eyeScale` to scale all eye features together
- Check that `eyes.heightPct` is correct (typically 12%)

### Auto-calibration fails
- Check that the original avatar PNG file exists in `/public/avatars/` (e.g., `sarah.png`)
- Verify image has good contrast between pupils and surrounding areas
- Check that pupils are visible and not obscured by shadows or reflections
- Try manual calibration instead

## About the Avatar Image Files

The `/public/avatars/` directory contains several types of image files for each persona:

- **`{personaId}.png`** - Original full-face avatar with pupils visible
  - **Used for:** Auto-calibration pupil detection only
  - **Contains pupils:** ✅ Yes (needed for detection algorithm)
  - **Purpose:** Source images for the auto-calibration algorithm to analyze

- **`{personaId}-transparent.png`** - Final avatar with transparent background and pupils removed
  - **Used for:** Base layer in BrandedAvatar component (primary rendering)
  - **Contains pupils:** ❌ No (removed to avoid duplicates with animated overlays)
  - **Purpose:** Clean base image for rendering with animated pupil overlays on top

- **`{personaId}-eyes.png`** - Intermediate files with pupils removed
  - **Used for:** Not currently used (intermediate/legacy files from creation process)
  - **Contains pupils:** ❌ No (removed during creation)
  - **Purpose:** Intermediate step in creating the final `-transparent.png` files

- **`{personaId}_hybrid.svg`** - SVG-based avatar with embedded animations
  - **Used for:** SvgAnimatedAvatar component (alternative rendering approach)
  - **Contains pupils:** ✅ Yes (SVG elements with built-in animations)

- **`{personaId}_colors.json`** - Color palette extracted from avatar
  - **Used for:** Theming and color coordination

### Why Different Files for Detection vs Rendering?

**For Auto-Calibration (Detection):**
- We need the **original `.png` files** with pupils visible
- The algorithm analyzes dark regions to find pupil centers and calculate separation distance
- Example: `/avatars/sarah.png` → algorithm detects pupils at specific positions

**For BrandedAvatar (Rendering):**
- We use the **`-transparent.png` files** with pupils already removed
- These have transparent backgrounds and no pupils
- Then we overlay our own animated pupil graphics at the calibrated positions
- This prevents duplicate pupils (photo's original + our animated overlay)
- Example: `/avatars/sarah-transparent.png` → clean base + animated overlays

**Important:** Never use `-transparent.png` or `-eyes.png` files for auto-calibration - they won't work because the pupils have been removed!

## Technical Details

### Coordinate System

All positions use percentage-based coordinates relative to the avatar container:

- **X axis**: 0% = left edge, 50% = center, 100% = right edge
- **Y axis**: 0% = top edge, 50% = center, 100% = bottom edge

### Calculation Formulas

```typescript
// Left pupil X position
leftPupilXPct = 50 + eyeCenterOffsetPct - (eyeSeparationPct / 2)

// Right pupil X position
rightPupilXPct = 50 + eyeCenterOffsetPct + (eyeSeparationPct / 2)

// Pupil size
pupilSizePct = max(3.0, eyeHeightPct * 0.5 * pupilSizeScale) * eyeScale
```

### Default Values

If not specified in faceAnchors:
- `eyeSeparationPct`: 26%
- `eyeCenterOffsetPct`: 0%
- `eyeWidthPct`: eyeHeightPct * 1.5 (typically 18%)
- `pupilSizeScale`: 1.0
- `eyeScale`: 1.0

## Files Modified

- `src/utils/eyeCalibration.ts` - Auto-calibration algorithm
- `src/components/AutoEyeCalibration.tsx` - Auto-calibration UI
- `src/components/AvatarCalibrationTool.tsx` - Manual calibration tool
- `src/components/BrandedAvatar.tsx` - Avatar rendering with pupils
- `src/data/personas.ts` - Persona definitions with faceAnchors


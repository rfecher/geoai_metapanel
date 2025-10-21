# Piper TTS - Complete Solution

## The Real Problem

You installed Piper with `pip install piper-tts`, but it wasn't working because:

1. ❌ The `piper` command wasn't in your PATH
2. ❌ The voice models weren't downloaded yet

## Complete Solution

### Step 1: Piper is Already Installed ✅

You already have Piper installed at:
```
/Users/rfecher/Library/Python/3.9/bin/piper
```

### Step 2: Download Voice Models

The new version of Piper (1.3.0) requires you to download voice models separately.

**Quick way - Run the script:**
```bash
./download-piper-voices.sh
```

**Manual way - Download each voice:**
```bash
# List available voices
python3 -m piper.download_voices

# Download the voices needed for the app
python3 -m piper.download_voices en_GB-alba-medium      # Maya
python3 -m piper.download_voices en_US-lessac-medium    # Otto
python3 -m piper.download_voices en_US-amy-medium       # Sarah
python3 -m piper.download_voices en_US-ryan-medium      # Marcus
python3 -m piper.download_voices en_US-libritts-high    # Jessica
```

### Step 3: Test Piper

```bash
# Test with full path
python3 -m piper -m en_US-lessac-medium -f test.wav -- 'This is a test.'
afplay test.wav
```

### Step 4: Restart the App

```bash
npm run dev
```

The app will now automatically find Piper at `/Users/rfecher/Library/Python/3.9/bin/piper` and use it!

---

## What I Fixed in the Code

### 1. Smart Piper Detection

Updated `electron/main.ts` to search for Piper in multiple locations:
- `piper` (in PATH)
- `/usr/local/bin/piper`
- `/opt/homebrew/bin/piper`
- `~/Library/Python/3.9/bin/piper` ← **Your location!**
- `~/Library/Python/3.10/bin/piper`
- `~/Library/Python/3.11/bin/piper`
- `~/Library/Python/3.12/bin/piper`
- `~/.local/bin/piper`

The app will now find Piper even if it's not in your PATH!

### 2. Better Error Messages

- Shows exactly where it's looking for Piper
- Tells you if voice models are missing
- Provides clear installation instructions

### 3. Settings Persistence

- Piper selection now saves properly
- Won't revert to Web Speech on reload

---

## How to Use

### Option A: Download All Voices (Recommended)

```bash
./download-piper-voices.sh
```

This downloads all 5 voices needed for the personas (~100-200MB total).

### Option B: Download One Voice to Test

```bash
python3 -m piper.download_voices en_US-lessac-medium
```

Then test it:
```bash
python3 -m piper -m en_US-lessac-medium -f test.wav -- 'Hello from Piper!'
afplay test.wav
```

---

## Voice Mappings

| Persona | Voice Model | Size |
|---------|-------------|------|
| Maya Ríos | `en_GB-alba-medium` | ~20MB |
| Prof. Otto | `en_US-lessac-medium` | ~20MB |
| Dr. Sarah Chen | `en_US-amy-medium` | ~20MB |
| Dr. Marcus Webb | `en_US-ryan-medium` | ~20MB |
| Lt. Col. Jessica Park | `en_US-libritts-high` | ~50MB |

**Total:** ~130MB

---

## Troubleshooting

### "Unable to find voice" Error

**Problem:** Voice models not downloaded

**Solution:**
```bash
python3 -m piper.download_voices en_US-lessac-medium
```

### "piper: command not found" (in terminal)

**Problem:** Piper not in PATH

**Solution:** Use `python3 -m piper` instead of `piper`:
```bash
python3 -m piper -m en_US-lessac-medium -f test.wav -- 'Test'
```

**Or add to PATH** (optional):
```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# Then reload
source ~/.zshrc
```

### App Still Using Web Speech

1. **Download voice models first** (see above)
2. **Restart the app:** `npm run dev`
3. **Check console** for error messages
4. **Click "Test Piper Connection"** in settings

---

## Quick Start

```bash
# 1. Download voices
./download-piper-voices.sh

# 2. Test one voice
python3 -m piper -m en_US-lessac-medium -f test.wav -- 'This is a test.'
afplay test.wav

# 3. Restart app
npm run dev

# 4. In the app:
#    - Open Settings
#    - Select "Piper (local, high quality)"
#    - Click "Test Piper Connection"
#    - Should see: ✅ Piper is installed and ready!

# 5. Send a message and enjoy high-quality voices!
```

---

## Why This Happened

The new Piper 1.3.0 (from OHF-Voice/piper1-gpl) changed how it works:

**Old Piper (rhasspy/piper - archived):**
- Binary releases
- Voice models bundled or auto-downloaded
- Installed via Homebrew (unofficial)

**New Piper (OHF-Voice/piper1-gpl - current):**
- Python package via pip
- Voice models downloaded separately
- No Homebrew formula

The documentation was outdated and showed the old installation method.

---

## Files Created

1. **`download-piper-voices.sh`** - Script to download all voice models
2. **`PIPER_COMPLETE_SOLUTION.md`** - This file
3. **`PIPER_QUICK_FIX.md`** - Quick reference guide
4. **`PIPER_FIX_SUMMARY.md`** - Detailed fix documentation

---

## Summary

**The Issue:**
- ✅ Piper IS installed
- ❌ Voice models NOT downloaded
- ❌ Piper not in PATH (but app now finds it anyway!)

**The Solution:**
1. Download voice models: `./download-piper-voices.sh`
2. Restart app: `npm run dev`
3. Select Piper in settings
4. Enjoy! 🎤

---

## Next Steps

1. **Run the download script:**
   ```bash
   ./download-piper-voices.sh
   ```

2. **Wait for downloads to complete** (~2-5 minutes depending on internet speed)

3. **Restart the app:**
   ```bash
   npm run dev
   ```

4. **Test it:**
   - Open Settings
   - Select "Piper (local, high quality)"
   - Click "Test Piper Connection"
   - Send a message!

**You should now hear high-quality Piper voices!** 🎉


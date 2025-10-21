# Piper TTS - Quick Fix Guide

## The Problem

You were getting "Piper not found" because the installation command was wrong!

❌ **WRONG:** `brew install piper-tts` (This doesn't exist!)

✅ **CORRECT:** `pip install piper-tts` (Piper is a Python package!)

---

## Quick Fix Steps

### 1. Install Piper

```bash
pip install piper-tts
```

**If you get "pip: command not found":**

```bash
# Install Python first (macOS)
brew install python3

# Then install Piper
pip3 install piper-tts
```

### 2. Verify Installation

```bash
piper --version
```

You should see something like: `1.3.0`

### 3. Test Piper

```bash
echo "Hello, this is a test" | piper --model en_US-lessac-medium --output_file test.wav
afplay test.wav
```

This will:
- Download the voice model (first time only, ~20MB)
- Generate `test.wav`
- Play the audio

### 4. Restart Your App

```bash
# Make sure you're running in Electron mode
npm run dev
```

### 5. Test in the App

1. Open Settings (⚙️)
2. Select "Piper (local, high quality)"
3. Click "🔍 Test Piper Connection"
4. You should see: ✅ Piper is installed and ready!

---

## What Was Fixed

I updated all the documentation and error messages to show the correct installation command:

### Files Updated:
- ✅ `src/App.tsx` - UI now shows `pip install piper-tts`
- ✅ `electron/main.ts` - Error messages corrected
- ✅ `PIPER_TTS_SETUP.md` - Installation guide fixed
- ✅ `PIPER_FIX_SUMMARY.md` - Troubleshooting updated

### Code Fixes:
- ✅ Settings persistence (Piper selection now saves properly)
- ✅ Better error messages (shows exactly what's wrong)
- ✅ Diagnostic test button (easy way to check if Piper works)
- ✅ Startup diagnostics (automatic check on app start)

---

## Common Issues

### "pip: command not found"

**Solution:** Install Python first
```bash
brew install python3
pip3 install piper-tts
```

### "piper: command not found" after installing

**Solution:** The pip install location might not be in your PATH

```bash
# Find where pip installed piper
which piper

# If nothing shows up, try:
python3 -m piper --version

# Or add pip's bin directory to PATH:
export PATH="$HOME/Library/Python/3.x/bin:$PATH"
# (Replace 3.x with your Python version)
```

### Still using Web Speech after selecting Piper

**Check the browser console** (Cmd+Option+I) for error messages. The app will now show:
- ❌ Detailed error message
- 🔍 What to check
- 💡 How to fix it

---

## Why This Happened

The original Piper project (https://github.com/rhasspy/piper) was **archived** in October 2025, and development moved to a new repository (https://github.com/OHF-Voice/piper1-gpl).

The new version is distributed as a **Python package** via PyPI, not as a Homebrew formula. The old documentation incorrectly suggested using Homebrew.

---

## Next Steps

1. **Install Piper:**
   ```bash
   pip install piper-tts
   ```

2. **Restart the app:**
   ```bash
   npm run dev
   ```

3. **Test it:**
   - Open Settings
   - Select Piper
   - Click "Test Piper Connection"
   - Send a message and listen!

---

## Need Help?

If you still have issues:

1. **Check the console** - Look for error messages starting with `❌`
2. **Run the test button** - It will tell you exactly what's wrong
3. **Check Python version** - Piper requires Python 3.7+
   ```bash
   python3 --version
   ```

4. **Try manual test:**
   ```bash
   echo "test" | piper --model en_US-lessac-medium --output_file test.wav
   afplay test.wav
   ```

---

## Summary

**Before:**
- ❌ Wrong installation command (`brew install piper-tts`)
- ❌ Settings didn't persist
- ❌ Silent fallback to Web Speech
- ❌ No way to diagnose issues

**After:**
- ✅ Correct installation command (`pip install piper-tts`)
- ✅ Settings persist properly
- ✅ Clear error messages with alerts
- ✅ Diagnostic test button
- ✅ Automatic startup check

**Install Piper now and enjoy high-quality local voices!** 🎤✨


# Piper TTS Fix Summary

## Issues Fixed

### 1. ✅ Settings Not Persisting
**Problem:** When you selected "Piper" from the dropdown and reloaded the app, it would revert to "Web Speech".

**Root Cause:** In `src/App.tsx` line 97, the localStorage loading logic only checked for `'webspeech'`, `'azure'`, and `'elevenlabs'` but not `'piper'`.

**Fix:** Added `|| s.ttsProvider === 'piper'` to the condition.

**File:** `src/App.tsx` line 97

---

### 2. ✅ Silent Fallback to Web Speech
**Problem:** When Piper failed, it would silently fall back to Web Speech without telling you why.

**Root Cause:** The error was logged to console but not prominently displayed.

**Fix:** Added:
- Detailed console error messages explaining the 3 possible failure reasons
- Alert dialog showing the error to the user
- Clear instructions on what to check

**File:** `src/services/tts.ts` lines 44-61

---

### 3. ✅ No Diagnostic Tool
**Problem:** No easy way to test if Piper is properly configured.

**Fix:** Added a "🔍 Test Piper Connection" button in the settings panel that:
- Checks if Electron IPC is available
- Tests if Piper is installed
- Shows clear error messages
- Provides installation instructions

**File:** `src/App.tsx` lines 373-401

---

### 4. ✅ Startup Diagnostics
**Problem:** No visibility into Piper status when the app starts.

**Fix:** Added automatic Piper availability check on app startup that logs:
- Whether Electron IPC is available
- Whether Piper is installed
- Clear warnings if something is wrong

**File:** `src/App.tsx` lines 61-82

---

## How to Test the Fixes

### Step 1: Restart the App
```bash
# Make sure you're running in Electron mode
npm run dev
```

### Step 2: Check Console on Startup
Open the browser DevTools (Cmd+Option+I) and look for:
```
🔍 Checking Piper availability...
  window.electron: {...}
  window.electron?.piperSpeak: function
  window.electron?.piperTest: function
✅ Piper is available and ready!
```

**OR** if there's a problem:
```
⚠️ Electron IPC not available - Piper will not work
   Make sure you are running: npm run dev (not just vite)
```

### Step 3: Open Settings
Click the ⚙️ Settings button

### Step 4: Select Piper
Choose "Piper (local, high quality)" from the TTS Provider dropdown

### Step 5: Test Connection
Click the "🔍 Test Piper Connection" button

You should see one of these messages:

**✅ Success:**
```
✅ Piper is installed and ready!

You can now use Piper TTS.
```

**❌ Electron Not Available:**
```
❌ Electron IPC not available!

This means you're running in a browser, not in Electron.

Piper requires Electron. Run: npm run dev
```

**❌ Piper Not Installed:**
```
❌ Piper test failed:

Piper not installed. Install with: pip install piper-tts
```

### Step 6: Send a Message
If the test passed, send a message and listen for high-quality Piper voices!

---

## Common Issues and Solutions

### Issue: "Electron IPC not available"

**Cause:** You're running the app in a regular browser instead of Electron.

**Solution:**
```bash
# Stop the current process (Ctrl+C)
# Run the correct command:
npm run dev
```

This command runs both Vite AND Electron together.

---

### Issue: "Piper not installed"

**Cause:** The Piper command-line tool is not installed on your system.

**Solution:**
```bash
# Install Piper (it's a Python package, NOT a Homebrew formula!)
pip install piper-tts

# If pip is not found, install Python first:
# brew install python3
# pip3 install piper-tts

# Verify installation
piper --version

# Test it
echo "Hello" | piper --model en_US-lessac-medium --output_file test.wav
afplay test.wav
```

---

### Issue: "Piper TTS failed" with voice model error

**Cause:** The voice model hasn't been downloaded yet.

**Solution:** Piper will automatically download voice models on first use. Wait a few seconds for the download to complete. You can pre-download them:

```bash
# Create voices directory
mkdir -p ~/.local/share/piper/voices

# Download the voices
piper --model en_GB-alba-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-lessac-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-amy-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-ryan-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-libritts-high --download-dir ~/.local/share/piper/voices
```

---

### Issue: Still using Web Speech after selecting Piper

**Debugging Steps:**

1. **Check the console** - Look for error messages starting with `❌ PIPER TTS FAILED`

2. **Look at the alert dialog** - It will show the specific error

3. **Check the startup logs** - Look for the Piper availability check

4. **Run the test button** - Click "🔍 Test Piper Connection" to diagnose

5. **Verify you're in Electron:**
   ```javascript
   // In browser console:
   console.log(window.electron)
   // Should show an object with piperSpeak and piperTest functions
   ```

---

## Files Changed

1. **src/App.tsx**
   - Line 8: Added import for piper types
   - Lines 61-82: Added startup diagnostics
   - Line 97: Fixed settings persistence
   - Lines 373-401: Added test button

2. **src/services/tts.ts**
   - Lines 44-61: Added detailed error logging and alert

---

## Next Steps

1. ✅ Restart the app with `npm run dev`
2. ✅ Check console for startup diagnostics
3. ✅ Open Settings and select Piper
4. ✅ Click "Test Piper Connection"
5. ✅ If test passes, send a message and enjoy high-quality voices!
6. ❌ If test fails, follow the error message instructions

---

## Additional Resources

- **Setup Guide:** See `PIPER_TTS_SETUP.md` for detailed installation instructions
- **Integration Details:** See `PIPER_INTEGRATION_SUMMARY.md` for technical architecture
- **Piper GitHub:** https://github.com/rhasspy/piper
- **Voice Samples:** https://rhasspy.github.io/piper-samples/

---

## Summary

The main issue was that **Piper settings weren't being saved/loaded properly**, causing the app to revert to Web Speech on reload. Additionally, there was no clear feedback when Piper failed.

Now you have:
- ✅ Proper settings persistence
- ✅ Clear error messages
- ✅ Diagnostic test button
- ✅ Startup availability check

Try it out and let me know if you see any error messages! 🎤✨


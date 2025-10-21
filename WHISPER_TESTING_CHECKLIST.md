# Whisper Integration Testing Checklist

Use this checklist to verify the Whisper integration is working correctly.

## Pre-Installation Tests

- [ ] **Verify project structure**
  ```bash
  ls scripts/setup-whisper.sh
  ls src/services/whisper.ts
  ```

- [ ] **Check documentation exists**
  ```bash
  ls WHISPER_STT_SETUP.md
  ls VOICE_INPUT_QUICK_START.md
  ls WHISPER_INTEGRATION_SUMMARY.md
  ```

## Installation Tests

- [ ] **Run setup script**
  ```bash
  bash scripts/setup-whisper.sh
  ```
  Expected: Script completes without errors

- [ ] **Verify whisper.cpp binary**
  ```bash
  ls -lh whisper.cpp/main
  ```
  Expected: Executable file exists (~2-5MB)

- [ ] **Verify model downloaded**
  ```bash
  ls -lh whisper.cpp/models/ggml-base.en.bin
  ```
  Expected: Model file exists (~142MB)

- [ ] **Test whisper.cpp directly** (optional)
  ```bash
  cd whisper.cpp
  # Record a test audio file or use a sample
  ./main -m models/ggml-base.en.bin -f samples/jfk.wav
  ```
  Expected: Transcription output

## Application Startup Tests

- [ ] **Start the application**
  ```bash
  npm run dev
  ```
  Expected: App launches, DevTools open

- [ ] **Check console for Whisper test**
  Look for:
  ```
  🔍 Checking Whisper availability...
  ✅ Whisper is available and ready!
  ```

- [ ] **Verify no errors in console**
  Expected: No red error messages about Whisper

## UI Tests

### Settings Panel

- [ ] **Open Settings**
  Click ⚙️ button
  Expected: Settings panel opens

- [ ] **Find Whisper section**
  Scroll to "🎤 Voice Input (Whisper STT)"
  Expected: Section visible

- [ ] **Check availability status**
  Expected: "✅ Whisper is available" (green text)

- [ ] **Verify model selector**
  Expected: Dropdown with 4 options:
  - tiny.en (fastest, ~75MB)
  - base.en (balanced, ~142MB) ← selected
  - small.en (better, ~466MB)
  - medium.en (best, ~1.5GB)

- [ ] **Test connection button**
  Click "🔍 Test Whisper Connection"
  Expected: Alert "✅ Whisper is installed and ready!"

### Input Area

- [ ] **Verify microphone button exists**
  Expected: Green 🎤 button visible next to input field

- [ ] **Check button is enabled**
  Expected: Button is clickable (not grayed out)

- [ ] **Verify tooltip**
  Hover over 🎤 button
  Expected: Tooltip "Click to start voice input"

## Recording Tests

### Basic Recording

- [ ] **Start recording**
  Click 🎤 button
  Expected:
  - Button turns red
  - Button shows ⏹️ icon
  - Button pulses/animates
  - Input field shows "Recording... (click mic to stop)"
  - Input field is disabled

- [ ] **Browser requests microphone permission**
  Expected: Permission dialog appears (first time only)

- [ ] **Grant microphone permission**
  Click "Allow"
  Expected: Recording starts

- [ ] **Speak test phrase**
  Say clearly: "What are the key open source GeoAI tools?"
  Duration: ~5 seconds

- [ ] **Stop recording**
  Click ⏹️ button
  Expected:
  - Button shows ⏳ icon
  - Input field shows "Transcribing..."
  - Button is disabled

- [ ] **Wait for transcription**
  Expected: 1-3 seconds processing time

- [ ] **Verify transcription appears**
  Expected:
  - Text appears in input field
  - Text matches what you said (approximately)
  - 🎤 button returns to green
  - Input field is enabled

- [ ] **Send the message**
  Click Send or press Enter
  Expected: Message sent to panel, personas respond

### Edge Cases

- [ ] **Test very short recording (< 2 seconds)**
  Record: "Hello"
  Expected: May transcribe or be empty (acceptable)

- [ ] **Test longer recording (15-20 seconds)**
  Record a complex question
  Expected: Full transcription, takes 2-5 seconds

- [ ] **Test with background noise**
  Record with TV/music in background
  Expected: Transcription may be less accurate but should work

- [ ] **Test multiple recordings in sequence**
  1. Record first phrase
  2. Wait for transcription
  3. Record second phrase
  4. Expected: Second phrase appended to first

- [ ] **Test canceling by refreshing**
  1. Start recording
  2. Refresh page
  3. Expected: Recording stops, no errors

## Model Switching Tests

- [ ] **Switch to tiny.en model**
  1. Open Settings
  2. Change model to "tiny.en"
  3. Record test phrase
  Expected: Faster transcription, possibly less accurate

- [ ] **Switch to small.en model** (if downloaded)
  ```bash
  cd whisper.cpp
  bash models/download-ggml-model.sh small.en
  ```
  1. Change model to "small.en" in Settings
  2. Record test phrase
  Expected: Slower transcription, more accurate

## Error Handling Tests

- [ ] **Test without microphone permission**
  1. Revoke microphone permission in browser
  2. Click 🎤
  Expected: Error alert about microphone access

- [ ] **Test with Whisper not installed**
  1. Rename whisper.cpp directory: `mv whisper.cpp whisper.cpp.bak`
  2. Restart app
  Expected:
  - No 🎤 button OR
  - Settings show "❌ Whisper not installed"
  3. Restore: `mv whisper.cpp.bak whisper.cpp`

- [ ] **Test with model missing**
  1. Rename model file
  2. Try recording
  Expected: Error message about missing model

## Integration Tests

- [ ] **Voice input + Text input**
  1. Type: "What are the"
  2. Click 🎤
  3. Say: "ethical implications of geospatial AI"
  4. Expected: Combined text in input field

- [ ] **Voice input + Send**
  1. Record question
  2. Wait for transcription
  3. Click Send
  Expected: Personas respond to voice question

- [ ] **Voice input + TTS**
  1. Enable TTS (Piper or other)
  2. Record question with voice
  3. Send
  Expected: Personas respond with voice

- [ ] **Voice input during busy state**
  1. Send a question (panel becomes busy)
  2. Try to click 🎤
  Expected: Button is disabled, can't record

## Performance Tests

- [ ] **Measure transcription time**
  Record 10 seconds of speech
  Time from clicking ⏹️ to text appearing
  Expected:
  - Apple Silicon: 1-3 seconds
  - Intel Mac: 2-5 seconds
  - Linux: 3-7 seconds

- [ ] **Test CPU usage during transcription**
  Open Activity Monitor/Task Manager
  Record and transcribe
  Expected: CPU spike during transcription, then returns to normal

- [ ] **Test memory usage**
  Check memory before and after several transcriptions
  Expected: No significant memory leak

## Cross-Platform Tests (if applicable)

### macOS
- [ ] **Test on Apple Silicon (M1/M2/M3)**
  Expected: Fast transcription with Metal acceleration

- [ ] **Test on Intel Mac**
  Expected: Slower but functional

### Linux
- [ ] **Test on Ubuntu/Debian**
  Expected: Works with CPU

- [ ] **Test on Fedora/RHEL**
  Expected: Works with CPU

### Windows (future)
- [ ] **Test on Windows 10/11**
  Expected: Not yet implemented

## Documentation Tests

- [ ] **Follow VOICE_INPUT_QUICK_START.md**
  Complete all steps as a new user would
  Expected: Everything works as documented

- [ ] **Follow WHISPER_STT_SETUP.md**
  Verify all instructions are accurate
  Expected: No missing steps or errors

- [ ] **Check README.md**
  Verify voice input is mentioned
  Expected: Feature listed and documented

## Cleanup Tests

- [ ] **Verify temp files are cleaned up**
  ```bash
  ls /tmp/whisper-*.wav
  ```
  Expected: No files (or only very recent ones)

- [ ] **Test app quit cleanup**
  1. Start recording
  2. Quit app (Cmd+Q or close window)
  3. Check temp directory
  Expected: Temp files cleaned up

## Regression Tests

- [ ] **Verify existing features still work**
  - Text input
  - Send button
  - Persona selection
  - LLM provider settings
  - TTS functionality

- [ ] **Verify no console errors**
  Check for any new errors or warnings
  Expected: Clean console (except expected logs)

## User Experience Tests

- [ ] **Test with non-technical user**
  Have someone unfamiliar with the app try voice input
  Expected: Intuitive and easy to use

- [ ] **Test accessibility**
  - Tab navigation to 🎤 button
  - Screen reader announces button state
  Expected: Accessible to keyboard/screen reader users

- [ ] **Test on different screen sizes**
  Resize window to various sizes
  Expected: 🎤 button always visible and usable

## Final Verification

- [ ] **Complete end-to-end test**
  1. Fresh app start
  2. Open Settings, verify Whisper available
  3. Record a question with voice
  4. Send to panel
  5. Get responses
  6. Verify TTS works (if enabled)
  Expected: Complete workflow works smoothly

- [ ] **Review all documentation**
  - [ ] WHISPER_STT_SETUP.md
  - [ ] VOICE_INPUT_QUICK_START.md
  - [ ] WHISPER_INTEGRATION_SUMMARY.md
  - [ ] VOICE_INPUT_USAGE.md
  - [ ] README.md
  Expected: All accurate and helpful

## Sign-off

- [ ] **All critical tests pass**
- [ ] **No blocking bugs**
- [ ] **Documentation complete**
- [ ] **Ready for use**

---

## Test Results Template

```
Date: _______________
Tester: _______________
Platform: _______________
OS Version: _______________

Installation: ✅ / ❌
UI Tests: ✅ / ❌
Recording Tests: ✅ / ❌
Model Switching: ✅ / ❌
Error Handling: ✅ / ❌
Integration: ✅ / ❌
Performance: ✅ / ❌
Documentation: ✅ / ❌

Notes:
_________________________________
_________________________________
_________________________________

Overall Status: ✅ PASS / ❌ FAIL
```

## Troubleshooting During Testing

If any test fails, check:

1. **Console logs** - Look for error messages
2. **Whisper binary** - Verify it exists and is executable
3. **Model file** - Verify it exists and is correct size
4. **Microphone permissions** - Check OS and browser settings
5. **Temp directory** - Check for permission issues
6. **Documentation** - Follow setup guide exactly

## Reporting Issues

If you find bugs, note:
- Which test failed
- Error messages (console and alerts)
- Steps to reproduce
- Expected vs actual behavior
- Platform and OS version
- Screenshots if applicable

---

**Happy Testing! 🎤✨**


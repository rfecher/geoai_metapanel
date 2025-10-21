# Voice Input Quick Start 🎤

Get voice-to-text working in 3 steps!

## Step 1: Install Whisper

```bash
bash scripts/setup-whisper.sh
```

⏱️ Takes 5-10 minutes. Grab a coffee! ☕

## Step 2: Restart the App

```bash
npm run dev
```

## Step 3: Use Voice Input

1. Click the **🎤** button next to the input field
2. Speak your question
3. Click **⏹️** to stop
4. Wait 1-3 seconds for transcription
5. Click **Send** or press Enter

## That's it! 🎉

### Tips

- Speak clearly at a normal pace
- Keep recordings under 20 seconds for faster processing
- You can edit the transcribed text before sending
- Combine voice and typing: type part, then add more via voice

### Troubleshooting

**"Whisper not available"?**
- Run: `bash scripts/setup-whisper.sh`
- Restart the app

**Microphone not working?**
- Check browser/OS permissions
- macOS: System Preferences → Security & Privacy → Microphone

**Slow transcription?**
- In Settings, change model to `tiny.en` (faster but less accurate)

### Models

- `tiny.en` - Fastest (75MB)
- `base.en` - **Recommended** (142MB) ← Default
- `small.en` - More accurate (466MB)
- `medium.en` - Best accuracy (1.5GB)

Change model in Settings ⚙️

---

For detailed documentation, see [WHISPER_STT_SETUP.md](./WHISPER_STT_SETUP.md)


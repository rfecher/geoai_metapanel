# Whisper Speech-to-Text Setup Guide

This guide will help you set up local speech-to-text (voice input) using Whisper.cpp.

## Overview

The GeoAI MetaPanel now supports **local voice input** using OpenAI's Whisper model via the high-performance `whisper.cpp` implementation. This allows you to speak your questions instead of typing them.

### Features

- 🎤 **Local & Private**: All processing happens on your machine
- 🚀 **Fast**: Optimized C++ implementation with hardware acceleration
- 🎯 **Accurate**: Uses OpenAI's state-of-the-art Whisper model
- 💰 **Free**: No API costs or internet required
- 🔒 **Secure**: Your voice data never leaves your computer

## Quick Setup

### 1. Run the Setup Script

From your project root, run:

```bash
bash scripts/setup-whisper.sh
```

This script will:
- Clone and build `whisper.cpp`
- Download the `base.en` model (~142MB)
- Verify the installation

**Time required**: 5-10 minutes (depending on your internet speed and CPU)

### 2. Restart the App

If the app is running, restart it:

```bash
npm run dev
```

### 3. Test Voice Input

1. Click the **⚙️ Settings** button
2. Look for the "🎤 Voice Input (Whisper STT)" section
3. You should see "✅ Whisper is available"
4. Click the **🎤** button next to the input field
5. Speak your question
6. Click the **⏹️** button to stop recording
7. Wait for transcription (usually 1-3 seconds)
8. Your text will appear in the input field!

## Available Models

You can choose different models based on your needs:

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| `tiny.en` | ~75MB | Fastest | Good | Quick testing, fast machines |
| `base.en` | ~142MB | Fast | Better | **Recommended default** |
| `small.en` | ~466MB | Moderate | Great | High accuracy needs |
| `medium.en` | ~1.5GB | Slow | Best | Maximum accuracy |

### Downloading Additional Models

To download a different model:

```bash
cd whisper.cpp
bash models/download-ggml-model.sh small.en
```

Then select it in the Settings panel.

## How It Works

### Architecture

```
User speaks → Browser MediaRecorder → WAV conversion → 
Electron IPC → whisper.cpp → Transcription → Input field
```

1. **Recording**: Browser's MediaRecorder API captures audio
2. **Conversion**: Audio is converted to 16kHz mono WAV (Whisper's format)
3. **IPC**: Audio buffer sent to Electron main process
4. **Transcription**: whisper.cpp processes the audio
5. **Display**: Text appears in the input field

### Technical Details

- **Audio Format**: 16kHz, mono, 16-bit PCM WAV
- **Max Recording**: 30 seconds (configurable)
- **Processing**: Local CPU/GPU (Metal on Apple Silicon)
- **Privacy**: No data sent to cloud

## Usage Tips

### Best Practices

1. **Speak clearly** and at a normal pace
2. **Minimize background noise** for better accuracy
3. **Use shorter recordings** (10-20 seconds) for faster processing
4. **Check microphone permissions** if recording fails

### Keyboard Shortcuts

- Click **🎤** to start recording
- Click **⏹️** to stop and transcribe
- Press **Enter** to send (after transcription)

### Combining Voice and Text

You can mix voice input with typing:
1. Type part of your question
2. Click 🎤 to add more via voice
3. The transcription will be appended to existing text

## Troubleshooting

### "Whisper not available" Error

**Solution**: Run the setup script:
```bash
bash scripts/setup-whisper.sh
```

### Build Errors on macOS

If you get compilation errors:

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Try building again
cd whisper.cpp
make clean
make -j
```

### Build Errors on Linux

Install build dependencies:

```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# Fedora/RHEL
sudo dnf install gcc-c++ make

# Then rebuild
cd whisper.cpp
make clean
make -j
```

### Microphone Permission Denied

- **macOS**: System Preferences → Security & Privacy → Microphone → Enable for your terminal/Electron app
- **Linux**: Check PulseAudio/PipeWire permissions

### Slow Transcription

Try a smaller model:
1. Open Settings
2. Change Whisper model to `tiny.en`
3. Trade some accuracy for speed

### "Model not found" Error

Download the model manually:

```bash
cd whisper.cpp
bash models/download-ggml-model.sh base.en
```

## Performance

### Typical Transcription Times

On Apple M1/M2 (with Metal acceleration):
- 5 seconds of audio → ~1 second to transcribe
- 15 seconds of audio → ~2-3 seconds to transcribe

On Intel CPU:
- 5 seconds of audio → ~2-3 seconds to transcribe
- 15 seconds of audio → ~5-7 seconds to transcribe

### Hardware Acceleration

- **macOS (Apple Silicon)**: Automatically uses Metal
- **macOS (Intel)**: CPU only
- **Linux**: CPU (CUDA support available with custom build)

## Advanced Configuration

### Using Different Models

Edit `src/App.tsx` to change the default model:

```typescript
const [whisperModel, setWhisperModel] = useState<WhisperModel>('small.en');
```

### Adjusting Recording Duration

Edit `src/services/whisper.ts`:

```typescript
export async function recordAudio(durationMs: number = 60000) { // 60 seconds
  // ...
}
```

### Custom Whisper Build

For CUDA support on Linux:

```bash
cd whisper.cpp
make clean
WHISPER_CUDA=1 make -j
```

## Uninstalling

To remove Whisper:

```bash
rm -rf whisper.cpp
```

The app will continue to work without voice input.

## Privacy & Security

### What Data is Collected?

**None.** All processing happens locally:
- Audio is recorded in your browser
- Transcription happens on your machine
- No data is sent to any server
- Temporary audio files are deleted immediately

### Microphone Access

The app requests microphone access only when you click the 🎤 button. You can revoke this permission at any time in your browser/OS settings.

## Comparison with Other Options

| Feature | Whisper.cpp (Local) | Web Speech API | OpenAI Whisper API |
|---------|---------------------|----------------|-------------------|
| Privacy | ✅ Fully private | ⚠️ May use cloud | ❌ Sends to cloud |
| Cost | ✅ Free | ✅ Free | ❌ $0.006/minute |
| Offline | ✅ Yes | ❌ No | ❌ No |
| Accuracy | ✅ Excellent | ⚠️ Good | ✅ Excellent |
| Speed | ✅ Fast | ✅ Very fast | ⚠️ Network dependent |
| Setup | ⚠️ Requires install | ✅ Built-in | ✅ API key only |

## Resources

- [Whisper.cpp GitHub](https://github.com/ggerganov/whisper.cpp)
- [OpenAI Whisper Paper](https://arxiv.org/abs/2212.04356)
- [Whisper Model Card](https://github.com/openai/whisper/blob/main/model-card.md)

## Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Run the test: Click "🔍 Test Whisper Connection" in Settings
3. Check the console for error messages (View → Developer → Developer Tools)
4. Verify whisper.cpp built successfully: `ls -la whisper.cpp/main`

## Next Steps

Once voice input is working:

1. Try different models to find your preferred speed/accuracy balance
2. Experiment with longer recordings
3. Use voice input for complex questions that are tedious to type
4. Combine voice and text input for maximum efficiency

Enjoy hands-free interaction with your GeoAI panel! 🎤✨


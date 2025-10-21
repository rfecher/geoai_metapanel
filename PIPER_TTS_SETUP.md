# Piper TTS Setup Guide

Piper is a fast, local neural text-to-speech system that produces high-quality voices without requiring internet or API keys.

---

## 🚀 Quick Setup (macOS/Linux/Windows)

### 1. Install Piper

```bash
pip install piper-tts
```

**Note:** Piper is a Python package, not a Homebrew formula. Make sure you have Python 3.7+ installed.

### 2. Verify Installation

```bash
piper --version
```

You should see the Piper version number (e.g., `1.3.0`).

### 3. Test Piper

```bash
echo "Hello, this is a test" | piper --model en_US-lessac-medium --output_file test.wav
```

This will download the voice model (first time only) and generate `test.wav`.

### 4. Play the Audio

```bash
afplay test.wav
```

---

## 🎤 Voice Mappings in GeoAI MetaPanel

The app automatically assigns high-quality voices to each persona:

| Persona | Voice Model | Character |
|---------|-------------|-----------|
| **Maya Ríos** | `en_GB-alba-medium` | Warm, thoughtful female (British) |
| **Prof. Otto Reinhardt** | `en_US-lessac-medium` | Formal, precise male |
| **Dr. Sarah Hayes** | `en_US-amy-medium` | Friendly, energetic female |
| **Dr. Marcus Webb** | `en_US-ryan-medium` | Professional, confident male |
| **Lt. Col. Jessica Hayes** | `en_US-libritts-high` | Authoritative, clear female |

---

## 📥 Voice Models

Piper will automatically download voice models on first use. They're stored in:
```
~/.local/share/piper/voices/
```

Each voice model is ~10-50MB.

### Pre-download Voices (Optional)

To avoid delays during first use:

```bash
# Create voices directory
mkdir -p ~/.local/share/piper/voices

# Download the voices used by the app
piper --model en_GB-alba-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-lessac-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-amy-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-ryan-medium --download-dir ~/.local/share/piper/voices
piper --model en_US-libritts-high --download-dir ~/.local/share/piper/voices
```

---

## 🎯 Using Piper in the App

### 1. Open Settings

Click the ⚙️ Settings button in the app.

### 2. Select Piper

Under "TTS Provider", select **"Piper (local, high quality)"**

### 3. That's It!

Voices are automatically assigned to each persona. No API keys or configuration needed!

### 4. Test It

- Type a question
- Click Send
- Each persona will speak with their assigned voice

---

## 🔧 Troubleshooting

### "Piper not found" Error

**Problem:** The app can't find the Piper executable.

**Solution:**
```bash
# Check if Piper is installed
which piper

# If not found, install it with pip (NOT brew!)
pip install piper-tts

# Verify installation
piper --version
```

**Note:** If `pip` is not found, you may need to install Python first:
```bash
# macOS
brew install python3

# Then install Piper
pip3 install piper-tts
```

---

### Voice Download Fails

**Problem:** Piper can't download voice models.

**Solution:**
```bash
# Check internet connection
# Try downloading manually
piper --model en_US-lessac-medium --output_file /dev/null < /dev/null

# If it fails, check Piper's GitHub for voice URLs:
# https://github.com/rhasspy/piper/blob/master/VOICES.md
```

---

### Audio Doesn't Play

**Problem:** Piper generates audio but it doesn't play.

**Solution:**
1. Check system audio settings
2. Try playing a test file manually:
   ```bash
   echo "test" | piper --model en_US-lessac-medium --output_file test.wav
   afplay test.wav
   ```
3. Restart the app

---

### Slow First Use

**Problem:** First speech generation is slow.

**Explanation:** Piper downloads voice models on first use (~10-50MB each).

**Solution:** Pre-download voices (see above) or wait for the first download to complete.

---

## 🆚 Comparison with Other TTS Options

| Feature | Piper | Web Speech | Azure | ElevenLabs |
|---------|-------|------------|-------|------------|
| **Quality** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cost** | Free | Free | $$ | $$$ |
| **Privacy** | ✅ Local | ✅ Local | ❌ Cloud | ❌ Cloud |
| **Internet** | ❌ Not needed | ❌ Not needed | ✅ Required | ✅ Required |
| **Setup** | Easy | None | Medium | Easy |
| **Voices** | Many | System | Many | Many |
| **Speed** | Fast | Fast | Medium | Medium |

---

## 📚 Available Voices

Piper has 100+ voices in many languages. Here are some high-quality English voices:

### American English
- `en_US-amy-medium` - Female, clear
- `en_US-lessac-medium` - Male, formal
- `en_US-libritts-high` - Multiple speakers, best quality
- `en_US-ryan-medium` - Male, professional
- `en_US-kristin-medium` - Female, authoritative

### British English
- `en_GB-alba-medium` - Female, warm
- `en_GB-alan-medium` - Male, formal
- `en_GB-northern_english_male-medium` - Male, commanding

### Quality Levels
- **`-low`** = Lower pitch (not lower quality!)
- **`-medium`** = Medium pitch
- **`-high`** = Higher pitch or multi-speaker models

All quality levels use the same neural TTS technology.

---

## 🔗 Resources

- **Piper GitHub:** https://github.com/rhasspy/piper
- **Voice Samples:** https://rhasspy.github.io/piper-samples/
- **Voice List:** https://github.com/rhasspy/piper/blob/master/VOICES.md
- **Hugging Face Models:** https://huggingface.co/rhasspy/piper-voices

---

## 💡 Tips

### 1. Pre-download Voices
Download voices before a presentation to avoid delays:
```bash
piper --model en_US-lessac-medium --download-dir ~/.local/share/piper/voices
```

### 2. Test Voices
Try different voices to find your favorites:
```bash
echo "This is a test" | piper --model en_GB-alba-medium --output_file test.wav && afplay test.wav
```

### 3. Offline Use
Once voices are downloaded, Piper works completely offline!

### 4. Multiple Languages
Piper supports 40+ languages. See the voice list for options.

---

## 🎬 Example Usage

### Test All Persona Voices

```bash
# Maya (warm female)
echo "Data sovereignty is a human right" | piper --model en_GB-alba-medium --output_file maya.wav
afplay maya.wav

# Otto (formal male)
echo "That's not quite correct. Let me explain the proper coordinate system" | piper --model en_US-lessac-medium --output_file otto.wav
afplay otto.wav

# Sarah (friendly female)
echo "Open source creates better, more transparent technology" | piper --model en_US-amy-medium --output_file sarah.wav
afplay sarah.wav

# Marcus (business male)
echo "Results speak for themselves. Our platform prevented 847 casualties" | piper --model en_US-ryan-medium --output_file marcus.wav
afplay marcus.wav

# Jessica (authoritative female)
echo "Speed and effectiveness save lives" | piper --model en_US-libritts-high --output_file jessica.wav
afplay jessica.wav
```

---

## ✅ Summary

**Installation:**
```bash
pip install piper-tts
```

**Configuration:**
1. Open Settings in the app
2. Select "Piper (local, high quality)"
3. Done!

**Benefits:**
- ✅ High quality neural voices
- ✅ Free and local (no API keys)
- ✅ Works offline
- ✅ Fast generation
- ✅ Privacy-friendly
- ✅ Distinct voices per persona

**Perfect for:**
- Presentations without internet
- Privacy-conscious users
- High-quality voice output
- Multi-persona conversations

Enjoy your high-quality local TTS! 🎤✨


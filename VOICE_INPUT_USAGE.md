# Voice Input Usage Guide

## Visual Walkthrough

### Step 1: Initial State

When Whisper is installed and available, you'll see a green microphone button:

```
┌─────────────────────────────────────────────────────────┐
│  [🎤]  [Type your question or use voice input...    ]  │
│                                                    [Send]│
└─────────────────────────────────────────────────────────┘
```

### Step 2: Recording

Click the 🎤 button to start recording. It turns red and pulses:

```
┌─────────────────────────────────────────────────────────┐
│  [⏹️]  [Recording... (click mic to stop)            ]  │
│  RED                                               [Send]│
│ PULSE                                                    │
└─────────────────────────────────────────────────────────┘
```

**Now speak your question clearly!**

### Step 3: Transcribing

Click the ⏹️ button to stop. The app transcribes your speech:

```
┌─────────────────────────────────────────────────────────┐
│  [⏳]  [Transcribing...                              ]  │
│                                                    [Send]│
└─────────────────────────────────────────────────────────┘
```

**Wait 1-3 seconds...**

### Step 4: Result

Your transcribed text appears in the input field:

```
┌─────────────────────────────────────────────────────────┐
│  [🎤]  [What are the ethical implications of geospa  ]  │
│        [tial AI in disaster response?            ] [Send]│
└─────────────────────────────────────────────────────────┘
```

**Edit if needed, then click Send or press Enter!**

## Settings Panel

Open Settings (⚙️) to configure Whisper:

```
┌─────────────────────────────────────────────────────────┐
│ 🎤 Voice Input (Whisper STT)                            │
│ ✅ Whisper is available                                 │
│                                                          │
│ Whisper model:                                          │
│ [base.en (balanced, ~142MB)          ▼]                │
│                                                          │
│ Click the 🎤 button below to use voice input            │
└─────────────────────────────────────────────────────────┘
```

### Model Options

```
┌─────────────────────────────────────────────────────────┐
│ Whisper model:                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ tiny.en (fastest, ~75MB)                            │ │
│ │ base.en (balanced, ~142MB)          ← SELECTED      │ │
│ │ small.en (better, ~466MB)                           │ │
│ │ medium.en (best, ~1.5GB)                            │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Usage Patterns

### Pattern 1: Voice Only

1. Click 🎤
2. Speak your question
3. Click ⏹️
4. Wait for transcription
5. Click Send

**Best for:** Long, complex questions

### Pattern 2: Voice + Text

1. Type part of your question: "What are the"
2. Click 🎤
3. Speak the rest: "ethical implications of geospatial AI"
4. Click ⏹️
5. Result: "What are the ethical implications of geospatial AI"
6. Click Send

**Best for:** Combining quick typing with voice

### Pattern 3: Multiple Voice Segments

1. Click 🎤, speak "What are the ethical implications", click ⏹️
2. Wait for transcription
3. Click 🎤 again, speak "of geospatial AI in disaster response", click ⏹️
4. Result: Both segments combined
5. Click Send

**Best for:** Building complex questions incrementally

## Tips for Best Results

### 🎯 Speak Clearly
- Normal speaking pace (not too fast or slow)
- Clear pronunciation
- Natural pauses between phrases

### 🔇 Minimize Background Noise
- Close windows
- Turn off fans/AC if possible
- Use in quiet environment
- Consider using headset microphone

### ⏱️ Optimal Recording Length
- **5-15 seconds**: Best balance of speed and accuracy
- **< 5 seconds**: May miss context
- **> 30 seconds**: Slower processing, may lose focus

### 🎤 Microphone Position
- 6-12 inches from mouth
- Slightly off to the side (not directly in front)
- Avoid breathing directly into mic

### ✏️ Review Before Sending
- Always check transcription for accuracy
- Edit any mistakes
- Whisper is good but not perfect!

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Start recording | Click 🎤 |
| Stop recording | Click ⏹️ |
| Send message | Enter (after transcription) |
| Cancel recording | Refresh page (emergency only) |

## Common Scenarios

### Scenario 1: Technical Question

**You say:**
> "What are the key differences between raster and vector data models in the context of machine learning applications?"

**Transcription:**
```
What are the key differences between raster and vector data 
models in the context of machine learning applications?
```

**Result:** ✅ Perfect!

### Scenario 2: Question with Acronyms

**You say:**
> "How does GDAL handle coordinate reference systems in GeoTIFF files?"

**Transcription:**
```
How does GDAL handle coordinate reference systems in GeoTIFF files?
```

**Result:** ✅ Whisper handles technical terms well!

### Scenario 3: Complex Multi-part Question

**You say:**
> "Can you explain the trade-offs between using proprietary cloud platforms versus open source tools for geospatial AI, considering factors like cost, scalability, and vendor lock-in?"

**Transcription:**
```
Can you explain the trade-offs between using proprietary cloud 
platforms versus open source tools for geospatial AI, considering 
factors like cost, scalability, and vendor lock-in?
```

**Result:** ✅ Handles long, complex questions!

## Troubleshooting Visual Guide

### Problem: No 🎤 Button

```
┌─────────────────────────────────────────────────────────┐
│  [Type your question...                              ]  │
│                                                    [Send]│
└─────────────────────────────────────────────────────────┘
```

**Solution:** Whisper not installed
- Run: `bash scripts/setup-whisper.sh`
- Restart app

### Problem: Button Disabled (Grayed Out)

```
┌─────────────────────────────────────────────────────────┐
│  [🎤]  [Type your question...                        ]  │
│  GRAY                                              [Send]│
└─────────────────────────────────────────────────────────┘
```

**Solution:** Panel is busy
- Wait for current response to complete
- Then try again

### Problem: Empty Transcription

```
┌─────────────────────────────────────────────────────────┐
│  [🎤]  [                                              ]  │
│                                                    [Send]│
└─────────────────────────────────────────────────────────┘
```

**Solutions:**
- Speak louder
- Get closer to microphone
- Record for longer (5+ seconds)
- Check microphone is working in system settings

### Problem: Incorrect Transcription

```
┌─────────────────────────────────────────────────────────┐
│  [🎤]  [What are the ethical implications of juice   ]  │
│        [spatial AI?                              ] [Send]│
└─────────────────────────────────────────────────────────┘
```

**You said:** "geospatial AI"
**It heard:** "juice spatial AI"

**Solutions:**
- Speak more clearly
- Try a better model (small.en or medium.en)
- Edit the text manually before sending
- Reduce background noise

## Performance Indicators

### Fast Transcription (< 2 seconds)
```
🎤 → ⏹️ → ⏳ (1 sec) → ✅ Text appears
```
**Means:** Good performance, optimal setup

### Normal Transcription (2-5 seconds)
```
🎤 → ⏹️ → ⏳ (3 sec) → ✅ Text appears
```
**Means:** Expected performance

### Slow Transcription (> 5 seconds)
```
🎤 → ⏹️ → ⏳ (8 sec) → ✅ Text appears
```
**Means:** Consider using smaller model or closing other apps

## Advanced Usage

### Using Different Models for Different Needs

**Quick questions (tiny.en):**
- "What is GDAL?"
- "Define raster data"
- Fast transcription, good enough accuracy

**Normal questions (base.en):**
- "How does coordinate transformation work?"
- "Explain the difference between WGS84 and Web Mercator"
- Balanced speed and accuracy

**Complex questions (small.en or medium.en):**
- "Can you provide a detailed analysis of the ethical implications..."
- Technical terms, long sentences
- Best accuracy, slower processing

### Combining with Panel Features

1. **Voice + Persona Selection:**
   - Select specific personas
   - Use voice to ask complex questions
   - Get diverse perspectives

2. **Voice + Context:**
   - Build conversation with voice
   - Context window includes voice inputs
   - Natural conversation flow

3. **Voice + TTS:**
   - Ask questions with voice
   - Hear responses with TTS
   - Fully hands-free experience!

## Accessibility Benefits

Voice input makes the panel more accessible for:
- 👨‍🦽 Users with mobility impairments
- 👀 Users with visual impairments (combined with screen readers)
- 🤔 Users who think better by speaking
- 🏃 Users who are multitasking
- ⌨️ Users who want to reduce typing strain

## Privacy Reminder

```
┌─────────────────────────────────────────────────────────┐
│                    🔒 Your Privacy                       │
│                                                          │
│  ✅ All audio processing happens on YOUR computer       │
│  ✅ No data sent to cloud services                      │
│  ✅ Temporary files deleted immediately                 │
│  ✅ Microphone access only when YOU click 🎤            │
│  ✅ No audio recordings stored                          │
│                                                          │
│  Your voice data never leaves your machine!             │
└─────────────────────────────────────────────────────────┘
```

## Summary

Voice input with Whisper provides:
- ✅ Fast, accurate transcription
- ✅ Complete privacy
- ✅ Easy to use
- ✅ Works offline
- ✅ Free forever

**Just click 🎤, speak, and go!**


#!/bin/bash

# Download Piper TTS Voice Models
# This script downloads all the voice models needed for the GeoAI MetaPanel personas

echo "🎤 Downloading Piper TTS Voice Models..."
echo ""

# Check if piper is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python first."
    exit 1
fi

# Check if piper-tts is installed
if ! python3 -c "import piper" 2>/dev/null; then
    echo "❌ piper-tts not installed. Installing now..."
    pip3 install piper-tts
fi

echo "✅ Piper TTS is installed"
echo ""

# Create the voice directory if it doesn't exist
VOICE_DIR="$HOME/.local/share/piper-tts"
mkdir -p "$VOICE_DIR"

echo "Voice directory: $VOICE_DIR"
echo ""

# List of voices needed for the personas
voices=(
    "en_GB-semaine-medium"                   # Maya Ríos (Prudence #0) & Prof. Otto (Obadiah #2)
    "en_US-kathleen-low"                     # Dr. Sarah Hayes
    "en_US-bryce-medium"                     # Dr. Marcus Webb
    "en_US-amy-medium"                       # Lt. Col. Jessica Hayes
)

echo "Downloading ${#voices[@]} voice models..."
echo ""

for voice in "${voices[@]}"; do
    echo "📥 Downloading $voice..."
    python3 -m piper.download_voices "$voice" --download-dir "$VOICE_DIR"
    
    if [ $? -eq 0 ]; then
        echo "✅ $voice downloaded successfully"
    else
        echo "❌ Failed to download $voice"
    fi
    echo ""
done

echo "🎉 All voice models downloaded!"
echo ""
echo "Voice models are stored in ~/.local/share/piper-tts/"
echo "You can now use Piper TTS in the GeoAI MetaPanel app."
echo ""
echo "To test a voice, run:"
echo "  echo 'This is a test.' | piper --model en_GB-alan-medium --output_file test.wav"
echo "  afplay test.wav"


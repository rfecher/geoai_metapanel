#!/bin/bash

# Script to download Piper TTS voice models
# These are the voices used by the GeoAI MetaPanel personas

set -e

# Create directory for voice models
VOICE_DIR="$HOME/.local/share/piper-tts"
mkdir -p "$VOICE_DIR"

echo "📦 Downloading Piper voice models to: $VOICE_DIR"
echo ""

# Base URL for Piper voice models on Hugging Face
BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"

# Voice configurations: "voice_name|language_path"
declare -a VOICES=(
    "en_GB-alba-medium|en/en_GB/alba/medium"           # Maya Ríos
    "en_US-lessac-medium|en/en_US/lessac/medium"       # Prof. Otto
    "en_US-amy-medium|en/en_US/amy/medium"             # Dr. Sarah Hayes
    "en_US-kusal-medium|en/en_US/kusal/medium"             # Dr. Marcus Webb
    "en_US-libritts_r-medium|en/en_US/libritts_r/medium"  # Lt. Col. Jessica Hayes
)

# Download each voice
for voice_config in "${VOICES[@]}"; do
    # Split the configuration
    IFS='|' read -r voice path <<< "$voice_config"

    echo "⬇️  Downloading $voice..."

    # Download .onnx model file
    if [ ! -f "$VOICE_DIR/$voice.onnx" ]; then
        echo "   Downloading from: $BASE_URL/$path/$voice.onnx"
        curl -L -o "$VOICE_DIR/$voice.onnx" "$BASE_URL/$path/$voice.onnx" || {
            echo "❌ Failed to download $voice.onnx"
            continue
        }
        echo "✅ Downloaded $voice.onnx ($(du -h "$VOICE_DIR/$voice.onnx" | cut -f1))"
    else
        echo "✓ $voice.onnx already exists ($(du -h "$VOICE_DIR/$voice.onnx" | cut -f1))"
    fi

    # Download .onnx.json config file
    if [ ! -f "$VOICE_DIR/$voice.onnx.json" ]; then
        curl -L -o "$VOICE_DIR/$voice.onnx.json" "$BASE_URL/$path/$voice.onnx.json" || {
            echo "❌ Failed to download $voice.onnx.json"
            continue
        }
        echo "✅ Downloaded $voice.onnx.json"
    else
        echo "✓ $voice.onnx.json already exists"
    fi

    echo ""
done

echo "🎉 Voice model download complete!"
echo ""
echo "📁 Models installed in: $VOICE_DIR"
echo ""
echo "Installed voices:"
ls -lh "$VOICE_DIR"/*.onnx 2>/dev/null || echo "No models found"
echo ""
echo "Total size:"
du -sh "$VOICE_DIR" 2>/dev/null || echo "0"
echo ""
echo "✅ You can now use Piper TTS in the GeoAI MetaPanel app!"


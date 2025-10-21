#!/bin/bash

# Setup script for openWakeWord - Local wake word detection
# This script installs openWakeWord and its dependencies

set -e

echo "🎤 Setting up openWakeWord for local wake word detection..."
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "📍 Detected OS: $MACHINE"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo ""
    if [ "$MACHINE" = "Mac" ]; then
        echo "Install with: brew install python3"
    else
        echo "Install Python 3 from: https://www.python.org/downloads/"
    fi
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "✅ Found $PYTHON_VERSION"
echo ""

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed."
    exit 1
fi

echo "📦 Installing openWakeWord..."
echo ""

# Install openWakeWord
pip3 install openwakeword

echo ""
echo "📥 Downloading pre-trained models..."
echo ""

# Create models directory
MODELS_DIR="openwakeword_models"
mkdir -p "$MODELS_DIR"

# Download common wake word models using Python
echo "Downloading default wake word models..."
python3 << 'PYTHON_SCRIPT'
from openwakeword.model import Model
import os

# Create models directory
os.makedirs('openwakeword_models', exist_ok=True)

# Initialize model - this will download default models to cache
# We don't specify wakeword_models to let it download to default cache location
print("Initializing openWakeWord and downloading models...")
try:
    model = Model()
    print(f"✅ Models downloaded successfully!")
    print(f"Available models: {list(model.models.keys())}")
except Exception as e:
    print(f"❌ Error downloading models: {e}")
    print("Models will be downloaded on first use.")
PYTHON_SCRIPT

echo ""
echo "✅ openWakeWord setup complete!"
echo ""
echo "📍 Models directory: $MODELS_DIR"
echo ""
echo "Available wake words:"
echo "  - hey mycroft"
echo "  - alexa"
echo "  - hey jarvis"
echo "  - timer"
echo ""
echo "🎉 You can now use local wake word detection!"
echo ""
echo "To test:"
echo "  python3 scripts/test-openwakeword.py"


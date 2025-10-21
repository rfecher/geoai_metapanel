#!/bin/bash

# Setup script for whisper.cpp integration
# This downloads and builds whisper.cpp and downloads a model

set -e

echo "🎤 Setting up Whisper.cpp for local speech-to-text..."

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "📋 Detected: $OS on $ARCH"

# Create whisper directory in project root
WHISPER_DIR="$(pwd)/whisper.cpp"

if [ -d "$WHISPER_DIR" ]; then
  echo "⚠️  whisper.cpp directory already exists. Skipping clone."
else
  echo "📦 Cloning whisper.cpp..."
  git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
fi

cd "$WHISPER_DIR"

# Check for build tools
echo "🔍 Checking for build tools..."
if ! command -v make &> /dev/null; then
  echo "❌ 'make' not found. Please install build tools:"
  if [ "$OS" = "Darwin" ]; then
    echo "   Run: xcode-select --install"
  else
    echo "   Run: sudo apt-get install build-essential (Ubuntu/Debian)"
  fi
  exit 1
fi

# Check for cmake
if ! command -v cmake &> /dev/null; then
  echo "⚠️  CMake not found. Attempting to install..."
  if [ "$OS" = "Darwin" ]; then
    if command -v brew &> /dev/null; then
      echo "📦 Installing CMake via Homebrew..."
      brew install cmake
    else
      echo "❌ Homebrew not found. Please install CMake manually:"
      echo "   Option 1: Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
      echo "   Option 2: Download CMake from: https://cmake.org/download/"
      exit 1
    fi
  elif [ "$OS" = "Linux" ]; then
    echo "❌ CMake not found. Please install it:"
    echo "   Ubuntu/Debian: sudo apt-get install cmake"
    echo "   Fedora/RHEL: sudo dnf install cmake"
    exit 1
  fi
fi

# Build whisper.cpp using CMake
echo "🔨 Building whisper.cpp with CMake..."
if [ "$OS" = "Darwin" ]; then
  # macOS - use Metal acceleration if available
  if [ "$ARCH" = "arm64" ]; then
    echo "🍎 Building with Metal acceleration for Apple Silicon..."
    cmake -B build -DWHISPER_METAL=ON
  else
    echo "🍎 Building for Intel Mac..."
    cmake -B build
  fi
elif [ "$OS" = "Linux" ]; then
  echo "🐧 Building for Linux..."
  cmake -B build
else
  echo "❌ Unsupported OS: $OS"
  exit 1
fi

echo "🔨 Compiling (this may take a few minutes)..."
cmake --build build --config Release -j

# Check if main binary was created
if [ ! -f "build/bin/main" ]; then
  echo "❌ Build failed - main binary not found"
  exit 1
fi

# Create symlink for easier access
ln -sf build/bin/main main
echo "✅ Created symlink: whisper.cpp/main -> build/bin/main"

# Download model if not exists
MODEL_DIR="$WHISPER_DIR/models"
mkdir -p "$MODEL_DIR"

# Use base.en model (good balance of speed and accuracy for English)
MODEL_NAME="base.en"
MODEL_FILE="$MODEL_DIR/ggml-$MODEL_NAME.bin"

if [ -f "$MODEL_FILE" ]; then
  echo "✅ Model $MODEL_NAME already exists"
else
  echo "📥 Downloading Whisper model: $MODEL_NAME (this may take a few minutes)..."
  bash "$WHISPER_DIR/models/download-ggml-model.sh" "$MODEL_NAME"
fi

# Download VAD model for voice activity detection
VAD_MODEL="$MODEL_DIR/ggml-silero-v5.1.2.bin"
if [ -f "$VAD_MODEL" ]; then
  echo "✅ VAD model already exists"
else
  echo "📥 Downloading VAD model for voice activity detection (~1MB)..."
  bash "$WHISPER_DIR/models/download-vad-model.sh" silero-v5.1.2
fi

echo ""
echo "✅ Whisper.cpp setup complete!"
echo ""
echo "📍 Whisper binary: $WHISPER_DIR/main (symlink to build/bin/main)"
echo "📍 Model file: $MODEL_FILE"
echo ""
echo "🧪 Testing whisper..."
if [ -f "$WHISPER_DIR/main" ] || [ -f "$WHISPER_DIR/build/bin/main" ]; then
  echo "✅ Whisper binary found and ready!"

  # Test with sample audio if available
  if [ -f "$WHISPER_DIR/samples/jfk.wav" ]; then
    echo ""
    echo "🎤 Testing with sample audio..."
    "$WHISPER_DIR/main" -m "$MODEL_FILE" -f "$WHISPER_DIR/samples/jfk.wav" -nt -np 2>/dev/null | head -5
    echo ""
  fi
else
  echo "❌ Whisper binary not found. Build may have failed."
  exit 1
fi

echo ""
echo "🎉 Setup complete! You can now use voice-to-text in the app."
echo ""
echo "Available models (you can download more):"
echo "  - tiny.en    (fastest, least accurate, ~75MB)"
echo "  - base.en    (good balance, ~142MB) ← INSTALLED"
echo "  - small.en   (better accuracy, ~466MB)"
echo "  - medium.en  (high accuracy, ~1.5GB)"
echo ""
echo "To download a different model:"
echo "  cd whisper.cpp && bash models/download-ggml-model.sh <model-name>"


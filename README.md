# GeoAI MetaPanel

A cross-platform Electron desktop application featuring a simulated roundtable of AI-generated expert personas for GeoAI discussions. Each persona represents a unique ideological and technical stance on topics at the heart of the FOSS4G community.

## Features

- **Multiple AI Personas**: Engage with diverse expert perspectives including Maya Ríos (Indigenous data sovereignty advocate), Prof. Otto Reinhardt (spatial ontologist), and others
- **Multiple LLM Providers**: Support for Ollama, LM Studio, OpenAI, and any OpenAI-compatible API
- **Easy Provider Switching**: Quick presets for common setups with one-click testing
- **Per-Persona Models**: Assign different models to different personas for varied perspectives
- **🎤 Voice Input (NEW!)**: Local speech-to-text using Whisper.cpp
  - Speak your questions instead of typing
  - Completely private - runs locally on your machine
  - Fast and accurate transcription
  - See [VOICE_INPUT_QUICK_START.md](./VOICE_INPUT_QUICK_START.md)
- **High-Quality Text-to-Speech**: Multiple TTS providers including:
  - **Piper** (local, high-quality neural voices) - Recommended! 🔊
  - Web Speech API (browser built-in)
  - Azure Neural TTS
  - ElevenLabs
- **Distinct Voices Per Persona**: Each character has a unique, carefully selected voice
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Project Structure

```
geoai_metapanel/
├── electron/           # Electron main process and preload scripts
│   ├── main.ts        # Main process entry point
│   └── preload.ts     # Preload script for secure IPC
├── src/               # React renderer process
│   ├── App.tsx        # Main application component
│   ├── components/    # React components
│   ├── data/          # Persona definitions
│   ├── services/      # API services (Ollama, TTS)
│   ├── main.tsx       # Renderer entry point
│   └── styles.css     # Application styles
├── images/            # Persona avatars and assets
├── build/             # Build resources (icons, entitlements)
├── dist/              # Vite build output (renderer)
├── dist-electron/     # Compiled Electron main process
├── release/           # electron-builder output
├── index.html         # HTML entry point
├── package.json       # Project configuration
├── tsconfig.json      # TypeScript configuration
└── vite.config.ts     # Vite bundler configuration
```

## Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **LLM Provider** (choose one or more):
  - **Ollama**: Install from [ollama.ai](https://ollama.ai) for local LLM inference (recommended for getting started)
  - **LM Studio**: Download from [lmstudio.ai](https://lmstudio.ai) for GUI-based local model management
  - **OpenAI API**: Sign up at [platform.openai.com](https://platform.openai.com) for cloud-based inference
  - **Other**: Any OpenAI-compatible API endpoint
- **TTS (Optional)**:
  - **Piper** (recommended): `brew install piper-tts` for high-quality local voices
  - Or use built-in browser TTS (no installation needed)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd geoai_metapanel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your preferred LLM provider:

   **Option A - Ollama (Recommended for beginners):**
   ```bash
   # Install Ollama from https://ollama.ai
   ollama pull llama3.1
   ollama serve
   ```

   **Option B - LM Studio:**
   - Download and install LM Studio
   - Download models through the GUI
   - Start the local server (→ tab)

   **Option C - OpenAI:**
   - Sign up and get an API key
   - Configure in the app's Settings panel

   See [LLM_SETUP_GUIDE.md](LLM_SETUP_GUIDE.md) for detailed setup instructions.

## Development

Run the application in development mode with hot-reload:

```bash
npm run dev
```

This will:
- Start the Vite development server for the React renderer
- Compile the Electron main process
- Launch the Electron application with DevTools open

## Building for Production

### Build for Current Platform

```bash
npm run build
```

This creates a distributable package for your current platform in the `release/` directory.

### Platform-Specific Builds

#### macOS
```bash
npm run build:mac
```

Creates:
- `.dmg` installer (universal binary for Intel and Apple Silicon)
- `.zip` archive

**Requirements:**
- macOS 10.13 or higher
- Xcode Command Line Tools

**Code Signing (Optional):**
To sign the macOS app, set these environment variables:
```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
export APPLE_ID=your@apple.id
export APPLE_ID_PASSWORD=app-specific-password
```

#### Windows
```bash
npm run build:win
```

Creates:
- `.exe` NSIS installer (64-bit and 32-bit)
- Portable `.exe` (64-bit)

**Requirements:**
- Windows 7 or higher
- Can be built from macOS/Linux using Wine

**Code Signing (Optional):**
To sign the Windows app, set these environment variables:
```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password
```

#### Linux
```bash
npm run build:linux
```

Creates:
- `.AppImage` (portable)
- `.deb` package (Debian/Ubuntu)

**Requirements:**
- Ubuntu 18.04 or equivalent

### Build Directory Only (No Installer)

For testing the packaged app without creating installers:

```bash
npm run build:dir
```

## Configuration

### LLM Provider Settings

Configure your LLM provider in the app's Settings panel:

1. **Choose Provider**: Select from Ollama, LM Studio, OpenAI, or Custom
2. **Test Connection**: Click the test button to verify your setup
3. **Refresh Models**: Load available models from your provider
4. **Set Default Model**: Choose which model to use by default
5. **Per-Persona Overrides**: Optionally assign different models to different personas

For detailed setup instructions for each provider, see [LLM_SETUP_GUIDE.md](LLM_SETUP_GUIDE.md).

**Quick Setup Examples:**
- **Ollama**: Base URL `http://localhost:11434`, Model `llama3.1`
- **LM Studio**: Base URL `http://localhost:1234`, Model `local-model`
- **OpenAI**: Base URL `https://api.openai.com/v1`, Model `gpt-4`, API Key required

### Voice Input (Speech-to-Text)

**NEW!** Use your voice to ask questions instead of typing.

**Quick Setup:**
```bash
bash scripts/setup-whisper.sh
```

Then click the 🎤 button in the app to start recording. See [VOICE_INPUT_QUICK_START.md](./VOICE_INPUT_QUICK_START.md) for details.

**Features:**
- 🔒 **100% Private**: All processing happens locally
- 🚀 **Fast**: 1-3 second transcription time
- 🎯 **Accurate**: Uses OpenAI's Whisper model
- 💰 **Free**: No API costs

### TTS Settings (Text-to-Speech)

Choose from multiple TTS providers:
1. **Piper** (Recommended): Local, high-quality neural voices - see [PIPER_TTS_SETUP.md](PIPER_TTS_SETUP.md)
2. **Web Speech API**: Built-in browser TTS (free, no setup)
3. **Azure Neural**: High-quality neural voices (requires Azure subscription)
4. **ElevenLabs**: Premium AI voices (requires ElevenLabs API key)

## Adding Custom Icons

To customize the application icon:

1. Create icons in the following formats:
   - **macOS**: `build/icon.icns` (1024x1024 PNG converted to ICNS)
   - **Windows**: `build/icon.ico` (256x256 PNG converted to ICO)
   - **Linux**: `build/icon.png` (512x512 PNG)

2. Use online tools or command-line utilities:
   ```bash
   # macOS: Convert PNG to ICNS
   iconutil -c icns icon.iconset
   
   # Windows: Use ImageMagick
   convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
   ```

## Troubleshooting

### LLM Connection Issues

**General Steps:**
1. Click **🔌 Test Connection** in Settings to diagnose the issue
2. Verify the base URL is correct (include `http://` or `https://`)
3. Check that your LLM server is running
4. Try the **🔄 Refresh** button to reload available models

**Provider-Specific:**

**Ollama:**
- Ensure Ollama is running: `ollama serve`
- Check the base URL in Settings: `http://localhost:11434`
- Verify models are installed: `ollama list`

**LM Studio:**
- Open LM Studio and go to the Local Server tab (→)
- Click "Start Server"
- Verify the port matches your base URL (usually `1234`)
- Make sure a model is loaded

**OpenAI:**
- Verify your API key is correct
- Check your account has credits/billing enabled
- Ensure you have internet connectivity

For more troubleshooting help, see [LLM_SETUP_GUIDE.md](LLM_SETUP_GUIDE.md).

### Build Issues

- **macOS**: Install Xcode Command Line Tools: `xcode-select --install`
- **Windows**: Ensure you have Visual Studio Build Tools or equivalent
- **Linux**: Install required dependencies: `sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0`

### SSL Certificate Issues

If you encounter SSL certificate errors during `npm install`, you may need to configure npm:
```bash
npm config set strict-ssl false
```
Or use a corporate proxy if behind a firewall.

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **electron-builder**: Application packaging and distribution
- **Ollama**: Local LLM inference

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on the GitHub repository.


import { app, BrowserWindow, ipcMain } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, readdir, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { constants } from 'node:fs';

const execAsync = promisify(exec);

// Track temp files for cleanup
const tempFiles = new Set<string>();

// openWakeWord service
let wakeWordProcess: ChildProcess | null = null;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

let win: BrowserWindow | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 780,
    show: false, // Don't show until ready to prevent blank window flash
    webPreferences: {
      preload: join(ROOT_DIR, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'GeoAI MetaPanel',
  });

  // Show window when ready to prevent blank window
  win.once('ready-to-show', () => {
    win?.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    console.log('🔵 Loading Electron window from:', devUrl);
    await win.loadURL(devUrl);
    // Always open DevTools in development to help debug
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(join(ROOT_DIR, '../index.html'));
  }

  // Log when window is ready
  win.webContents.on('did-finish-load', () => {
    console.log('✅ Electron window loaded successfully');
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Electron window failed to load:', errorCode, errorDescription);
  });
}

// Clean up orphaned temp files on startup, then create window
app.whenReady().then(async () => {
  await cleanupAllTempFiles();
  createWindow();
});

app.on('window-all-closed', () => {
  // In development, always quit when window closes for easier workflow
  // In production, follow macOS convention (keep app running)
  if (process.env.VITE_DEV_SERVER_URL || process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Clean up temp files when app quits
app.on('before-quit', async (event) => {
  event.preventDefault();
  await cleanupAllTempFiles();
  app.exit(0);
});

// ============================================================================
// Piper TTS IPC Handlers (with request queue to serialize synthesis)
// ============================================================================

// Simple FIFO queue to serialize Piper synthesis requests. This avoids
// concurrency issues observed when multiple piper processes run at once.
// Only affects the Piper provider; other TTS providers are unaffected.

type PiperTask<T> = () => Promise<T>;
const piperQueue: Array<{ id: number; fn: PiperTask<any>; resolve: (v: any) => void; reject: (e: any) => void; }> = [];
let piperProcessing = false;
let piperTaskCounter = 0;

function enqueuePiper<T>(fn: PiperTask<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++piperTaskCounter;
    piperQueue.push({ id, fn, resolve, reject });
    console.log(`🟡 Piper queue: enqueued task #${id}. Pending ahead: ${piperQueue.length - 1}`);
    // Defer processing to next tick so rapid bursts coalesce cleanly
    process.nextTick(processPiperQueue);
  });
}

async function processPiperQueue() {
  if (piperProcessing) return;
  const next = piperQueue.shift();
  if (!next) return;
  piperProcessing = true;
  const start = Date.now();
  console.log(`🟠 Piper queue: starting task #${next.id}. Remaining in queue: ${piperQueue.length}`);
  try {
    const res = await next.fn();
    next.resolve(res);
    console.log(`🟢 Piper queue: finished task #${next.id} in ${Date.now() - start}ms`);
  } catch (err) {
    console.error(`🔴 Piper queue: task #${next.id} failed`, err);
    next.reject(err);
  } finally {
    piperProcessing = false;
    // Continue with the next task (if any)
    process.nextTick(processPiperQueue);
  }
}

/**
 * Find the piper executable
 */
async function findPiper(): Promise<string | null> {
  // Try common locations
  const locations = [
    'piper', // In PATH
    '/usr/local/bin/piper',
    '/opt/homebrew/bin/piper',
    `${process.env.HOME}/Library/Python/3.9/bin/piper`,
    `${process.env.HOME}/Library/Python/3.10/bin/piper`,
    `${process.env.HOME}/Library/Python/3.11/bin/piper`,
    `${process.env.HOME}/Library/Python/3.12/bin/piper`,
    `${process.env.HOME}/.local/bin/piper`,
  ];

  for (const location of locations) {
    try {
      // Use --help instead of --version (new piper doesn't support --version)
      const { stdout, stderr } = await execAsync(`${location} --help 2>&1`);
      const output = stdout + stderr;
      // Check if output contains "usage: piper" which indicates it's the real piper
      if (output.includes('usage: piper') || output.includes('piper [-h]')) {
        console.log(`✅ Found piper at: ${location}`);
        return location;
      }
    } catch (error) {
      // Continue to next location
    }
  }

  return null;
}

/**
 * Test if Piper is installed and available
 */
ipcMain.handle('piper-test', async () => {
  try {
    const piperPath = await findPiper();
    if (piperPath) {
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Piper not found. Install with: pip install piper-tts\n\nIf already installed, you may need to add it to PATH:\nexport PATH="$HOME/Library/Python/3.9/bin:$PATH"'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Piper not installed. Install with: pip install piper-tts',
    };
  }
});

/**
 * Clean up a temp file and remove from tracking set
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
    tempFiles.delete(filePath);
    console.log('🗑️ Cleaned up temp file:', filePath);
  } catch (error) {
    // File might not exist or already deleted, that's okay
    tempFiles.delete(filePath);
  }
}

/**
 * Clean up all remaining temp files (called on app quit)
 */
async function cleanupAllTempFiles(): Promise<void> {
  console.log('🧹 Cleaning up all temp files...');
  const promises = Array.from(tempFiles).map(cleanupTempFile);
  await Promise.all(promises);

  // Also clean up any orphaned piper temp files from previous runs
  try {
    const tmpDir = tmpdir();
    const files = await readdir(tmpDir);
    const piperFiles = files.filter(f => f.startsWith('piper-') && (f.endsWith('.txt') || f.endsWith('.wav')));

    if (piperFiles.length > 0) {
      console.log(`🧹 Found ${piperFiles.length} orphaned piper temp files, cleaning up...`);
      await Promise.all(piperFiles.map(f => unlink(join(tmpDir, f)).catch(() => {})));
    }
  } catch (error) {
    console.warn('⚠️ Could not clean up orphaned temp files:', error);
  }
}

/**
 * Generate speech with Piper and return audio data
 */
ipcMain.handle('piper-speak', async (_event, text: string, voice: string, opts?: { lengthScale?: number }) => {
  // Serialize execution via the Piper queue to avoid concurrent piper processes
  return enqueuePiper(async () => {
    try {
      console.log('🎤 Piper TTS request:', { text: text.substring(0, 50), voice });

      // Find piper executable
      const piperPath = await findPiper();
      if (!piperPath) {
        throw new Error('Piper executable not found. Install with: pip install piper-tts');
      }

      // Create temporary files with unique names
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const textFile = join(tmpdir(), `piper-${nonce}.txt`);
      const audioFile = join(tmpdir(), `piper-${nonce}.wav`);

      // Track temp files for cleanup
      tempFiles.add(textFile);
      tempFiles.add(audioFile);

      try {
        // Write text to temp file
        await writeFile(textFile, text, 'utf-8');

        // Piper expects a path to .onnx model file, not just a model name
        // Check if voice is a path or a model name
        // Also handle speaker selection for multi-speaker models (format: voice#speaker_id)
        let modelPath = voice;
        let speakerId: string | null = null;

        // Check if voice includes speaker ID (e.g., "en_GB-semaine-medium#0")
        if (voice.includes('#')) {
          const [voiceName, speaker] = voice.split('#');
          modelPath = voiceName;
          speakerId = speaker;
          console.log(`🎤 Multi-speaker model detected: ${voiceName}, speaker: ${speakerId}`);
        }

        if (!modelPath.endsWith('.onnx')) {
          // Try to find the model in common locations and in the project root
          const projectRoot = join(ROOT_DIR, '..');
          const possiblePaths = [
            join(projectRoot, `${modelPath}.onnx`),
            `${process.env.HOME}/.local/share/piper-tts/${modelPath}.onnx`,
            `${process.env.HOME}/Library/Python/3.9/share/piper-tts/${modelPath}.onnx`,
            `/usr/local/share/piper-tts/${modelPath}.onnx`,
          ];

          let found = false;
          for (const path of possiblePaths) {
            try {
              const { access } = await import('node:fs/promises');
              await access(path);
              modelPath = path;
              found = true;
              console.log(`✅ Found model at: ${path}`);
              break;
            } catch {
              // Try next path
            }
          }

          if (!found) {
            throw new Error(`Piper voice model not found: ${voice}\n\nPlease download models from: https://github.com/rhasspy/piper/releases\nExtract to: ~/.local/share/piper-tts/ or place <model>.onnx at the project root.\n\nOr use Web Speech API instead.`);
          }
        }

        // Call Piper using stdin redirection from file (more reliable than echo for long text)
        // Add --speaker parameter if speaker ID is specified
        const speakerParam = speakerId !== null ? ` --speaker ${speakerId}` : '';
        const lengthScale = (opts && typeof opts.lengthScale === "number") ? opts.lengthScale : 0.86;
        const command = `cat "${textFile}" | "${piperPath}" --model "${modelPath}"${speakerParam} --length_scale ${lengthScale} --output-file "${audioFile}"`;

        console.log('🔵 Executing Piper with text file input');
        console.log('🔵 Command:', command);
        const { stdout, stderr } = await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 30000, // 30 second timeout
        });

        if (stdout) {
          console.log('Piper stdout:', stdout);
        }
        if (stderr) {
          console.warn('Piper stderr:', stderr);
        }

        // Read the generated audio file
        const { readFile } = await import('node:fs/promises');
        const audioData = await readFile(audioFile);

        // Clean up temp files immediately after reading
        await cleanupTempFile(textFile);
        await cleanupTempFile(audioFile);

        console.log('✅ Piper TTS generated:', audioData.byteLength, 'bytes');
        return audioData.buffer;
      } catch (error) {
        // Clean up on error
        await cleanupTempFile(textFile);
        await cleanupTempFile(audioFile);

        // Log detailed error information
        console.error('❌ Piper command failed:', error);
        if (error && typeof error === 'object' && 'stderr' in error) {
          console.error('Piper stderr:', (error as any).stderr);
        }
        if (error && typeof error === 'object' && 'stdout' in error) {
          console.error('Piper stdout:', (error as any).stdout);
        }

        throw error;
      }
    } catch (error) {
      console.error('❌ Piper TTS error:', error);

      // Extract more detailed error message
      let errorMsg = error instanceof Error ? error.message : String(error);
      if (error && typeof error === 'object' && 'stderr' in error) {
        errorMsg += `\nStderr: ${(error as any).stderr}`;
      }

      throw new Error(`Piper TTS failed: ${errorMsg}`);
    }
  });
});

// ============================================================================
// Whisper STT IPC Handlers
// ============================================================================

/**
 * Find the whisper.cpp executable
 */
async function findWhisper(): Promise<string | null> {
  const projectRoot = join(ROOT_DIR, '..');

  // Try multiple possible locations (prefer whisper-cli over deprecated main)
  const possiblePaths = [
    join(projectRoot, 'whisper.cpp', 'build', 'bin', 'whisper-cli'), // New CMake binary (preferred)
    join(projectRoot, 'whisper.cpp', 'build', 'bin', 'main'), // CMake build location (deprecated)
    join(projectRoot, 'whisper.cpp', 'main'), // Symlink (fallback)
  ];

  for (const whisperPath of possiblePaths) {
    try {
      await access(whisperPath, constants.X_OK);
      console.log('✅ Found whisper.cpp at:', whisperPath);
      return whisperPath;
    } catch {
      // Try next path
    }
  }

  console.warn('⚠️  whisper.cpp not found in any expected location');
  return null;
}

/**
 * Find the whisper model file
 */
async function findWhisperModel(modelName: string = 'base.en'): Promise<string | null> {
  const projectRoot = join(ROOT_DIR, '..');
  const modelPath = join(projectRoot, 'whisper.cpp', 'models', `ggml-${modelName}.bin`);

  try {
    await access(modelPath, constants.R_OK);
    console.log('✅ Found whisper model at:', modelPath);
    return modelPath;
  } catch {
    console.warn('⚠️  Whisper model not found at:', modelPath);
    return null;
  }
}

/**
 * Test if whisper.cpp is available
 */
ipcMain.handle('whisper-test', async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const whisperPath = await findWhisper();
    if (!whisperPath) {
      return {
        success: false,
        error: 'Whisper.cpp not found. Please run: bash scripts/setup-whisper.sh'
      };
    }

    const modelPath = await findWhisperModel();
    if (!modelPath) {
      return {
        success: false,
        error: 'Whisper model not found. Please run: bash scripts/setup-whisper.sh'
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

/**
 * Transcribe audio using whisper.cpp
 * @param audioBuffer - WAV audio data (16kHz, mono, 16-bit PCM)
 * @param modelName - Model to use (tiny.en, base.en, small.en, etc.)
 */
ipcMain.handle('whisper-transcribe', async (
  _event,
  audioBuffer: ArrayBuffer,
  modelName: string = 'base.en'
): Promise<string> => {
  console.log('🎤 Whisper transcription requested');

  try {
    const whisperPath = await findWhisper();
    if (!whisperPath) {
      throw new Error('Whisper.cpp not found. Please run: bash scripts/setup-whisper.sh');
    }

    const modelPath = await findWhisperModel(modelName);
    if (!modelPath) {
      throw new Error(`Whisper model '${modelName}' not found. Please run: bash scripts/setup-whisper.sh`);
    }

    // Create temp file for audio
    const audioFile = join(tmpdir(), `whisper-${Date.now()}.wav`);
    tempFiles.add(audioFile);

    // Write audio buffer to file
    await writeFile(audioFile, Buffer.from(audioBuffer));
    console.log('📝 Wrote audio to temp file:', audioFile);

    try {
      // Run whisper.cpp
      // -m: model path
      // -f: input file
      // -nt: no timestamps in output
      // -np: no progress output
      // -l: language (en for English)
      const command = `"${whisperPath}" -m "${modelPath}" -f "${audioFile}" -nt -np -l en`;

      console.log('🔵 Executing whisper.cpp...');
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 60000, // 60 second timeout
      });

      if (stderr) {
        console.warn('Whisper stderr:', stderr);
      }

      // Extract transcription from output
      // Whisper outputs the transcription after processing info
      const lines = stdout.split('\n');
      const transcriptionLines = lines.filter(line =>
        line.trim() &&
        !line.includes('[') && // Skip timestamp lines
        !line.includes('whisper_') && // Skip debug lines
        !line.includes('processing') // Skip processing lines
      );

      const transcription = transcriptionLines.join(' ').trim();
      console.log('✅ Transcription:', transcription);

      // Clean up temp file
      await cleanupTempFile(audioFile);

      return transcription;
    } catch (error) {
      // Clean up on error
      await cleanupTempFile(audioFile);
      throw error;
    }
  } catch (error) {
    console.error('❌ Whisper transcription error:', error);

    let errorMsg = error instanceof Error ? error.message : String(error);
    if (error && typeof error === 'object' && 'stderr' in error) {
      errorMsg += `\nStderr: ${(error as any).stderr}`;
    }

    throw new Error(`Whisper transcription failed: ${errorMsg}`);
  }
});

// openWakeWord IPC handlers
ipcMain.handle('openwakeword-start', async (event, modelsDir?: string) => {
  try {
    if (wakeWordProcess) {
      console.log('⚠️ openWakeWord already running');
      return { success: true };
    }

    const projectRoot = join(ROOT_DIR, '..');
    const scriptPath = join(projectRoot, 'scripts', 'openwakeword-service.py');
    const models = modelsDir || join(projectRoot, 'openwakeword_models');

    console.log('🎤 Starting openWakeWord service...');
    console.log('📍 Script:', scriptPath);
    console.log('📍 Models:', models);

    // Start Python service
    wakeWordProcess = spawn('python3', [scriptPath], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle stdout (messages from Python)
    wakeWordProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());

      for (const line of lines) {
        try {
          const msg = JSON.parse(line);

          if (msg.type === 'log') {
            console.log('🎤 [openWakeWord]', msg.message);
          } else if (msg.type === 'detection') {
            console.log('✅ Wake word detected:', msg.wakeWord);
            // Send to renderer
            if (win) {
              win.webContents.send('openwakeword-detection', msg.wakeWord);
            }
          } else if (msg.type === 'error') {
            console.error('❌ [openWakeWord]', msg.error);
          } else if (msg.type === 'init_response' || msg.type === 'start_response') {
            console.log('✅ [openWakeWord]', msg.type, msg.success);
          }
        } catch (e) {
          // Not JSON, just log it
          console.log('🎤 [openWakeWord]', line);
        }
      }
    });

    // Handle stderr
    wakeWordProcess.stderr?.on('data', (data) => {
      console.error('❌ [openWakeWord stderr]', data.toString());
    });

    // Handle process exit
    wakeWordProcess.on('exit', (code) => {
      console.log(`🎤 openWakeWord process exited with code ${code}`);
      wakeWordProcess = null;
    });

    // Initialize the service
    wakeWordProcess.stdin?.write(JSON.stringify({ type: 'init', modelsDir: models }) + '\n');

    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start listening
    wakeWordProcess.stdin?.write(JSON.stringify({ type: 'start' }) + '\n');

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to start openWakeWord:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('openwakeword-stop', async () => {
  try {
    if (!wakeWordProcess) {
      return { success: true };
    }

    console.log('🎤 Stopping openWakeWord...');

    // Send quit command
    wakeWordProcess.stdin?.write(JSON.stringify({ type: 'quit' }) + '\n');

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 500));

    // Force kill if still running
    if (wakeWordProcess) {
      wakeWordProcess.kill();
      wakeWordProcess = null;
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to stop openWakeWord:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('openwakeword-test', async () => {
  try {
    const projectRoot = join(ROOT_DIR, '..');
    const scriptPath = join(projectRoot, 'scripts', 'openwakeword-service.py');

    // Check if script exists
    try {
      await access(scriptPath, constants.R_OK);
    } catch {
      return { success: false, error: 'openWakeWord service script not found. Run: bash scripts/setup-openwakeword.sh' };
    }

    // Check if Python is available
    try {
      await execAsync('python3 --version');
    } catch {
      return { success: false, error: 'Python 3 not found' };
    }

    // Check if openWakeWord is installed
    try {
      await execAsync('python3 -c "import openwakeword"');
    } catch {
      return { success: false, error: 'openWakeWord not installed. Run: bash scripts/setup-openwakeword.sh' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});


// ============================================================================
// Calibration (Avatar Face Anchors) IPC Handlers
// ============================================================================

/**
 * Load saved avatar face anchors from userData
 */
ipcMain.handle('calibration-load', async () => {
  try {
    const filePath = join(app.getPath('userData'), 'avatar-face-anchors.json');
    try {
      await access(filePath, constants.R_OK);
    } catch {
      return { success: true, data: {} as Record<string, any> };
    }
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to load calibration file:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

/**
 * Save avatar face anchors to userData
 */
ipcMain.handle('calibration-save', async (_event, data: Record<string, any>) => {
  try {
    const filePath = join(app.getPath('userData'), 'avatar-face-anchors.json');
    const json = JSON.stringify(data ?? {}, null, 2);
    await writeFile(filePath, json, 'utf-8');
    console.log('✅ Saved calibration to', filePath);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to save calibration file:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

/**
 * Return the path used to store avatar face anchors
 */
ipcMain.handle('calibration-path', async () => {
  try {
    const filePath = join(app.getPath('userData'), 'avatar-face-anchors.json');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('❌ Failed to resolve calibration path:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

/**
 * Update a persona's animationConfig in personas.ts
 */
ipcMain.handle('calibration-save-persona-config', async (_event, personaId: string, animationConfig: Record<string, any>) => {
  try {
    // Validate persona ID
    const validPersonas = ['maya', 'otto', 'sarah', 'marcus', 'jessica'];
    if (!validPersonas.includes(personaId)) {
      throw new Error(`Invalid persona ID: ${personaId}`);
    }

    // Construct file path relative to project root
    const filePath = join(ROOT_DIR, '..', 'src', 'data', 'personas.ts');

    // Read current file content
    const content = await readFile(filePath, 'utf-8');

    // Find the persona's animationConfig block and replace it
    // Strategy: Find the persona by id, then find its animationConfig object
    const personaIdPattern = new RegExp(`id:\\s*['"]${personaId}['"]`, 'g');
    const matches = [...content.matchAll(personaIdPattern)];

    if (matches.length === 0) {
      throw new Error(`Persona ${personaId} not found in personas.ts`);
    }

    // Find the animationConfig block after the persona id
    const personaStartIndex = matches[0].index!;
    const afterPersonaId = content.substring(personaStartIndex);

    // Find animationConfig: { ... } block
    const animConfigMatch = afterPersonaId.match(/animationConfig:\s*\{/);
    if (!animConfigMatch) {
      throw new Error(`animationConfig not found for persona ${personaId}`);
    }

    const animConfigStart = personaStartIndex + animConfigMatch.index!;

    // Find the closing brace of animationConfig by counting braces
    let braceCount = 0;
    let animConfigEnd = animConfigStart + animConfigMatch[0].length;
    let inString = false;
    let stringChar = '';

    for (let i = animConfigStart + animConfigMatch[0].length; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      // Track string boundaries
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          if (braceCount === 0) {
            animConfigEnd = i + 1;
            break;
          }
          braceCount--;
        }
      }
    }

    // Format the new animationConfig
    const configLines = [];
    for (const [key, value] of Object.entries(animationConfig)) {
      const formattedValue = typeof value === 'string' ? `'${value}'` : value;
      configLines.push(`      ${key}: ${formattedValue},`);
    }

    const newAnimConfig = `animationConfig: {\n${configLines.join('\n')}\n    }`;

    // Replace the old animationConfig with the new one
    const newContent =
      content.substring(0, animConfigStart) +
      newAnimConfig +
      content.substring(animConfigEnd);

    // Write back to file
    await writeFile(filePath, newContent, 'utf-8');
    console.log(`✅ Updated ${personaId} animationConfig in personas.ts`);

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to save persona config:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (wakeWordProcess) {
    wakeWordProcess.kill();
    wakeWordProcess = null;
  }
});


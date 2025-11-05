/**
 * Whisper STT (Speech-to-Text) Service
 * Provides local speech recognition using whisper.cpp
 */


export type WhisperModel = 'tiny.en' | 'base.en' | 'small.en' | 'medium.en';

/**
 * Test if Whisper is available
 */
export async function whisperTest(): Promise<{ success: boolean; error?: string }> {
  if (!window.electron?.whisperTest) {
    return {
      success: false,
      error: 'Whisper not available (not running in Electron)'
    };
  }

  try {
    return await window.electron.whisperTest();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Record audio from microphone and return as WAV buffer
 * @param durationMs - Maximum recording duration in milliseconds (default: 30000 = 30 seconds)
 * @returns Promise that resolves with WAV audio buffer
 */
export async function recordAudio(durationMs: number = 30000): Promise<ArrayBuffer> {
  // Request microphone permission
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      channelCount: 1, // Mono
      sampleRate: 16000, // 16kHz (Whisper's native sample rate)
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    } 
  });

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus', // Most widely supported
  });

  const audioChunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Stop all tracks to release microphone
      stream.getTracks().forEach(track => track.stop());

      try {
        // Combine chunks into single blob
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Convert to WAV format (16kHz, mono, 16-bit PCM)
        const wavBuffer = await convertToWav(audioBlob);
        resolve(wavBuffer);
      } catch (error) {
        reject(error);
      }
    };

    mediaRecorder.onerror = (event) => {
      stream.getTracks().forEach(track => track.stop());
      reject(new Error(`MediaRecorder error: ${event}`));
    };

    // Start recording
    mediaRecorder.start();

    // Stop after duration
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, durationMs);
  });
}

/**
 * Convert audio blob to WAV format (16kHz, mono, 16-bit PCM)
 */
async function convertToWav(audioBlob: Blob): Promise<ArrayBuffer> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  
  // Decode audio data
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Get audio data (convert to mono if needed)
  let audioData: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    audioData = audioBuffer.getChannelData(0);
  } else {
    // Mix down to mono
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    audioData = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      audioData[i] = (left[i] + right[i]) / 2;
    }
  }
  
  // Convert float32 to int16
  const int16Data = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Create WAV file
  const wavBuffer = createWavFile(int16Data, audioBuffer.sampleRate);
  return wavBuffer;
}

/**
 * Create WAV file from PCM data
 */
function createWavFile(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  // Write PCM data
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset + i * 2, samples[i], true);
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Transcribe audio using Whisper
 * @param audioBuffer - WAV audio buffer (16kHz, mono, 16-bit PCM)
 * @param model - Whisper model to use
 */
export async function whisperTranscribe(
  audioBuffer: ArrayBuffer,
  model: WhisperModel = 'base.en'
): Promise<string> {
  if (!window.electron?.whisperTranscribe) {
    throw new Error('Whisper not available (not running in Electron)');
  }

  try {
    const transcription = await window.electron.whisperTranscribe(audioBuffer, model);
    return transcription;
  } catch (error) {
    throw new Error(
      `Whisper transcription failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Record audio and transcribe it
 * @param model - Whisper model to use
 * @param maxDurationMs - Maximum recording duration
 */
export async function recordAndTranscribe(
  model: WhisperModel = 'base.en',
  maxDurationMs: number = 30000
): Promise<string> {
  console.log('🎤 Starting recording...');
  const audioBuffer = await recordAudio(maxDurationMs);
  
  console.log('🎤 Recording complete, transcribing...');
  const transcription = await whisperTranscribe(audioBuffer, model);
  
  console.log('✅ Transcription:', transcription);
  return transcription;
}

/**
 * Start recording with Voice Activity Detection (VAD)
 * Automatically stops when user stops speaking
 * @param options.maxDurationMs - Maximum recording duration (default: 30000ms)
 * @param options.silenceThresholdMs - Duration of silence before auto-stopping (default: 1500ms, recommended: 2000ms for natural pauses)
 * @param options.onSpeechStart - Callback when speech is detected
 * @param options.onSpeechEnd - Callback when speech ends
 */
export function startRecordingWithVAD(options?: {
  maxDurationMs?: number;
  silenceThresholdMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}): {
  stop: () => Promise<ArrayBuffer>;
  cancel: () => void;
} {
  const maxDuration = options?.maxDurationMs || 30000; // 30 seconds max
  const silenceThreshold = options?.silenceThresholdMs || 1500; // Default 1.5 seconds (can be increased for natural pauses)

  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audioChunks: Blob[] = [];
  let resolvePromise: ((buffer: ArrayBuffer) => void) | null = null;
  let rejectPromise: ((error: Error) => void) | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let silenceTimer: NodeJS.Timeout | null = null;
  let maxDurationTimer: NodeJS.Timeout | null = null;
  let isSpeaking = false;
  let hasSpoken = false;

  const cleanup = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
    }
  };

  const stopRecording = () => {
    console.log('🎤 stopRecording() called, mediaRecorder state:', mediaRecorder?.state);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('🎤 Calling mediaRecorder.stop()');
      mediaRecorder.stop();
      // cleanup() will be called in onstop handler
    }
  };

  const promise = new Promise<ArrayBuffer>(async (resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    try {
      // Request microphone permission
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Set up audio analysis for VAD
      audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6; // slightly less smoothing for quicker response
      source.connect(analyser);

      // Use time-domain RMS with dynamic noise calibration + hysteresis
      const timeData = new Uint8Array(analyser.fftSize);
      const frameMs = 1000 / 60; // ~requestAnimationFrame cadence

      // Calibrate noise floor for first 300ms
      const calibrationMs = 300;
      let calibrationUntil = performance.now() + calibrationMs;
      let noiseRmsAccum = 0;
      let noiseRmsCount = 0;
      let calibrated = false;
      let speechOnThreshold = 0.06;  // default if calibration fails
      let speechOffThreshold = 0.045; // hysteresis lower than on-threshold

      let speechFrames = 0;
      let silenceFrames = 0;
      const speechHoldFrames = 4;  // require ~65ms of continuous speech
      const silenceHoldFrames = 6; // require ~100ms of continuous silence to flip state

      const rmsFromTimeData = (u8: Uint8Array) => {
        let sumSq = 0;
        for (let i = 0; i < u8.length; i++) {
          const v = (u8[i] - 128) / 128; // [-1, 1]
          sumSq += v * v;
        }
        return Math.sqrt(sumSq / u8.length);
      };

      // Voice activity detection loop
      const checkVoiceActivity = () => {
        if (!analyser || !mediaRecorder || mediaRecorder.state !== 'recording') return;

        analyser.getByteTimeDomainData(timeData);
        const rms = rmsFromTimeData(timeData);

        // Calibration phase to set dynamic thresholds based on ambient noise
        if (!calibrated) {
          noiseRmsAccum += rms;
          noiseRmsCount += 1;
          if (performance.now() >= calibrationUntil) {
            const noiseFloor = noiseRmsCount ? (noiseRmsAccum / noiseRmsCount) : 0.015;
            // Set thresholds relative to noise floor with bounds
            speechOnThreshold = Math.min(Math.max(noiseFloor + 0.03, 0.035), 0.12);
            speechOffThreshold = Math.max(speechOnThreshold - 0.015, 0.02);
            calibrated = true;
            console.log('🎤 VAD calibrated:', { noiseFloor: +noiseFloor.toFixed(4), speechOnThreshold: +speechOnThreshold.toFixed(4), speechOffThreshold: +speechOffThreshold.toFixed(4) });
          }
          // Continue checking during calibration
          requestAnimationFrame(checkVoiceActivity);
          return;
        }

        // Apply hysteresis + short frame holds to avoid rapid toggling on background noise
        const aboveOn = rms > speechOnThreshold;
        const aboveOff = rms > speechOffThreshold;

        if (isSpeaking) {
          if (aboveOff) {
            silenceFrames = 0;
          } else {
            silenceFrames++;
            if (silenceFrames >= silenceHoldFrames) {
              isSpeaking = false;
              if (options?.onSpeechEnd) options.onSpeechEnd();
              console.log('🎤 Silence detected (RMS):', rms.toFixed(3), '→ starting timer');
              // Start silence timer only if user has spoken
              if (hasSpoken) {
                if (silenceTimer) clearTimeout(silenceTimer);
                console.log(`🎤 Will auto-stop in ${silenceThreshold}ms if silence continues`);
                silenceTimer = setTimeout(() => {
                  console.log('🎤 Auto-stopping after sustained silence');
                  stopRecording();
                }, silenceThreshold);
              }
            }
          }
        } else {
          if (aboveOn) {
            speechFrames++;
            if (speechFrames >= speechHoldFrames) {
              isSpeaking = true;
              hasSpoken = true;
              if (silenceTimer) clearTimeout(silenceTimer);
              if (options?.onSpeechStart) options.onSpeechStart();
              console.log('🎤 Speech detected (RMS):', rms.toFixed(3));
            }
          } else {
            speechFrames = 0;
          }
        }

        // Continue checking
        requestAnimationFrame(checkVoiceActivity);
      };

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎤 mediaRecorder.onstop triggered');
        cleanup();
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          console.log('🎤 Stream tracks stopped');
        }

        try {
          console.log('🎤 Converting audio to WAV...');
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const wavBuffer = await convertToWav(audioBlob);
          console.log('🎤 Conversion complete, resolving promise');
          if (resolvePromise) resolvePromise(wavBuffer);
        } catch (error) {
          console.error('🎤 Error in onstop:', error);
          if (rejectPromise) rejectPromise(error as Error);
        }
      };

      mediaRecorder.onerror = (event) => {
        cleanup();
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (rejectPromise) rejectPromise(new Error(`MediaRecorder error: ${event}`));
      };

      // Start recording
      mediaRecorder.start();
      console.log('🎤 Recording started with VAD');

      // Start VAD
      checkVoiceActivity();

      // Set max duration timer
      maxDurationTimer = setTimeout(() => {
        console.log('🎤 Max duration reached');
        stopRecording();
      }, maxDuration);

    } catch (error) {
      cleanup();
      reject(error);
    }
  });

  return {
    stop: async () => {
      stopRecording();
      console.log('🎤 Recording stopped manually');
      return promise;
    },
    cancel: () => {
      cleanup();
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (rejectPromise) {
        rejectPromise(new Error('Recording cancelled'));
      }
      console.log('🎤 Recording cancelled');
    }
  };
}

/**
 * Start recording and return a controller to stop it manually
 * (Legacy function without VAD)
 */
export function startRecording(): {
  stop: () => Promise<ArrayBuffer>;
  cancel: () => void;
} {
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audioChunks: Blob[] = [];
  let resolvePromise: ((buffer: ArrayBuffer) => void) | null = null;
  let rejectPromise: ((error: Error) => void) | null = null;

  const promise = new Promise<ArrayBuffer>(async (resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    try {
      // Request microphone permission
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const wavBuffer = await convertToWav(audioBlob);
          if (resolvePromise) resolvePromise(wavBuffer);
        } catch (error) {
          if (rejectPromise) rejectPromise(error as Error);
        }
      };

      mediaRecorder.onerror = (event) => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (rejectPromise) rejectPromise(new Error(`MediaRecorder error: ${event}`));
      };

      // Start recording
      mediaRecorder.start();
      console.log('🎤 Recording started');
    } catch (error) {
      reject(error);
    }
  });

  return {
    stop: async () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log('🎤 Recording stopped');
      }
      return promise;
    },
    cancel: () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (rejectPromise) {
        rejectPromise(new Error('Recording cancelled'));
      }
      console.log('🎤 Recording cancelled');
    }
  };
}


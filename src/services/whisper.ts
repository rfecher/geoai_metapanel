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
  const silenceThreshold = options?.silenceThresholdMs || 1500; // 1.5 seconds of silence

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
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Voice activity detection loop
      const checkVoiceActivity = () => {
        if (!analyser || !mediaRecorder || mediaRecorder.state !== 'recording') return;

        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

        // Debug: Log volume levels periodically
        if (Math.random() < 0.05) { // Log ~5% of the time to avoid spam
          console.log('🎤 Volume level:', Math.round(average));
        }

        // Threshold for speech detection (adjust based on testing)
        const speechThreshold = 20; // Lower = more sensitive
        const isSpeakingNow = average > speechThreshold;

        if (isSpeakingNow && !isSpeaking) {
          // Speech started
          isSpeaking = true;
          hasSpoken = true;
          if (silenceTimer) clearTimeout(silenceTimer);
          if (options?.onSpeechStart) options.onSpeechStart();
          console.log('🎤 Speech detected, average volume:', Math.round(average));
        } else if (!isSpeakingNow && isSpeaking) {
          // Speech stopped
          isSpeaking = false;
          if (options?.onSpeechEnd) options.onSpeechEnd();
          console.log('🎤 Silence detected, starting timer...');

          // Start silence timer only if user has spoken
          if (hasSpoken) {
            console.log(`🎤 Will auto-stop in ${silenceThreshold}ms if silence continues`);
            silenceTimer = setTimeout(() => {
              console.log('🎤 Auto-stopping after silence');
              stopRecording();
            }, silenceThreshold);
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


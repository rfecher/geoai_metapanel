/**
 * Piper TTS Service
 *
 * Piper is a local neural TTS system that runs as a command-line tool.
 * Since we're in Electron, we can call it via Node.js child_process.
 *
 * Voice assignments come from persona definitions in personas.ts (ttsVoiceId field).
 * This ensures voices are always in sync with persona definitions.
 *
 * Note: For multi-speaker models, append #<speaker_id> to the voice name
 */

import { personas } from '../data/personas';

// Build PIPER_VOICE_PRESETS dynamically from persona definitions
// This ensures voices always come from personas.ts and can't get out of sync
export const PIPER_VOICE_PRESETS: Record<string, string> = personas.reduce((acc, persona) => {
  if (persona.ttsVoiceId) {
    acc[persona.id] = persona.ttsVoiceId;
  }
  return acc;
}, {} as Record<string, string>);

export const PIPER_AVAILABLE_VOICES = [
  'en_US-amy-medium',
  'en_US-bryce-medium',
  'en_US-joe-medium',
  'en_US-danny-medium',
  'en_US-hfc_male-medium',
  'en_US-hfc_female-medium',
  'en_US-kathleen-low',
  'en_US-lessac-medium',
  'en_US-libritts_r-medium',
  'en_US-norman-medium',
  'en_US-ryan-medium',
  'en_US-kristin-medium',
  'en_GB-alba-medium',
  'en_GB-alan-medium',
  'en_GB-semaine-medium#0',  // Prudence
  'en_GB-semaine-medium#2',  // Obadiah
  'en_GB-northern_english_male-medium',
];

/**
 * Call Piper TTS via Electron IPC
 * 
 * In Electron, we'll expose a preload API that calls Piper via child_process.
 * For now, we'll use a simple HTTP server approach or direct file generation.
 */
export async function speakWithPiper(
  text: string,
  voice: string,
  personaId?: string
): Promise<void> {
  console.log('🎤 Piper TTS called:', {
    text: text.substring(0, 50) + '...',
    voice,
    personaId,
    hasElectron: !!window.electron,
    hasPiperSpeak: !!window.electron?.piperSpeak
  });

  try {
    // Check if we're in Electron with IPC available
    if (window.electron?.piperSpeak) {
      console.log('🔵 Using Electron IPC for Piper');
      const audioData = await window.electron.piperSpeak(text, voice);
      console.log('✅ Got audio data:', audioData.byteLength, 'bytes');
      return playAudioData(audioData, personaId);
    } else {
      console.log('⚠️ Electron IPC not available, trying HTTP fallback');
      // Fallback: Try HTTP endpoint (if user runs piper-server)
      return speakWithPiperHTTP(text, voice, personaId);
    }
  } catch (error) {
    console.error('❌ Piper TTS error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Fallback: Call Piper via HTTP server
 * User can run: piper-server --port 5050
 */
async function speakWithPiperHTTP(
  text: string,
  voice: string,
  personaId?: string
): Promise<void> {
  const url = 'http://localhost:5050/api/tts';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    throw new Error(`Piper HTTP ${response.status}: ${await response.text()}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return playAudioData(audioBuffer, personaId);
}

/**
 * Play audio data (WAV format from Piper)
 */
function playAudioData(audioData: ArrayBuffer, personaId?: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      // Register this audio globally for cancellation
      if (window.currentTTSAudio) {
        window.currentTTSAudio.pause();
      }
      window.currentTTSAudio = audio;

      // Optional: Add amplitude visualization
      let raf = 0;
      let ctx: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      let src: MediaElementAudioSourceNode | null = null;

      const sample = () => {
        if (!analyser) return;
        const timeArr = new Uint8Array(analyser.fftSize);
        const freqArr = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(timeArr);
        analyser.getByteFrequencyData(freqArr);

        // Compute RMS for amplitude
        let sum = 0;
        for (let i = 0; i < timeArr.length; i++) {
          const v = (timeArr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeArr.length);
        const amp = Math.max(0, Math.min(1, rms * 3));

        // Notify amplitude listener if available
        if (window.ttsAmplitudeListener) {
          window.ttsAmplitudeListener({ personaId, amp });
        }

        // Compute simple band energies for viseme classification
        const n = freqArr.length;
        let low = 0, mid = 0, high = 0;
        const lowEnd = Math.floor(n * 0.10);
        const midEnd = Math.floor(n * 0.40);
        for (let i = 0; i < n; i++) {
          const val = freqArr[i] / 255;
          if (i < lowEnd) low += val;
          else if (i < midEnd) mid += val;
          else high += val;
        }
        if (window.ttsVisemeListener) {
          const total = low + mid + high + 1e-6;
          const lowR = low / total, midR = mid / total, highR = high / total;
          const open = Math.max(0, Math.min(1, rms * 2.0 + lowR * 0.6));
          const wide = Math.max(0, Math.min(1, (highR * 0.9 + midR * 0.2) - lowR * 0.2));
          const round = Math.max(0, Math.min(1, lowR * 0.9 - highR * 0.3));
          let viseme = 'A';
          if (rms < 0.02) viseme = 'Rest';
          else if (highR > 0.55 && rms < 0.12) viseme = 'FV';
          else if (round > 0.55 && open < 0.6) viseme = 'O';
          else if (wide > 0.55 && open < 0.7) viseme = 'E';
          else if (open > 0.75 && midR > 0.3) viseme = 'A';
          window.ttsVisemeListener({ personaId, viseme, open, wide, round });
        }

        raf = requestAnimationFrame(sample);
      };

      audio.onplay = () => {
        try {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          src = ctx.createMediaElementSource(audio);
          src.connect(analyser);
          analyser.connect(ctx.destination);
          raf = requestAnimationFrame(sample);
        } catch (err) {
          console.warn('Audio visualization error:', err);
        }
      };

      const cleanup = () => {
        if (window.currentTTSAudio === audio) {
          window.currentTTSAudio = null;
        }
        if (raf) cancelAnimationFrame(raf);
        if (window.ttsAmplitudeListener) {
          window.ttsAmplitudeListener({ personaId, amp: 0 });
        }
        if (window.ttsVisemeListener) {
          window.ttsVisemeListener({ personaId, viseme: 'Rest', open: 0, wide: 0, round: 0 });
        }
        try {
          src?.disconnect();
          analyser?.disconnect();
          ctx?.close();
        } catch {}
        URL.revokeObjectURL(url);
      };

      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = (err) => {
        cleanup();
        reject(new Error('Audio playback error'));
      };

      audio.play().catch((err) => {
        cleanup();
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Test if Piper is available
 */
export async function testPiperConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Try Electron IPC first
    if (window.electron?.piperTest) {
      const result = await window.electron.piperTest();
      return result;
    }

    // Try HTTP endpoint
    const response = await fetch('http://localhost:5050/health', {
      method: 'GET',
    });

    if (response.ok) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: 'Piper server not responding. Make sure Piper is installed and running.' 
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Piper not available. Install with: brew install piper-tts',
    };
  }
}

// Extend window type for TypeScript
declare global {
  interface Window {
    electron?: {
      // Piper
      piperSpeak?: (text: string, voice: string) => Promise<ArrayBuffer>;
      piperTest?: () => Promise<{ success: boolean; error?: string }>;
      // Calibration
      calibrationLoad?: () => Promise<{ success: boolean; data?: Record<string, any>; error?: string }>;
      calibrationSave?: (data: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
      calibrationPath?: () => Promise<{ success: boolean; path?: string; error?: string }>;
      // Hybrid avatar calibration
      calibrationSaveSvg?: (personaId: string, svgContent: string) => Promise<{ success: boolean; error?: string }>;
      calibrationSavePersonaConfig?: (personaId: string, animationConfig: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
      // Whisper
      whisperTranscribe?: (audioBuffer: ArrayBuffer, modelName?: string) => Promise<string>;
      whisperTest?: () => Promise<{ success: boolean; error?: string }>;
      // openWakeWord
      openWakeWordStart?: (modelsDir?: string) => Promise<{ success: boolean; error?: string }>;
      openWakeWordStop?: () => Promise<{ success: boolean; error?: string }>;
      openWakeWordTest?: () => Promise<{ success: boolean; error?: string }>;
      onWakeWordDetection?: (callback: (wakeWord: string) => void) => void;
    };
    ttsAmplitudeListener?: (info: { personaId?: string; amp: number }) => void;
    ttsVisemeListener?: (info: { personaId?: string; viseme: string; open: number; wide: number; round: number }) => void;
    currentTTSAudio?: HTMLAudioElement | null;
  }
}


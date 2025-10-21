/**
 * Wake Word Detection Service
 * Listens for trigger phrases like "Ok Panel" to activate voice input
 */

export type WakeWordCallback = () => void;

export interface WakeWordOptions {
  wakeWord?: string;
  threshold?: number;
  continuous?: boolean;
}

let recognition: any = null;
let isListening = false;
let callback: WakeWordCallback | null = null;

/**
 * Start listening for wake word
 */
export function startWakeWordDetection(
  onWakeWordDetected: WakeWordCallback,
  options: WakeWordOptions = {}
): { stop: () => void } {
  const wakeWord = options.wakeWord || 'ok panel';
  const continuous = options.continuous !== false; // Default true

  // Check if browser supports speech recognition
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.error('❌ Speech recognition not supported in this browser');
    throw new Error('Speech recognition not supported');
  }

  // Stop any existing recognition
  if (recognition) {
    recognition.stop();
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true; // Keep listening
  recognition.interimResults = false; // Only final results
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  callback = onWakeWordDetected;
  isListening = true;

  recognition.onstart = () => {
    console.log('👂 Wake word detection started, listening for "' + wakeWord + '"...');
  };

  recognition.onresult = (event: any) => {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.toLowerCase().trim();
    
    console.log('👂 Heard:', transcript);

    // Check if wake word was detected
    if (transcript.includes(wakeWord.toLowerCase())) {
      console.log('✅ Wake word detected!');
      if (callback) {
        callback();
      }
    }
  };

  recognition.onerror = (event: any) => {
    console.error('❌ Wake word detection error:', event.error);

    // Handle different error types
    if (event.error === 'network') {
      console.warn('⚠️ Network error - Web Speech API may require internet connection');
      console.warn('⚠️ Some browsers (Chrome) need internet for speech recognition');
      // Don't restart on network errors - let it fail gracefully
      isListening = false;
      if (callback) {
        // Notify user through console
        console.error('💡 Try: 1) Check internet connection, 2) Use Chrome/Edge, 3) Check microphone permissions');
      }
    } else if (event.error === 'no-speech' || event.error === 'audio-capture') {
      // These are expected, just restart
      if (isListening && continuous) {
        setTimeout(() => {
          if (isListening) {
            try {
              recognition.start();
            } catch (e) {
              // Already started, ignore
            }
          }
        }, 100);
      }
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      console.error('❌ Microphone permission denied or service not allowed');
      isListening = false;
    } else if (event.error === 'aborted') {
      // Aborted is normal when stopping, just restart if continuous
      if (isListening && continuous) {
        setTimeout(() => {
          if (isListening) {
            try {
              recognition.start();
            } catch (e) {
              // Already started, ignore
            }
          }
        }, 100);
      }
    } else {
      // Unknown error, try to restart
      if (isListening && continuous) {
        setTimeout(() => {
          if (isListening) {
            try {
              recognition.start();
            } catch (e) {
              console.error('Failed to restart after error:', e);
            }
          }
        }, 1000); // Wait longer for unknown errors
      }
    }
  };

  recognition.onend = () => {
    console.log('👂 Wake word detection ended');
    
    // Restart if continuous mode
    if (isListening && continuous) {
      setTimeout(() => {
        if (isListening) {
          try {
            recognition.start();
            console.log('👂 Restarting wake word detection...');
          } catch (e) {
            console.error('Failed to restart wake word detection:', e);
          }
        }
      }, 100);
    }
  };

  // Start recognition
  try {
    recognition.start();
  } catch (error) {
    console.error('Failed to start wake word detection:', error);
    throw error;
  }

  return {
    stop: () => {
      console.log('👂 Stopping wake word detection...');
      isListening = false;
      callback = null;
      if (recognition) {
        recognition.stop();
        recognition = null;
      }
    }
  };
}

/**
 * Check if wake word detection is currently active
 */
export function isWakeWordActive(): boolean {
  return isListening;
}

/**
 * Test if wake word detection is supported
 */
export function isWakeWordSupported(): boolean {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SpeechRecognition;
}


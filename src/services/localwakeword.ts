/**
 * Local Wake Word Detection Service (openWakeWord)
 * Fully local, no internet required
 */

export type LocalWakeWordCallback = () => void;

/**
 * Start local wake word detection
 */
export async function startLocalWakeWord(
  onWakeWordDetected: LocalWakeWordCallback,
  modelsDir?: string
): Promise<{ stop: () => Promise<void> }> {
  if (!window.electron?.openWakeWordStart) {
    throw new Error('openWakeWord not available - running outside Electron?');
  }

  // Set up detection listener
  window.electron.onWakeWordDetection((wakeWord: string) => {
    console.log('✅ Local wake word detected:', wakeWord);
    onWakeWordDetected();
  });

  // Start the service
  const result = await window.electron.openWakeWordStart(modelsDir);
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to start openWakeWord');
  }

  return {
    stop: async () => {
      if (window.electron?.openWakeWordStop) {
        await window.electron.openWakeWordStop();
      }
    }
  };
}

/**
 * Test if local wake word detection is available
 */
export async function testLocalWakeWord(): Promise<{ success: boolean; error?: string }> {
  if (!window.electron?.openWakeWordTest) {
    return { success: false, error: 'openWakeWord not available - running outside Electron?' };
  }

  return await window.electron.openWakeWordTest();
}

/**
 * Check if local wake word is supported
 */
export function isLocalWakeWordSupported(): boolean {
  return !!(window.electron?.openWakeWordStart && window.electron?.openWakeWordTest);
}


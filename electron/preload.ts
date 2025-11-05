// Preload runs in isolated context; expose minimal APIs if needed.
import { contextBridge, ipcRenderer } from 'electron';

// Expose Piper TTS, Whisper STT, and openWakeWord APIs to renderer
contextBridge.exposeInMainWorld('electron', {
  // Piper TTS
  piperSpeak: async (text: string, voice: string, options?: { lengthScale?: number }): Promise<ArrayBuffer> => {
    return await ipcRenderer.invoke('piper-speak', text, voice, options);
  },
  piperTest: async (): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('piper-test');
  },

  // Whisper STT
  whisperTranscribe: async (audioBuffer: ArrayBuffer, modelName?: string): Promise<string> => {
    return await ipcRenderer.invoke('whisper-transcribe', audioBuffer, modelName);
  },
  whisperTest: async (): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('whisper-test');
  },

  // openWakeWord
  openWakeWordStart: async (modelsDir?: string): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('openwakeword-start', modelsDir);
  },
  openWakeWordStop: async (): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('openwakeword-stop');
  },
  openWakeWordTest: async (): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('openwakeword-test');
  },
  onWakeWordDetection: (callback: (wakeWord: string) => void) => {
    ipcRenderer.on('openwakeword-detection', (_event, wakeWord) => callback(wakeWord));
  },

  // Calibration (face anchors)
  calibrationLoad: async (): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> => {
    return await ipcRenderer.invoke('calibration-load');
  },
  calibrationSave: async (data: Record<string, any>): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('calibration-save', data);
  },
  calibrationPath: async (): Promise<{ success: boolean; path?: string; error?: string }> => {
    return await ipcRenderer.invoke('calibration-path');
  },

  // Hybrid avatar calibration (SVG and persona config)
  calibrationSaveSvg: async (personaId: string, svgContent: string): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('calibration-save-svg', personaId, svgContent);
  },
  calibrationSavePersonaConfig: async (personaId: string, animationConfig: Record<string, any>): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('calibration-save-persona-config', personaId, animationConfig);
  },
});

export {};

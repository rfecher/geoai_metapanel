import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './components/MessageBubble';
import LLMProviderSelector from './components/LLMProviderSelector';
import VideoConferenceLayout from './components/VideoConferenceLayout';
import Settings from './components/Settings';
import CaptionsOverlay from './components/CaptionsOverlay';

import { personas } from './data/personas';
import { chatWithLLM, chatWithLLMStreaming, LLMConfig, LLM_PRESETS, ChatMessage } from './services/llm';

import { ttsSpeak, ttsPreGenerate, ttsPlayPreGenerated, type TTSSettings, setTtsAmplitudeListener, setTtsVisemeListener, cancelCurrentSpeech } from './services/tts';
// Import piper to ensure window.electron types are available
import './services/piper';
import { startRecordingWithVAD, whisperTranscribe, whisperTest, type WhisperModel } from './services/whisper';
import AcknowledgmentBubble, { getAcknowledgment } from './components/AcknowledgmentBubble';

import { startLocalWakeWord, testLocalWakeWord, isLocalWakeWordSupported } from './services/localwakeword';
import { setBackupConfig, getBackupStatus, addBackupStateListener, removeBackupStateListener, getBackupMatchConfidence, shouldUseBackup, isHybridMode, shouldUseBackupInHybridMode, type BackupMode } from './services/backup';
import { createContextEngine } from './services/contextEngine';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  personaId?: string;
  author: string;
  text: string;
  color: string;
  isAcknowledgment?: boolean; // Flag for temporary acknowledgment messages
  isStreaming?: boolean; // Flag for messages currently being streamed
  isBackup?: boolean; // Flag for responses from backup/demo system (not live LLM)
};

let ttsChain: Promise<void> = Promise.resolve();


// Pre-canned, in-character mic check lines per persona (1–2 sentences max)
const MIC_CHECK_LINES: Record<string, string> = {
  maya: "Maya here. Audio is clear on my side. Ready to begin.",
  otto: "This is Otto. Signal is clear here. Let's proceed.",
  marcus: "Marcus checking in. Coming through fine on my end; let's keep it crisp.",
  jessica: "Jessica is here. Comms are loud and clear. Ready to go.",
  sarah: "Sarah here — loud and clear! Excited to kick things off.",
};

function buildHistoryChat(messagesState: Msg[], maxItems = 20, currentQuestionOnly = false): ChatMessage[] {
  // Convert prior UI messages to Ollama chat history
  // If currentQuestionOnly is true, only include responses from the current question
  let tail: Msg[];

  if (currentQuestionOnly) {
    // Find the last user message and include only messages after it (avoid findLastIndex for ES2020 target)
    let lastUserIndex = -1;
    for (let i = messagesState.length - 1; i >= 0; i--) {
      if (messagesState[i].role === 'user') { lastUserIndex = i; break; }
    }
    if (lastUserIndex === -1) {
      tail = [];
    } else {
      // Include only messages from the current question (excluding the user message itself)
      tail = messagesState.slice(lastUserIndex + 1);
    }
  } else {
    tail = messagesState.slice(-maxItems);
  }

  const out: ChatMessage[] = [];
  for (const m of tail) {
    // Exclude acknowledgments and control placeholders from LLM history
    if ((m as any).isAcknowledgment) continue;

    if (m.role === 'user') {
      out.push({ role: 'user', content: m.text });
    } else {
      const speaker = m.personaId ? (personas.find(p => p.id === m.personaId)?.name ?? 'Assistant') : 'Assistant';
      out.push({ role: 'assistant', content: `${speaker}: ${m.text}` });
    }
  }
  return out;
}

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('What are the key open-source GeoAI tools to watch in 2025?');
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(LLM_PRESETS.ollama);
  const [personaModels, setPersonaModels] = useState<Record<string, string>>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [contextSize, setContextSize] = useState<number>(20);
  const [mode, setMode] = useState<'persona'>('persona');
  const [ttsProvider, setTtsProvider] = useState<'webspeech' | 'azure' | 'elevenlabs' | 'piper'>('webspeech');
  const [defaultVoice, setDefaultVoice] = useState('');
  const [personaVoices, setPersonaVoices] = useState<Record<string, string>>({});
  const [azureRegion, setAzureRegion] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [layoutPinnedSpeakerId, setLayoutPinnedSpeakerId] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());

  // Whisper STT state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [whisperModel, setWhisperModel] = useState<WhisperModel>('medium.en');
  const [whisperAvailable, setWhisperAvailable] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // VAD: user is currently speaking
  const recordingControllerRef = useRef<{ stop: () => Promise<ArrayBuffer>; cancel: () => void } | null>(null);

  // Wake word state - enabled by default
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [wakeWordSupported, setWakeWordSupported] = useState(false);
  const [wakeWordError, setWakeWordError] = useState<string | null>(null);
  const [wakeWordAutoStarted, setWakeWordAutoStarted] = useState(false);
  const wakeWordControllerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  // Refs to hold callback functions to avoid circular dependencies
  const onSendRef = useRef<((questionOverride?: string) => Promise<void>) | null>(null);
  const onMicrophoneClickRef = useRef<(() => Promise<void>) | null>(null);

  // Conversation Context Engine
  const contextEngineRef = useRef(createContextEngine({
    maxHistoryMessages: 30,
    timeWindowMs: 10 * 60 * 1000, // 10 minutes
    timeBudgetMsPerQuestion: 3 * 60 * 1000, // ~3 minutes per question
  }));

  const [ampByPersona, setAmpByPersona] = useState<Record<string, number>>({});

  // Video conference layout mode
  const [visemeByPersona, setVisemeByPersona] = useState<Record<string, { viseme: string; open: number; wide: number; round: number }>>({});

  // Meeting-first UI and captions
  const [meetingMode, setMeetingMode] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [activeCaption, setActiveCaption] = useState<{
    personaId: string;
    personaName: string;
    color: string;
    text: string;
  } | null>(null);


  // Mic check state
  const [isMicCheckRunning, setIsMicCheckRunning] = useState(false);


  // Debug: track meetingMode, captionsEnabled, and activeCaption changes
  useEffect(() => {
    console.log('[App] State', {
      meetingMode,
      captionsEnabled,
      activeCaption,
    });
  }, [meetingMode, captionsEnabled, activeCaption]);

  const [layoutMode, setLayoutMode] = useState<'speaker' | 'grid'>('grid');

  // Persisted calibration (face anchors) loaded from Electron or localStorage
  const [calibrationAnchors, setCalibrationAnchors] = useState<Record<string, any>>({});

  // Avatar generation state
  const [useGeneratedAvatars, setUseGeneratedAvatars] = useState(false);
  const [generatedAvatars, setGeneratedAvatars] = useState<Record<string, string>>({});
  const [avatarProvider, setAvatarProvider] = useState<'placeholder' | 'stable-diffusion-local'>('stable-diffusion-local');
  const [sdEndpoint, setSdEndpoint] = useState('http://127.0.0.1:7860');

  // Accessibility preferences
  const [reduceMotion, setReduceMotion] = useState(() => {
    // Check system preference
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Conversation dynamics settings (Phase 1: Quick Wins)
  const [showAcknowledgments, setShowAcknowledgments] = useState(true);
  const [showTypingIndicators, setShowTypingIndicators] = useState(true);
  const [enableListeningAnimations, setEnableListeningAnimations] = useState(true);

  // Streaming settings (Phase 2: Streaming Responses)

  // Backup/fallback system state
  const [backupMode, setBackupMode] = useState<BackupMode>('auto');
  const [backupStatus, setBackupStatus] = useState<string>('Backup mode: Ready');

  useEffect(() => {
    setTtsAmplitudeListener(info => {
      if (!info.personaId) return;
      setAmpByPersona(prev => ({ ...prev, [info.personaId!]: info.amp }));
    });
    return () => setTtsAmplitudeListener(null);
  }, []);

  useEffect(() => {
    setTtsVisemeListener(info => {
      if (!info.personaId) return;
      setVisemeByPersona(prev => ({
        ...prev,
        [info.personaId!]: { viseme: info.viseme, open: info.open, wide: info.wide, round: info.round }
      }));
    });
    return () => setTtsVisemeListener(null);
  }, []);

  // Auto-switch layout mode based on speaking state or a layout-pinned speaker
  useEffect(() => {
    if (speakingId || layoutPinnedSpeakerId) {
      setLayoutMode('speaker');
    } else {
      // Switch to grid when no one is speaking and no one is layout-pinned
      const timer = setTimeout(() => setLayoutMode('grid'), 500);
      return () => clearTimeout(timer);
    }
  }, [speakingId, layoutPinnedSpeakerId]);

  // Check Piper and Whisper availability on startup
  useEffect(() => {
    console.log('🔍 Checking Piper availability...');
    console.log('  window.electron:', window.electron);
    console.log('  window.electron?.piperSpeak:', window.electron?.piperSpeak);
    console.log('  window.electron?.piperTest:', window.electron?.piperTest);

    if (window.electron?.piperTest) {
      window.electron.piperTest().then(result => {
        if (result.success) {
          console.log('✅ Piper is available and ready!');
        } else {
          console.warn('⚠️ Piper test failed:', result.error);
        }
      }).catch(error => {
        console.error('❌ Piper test error:', error);
      });
    } else {
      console.warn('⚠️ Electron IPC not available - Piper will not work');
      console.warn('   Make sure you are running: npm run dev (not just vite)');
    }

    // Check Whisper availability
    console.log('🔍 Checking Whisper availability...');
    whisperTest().then(result => {
      if (result.success) {
        console.log('✅ Whisper is available and ready!');
        setWhisperAvailable(true);
      } else {
        console.warn('⚠️ Whisper not available:', result.error);
        setWhisperAvailable(false);
      }
    }).catch(error => {
      console.error('❌ Whisper test error:', error);
      setWhisperAvailable(false);
    });

    // Check local wake word support
    const localWakeWordSupport = isLocalWakeWordSupported();
    setWakeWordSupported(localWakeWordSupport);
    if (localWakeWordSupport) {
      console.log('✅ Local wake word detection is supported');
      // Test if openWakeWord is installed
      testLocalWakeWord().then(result => {
        if (result.success) {
          console.log('✅ openWakeWord is installed and ready!');
        } else {
          console.warn('⚠️ openWakeWord not installed:', result.error);
          setWakeWordError(result.error || 'openWakeWord not installed');
        }
      });

    } else {
      console.warn('⚠️ Local wake word detection not supported (not running in Electron?)');
    }
  }, []);

  // Auto-start wake word detection when Whisper becomes available
  useEffect(() => {
    if (whisperAvailable && wakeWordSupported && !wakeWordEnabled && !wakeWordAutoStarted && !wakeWordError) {
      console.log('🎤 Auto-starting wake word detection...');
      setWakeWordAutoStarted(true);

      (async () => {
        try {
          const controller = await startLocalWakeWord(() => {
            console.log('✅ Wake word detected! Starting voice input...');
            if (onMicrophoneClickRef.current) {
              onMicrophoneClickRef.current();
            }
          });
          wakeWordControllerRef.current = controller;
          setWakeWordEnabled(true);
          console.log('👂 Wake word detection auto-started, listening for "Okay Panel"...');
        } catch (error) {
          console.error('❌ Failed to auto-start wake word detection:', error);
          setWakeWordError(error instanceof Error ? error.message : String(error));
        }
      })();
    }
  }, [whisperAvailable, wakeWordSupported, wakeWordEnabled, wakeWordAutoStarted, wakeWordError]);

  const speakingPersona = useMemo(() => personas.find(p => p.id === speakingId) || null, [speakingId]);

  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(59,130,246,${alpha})`;
    const r = parseInt(m[1], 16); const g = parseInt(m[2], 16); const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);


  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const selectedPersonasBase = useMemo(() => personas.filter(p => ['maya','otto','sarah','marcus','jessica'].includes(p.id)), []);
  const selectedPersonasMerged = useMemo(() => selectedPersonasBase.map(p => ({
    ...p,
    faceAnchors: (calibrationAnchors as any)[p.id] ?? p.faceAnchors,
  })), [selectedPersonasBase, calibrationAnchors]);
  // Load saved settings on mount
  // Load calibration anchors (face anchors) once on startup
  useEffect(() => {
    (async () => {
      try {
        if (window.electron?.calibrationLoad) {
          const res = await window.electron.calibrationLoad();
          if (res.success && res.data) {
            setCalibrationAnchors(res.data);
            return;
          }
        }
        const raw = localStorage.getItem('avatarFaceAnchors');
        if (raw) setCalibrationAnchors(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  // Backwards-compat alias used throughout the file
  const selectedPersonas = selectedPersonasBase;

  useEffect(() => {
    try {
      const raw = localStorage.getItem('settings');
      if (!raw) return;
      const s = JSON.parse(raw);

      // Load LLM config (with backward compatibility for old settings)
      if (s.llmConfig) {
        setLlmConfig(s.llmConfig);
      } else if (s.baseUrl || s.model) {
        // Migrate old settings
        setLlmConfig({
          provider: 'ollama',
          baseUrl: s.baseUrl || LLM_PRESETS.ollama.baseUrl,
          defaultModel: s.model || LLM_PRESETS.ollama.defaultModel,
        });
      }

      if (s && typeof s.personaModels === 'object') setPersonaModels(s.personaModels);
      if (typeof s.contextSize === 'number') setContextSize(s.contextSize);
      if (s.mode === 'persona') setMode('persona');
      if (s.ttsProvider === 'webspeech' || s.ttsProvider === 'azure' || s.ttsProvider === 'elevenlabs' || s.ttsProvider === 'piper') setTtsProvider(s.ttsProvider);
      if (typeof s.defaultVoice === 'string') setDefaultVoice(s.defaultVoice);
      // For Piper, don't load personaVoices from storage - always use persona definitions
      // For other providers, load from storage
      if (s && typeof s.personaVoices === 'object') {
        if (s.ttsProvider !== 'piper') {
          setPersonaVoices(s.personaVoices);
        }
      }
      if (typeof s.azureRegion === 'string') setAzureRegion(s.azureRegion);
      if (typeof s.azureKey === 'string') setAzureKey(s.azureKey);
      if (typeof s.elevenKey === 'string') setElevenKey(s.elevenKey);
      // Load Whisper model preference
      if (s.whisperModel === 'tiny.en' || s.whisperModel === 'base.en' || s.whisperModel === 'small.en' || s.whisperModel === 'medium.en') {
        setWhisperModel(s.whisperModel);
      }
      // Load conversation dynamics settings
      if (typeof s.showAcknowledgments === 'boolean') setShowAcknowledgments(s.showAcknowledgments);
      if (typeof s.showTypingIndicators === 'boolean') setShowTypingIndicators(s.showTypingIndicators);
      if (typeof s.enableListeningAnimations === 'boolean') setEnableListeningAnimations(s.enableListeningAnimations);
      // Load backup mode settings
      if (s.backupMode === 'disabled' || s.backupMode === 'auto' || s.backupMode === 'always' || s.backupMode === 'hybrid') setBackupMode(s.backupMode);
    } catch {}
  }, []);
  // Prefill Azure voices with recommended defaults per persona (non-destructive)
  useEffect(() => {
    if (ttsProvider !== 'azure') return;
    const defaults: Record<string, string> = {
      maya: 'en-CA-ClaraNeural',
      otto: 'en-GB-RyanNeural',
      opendata: 'en-US-AriaNeural',
      marcus: 'en-US-GuyNeural',
      jessica: 'en-US-SaraNeural',
    };
    let changed = false;
    const merged = { ...personaVoices };
    Object.keys(defaults).forEach(id => {
      if (!merged[id]) { merged[id] = defaults[id]; changed = true; }
    });
    if (changed) setPersonaVoices(merged);
  }, [ttsProvider]);

  // Reactivate wake word detection after AI finishes speaking
  useEffect(() => {
    // Only reactivate if:
    // 1. No one is currently speaking (speakingId is null)
    // 2. AI is not busy processing (busy is false)
    // 3. Not currently recording or transcribing
    // 4. Wake word is supported but not currently enabled
    // 5. Whisper is available
    if (!speakingId && !busy && !isRecording && !isTranscribing &&
        wakeWordSupported && !wakeWordEnabled && whisperAvailable && wakeWordAutoStarted) {
      console.log('🎤 AI finished speaking and processing, reactivating wake word detection...');

      // Use a timeout to ensure all state has settled
      const timer = setTimeout(() => {
        (async () => {
          try {
            const controller = await startLocalWakeWord(() => {
              console.log('✅ Wake word detected! Starting voice input...');
              if (onMicrophoneClickRef.current) {
                onMicrophoneClickRef.current();
              }
            });
            wakeWordControllerRef.current = controller;
            setWakeWordEnabled(true);
            console.log('👂 Wake word detection reactivated after AI response');
          } catch (error) {
            console.error('❌ Failed to reactivate wake word detection:', error);
            setWakeWordError(error instanceof Error ? error.message : String(error));
          }
        })();
      }, 500); // 500ms delay to ensure all state updates have completed

      return () => clearTimeout(timer);
    }
  }, [speakingId, busy, isRecording, isTranscribing, wakeWordSupported, wakeWordEnabled, whisperAvailable, wakeWordAutoStarted]);

  const speakQueued = useCallback((text: string, personaId?: string, preGeneratedAudioPromise?: Promise<HTMLAudioElement | null>, onStartCallback?: () => void) => {
    const settings: TTSSettings = {
      provider: ttsProvider,
      defaultVoice,
      personaVoices,
      azureRegion,
      azureKey,
      elevenApiKey: elevenKey,
    };
    ttsChain = ttsChain.then(async () => {
      if (personaId) setSpeakingId(personaId);
      // Clear layout pin when TTS actually starts (not when queued)
      if (onStartCallback) onStartCallback();
      // Always set live caption on utterance start; visibility is controlled by captionsEnabled
      if (personaId) {
        const found = selectedPersonasMerged.find(x => x.id === personaId) || personas.find(x => x.id === personaId);
        const personaName = found?.name ?? 'Assistant';
        const color = found?.color ?? '#ffffff';
        console.log('[CC] setActiveCaption', { personaId, personaName, text, captionsEnabled });
        setActiveCaption({ personaId, personaName, color, text });
      } else {
        console.log('[CC] not setting caption (no personaId)', { personaId, captionsEnabled });
      }

      try {
        if (preGeneratedAudioPromise) {
          // Wait for pre-generation to complete (may already be done)
          console.log(`⏳ Waiting for pre-generated audio for ${personaId}...`);
          const waitStart = Date.now();
          const preGeneratedAudio = await preGeneratedAudioPromise;
          const waitTime = Date.now() - waitStart;
          if (waitTime < 100) {
            console.log(`✨ Audio was already ready for ${personaId}! (waited ${waitTime}ms)`);
          } else {
            console.log(`⏱️ Waited ${waitTime}ms for audio generation for ${personaId}`);
          }
          await ttsPlayPreGenerated(preGeneratedAudio, text, settings, personaId);
        } else {
          await ttsSpeak(text, settings, personaId);
        }
      } finally {
        if (personaId) {
          setSpeakingId(prev => (prev === personaId ? null : prev));
          // Clear caption only if it belongs to this persona
          console.log('[CC] clearing caption for persona if matches', personaId);
          setActiveCaption(prev => (prev && prev.personaId === personaId ? null : prev));
        }
      }

    });
    return ttsChain;
  }, [ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey, selectedPersonasMerged]);

  const skipCurrentSpeaker = useCallback(() => {
    console.log('🛑 Skip button clicked - skipping current speaker only');

    // Cancel the current speech (this will cause the current ttsSpeak to resolve immediately)
    cancelCurrentSpeech();

    // Clear the speaking indicator
    setSpeakingId(null);
    setLayoutPinnedSpeakerId(null);

    // Also clear live captions if any
    console.log('[CC] setActiveCaption(null) due to skipCurrentSpeaker');
    setActiveCaption(null);


    // Don't reset the chain - let the next speaker continue
  }, []);




  // One-tap panelist mic check: each persona gives a brief, in-character audio confirmation
  const runMicCheck = useCallback(async () => {
    if (isMicCheckRunning || busy || selectedPersonas.length === 0) return;
    setIsMicCheckRunning(true);
    setBusy(true);
    try {
      const hostMsg: Msg = {
        id: `m-${Date.now()}-host-mic`,
        role: 'user',
        author: 'Host',
        text: 'Quick mic check: panel, please confirm audio is clear.',
        color: '#6B7280',
      };
      setMessages(prev => [...prev, hostMsg]);
      contextEngineRef.current.ingestMessage({ id: hostMsg.id, role: 'user', text: hostMsg.text, timestamp: Date.now(), excludeFromHistory: true });
      scrollToEnd();

      for (const p of selectedPersonas) {
        const line = MIC_CHECK_LINES[p.id] || `This is ${p.name}. Loud and clear.`;

        // Record to transcript immediately (and exclude from long-term CE history)
        const msg: Msg = { id: `m-${Date.now()}-${p.id}-mic`, role: 'assistant', personaId: p.id, author: p.name, text: line, color: p.color };
        setMessages(prev => [...prev, msg]);
        contextEngineRef.current.ingestMessage({ id: msg.id, role: 'assistant', personaId: p.id, author: p.name, text: line, timestamp: Date.now(), excludeFromHistory: true });
        scrollToEnd();

        // Prepare TTS settings snapshot
        const settings: TTSSettings = {
          provider: ttsProvider,
          defaultVoice,
          personaVoices,
          azureRegion,
          azureKey,
          elevenApiKey: elevenKey,
        };

        // Pre-generate where possible (Azure/Eleven); Piper will fall back to live generation
        const ttsPromise = ttsPreGenerate(line, settings, p.id);

        // Pin speaker in layout and play sequentially
        setLayoutPinnedSpeakerId(p.id);

        await speakQueued(line, p.id, ttsPromise, () => setLayoutPinnedSpeakerId(p.id));

        await new Promise(res => setTimeout(res, 120)); // brief pacing between panelists
      }
    } catch (err) {
      console.error('Mic check failed:', err);
    } finally {
      setIsMicCheckRunning(false);
      setBusy(false);
      setLayoutPinnedSpeakerId(null);

      setActiveCaption(null);
    }
  }, [isMicCheckRunning, busy, selectedPersonas, ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey, speakQueued]);


  // Clear personaVoices when switching to Piper (voices come from persona definitions)
  useEffect(() => {
    if (ttsProvider === 'piper') {
      setPersonaVoices({});
    }
  }, [ttsProvider]);

  // Sync backup mode with backup service
  useEffect(() => {
    setBackupConfig({ mode: backupMode });
  }, [backupMode]);

  // Listen for backup status changes
  useEffect(() => {
    const updateStatus = () => {
      const status = getBackupStatus();
      setBackupStatus(status.message);
    };

    // Initial status
    updateStatus();

    // Add listener
    addBackupStateListener(updateStatus);

    // Cleanup
    return () => {
      removeBackupStateListener(updateStatus);
    };
  }, []);

  // Persist settings when they change
  useEffect(() => {
    // For Piper, don't save personaVoices - always use persona definitions
    const voicesToSave = ttsProvider === 'piper' ? {} : personaVoices;
    const s = {
      llmConfig,
      personaModels,
      contextSize,
      mode,
      ttsProvider,
      defaultVoice,
      personaVoices: voicesToSave,
      azureRegion,
      azureKey,
      elevenKey,
      whisperModel,
      showAcknowledgments,
      showTypingIndicators,
      enableListeningAnimations,
      backupMode,
    };
    try { localStorage.setItem('settings', JSON.stringify(s)); } catch {}
  }, [llmConfig, personaModels, contextSize, mode, ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey, whisperModel, showAcknowledgments, showTypingIndicators, enableListeningAnimations, backupMode]);


  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    });
  }, []);

  // Handle microphone button click
  const onMicrophoneClick = useCallback(async () => {
    if (isRecording) {
      // Stop recording manually
      console.log('🎤 Manual stop requested...');
      if (recordingControllerRef.current) {
        recordingControllerRef.current.stop();
        // The promise will be handled by the auto-handler set up when recording started
      }
    } else {
      // Stop wake word detection while recording to avoid conflicts
      if (wakeWordEnabled && wakeWordControllerRef.current) {
        console.log('🎤 Stopping wake word detection during recording...');
        await wakeWordControllerRef.current.stop();
        wakeWordControllerRef.current = null;
        setWakeWordEnabled(false);
      }

      // Start recording with VAD
      console.log('🎤 Starting recording with VAD...');
      setIsRecording(true);
      setIsSpeaking(false);

      try {
        const controller = startRecordingWithVAD({
          maxDurationMs: 30000, // 30 seconds max
          silenceThresholdMs: 2000, // 2 seconds of silence to allow for natural pauses
          onSpeechStart: () => {
            console.log('🎤 Speech started');
            setIsSpeaking(true);
          },
          onSpeechEnd: () => {
            console.log('🎤 Speech ended');
            setIsSpeaking(false);
          }
        });
        recordingControllerRef.current = controller;

        // Set up promise handler for when recording stops (either manually or auto)
        controller.stop().then(async (audioBuffer) => {
          console.log('🎤 Recording stopped, starting transcription...');
          setIsRecording(false);
          setIsSpeaking(false);
          setIsTranscribing(true);
          recordingControllerRef.current = null;

          try {
            console.log('🎤 Transcribing audio...');
            const transcription = await whisperTranscribe(audioBuffer, whisperModel);
            console.log('✅ Transcription:', transcription);
            setIsTranscribing(false);

            // Auto-submit the question after transcription
            if (transcription.trim()) {
              console.log('🚀 Auto-submitting question...');
              // Use a small delay to ensure state updates
              setTimeout(() => {
                if (onSendRef.current) {
                  onSendRef.current(transcription);
                }
              }, 100);
            }
          } catch (error) {
            console.error('❌ Transcription error:', error);
            alert(`Voice input failed: ${error instanceof Error ? error.message : String(error)}`);
            setIsTranscribing(false);
          }
        }).catch((error) => {
          console.error('❌ Recording error:', error);
          setIsRecording(false);
          setIsSpeaking(false);
          setIsTranscribing(false);
          recordingControllerRef.current = null;
          if (error.message !== 'Recording cancelled') {
            alert(`Recording failed: ${error.message}`);
          }
        });
      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        alert(`Failed to start recording: ${error instanceof Error ? error.message : String(error)}`);
        setIsRecording(false);
        setIsSpeaking(false);
      }
    }
  }, [isRecording, whisperModel, wakeWordEnabled]);

  // Store onMicrophoneClick in ref for use in callbacks
  useEffect(() => {
    onMicrophoneClickRef.current = onMicrophoneClick;
  }, [onMicrophoneClick]);

  // Toggle wake word detection
  const toggleWakeWord = useCallback(async () => {
    if (wakeWordEnabled) {
      // Stop wake word detection
      if (wakeWordControllerRef.current) {
        await wakeWordControllerRef.current.stop();
        wakeWordControllerRef.current = null;
      }
      setWakeWordEnabled(false);
      setWakeWordError(null);
      console.log('👂 Local wake word detection disabled');
    } else {
      // Start local wake word detection
      setWakeWordError(null);
      try {
        console.log('👂 Starting local wake word detection...');
        const controller = await startLocalWakeWord(() => {
          console.log('✅ Wake word detected! Starting voice input...');
          // Trigger microphone click to start recording
          if (onMicrophoneClickRef.current) {
            onMicrophoneClickRef.current();
          }
        });
        wakeWordControllerRef.current = controller;
        setWakeWordEnabled(true);
        console.log('👂 Local wake word detection enabled, listening for "Okay Panel"...');
      } catch (error) {
        console.error('❌ Failed to start local wake word detection:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        setWakeWordError(errorMsg);
        let helpText = '\n\nPossible solutions:\n';
        helpText += '• Run setup: bash scripts/setup-openwakeword.sh\n';
        helpText += '• Install PyAudio: pip3 install pyaudio\n';
        helpText += '• Grant microphone permissions\n';
        helpText += '• Check console for details';
        alert(`Failed to start wake word detection: ${errorMsg}${helpText}`);
      }
    }
  }, [wakeWordEnabled]);

  // Cleanup wake word on unmount
  useEffect(() => {
    return () => {
      if (wakeWordControllerRef.current) {
        wakeWordControllerRef.current.stop();
      }
    };
  }, []);


  // Robust check for "SKIP" control token that sometimes arrives with labels/quotes

  // Helper function to determine if a question will use backup response
  const willUseBackupResponse = (question: string): boolean => {
    // Check if backup mode is always on
    if (shouldUseBackup()) {
      return true;
    }

    // Check if hybrid mode with strong match
    if (isHybridMode() && shouldUseBackupInHybridMode(question)) {
      return true;
    }

    // Check for recognized demo questions (high confidence match)
    const match = getBackupMatchConfidence(question);
    if (match?.questionId && match.confidence >= 0.75) {
      return true;
    }

    return false;
  };

  // Orchestrated persona-first pipeline round powered by Context Engine (sequential + reactive)
  async function handlePersonaRound(question: string, baseHistory: ChatMessage[]): Promise<void> {
    const engine = contextEngineRef.current;

    // Start round and randomize speaking order
    const participants = selectedPersonas.map(p => p.id);
    engine.startRound(question, participants);
    const order = [...selectedPersonas].sort(() => Math.random() - 0.5);

    // Pin first speaker in layout to prevent grid flash during placeholder→real response transition
    const first = order[0];
    setLayoutPinnedSpeakerId(first.id);

    // Log round models per persona
    try {
      console.log('🟡 [CE] Round start', {
        question: question.slice(0, 180),
        participants: order.map(p => ({ id: p.id, name: p.name, model: personaModels[p.id] || llmConfig.defaultModel }))
      });
    } catch {}

    // TTS settings
    const ttsSettings: TTSSettings = {
      provider: ttsProvider,
      defaultVoice,
      personaVoices,
      azureRegion,
      azureKey,
      elevenApiKey: elevenKey,
    };

    // Determine if this question will use backup responses
    const isBackupResponse = willUseBackupResponse(question);

    // Show acknowledgment for the first persona (skip rendering for backup responses)
    const ackText = getAcknowledgment(first.id);
    const ackMsgId = `m-${Date.now()}-${first.id}-ack`;
    const ackMsg: Msg = {
      id: ackMsgId,
      role: 'assistant',
      personaId: first.id,
      author: first.name,
      text: ackText,
      color: first.color,
      isAcknowledgment: true,
      isBackup: isBackupResponse,
    };
    setMessages(prev => [...prev, ackMsg]);
    // Ingest acknowledgment into Context Engine but exclude from long-term history
    contextEngineRef.current.ingestMessage({ id: ackMsgId, role: 'assistant', personaId: first.id, author: first.name, text: ackText, timestamp: Date.now(), excludeFromHistory: true });

    scrollToEnd();

    if (!isBackupResponse) {
      speakQueued(ackText, first.id);
    }

    // Sequential round state
    const currentRoundMsgs: ChatMessage[] = [];
    let disagreementOccurred = false;

    for (let i = 0; i < order.length; i++) {
      const p = order[i];

      if (engine.timeBudgetExceeded()) {
        console.log('⏳ [CE] Time budget exceeded for this round; stopping further responses.');
        break;
      }

      // Build system prompt with reactive requirements for non-first speakers
      let sysContent = engine.buildPersonaSystemPrompt(p.systemPrompt, p.id, p.name);
      const isFirst = i === 0;
      if (!isFirst) {
        sysContent += `\n\nYou are not the first speaker this round. Briefly react to at least one prior panelist by name and integrate it into your answer. Your reaction must either agree or politely disagree, and you must use explicit persona names when referencing others.`;
        if (!disagreementOccurred && i === order.length - 1) {
          sysContent += `\n\nNo explicit disagreement has occurred yet this round. Offer a respectful, well-grounded disagreement with a specific point from one prior panelist by name.`;
        }
      }

      const sys: ChatMessage = { role: 'system', content: sysContent };
      const usedModel = personaModels[p.id] || llmConfig.defaultModel;
      const reqMsgs: ChatMessage[] = [sys, ...baseHistory, ...currentRoundMsgs, { role: 'user', content: question }];
      console.log('📝 [CE] System prompt →', { personaId: p.id, personaName: p.name, model: usedModel, prompt: sys.content });

      setInFlight(prev => { const s = new Set(prev); s.add(p.id); return s; });
      let answer: string;
      let isBackup: boolean;
      try {
        const response = await chatWithLLM(llmConfig, { model: usedModel, messages: reqMsgs, personaId: p.id });
        answer = response.content;
        isBackup = response.isBackup;

        // Defensive: avoid repetitive responses
        const isRep = engine.responseIsRepetitive(answer, p.id);
        console.log('🔁 [CE] Repetition decision', { personaId: p.id, personaName: p.name, repetitive: isRep, sample: (answer || '').slice(0, 140) });
        if (isRep) {
          answer = 'SKIP';
        }

        if (answer && answer.trim().toUpperCase() !== 'SKIP') {
          // Record into context engine and UI
          engine.ingestMessage({ id: `e-${Date.now()}-${p.id}`, role: 'assistant', personaId: p.id, author: p.name, text: answer, timestamp: Date.now() });
          const msg: Msg = { id: `m-${Date.now()}-${p.id}`, role: 'assistant', personaId: p.id, author: p.name, text: answer, color: p.color, isBackup };
          if (isFirst) {
            setMessages(prev => prev.map(m => m.id === ackMsgId ? msg : m));
          } else {
            setMessages(prev => [...prev, msg]);
          }
          scrollToEnd();

          // Pre-generate audio and queue TTS
          const ttsPromise = ttsPreGenerate(answer, ttsSettings, p.id);
          speakQueued(answer, p.id, ttsPromise, () => {
            if (isFirst) setLayoutPinnedSpeakerId(null);
          });

          // Track if a disagreement occurred
          if (/\bdisagree\b/i.test(answer) || /\bpush back\b/i.test(answer) || /\bchallenge\b/i.test(answer)) {
            disagreementOccurred = true;
          }

          // Include this response for subsequent personas
          currentRoundMsgs.push({ role: 'assistant', content: `${p.name}: ${answer}` });
        } else {
          // SKIP: do nothing
        }
      } finally {
        setInFlight(prev => { const s = new Set(prev); s.delete(p.id); return s; });
      }
    }


  }


  const onSend = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride || input).trim();
    if (!question || busy) return;

    const userMsg: Msg = { id: `m-${Date.now()}-u`, role: 'user', author: 'You', text: question, color: '#3B82F6' };
    setMessages(prev => [...prev, userMsg]);
    // Ingest user message into context engine
    contextEngineRef.current.ingestMessage({ id: userMsg.id, role: 'user', text: question, timestamp: Date.now() });

    setInput('');
    scrollToEnd();


    // Special handling: If user asks for a mic check, trigger the scripted sequence instead of LLM
    {
      const ql = question.toLowerCase();
      const isMicCheck = /\b(mic|microphone)\b.*\b(check|test)\b/.test(ql)
        || /\bsound\b.*\b(check|test)\b/.test(ql)
        || /check\s+(your|the)\s+(mics|microphones)/.test(ql);
      if (isMicCheck) {
        await runMicCheck();
        return;
      }
    }

    setBusy(true);
    if (selectedPersonas.length === 0) { setBusy(false); return; }

    // Build context from current question only to reduce repetition and keep focus
    const baseHistory = buildHistoryChat(messages, contextSize, true);

    // Unified orchestration path for persona-based conversations
    await handlePersonaRound(question, baseHistory);
    setBusy(false);
  }, [input, busy, selectedPersonas, llmConfig, personaModels, scrollToEnd, showAcknowledgments, ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey, mode, messages, contextSize]);

  // Store onSend in ref for use in callbacks
  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  return (
    <div className={`app stage ${meetingMode ? 'meeting-mode' : ''}`}>
      <div className="header">
        <div className="title">GeoAI MetaPanel</div>
      </div>

      {/* Video Conference Layout */}
      <VideoConferenceLayout
        personas={selectedPersonasMerged}
        speakingPersonaId={speakingId ?? undefined}
        layoutPinnedSpeakerId={layoutPinnedSpeakerId ?? undefined}
        audioAmplitudes={ampByPersona}
        visemesByPersona={visemeByPersona}
        layoutMode={layoutMode}
        personaModels={personaModels}
        defaultModel={llmConfig.defaultModel}
        inFlight={inFlight}
        busy={busy}
        generatedAvatars={generatedAvatars}
        useGeneratedAvatars={useGeneratedAvatars}
        enableListeningAnimations={enableListeningAnimations}
        meetingMode={meetingMode}

      />

      {/* Live captions overlay (toggleable, with transitions) */}
      {meetingMode && (
        <CaptionsOverlay
          visible={captionsEnabled && !!activeCaption}
          text={activeCaption?.text || ''}
          personaName={activeCaption?.personaName || ''}
          color={activeCaption?.color || '#fff'}
        />
      )}

      {/* Meeting toolbar */}
      <div className="meeting-toolbar" role="toolbar" aria-label="Meeting controls">
          <button
            className={`toolbar-button mic ${isRecording ? 'unmuted' : 'muted'} ${isSpeaking ? 'speaking' : ''}`}
            onClick={onMicrophoneClick}
            disabled={busy || isTranscribing || !whisperAvailable}
            aria-pressed={isRecording}
            title={isRecording ? (isSpeaking ? 'Speaking detected... click to stop' : 'Listening... click to stop') : 'Click to start voice input'}
          >
            <span className="icon" aria-hidden>🎤</span>
            <span>{isRecording ? 'On' : 'Off'}</span>
          </button>

          <div className="toolbar-sep" aria-hidden></div>

          {/* View controls: mode, layout, captions */}
          <button
            className="toolbar-button mode"
            onClick={() => setMeetingMode(m => { const next = !m; console.log('[Toolbar] Meeting mode toggled ->', next); return next; })}
            aria-pressed={meetingMode}
            title="Toggle meeting vs chat UI"
          >
            <span className="icon" aria-hidden>{meetingMode ? '💬' : '🎥'}</span>
            <span>{meetingMode ? 'Chat' : 'Meeting'}</span>
          </button>

          <button
            className="toolbar-button layout"
            onClick={() => setLayoutMode(m => m === 'grid' ? 'speaker' : 'grid')}
            title="Toggle layout mode"
          >
            <span className="icon" aria-hidden>{layoutMode === 'grid' ? '🎬' : '🔳'}</span>
            <span>{layoutMode === 'grid' ? 'Speaker' : 'Grid'}</span>
          </button>

          <button
            className={`toolbar-button cc ${captionsEnabled ? 'active' : ''}`}
            onClick={() => setCaptionsEnabled(c => { const next = !c; console.log('[CC] captionsEnabled toggled ->', next); return next; })}
            aria-pressed={captionsEnabled}
            title="Toggle live captions"
          >
            <span className="icon" aria-hidden>CC</span>
            <span>{captionsEnabled ? 'On' : 'Off'}</span>
          </button>

          <div className="toolbar-sep" aria-hidden></div>



          {/* Settings */}
          <button
            className="toolbar-button settings"
            onClick={() => setShowSettings(s => !s)}
            aria-pressed={showSettings}
            title="Open settings"
          >
            <span className="icon" aria-hidden>⚙️</span>
            <span>Settings</span>
          </button>

          {speakingPersona && (
            <>
              <div className="toolbar-sep" aria-hidden></div>
              <button
                className="toolbar-button skip"
                onClick={skipCurrentSpeaker}
                title="Skip current speaker"
              >
                <span className="icon" aria-hidden>⏭</span>
                <span>Skip</span>
              </button>
            </>
          )}
        </div>

      {/* Floating mic control for meeting mode */}
      {meetingMode && whisperAvailable && (
        <div className="meeting-mic-floating">
          <button
            className={`mic-button large ${isRecording ? (isSpeaking ? 'recording speaking' : 'recording') : ''}`}
            onClick={onMicrophoneClick}
            disabled={busy || isTranscribing}
            title={
              isRecording
                ? (isSpeaking ? 'Speaking detected... (stops automatically when you finish)' : 'Listening... (speak now or click to stop)')
                : 'Click to start voice input (auto-stops when you finish speaking)'
            }
          >
            {isTranscribing ? '⏳' : isRecording ? (isSpeaking ? '🔴' : '⏹️') : '🎤'}
          </button>
        </div>
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          personas={selectedPersonasMerged}
          generatedAvatars={generatedAvatars}
          useGeneratedAvatars={useGeneratedAvatars}
        >
          <LLMProviderSelector
            config={llmConfig}
            onConfigChange={setLlmConfig}
            onModelsRefresh={setAvailableModels}
          />

          <div className="label" style={{ marginTop: 16 }}>Per‑persona model overrides (optional)</div>
          <div className="tip">Only loaded models appear in dropdowns. Load models in LM Studio first.</div>
          {availableModels.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <button
                onClick={() => {
                  // Assign random models to each persona, ensuring different models if possible
                  const shuffled = [...availableModels].sort(() => Math.random() - 0.5);
                  const newAssignments: Record<string, string> = {};
                  selectedPersonas.forEach((p, idx) => {
                    // Use modulo to cycle through models if there are more personas than models
                    newAssignments[p.id] = shuffled[idx % shuffled.length];
                  });
                  setPersonaModels(newAssignments);
                }}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                🎲 Randomize Models
              </button>
              <div className="tip" style={{ margin: 0, fontSize: '11px' }}>
                {availableModels.length} loaded model(s) ready
              </div>
            </div>
          )}
          {selectedPersonas.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <div style={{ width: 140, color: '#374151' }}>{p.name}</div>
              {availableModels.length > 0 ? (
                <select
                  className="text-input"
                  value={personaModels[p.id] ?? ''}
                  onChange={e => setPersonaModels(prev => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ flex: 1 }}
                >
                  <option value="">Use Default Model</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="text-input"
                  placeholder="e.g. mistral, gemma, llama3.1, deepseek-r1:7b"
                  value={personaModels[p.id] ?? ''}
                  onChange={e => setPersonaModels(prev => ({ ...prev, [p.id]: e.target.value }))}
                />
              )}
            </div>
          ))}



          <div className="label" style={{ marginTop: 12 }}>TTS Provider</div>
          <select className="text-input" value={ttsProvider} onChange={e => setTtsProvider(e.target.value as any)}>
            <option value="webspeech">Web Speech (browser)</option>
            <option value="piper">Piper (local, high quality)</option>
            <option value="azure">Azure Neural</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>

          {ttsProvider === 'azure' && (
            <>
              <div className="label" style={{ marginTop: 8 }}>Azure region</div>
              <input className="text-input" value={azureRegion} onChange={e => setAzureRegion(e.target.value)} placeholder="e.g. eastus" />
              <div className="label">Azure key</div>
              <input className="text-input" value={azureKey} onChange={e => setAzureKey(e.target.value)} placeholder="Your Azure Speech key" />
            </>
          )}

          {ttsProvider === 'elevenlabs' && (
            <>
              <div className="label" style={{ marginTop: 8 }}>ElevenLabs API key</div>
              <input className="text-input" value={elevenKey} onChange={e => setElevenKey(e.target.value)} placeholder="sk-..." />
            </>
          )}

          {ttsProvider === 'piper' && (
            <div className="tip" style={{ marginTop: 8, padding: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4 }}>
              <strong>🎤 Piper TTS</strong> - High-quality local neural voices
              <br />
              Install: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 3 }}>pip install piper-tts</code>
              <br />
              Voices are automatically assigned per persona from their definitions
              <br />
              <small>Maya: Semaine/Prudence, Otto: Semaine/Obadiah, Sarah: Kathleen, Marcus: Bryce, Jessica: Amy</small>
              <br />
              <button
                className="btn"
                style={{ marginTop: 8, fontSize: 12, padding: '4px 8px' }}
                onClick={async () => {
                  console.log('🔍 Testing Piper configuration...');
                  console.log('window.electron:', window.electron);
                  console.log('window.electron?.piperSpeak:', window.electron?.piperSpeak);
                  console.log('window.electron?.piperTest:', window.electron?.piperTest);

                  if (!window.electron?.piperTest) {
                    alert('❌ Electron IPC not available!\n\nThis means you\'re running in a browser, not in Electron.\n\nPiper requires Electron. Run: npm run dev');
                    return;
                  }

                  try {
                    const result = await window.electron.piperTest();
                    if (result.success) {
                      alert('✅ Piper is installed and ready!\n\nYou can now use Piper TTS.');
                    } else {
                      alert(`❌ Piper test failed:\n\n${result.error}\n\nInstall with: pip install piper-tts`);
                    }
                  } catch (error) {
                    alert(`❌ Piper test error:\n\n${error instanceof Error ? error.message : String(error)}`);
                  }
                }}
              >
                🔍 Test Piper Connection
              </button>
            </div>
          )}

          {ttsProvider !== 'piper' && (
            <>
              <div className="label" style={{ marginTop: 8 }}>Default voice (name or id)</div>
              <input
                className="text-input"
                value={defaultVoice}
                onChange={e => setDefaultVoice(e.target.value)}
                placeholder={ttsProvider === 'webspeech' ? 'e.g. Microsoft David Desktop - English (United States)' : (ttsProvider === 'azure' ? 'e.g. en-US-JennyNeural' : 'ElevenLabs voiceId')}
              />
            </>
          )}

          {ttsProvider !== 'piper' && (
            <>
              <div className="label" style={{ marginTop: 8 }}>Per-persona voice overrides (optional)</div>
              <div className="tip">Leave blank to use the Default voice above</div>
              {selectedPersonas.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <div style={{ width: 140, color: '#374151' }}>{p.name}</div>
                  <input
                    className="text-input"
                    placeholder={ttsProvider === 'webspeech' ? 'voice name' : (ttsProvider === 'azure' ? 'Azure voice name' : 'ElevenLabs voiceId')}
                    value={personaVoices[p.id] ?? ''}
                    onChange={e => setPersonaVoices(prev => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
            </>
          )}

          <div className="label" style={{ marginTop: 12 }}>Context window: last {contextSize} messages</div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={contextSize}
            onChange={e => setContextSize(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div className="tip">0 = no prior context; larger values include more history</div>


          {/* Conversation Dynamics Settings */}
          <div className="label" style={{ marginTop: 16, fontWeight: 700 }}>💬 Conversation Dynamics</div>
          <div className="tip">Enhance conversational flow and responsiveness</div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showAcknowledgments}
              onChange={e => setShowAcknowledgments(e.target.checked)}
            />
            <span>Show acknowledgment messages</span>
          </label>
          <div className="tip" style={{ marginLeft: 24 }}>
            Display immediate acknowledgments (e.g., "Let me think...") while generating responses
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showTypingIndicators}
              onChange={e => setShowTypingIndicators(e.target.checked)}
            />
            <span>Show typing indicators</span>
          </label>
          <div className="tip" style={{ marginLeft: 24 }}>
            Display animated typing dots with persona-specific styles
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enableListeningAnimations}
              onChange={e => setEnableListeningAnimations(e.target.checked)}
            />
            <span>Enable listening animations</span>
          </label>
          <div className="tip" style={{ marginLeft: 24 }}>
            Non-speaking avatars show subtle engagement animations (nods, blinks)
          </div>


          {/* Backup/Fallback System Settings */}
          <div className="label" style={{ marginTop: 16, fontWeight: 700 }}>📦 Backup/Fallback System</div>
          <div className="tip">Graceful degradation when AI models are unavailable</div>

          <div className="label" style={{ marginTop: 8 }}>Backup mode</div>
          <select
            className="text-input"
            value={backupMode}
            onChange={e => setBackupMode(e.target.value as BackupMode)}
          >
            <option value="disabled">Disabled - No backup responses</option>
            <option value="auto">Auto - Enable after failures (recommended)</option>
            <option value="hybrid">Hybrid - Smart blend of backup + live LLM</option>
            <option value="always">Always - Always use backup responses</option>
          </select>

          <div style={{
            marginTop: 8,
            padding: 8,
            background: backupStatus.includes('Active') ? '#fef3c7' : '#f3f4f6',
            borderRadius: 6,
            fontSize: 12,
            color: '#374151'
          }}>
            <strong>Status:</strong> {backupStatus}
          </div>

          <div className="tip" style={{ marginTop: 4 }}>
            {backupMode === 'disabled' && 'Backup responses are disabled. Errors will show generic fallback messages.'}
            {backupMode === 'auto' && 'Backup mode activates automatically after 2 consecutive LLM failures and deactivates when LLM recovers.'}
            {backupMode === 'hybrid' && 'Uses pre-generated responses for demo questions (introductions, q1-q6) with strong matches, live LLM for everything else. Best of both worlds!'}
            {backupMode === 'always' && 'Always using pre-generated backup responses. Useful for demos or when LLM is unavailable.'}
          </div>

          {/* Whisper STT Settings */}
          <div className="label" style={{ marginTop: 16, fontWeight: 700 }}>🎤 Voice Input (Whisper STT)</div>
          {whisperAvailable ? (
            <>
              <div style={{ color: '#10b981', fontSize: 12, marginTop: 4 }}>✅ Whisper is available</div>
              <div className="label" style={{ marginTop: 8 }}>Whisper model</div>
              <select
                className="text-input"
                value={whisperModel}
                onChange={e => setWhisperModel(e.target.value as WhisperModel)}
              >
                <option value="tiny.en">tiny.en (fastest, ~75MB)</option>
                <option value="base.en">base.en (balanced, ~142MB)</option>
                <option value="small.en">small.en (better, ~466MB)</option>
                <option value="medium.en">medium.en (best, ~1.5GB)</option>
              </select>
              <div className="tip">Click the 🎤 button below to use voice input</div>
            </>
          ) : (
            <>
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>❌ Whisper not installed</div>
              <div className="tip" style={{ marginTop: 4 }}>
                To enable voice input, run: <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: 3 }}>bash scripts/setup-whisper.sh</code>
              </div>
              <button
                className="btn"
                style={{ marginTop: 8, fontSize: 12, padding: '4px 8px' }}
                onClick={async () => {
                  const result = await whisperTest();
                  if (result.success) {
                    alert('✅ Whisper is installed and ready!\n\nYou can now use voice input.');
                    setWhisperAvailable(true);
                  } else {
                    alert(`❌ Whisper not available:\n\n${result.error}\n\nRun: bash scripts/setup-whisper.sh`);
                  }
                }}
              >
                🔍 Test Whisper Connection
              </button>
            </>
          )}

          {/* Wake Word Detection */}
          <div className="label" style={{ marginTop: 16 }}>👂 Wake Word Detection (Local)</div>
          {wakeWordSupported ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={wakeWordEnabled}
                    onChange={toggleWakeWord}
                    disabled={!whisperAvailable}
                  />
                  <span>Enable local wake word detection</span>
                </label>
              </div>
              {wakeWordEnabled && (
                <div style={{ color: '#10b981', fontSize: 12, marginTop: 4 }}>
                  ✅ Listening for "Okay Panel"... (100% local, no internet required)
                </div>
              )}
              {wakeWordError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                  ❌ {wakeWordError}
                </div>
              )}
              <div className="tip" style={{ marginTop: 8 }}>
                Uses openWakeWord for fully local, privacy-first wake word detection.
                {!wakeWordError && ' Say "Okay Panel" to activate voice input hands-free!'}
                {wakeWordEnabled && ' (Auto-started on app launch)'}
              </div>
              {wakeWordError && (
                <div className="tip" style={{ marginTop: 4, color: '#ef4444' }}>
                  Run setup: <code style={{ background: '#fee', padding: '2px 6px', borderRadius: 3 }}>bash scripts/setup-openwakeword.sh</code>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                ❌ Local wake word detection not available (not running in Electron?)
              </div>
              <div className="tip" style={{ marginTop: 4 }}>
                Wake word detection requires running the app with: <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: 3 }}>npm run dev</code>
              </div>
            </>
          )}

          {/* Accessibility Settings */}
          <div className="label" style={{ marginTop: 16, fontWeight: 700 }}>♿ Accessibility</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reduceMotion}
                onChange={e => {
                  setReduceMotion(e.target.checked);
                  // Apply to document for CSS media query override
                  if (e.target.checked) {
                    document.documentElement.style.setProperty('--animation-speed', '0.01ms');
                  } else {
                    document.documentElement.style.removeProperty('--animation-speed');
                  }
                }}
              />
              <span>Reduce motion (disable animations)</span>
            </label>
          </div>
          <div className="tip" style={{ marginTop: 4 }}>
            Reduces or disables animations for better accessibility and performance.
          </div>

          {/* Avatar Generation Settings */}
          <div className="label" style={{ marginTop: 16, fontWeight: 700 }}>🎨 Avatar Generation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useGeneratedAvatars}
                onChange={e => setUseGeneratedAvatars(e.target.checked)}
              />
              <span>Use AI-generated avatars</span>
            </label>
          </div>



          {useGeneratedAvatars && (
            <>
              <div className="label" style={{ marginTop: 8 }}>Provider</div>
              <select className="text-input" value={avatarProvider} onChange={e => setAvatarProvider(e.target.value as any)}>
                <option value="stable-diffusion-local">Local Stable Diffusion (Automatic1111)</option>
                <option value="placeholder">Placeholder (UI Avatars)</option>
              </select>

              {avatarProvider === 'stable-diffusion-local' && (
                <>
                  <div className="label" style={{ marginTop: 8 }}>Local SD endpoint</div>
                  <input
                    className="text-input"
                    value={sdEndpoint}
                    onChange={e => setSdEndpoint(e.target.value)}
                    placeholder="http://127.0.0.1:7860"
                  />
                  <div className="tip">Requires Automatic1111 Web UI with --api enabled</div>
                </>
              )}

              <button
                className="btn"
                style={{ marginTop: 8, fontSize: 12, padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                onClick={async () => {
                  const { generateAvatar } = await import('./services/avatarGenerator');
                  const newAvatars: Record<string, string> = {};
                  for (const p of personas) {
                    try {
                      const avatarUrl = await generateAvatar(p, {
                        provider: avatarProvider === 'stable-diffusion-local' ? 'stable-diffusion-local' : 'placeholder',
                        apiEndpoint: avatarProvider === 'stable-diffusion-local' ? sdEndpoint : undefined,
                      });
                      newAvatars[p.id] = avatarUrl;
                    } catch (error) {
                      console.error(`Failed to generate avatar for ${p.name}:`, error);
                    }
                  }
                  setGeneratedAvatars(newAvatars);
                }}
              >
                🎨 Generate Avatars
              </button>
            </>
          )}

          <div className="tip" style={{ marginTop: 8 }}>
            Local SD default: http://127.0.0.1:7860 (Automatic1111 API)
          </div>

          <div className="label" style={{ marginTop: 8, fontWeight: 700 }}>Hybrid Avatar Calibration</div>
          <div className="tip">
            Switch to the "🎭 Avatars" tab above to access the hybrid avatar calibrator.
            Fine-tune overlay positions, animations, and styling for each persona.
          </div>

        </Settings>
      )}

      <div className="scroll" ref={scroller}>
        {messages.length === 0 && (
          <div className="empty">
            <div style={{ fontWeight: 800, color: '#111827' }}>Ask the panel anything about GeoAI</div>
            <div>Five expert personas will reply with diverse perspectives.</div>
          </div>
        )}
        {messages.map(m => {
          const p = m.personaId ? personas.find(x => x.id === m.personaId) : undefined;

          // Render acknowledgment bubble for acknowledgment messages
          if (m.isAcknowledgment && p) {
            return (
              <div key={m.id}>
                <AcknowledgmentBubble persona={p} isUser={false} showTypingIndicator={showTypingIndicators} acknowledgmentText={m.text} isBackupResponse={m.isBackup} />
              </div>
            );
          }

          // Render normal message bubble
          return (
            <MessageBubble
              key={m.id}
              author={m.author}
              avatarText={m.role === 'user' ? 'YOU' : (p?.avatarInitials ?? 'AI')}
              avatarUrl={m.role === 'user' ? undefined : p?.imageUrl}
              color={m.color}
              text={m.isStreaming ? m.text + '▊' : m.text} // Add cursor for streaming messages
              isUser={m.role === 'user'}
            />
          );
        })}


        {busy && (
          <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
            <span className="spinner" /> Panel is thinking…


          </div>
        )}
      </div>

      <div className="input-row">
        {whisperAvailable && (
          <button
            className={`mic-button ${isRecording ? (isSpeaking ? 'recording speaking' : 'recording') : ''}`}
            onClick={onMicrophoneClick}
            disabled={busy || isTranscribing}
            title={
              isRecording
                ? (isSpeaking ? 'Speaking detected... (stops automatically when you finish)' : 'Listening... (speak now or click to stop)')
                : 'Click to start voice input (auto-stops when you finish speaking)'
            }
          >
            {isTranscribing ? '⏳' : isRecording ? (isSpeaking ? '🔴' : '⏹️') : '🎤'}
          </button>
        )}
        <input
          className="input-box"
          placeholder={
            isRecording
              ? (isSpeaking ? 'Speaking... (auto-submits when done)' : 'Listening... (speak now)')
              : isTranscribing
                ? 'Transcribing and submitting...'
                : 'Say "Okay Panel" to ask a question...'
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !isRecording && !busy) onSend(); }}
          disabled={isRecording || isTranscribing || busy}
        />
      </div>

    </div>

  );
}


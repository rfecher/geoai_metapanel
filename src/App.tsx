import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './components/MessageBubble';
import LLMProviderSelector from './components/LLMProviderSelector';
import VideoConferenceLayout from './components/VideoConferenceLayout';
import Settings from './components/Settings';
import { personas } from './data/personas';
import { chatWithLLM, LLMConfig, LLM_PRESETS, ChatMessage } from './services/llm';

import { ttsSpeak, ttsPreGenerate, ttsPlayPreGenerated, type TTSSettings, setTtsAmplitudeListener, setTtsVisemeListener, cancelCurrentSpeech } from './services/tts';
// Import piper to ensure window.electron types are available
import './services/piper';
import { startRecordingWithVAD, whisperTranscribe, whisperTest, type WhisperModel } from './services/whisper';
import HybridAvatarCalibrator from './components/HybridAvatarCalibrator';
import AvatarCalibrationTool from './components/AvatarCalibrationTool';

import { startLocalWakeWord, testLocalWakeWord, isLocalWakeWordSupported } from './services/localwakeword';
type Msg = {
  id: string;
  role: 'user' | 'assistant';
  personaId?: string;
  author: string;
  text: string;
  color: string;
};

let ttsChain: Promise<void> = Promise.resolve();

function buildHistoryChat(messagesState: Msg[], maxItems = 20): ChatMessage[] {
  // Convert prior UI messages to Ollama chat history
  const tail = messagesState.slice(-maxItems);
  const out: ChatMessage[] = [];
  for (const m of tail) {
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
  const [mode, setMode] = useState<'persona' | 'fastest'>('persona');
  const [ttsProvider, setTtsProvider] = useState<'webspeech' | 'azure' | 'elevenlabs' | 'piper'>('webspeech');
  const [defaultVoice, setDefaultVoice] = useState('');
  const [personaVoices, setPersonaVoices] = useState<Record<string, string>>({});
  const [azureRegion, setAzureRegion] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());

  // Whisper STT state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [whisperModel, setWhisperModel] = useState<WhisperModel>('base.en');
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

  const [ampByPersona, setAmpByPersona] = useState<Record<string, number>>({});

  // Video conference layout mode
  const [visemeByPersona, setVisemeByPersona] = useState<Record<string, { viseme: string; open: number; wide: number; round: number }>>({});

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
  const [showCalibration, setShowCalibration] = useState(false);
  // Temporary access: open ?calibrate=hybrid to load the hybrid avatar calibrator page
  const calibratePage = new URLSearchParams(window.location.search).get('calibrate');
  if (calibratePage === 'hybrid') {
    return <HybridAvatarCalibrator />;
  }



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

  // Auto-switch layout mode based on speaking state
  useEffect(() => {
    if (speakingId) {
      setLayoutMode('speaker');
    } else {
      // Switch to grid when no one is speaking
      const timer = setTimeout(() => setLayoutMode('grid'), 500);
      return () => clearTimeout(timer);
    }
  }, [speakingId]);

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
      if (s.mode === 'persona' || s.mode === 'fastest') setMode(s.mode);
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

  const speakQueued = useCallback((text: string, personaId?: string, preGeneratedAudioPromise?: Promise<HTMLAudioElement | null>) => {
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
        if (personaId) setSpeakingId(prev => (prev === personaId ? null : prev));
      }
    });
    return ttsChain;
  }, [ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey]);

  const skipCurrentSpeaker = useCallback(() => {
    console.log('🛑 Skip button clicked - skipping current speaker only');

    // Cancel the current speech (this will cause the current ttsSpeak to resolve immediately)
    cancelCurrentSpeech();

    // Clear the speaking indicator
    setSpeakingId(null);

    // Don't reset the chain - let the next speaker continue
  }, []);

  const playIntro = useCallback(async (personaId: string) => {
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.intro) return;

    const ttsSettings: TTSSettings = {
      provider: ttsProvider,
      defaultVoice,
      personaVoices,
      azureRegion,
      azureKey,
      elevenApiKey: elevenKey,
    };

    try {
      setSpeakingId(personaId);
      await ttsSpeak(persona.intro, ttsSettings, personaId);
    } catch (error) {
      console.error('Failed to play intro:', error);
    } finally {
      setSpeakingId(null);
    }
  }, [ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey]);


  // Clear personaVoices when switching to Piper (voices come from persona definitions)
  useEffect(() => {
    if (ttsProvider === 'piper') {
      setPersonaVoices({});
    }
  }, [ttsProvider]);

  // Persist settings when they change
  useEffect(() => {
    // For Piper, don't save personaVoices - always use persona definitions
    const voicesToSave = ttsProvider === 'piper' ? {} : personaVoices;
    const s = { llmConfig, personaModels, contextSize, mode, ttsProvider, defaultVoice, personaVoices: voicesToSave, azureRegion, azureKey, elevenKey };
    try { localStorage.setItem('settings', JSON.stringify(s)); } catch {}
  }, [llmConfig, personaModels, contextSize, mode, ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey]);


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
      // Start recording with VAD
      console.log('🎤 Starting recording with VAD...');
      setIsRecording(true);
      setIsSpeaking(false);

      try {
        const controller = startRecordingWithVAD({
          maxDurationMs: 30000, // 30 seconds max
          silenceThresholdMs: 1500, // 1.5 seconds of silence
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
  }, [isRecording, whisperModel]);

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

  const onSend = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride || input).trim();
    if (!question || busy) return;

    const userMsg: Msg = { id: `m-${Date.now()}-u`, role: 'user', author: 'You', text: question, color: '#3B82F6' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    scrollToEnd();

    setBusy(true);
    try {
      if (selectedPersonas.length === 0) return;

      const baseHistory = buildHistoryChat(messages, contextSize);

      if (mode === 'persona') {
        let history = baseHistory;
        const ttsSettings: TTSSettings = {
          provider: ttsProvider,
          defaultVoice,
          personaVoices,
          azureRegion,
          azureKey,
          elevenApiKey: elevenKey,
        };

        for (const p of selectedPersonas) {
          const sys: ChatMessage = { role: 'system', content: `${p.systemPrompt}\n\nYou are one panelist among several. Build on previous panelists' points when helpful.` };
          const usedModel = personaModels[p.id] || llmConfig.defaultModel;
          const reqMsgs: ChatMessage[] = [sys, ...history, { role: 'user', content: question }];

          console.log(`🤖 Requesting LLM response for ${p.name}...`);
          // Wait for LLM response
          const answer = await chatWithLLM(llmConfig, { model: usedModel, messages: reqMsgs });
          console.log(`✅ Got LLM response for ${p.name}`);

          const aMsg: Msg = { id: `m-${Date.now()}-${p.id}`, role: 'assistant', personaId: p.id, author: p.name, text: answer, color: p.color };
          setMessages(prev => [...prev, aMsg]);

          scrollToEnd();

          // Start pre-generating TTS immediately in the background (don't await!)
          // This returns a promise that will resolve when generation is complete
          // The promise will be awaited later when it's time to speak
          console.log(`🎬 Starting TTS pre-generation for ${p.name} RIGHT NOW (will run in background)`);
          const ttsPromise = ttsPreGenerate(answer, ttsSettings, p.id);
          console.log(`✨ TTS promise created for ${p.name}, generation has started`);

          // Queue the speech with the promise - speakQueued will await it when it's this persona's turn
          speakQueued(answer, p.id, ttsPromise);
          console.log(`📝 Queued speech for ${p.name}, continuing to next speaker...`);

          history = [...history, { role: 'assistant', content: `${p.name}: ${answer}` }];
        }
      } else {
        // Fastest-first + addendums - fully non-blocking
        setInFlight(new Set(selectedPersonas.map(p => p.id)));

        const ttsSettings: TTSSettings = {
          provider: ttsProvider,
          defaultVoice,
          personaVoices,
          azureRegion,
          azureKey,
          elevenApiKey: elevenKey,
        };

        const requests = selectedPersonas.map(p => {
          const sys: ChatMessage = { role: 'system', content: `${p.systemPrompt}\n\nYou are one panelist among several.` };
          const usedModel = personaModels[p.id] || llmConfig.defaultModel;
          const reqMsgs: ChatMessage[] = [sys, ...baseHistory, { role: 'user', content: question }];
          return { p, usedModel, promise: chatWithLLM(llmConfig, { model: usedModel, messages: reqMsgs }) };
        });

        const initialAnswers: Record<string, string> = {};
        const completionOrder: string[] = [];

        // Process each response as it completes - fully non-blocking
        const responsePromises = requests.map(({ p, promise }) =>
          promise.then(answer => {
            initialAnswers[p.id] = answer;
            completionOrder.push(p.id);

            // Update UI immediately when this response completes
            const aMsg: Msg = { id: `m-${Date.now()}-${p.id}`, role: 'assistant', personaId: p.id, author: p.name, text: answer, color: p.color };
            setMessages(prev => [...prev, aMsg]);
            setInFlight(prev => { const n = new Set(prev); n.delete(p.id); return n; });
            scrollToEnd();

            // Start pre-generating TTS in background and queue it immediately
            const ttsPromise = ttsPreGenerate(answer, ttsSettings, p.id);
            speakQueued(answer, p.id, ttsPromise);

            return { personaId: p.id, answer };
          })
        );

        // Wait for all initial responses before doing addendums
        await Promise.all(responsePromises);

        // Addendums in persona order, each referencing others' points
        for (const p of selectedPersonas) {
          const others = selectedPersonas
            .filter(o => o.id !== p.id)
            .map(o => (initialAnswers[o.id] ? `${o.name}: ${initialAnswers[o.id]}` : ''))
            .filter(Boolean);
          if (others.length === 0) continue;

          const sys: ChatMessage = { role: 'system', content: `${p.systemPrompt}\n\nProvide a brief addendum (1–2 sentences) responding to the panel so far.` };
          const usedModel = personaModels[p.id] || llmConfig.defaultModel;
          const addReq: ChatMessage[] = [

            sys,
            ...baseHistory,
            { role: 'assistant', content: `Panel so far:\n${others.join('\n')}` },
            { role: 'user', content: 'Give a concise addendum (1–2 sentences) acknowledging or refining your point.' }
          ];
          const addendum = await chatWithLLM(llmConfig, { model: usedModel, messages: addReq });
          const addMsg: Msg = { id: `m-${Date.now()}-${p.id}-add`, role: 'assistant', personaId: p.id, author: p.name, text: addendum, color: p.color };
          setMessages(prev => [...prev, addMsg]);
          scrollToEnd();

          // Start pre-generating TTS for addendum in background
          const ttsPromise = ttsPreGenerate(addendum, ttsSettings, p.id);
          speakQueued(addendum, p.id, ttsPromise);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [input, busy, selectedPersonas, llmConfig, personaModels, scrollToEnd]);

  // Store onSend in ref for use in callbacks
  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  return (
    <div className="app stage">
      <div className="header">
        <div className="title">GeoAI MetaPanel</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="settings"
            onClick={() => setLayoutMode(m => m === 'grid' ? 'speaker' : 'grid')}
            title="Toggle layout mode"
          >
            {layoutMode === 'grid' ? '🎬 Speaker' : '📊 Grid'}
          </button>
          <button className="settings" onClick={() => setShowSettings(s => !s)}>{showSettings ? 'Close' : 'Settings'}</button>
        </div>
      </div>

      {/* Video Conference Layout */}
      <VideoConferenceLayout
        personas={selectedPersonasMerged}
        speakingPersonaId={speakingId ?? undefined}
        audioAmplitudes={ampByPersona}
        visemesByPersona={visemeByPersona}
        layoutMode={layoutMode}
        personaModels={personaModels}
        defaultModel={llmConfig.defaultModel}
        inFlight={inFlight}
        onPlayIntro={playIntro}
        busy={busy}
        generatedAvatars={generatedAvatars}
        useGeneratedAvatars={useGeneratedAvatars}
      />

      {/* Skip button overlay when someone is speaking */}
      {speakingPersona && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '20px',
          zIndex: 1000
        }}>
          <button
            className="skip-button"
            onClick={skipCurrentSpeaker}
            title="Skip current speaker"
          >
            Skip ⏭
          </button>
        </div>
      )}

      {showSettings && (
        <Settings onClose={() => setShowSettings(false)}>
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

          <div className="label" style={{ marginTop: 12 }}>Response order</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={mode === 'persona'} onChange={() => setMode('persona')} /> Persona order
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={mode === 'fastest'} onChange={() => setMode('fastest')} /> Fastest-first + addendums
            </label>
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
          return (
            <MessageBubble
              key={m.id}
              author={m.author}
              avatarText={m.role === 'user' ? 'YOU' : (p?.avatarInitials ?? 'AI')}
              avatarUrl={m.role === 'user' ? undefined : p?.imageUrl}
              color={m.color}
              text={m.text}
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

      {showCalibration && (
        <AvatarCalibrationTool
          personas={personas}
          generatedAvatars={generatedAvatars}
          useGeneratedAvatars={useGeneratedAvatars}
          onClose={() => setShowCalibration(false)}
        />
      )}

    </div>

  );
}


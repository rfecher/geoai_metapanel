import { speakWithPiper, PIPER_VOICE_PRESETS, piperLengthScaleForPersona } from './piper';

export type TTSProvider = 'webspeech' | 'azure' | 'elevenlabs' | 'piper';

export type TTSAmplitudeInfo = { personaId?: string; amp: number };
let amplitudeListener: ((info: TTSAmplitudeInfo) => void) | null = null;
export function setTtsAmplitudeListener(fn: ((info: TTSAmplitudeInfo) => void) | null) {
  amplitudeListener = fn;
  try { (window as any).ttsAmplitudeListener = fn as any; } catch {}
}


export type TTSVisemeInfo = { personaId?: string; viseme: string; open: number; wide: number; round: number };
let visemeListener: ((info: TTSVisemeInfo) => void) | null = null;
export function setTtsVisemeListener(fn: ((info: TTSVisemeInfo) => void) | null) {
  visemeListener = fn;
  try { (window as any).ttsVisemeListener = fn as any; } catch {}
}

export function cancelCurrentSpeech() {
  console.log('🛑 Cancel speech requested');

  // Cancel Web Speech API
  try {
    window.speechSynthesis.cancel();
    console.log('✅ Cancelled Web Speech API');
  } catch (e) {
    console.warn('Failed to cancel Web Speech:', e);
  }

  // Stop HTML5 Audio (Azure, ElevenLabs, Piper) - use global reference
  if (window.currentTTSAudio) {
    try {
      const audio = window.currentTTSAudio;
      // Pause will trigger the 'pause' event, but we need to manually trigger cleanup
      // by dispatching an 'ended' event or just pausing (which our handlers treat as completion)
      audio.pause();
      audio.currentTime = 0;
      // Trigger the ended event to resolve the promise
      audio.dispatchEvent(new Event('ended'));
      console.log('✅ Stopped and ended HTML5 Audio');
    } catch (e) {
      console.warn('Failed to stop audio:', e);
    }
  }

  // Reset amplitude
  if (amplitudeListener) {
    amplitudeListener({ amp: 0 });
  }
}

// ----------------------------------------------------------------------------
// Global exclusive playback queue to prevent overlapping voices across providers
// ----------------------------------------------------------------------------
function getPlaybackChain(): Promise<void> {
  const w = window as any;
  if (!w.__ttsPlaybackChain) {
    w.__ttsPlaybackChain = Promise.resolve();
  }
  return w.__ttsPlaybackChain as Promise<void>;
}
function setPlaybackChain(p: Promise<void>) {
  (window as any).__ttsPlaybackChain = p;
}

function withExclusivePlayback<T>(fn: () => Promise<T>): Promise<T> {
  const runner = async () => {
    // Stop any ongoing Web Speech utterances and pause any current HTML audio
    try { (window as any).speechSynthesis?.cancel(); } catch {}
    try { if ((window as any).currentTTSAudio) (window as any).currentTTSAudio.pause(); } catch {}
    // Give the audio graph a brief moment to settle
    await new Promise(res => setTimeout(res, 20));
    return fn();
  };
  const prev = getPlaybackChain();
  const p = prev.then(runner, runner);
  setPlaybackChain(p.then(() => {}, () => {}));
  return p;
}


// Declare global window property
declare global {
  interface Window {
    currentTTSAudio?: HTMLAudioElement | null;
  }
}

/**
 * Sanitize text for TTS by removing formatting markers that models sometimes add
 * despite instructions not to use them.
 */
function sanitizeTextForTTS(text: string): string {
  let cleaned = text;

  // Remove <thinking>...</thinking> blocks (including multi-line content)
  // This must be done first before other tag removal
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

  // Remove other common XML/HTML-style tags with content
  cleaned = cleaned.replace(/<emphasis>[\s\S]*?<\/emphasis>/gi, '$1');
  cleaned = cleaned.replace(/<note>[\s\S]*?<\/note>/gi, '');
  cleaned = cleaned.replace(/<internal>[\s\S]*?<\/internal>/gi, '');

  // Remove any remaining XML/HTML-style tags (self-closing or empty)
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Remove asterisks used for emphasis (*word* or **word**)
  cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1'); // Triple first
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');     // Double
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');         // Single

  // Remove underscores used for emphasis (_word_ or __word__)
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');


  // Clean up any multiple spaces or newlines created by removals
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

function classifyViseme(rms: number, low: number, mid: number, high: number): { viseme: string; open: number; wide: number; round: number } {
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

  return { viseme, open, wide, round };
}


// Azure voice style/SSML tuning per persona (optional best-effort)
const azurePersonaProfiles: Record<string, { style?: string; styledegree?: string; rate?: string; pitch?: string }> = {

  maya:     { style: 'empathetic', styledegree: '1', rate: '-5%',  pitch: '-2st' },
  otto:     { style: 'formal',      styledegree: '1', rate: '-10%', pitch: '-1st' },
  opendata: { style: 'cheerful',    styledegree: '1', rate: '+5%',  pitch: '+1st' },
  marcus:   { style: 'professional',styledegree: '1', rate: '+0%',  pitch: '+0st' },
  jessica:  { style: 'serious',     styledegree: '1', rate: '-2%',  pitch: '-1st' },
};
function getAzureProfile(personaId?: string) {
  if (!personaId) return undefined;
  return azurePersonaProfiles[personaId];
}

export type TTSSettings = {
  provider: TTSProvider;
  // Common
  defaultVoice?: string; // WebSpeech voice name | Azure voice name | ElevenLabs voiceId

  personaVoices?: Record<string, string>;
  // Azure
  azureRegion?: string; // e.g. 'eastus'
  azureKey?: string; // Cognitive Services key
  // ElevenLabs
  elevenApiKey?: string;
};

/**
 * Pre-generate TTS audio without playing it. Returns an audio element ready to play.
 * This allows us to generate audio while LLM is thinking, then play it instantly.
 */
export async function ttsPreGenerate(text: string, settings: TTSSettings, personaId?: string): Promise<HTMLAudioElement | null> {
  const cleanText = sanitizeTextForTTS(text);
  const provider = settings.provider ?? 'webspeech';

  // For Piper, always use voice from persona definition, ignore overrides
  const voiceOverride = (provider !== 'piper' && personaId) ? settings.personaVoices?.[personaId] : undefined;
  const voice = voiceOverride || settings.defaultVoice;

  const startTime = Date.now();
  console.log(`🎬 [${new Date().toISOString().substr(11, 12)}] Pre-generating TTS in background:`, { provider, personaId, textLength: cleanText.length });

  // Only pre-generate for providers that use audio buffers (not Web Speech API)
  if (provider === 'piper') {
    // Always use voice from PIPER_VOICE_PRESETS (which comes from persona ttsVoiceId)
    const piperVoice = (personaId && PIPER_VOICE_PRESETS[personaId]) || 'en_US-lessac-medium';
    console.log('🎤 Using Piper voice from persona definition:', piperVoice, 'for persona:', personaId);
    try {
      const audioData = await generatePiperAudio(cleanText, piperVoice, personaId);
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const elapsed = Date.now() - startTime;
      console.log(`✅ [${new Date().toISOString().substr(11, 12)}] Pre-generated Piper audio in ${elapsed}ms for ${personaId}`);
      return audio;
    } catch (error) {
      console.error('❌ Failed to pre-generate Piper audio:', error);
      return null;
    }
  } else if (provider === 'azure' && settings.azureRegion && settings.azureKey && voice) {
    try {
      const buf = await generateAzureAudio(cleanText, voice, settings.azureRegion, settings.azureKey, personaId);
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const elapsed = Date.now() - startTime;
      console.log(`✅ Pre-generated Azure audio in ${elapsed}ms for ${personaId}`);
      return audio;
    } catch (error) {
      console.error('❌ Failed to pre-generate Azure audio:', error);
      return null;
    }
  } else if (provider === 'elevenlabs' && settings.elevenApiKey && voice) {
    try {
      const buf = await generateElevenLabsAudio(cleanText, voice, settings.elevenApiKey);
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const elapsed = Date.now() - startTime;
      console.log(`✅ Pre-generated ElevenLabs audio in ${elapsed}ms for ${personaId}`);
      return audio;
    } catch (error) {
      console.error('❌ Failed to pre-generate ElevenLabs audio:', error);
      return null;
    }
  }

  // Web Speech API can't be pre-generated
  console.log('ℹ️ Web Speech API cannot be pre-generated, will use live generation');
  return null;
}

/**
 * Play pre-generated audio or fall back to live generation
 */
export async function ttsPlayPreGenerated(preGeneratedAudio: HTMLAudioElement | null, text: string, settings: TTSSettings, personaId?: string): Promise<void> {
  if (preGeneratedAudio) {
    console.log('🎵 Playing pre-generated audio for', personaId, '(audio was ready, no wait!)');
    return playPreGeneratedAudio(preGeneratedAudio, personaId);
  } else {
    console.log('🔊 No pre-generated audio available, falling back to live TTS generation for', personaId);
    return ttsSpeak(text, settings, personaId);
  }
}

// Speak and resolve when playback ends (or on error). PersonaId selects an override voice if provided.
export async function ttsSpeak(text: string, settings: TTSSettings, personaId?: string): Promise<void> {
  // Sanitize text to remove any formatting markers
  const cleanText = sanitizeTextForTTS(text);

  const provider = settings.provider ?? 'webspeech';

  // For Piper, always use voice from persona definition, ignore overrides
  const voiceOverride = (provider !== 'piper' && personaId) ? settings.personaVoices?.[personaId] : undefined;
  const voice = voiceOverride || settings.defaultVoice;

  console.log('🔊 TTS Speak called:', { provider, personaId, voice, voiceOverride });
  if (cleanText !== text) {
    console.log('🧹 Sanitized text (removed formatting):', { original: text.substring(0, 100), cleaned: cleanText.substring(0, 100) });
  }

  if (provider === 'piper') {
    // Always use voice from PIPER_VOICE_PRESETS (which comes from persona ttsVoiceId)
    const piperVoice = (personaId && PIPER_VOICE_PRESETS[personaId]) || 'en_US-lessac-medium';
    console.log('🎤 Using Piper voice from persona definition:', piperVoice, 'for persona:', personaId);
    try {
      return await speakWithPiper(cleanText, piperVoice, personaId);
    } catch (error) {
      console.error('❌ PIPER TTS FAILED - FALLING BACK TO WEB SPEECH');
      console.error('Error:', error);
      console.error('This means either:');
      console.error('  1. Electron IPC is not available (window.electron.piperSpeak is undefined)');
      console.error('  2. Piper command failed (not installed or voice model missing)');
      console.error('  3. HTTP fallback failed (no piper-server running on localhost:5050)');
      console.error('Check the logs above for more details.');
      alert(`Piper TTS failed: ${error instanceof Error ? error.message : String(error)}\n\nFalling back to Web Speech. Check console for details.`);
      return speakWebSpeech(cleanText, voice, personaId);
    }
  } else if (provider === 'webspeech') {
    return speakWebSpeech(cleanText, voice, personaId);
  } else if (provider === 'azure') {
    if (!settings.azureRegion || !settings.azureKey || !voice) {
      // Fallback to Web Speech if Azure not configured properly
      return speakWebSpeech(cleanText, voice, personaId);
    }
    return speakAzure(cleanText, voice, settings.azureRegion, settings.azureKey, personaId);
  } else if (provider === 'elevenlabs') {
    if (!settings.elevenApiKey || !voice) {
      return speakWebSpeech(cleanText, voice, personaId);
    }
    return speakElevenLabs(cleanText, voice, settings.elevenApiKey, personaId);
  }
  return speakWebSpeech(cleanText, voice);
}

async function speakWebSpeech(text: string, voiceName?: string, personaId?: string): Promise<void> {
  return withExclusivePlayback(() => new Promise<void>((resolve) => {
    try {
      // Safety: pause any HTML audio that might still be playing
      if (window.currentTTSAudio) {
        try { window.currentTTSAudio.pause(); } catch {}
      }

      const u = new SpeechSynthesisUtterance(text);

      if (voiceName) {
        const pick = window.speechSynthesis.getVoices().find(v => v.name === voiceName);
        if (pick) u.voice = pick;
      }

      u.onstart = () => {
        if (amplitudeListener) amplitudeListener({ personaId, amp: 0.2 });
      };

      u.onend = () => {
        if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
        resolve();
      };

      u.onerror = () => {
        if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
        resolve();
      };

      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  }));
}

async function speakAzure(text: string, voiceName: string, region: string, key: string, personaId?: string): Promise<void> {
  // Build SSML
  const prof = getAzureProfile(personaId);
  const prosodyOpen = `<prosody${prof?.rate ? ` rate=\"${prof.rate}\"` : ''}${prof?.pitch ? ` pitch=\"${prof.pitch}\"` : ''}>`;
  const prosodyClose = `</prosody>`;
  const wrapped = prof?.style
    ? `<mstts:express-as style=\"${prof.style}\"${prof?.styledegree ? ` styledegree=\"${prof.styledegree}\"` : ''}>${prosodyOpen}${escapeXml(text)}${prosodyClose}</mstts:express-as>`
    : `${prosodyOpen}${escapeXml(text)}${prosodyClose}`;
  const ssml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<speak version=\"1.0\" xml:lang=\"en-US\" xmlns:mstts=\"https://www.w3.org/2001/mstts\"><voice name=\"${voiceName}\">${wrapped}</voice></speak>`;
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': key,
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'GeoAI-MetaPanel',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return playAudioBuffer(buf, 'audio/mpeg', personaId);
}

async function speakElevenLabs(text: string, voiceId: string, apiKey: string, personaId?: string): Promise<void> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const res = await fetch(url + '?optimize_streaming_latency=4', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return playAudioBuffer(buf, 'audio/mpeg', personaId);
}

function playAudioBuffer(buf: ArrayBuffer, mime: string, personaId?: string): Promise<void> {
  return withExclusivePlayback(() => new Promise<void>((resolve) => {
    try {
      const blob = new Blob([buf], { type: mime });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      // Register globally for cancellation
      if (window.currentTTSAudio) {
        window.currentTTSAudio.pause();
      }
      window.currentTTSAudio = audio;

      // Optional visualization via Web Audio API
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
        // Compute simple RMS from time domain
        let sum = 0;
        for (let i = 0; i < timeArr.length; i++) {
          const v = (timeArr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeArr.length);
        const amp = Math.max(0, Math.min(1, rms * 3));
        if (amplitudeListener) amplitudeListener({ personaId, amp });
        // Compute band energies from frequency domain (approximate)
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
        if (visemeListener) {
          const v = classifyViseme(rms, low, mid, high);
          visemeListener({ personaId, ...v });
        }
        raf = requestAnimationFrame(sample);
      };

      audio.onplay = () => {
        try {
          // Lazily create context to avoid autoplay restrictions
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          src = ctx.createMediaElementSource(audio);
          src.connect(analyser);
          analyser.connect(ctx.destination);
          raf = requestAnimationFrame(sample);
        } catch {
          // Ignore visualization errors
        }
      };

      const cleanup = () => {
        if (window.currentTTSAudio === audio) {
          window.currentTTSAudio = null;
        }
        if (raf) cancelAnimationFrame(raf);
        if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
        if (visemeListener) visemeListener({ personaId, viseme: 'Rest', open: 0, wide: 0, round: 0 });
        try {
          src?.disconnect();
          analyser?.disconnect();
          ctx?.close();
        } catch {}
        URL.revokeObjectURL(url);
      };

      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = () => { cleanup(); resolve(); };

      audio.play().catch(() => { cleanup(); resolve(); });
    } catch {
      if (window.currentTTSAudio) {
        window.currentTTSAudio = null;
      }
      if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
      resolve();
    }
  }));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Piper audio without playing
 */
async function generatePiperAudio(text: string, voice: string, personaId?: string): Promise<ArrayBuffer> {
  const lengthScale = piperLengthScaleForPersona(personaId);
  if (window.electron?.piperSpeak) {
    return await window.electron.piperSpeak(text, voice, { lengthScale });
  } else {
    // HTTP fallback
    const response = await fetch('http://localhost:5050/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, length_scale: lengthScale }),
    });
    if (!response.ok) {
      throw new Error(`Piper HTTP ${response.status}`);
    }
    return await response.arrayBuffer();
  }
}

/**
 * Generate Azure audio without playing
 */
async function generateAzureAudio(text: string, voiceName: string, region: string, key: string, personaId?: string): Promise<ArrayBuffer> {
  const prof = getAzureProfile(personaId);
  const prosodyOpen = `<prosody${prof?.rate ? ` rate="${prof.rate}"` : ''}${prof?.pitch ? ` pitch="${prof.pitch}"` : ''}>`;
  const prosodyClose = `</prosody>`;
  const wrapped = prof?.style
    ? `<mstts:express-as style="${prof.style}"${prof?.styledegree ? ` styledegree="${prof.styledegree}"` : ''}>${prosodyOpen}${escapeXml(text)}${prosodyClose}</mstts:express-as>`
    : `${prosodyOpen}${escapeXml(text)}${prosodyClose}`;
  const ssml = `<?xml version="1.0" encoding="utf-8"?>\n<speak version="1.0" xml:lang="en-US" xmlns:mstts="https://www.w3.org/2001/mstts"><voice name="${voiceName}">${wrapped}</voice></speak>`;
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': key,
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'GeoAI-MetaPanel',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS HTTP ${res.status}`);
  return await res.arrayBuffer();
}

/**
 * Generate ElevenLabs audio without playing
 */
async function generateElevenLabsAudio(text: string, voiceId: string, apiKey: string): Promise<ArrayBuffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const res = await fetch(url + '?optimize_streaming_latency=4', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`);
  return await res.arrayBuffer();
}

/**
 * Play pre-generated audio element
 */
function playPreGeneratedAudio(audio: HTMLAudioElement, personaId?: string): Promise<void> {
  return withExclusivePlayback(() => new Promise<void>((resolve) => {
    try {
      // Register globally for cancellation
      if (window.currentTTSAudio) {
        window.currentTTSAudio.pause();
      }
      window.currentTTSAudio = audio;

      // Optional visualization via Web Audio API
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
        let sum = 0;
        for (let i = 0; i < timeArr.length; i++) {
          const v = (timeArr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeArr.length);
        const amp = Math.max(0, Math.min(1, rms * 3));
        if (amplitudeListener) amplitudeListener({ personaId, amp });
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
        if (visemeListener) {
          const v = classifyViseme(rms, low, mid, high);
          visemeListener({ personaId, ...v });
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
        } catch {
          // Ignore visualization errors
        }
      };

      const cleanup = () => {
        if (window.currentTTSAudio === audio) {
          window.currentTTSAudio = null;
        }
        if (raf) cancelAnimationFrame(raf);
        if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
        if (visemeListener) visemeListener({ personaId, viseme: 'Rest', open: 0, wide: 0, round: 0 });
        try {
          src?.disconnect();
          analyser?.disconnect();
          ctx?.close();
        } catch {}
        URL.revokeObjectURL(audio.src);
      };

      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = () => { cleanup(); resolve(); };

      audio.play().catch(() => { cleanup(); resolve(); });
    } catch {
      if (window.currentTTSAudio === audio) {
        window.currentTTSAudio = null;
      }
      if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
      resolve();
    }
  }));
}


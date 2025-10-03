export type TTSProvider = 'webspeech' | 'azure' | 'elevenlabs';

export type TTSAmplitudeInfo = { personaId?: string; amp: number };
let amplitudeListener: ((info: TTSAmplitudeInfo) => void) | null = null;
export function setTtsAmplitudeListener(fn: ((info: TTSAmplitudeInfo) => void) | null) {
  amplitudeListener = fn;
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

// Speak and resolve when playback ends (or on error). PersonaId selects an override voice if provided.
export async function ttsSpeak(text: string, settings: TTSSettings, personaId?: string): Promise<void> {
  const provider = settings.provider ?? 'webspeech';
  const voiceOverride = personaId ? settings.personaVoices?.[personaId] : undefined;
  const voice = voiceOverride || settings.defaultVoice;

  if (provider === 'webspeech') {
    return speakWebSpeech(text, voice, personaId);
  } else if (provider === 'azure') {
    if (!settings.azureRegion || !settings.azureKey || !voice) {
      // Fallback to Web Speech if Azure not configured properly
      return speakWebSpeech(text, voice, personaId);
    }
    return speakAzure(text, voice, settings.azureRegion, settings.azureKey, personaId);
  } else if (provider === 'elevenlabs') {
    if (!settings.elevenApiKey || !voice) {
      return speakWebSpeech(text, voice, personaId);
    }
    return speakElevenLabs(text, voice, settings.elevenApiKey, personaId);
  }
  return speakWebSpeech(text, voice);
}

async function speakWebSpeech(text: string, voiceName?: string, personaId?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (voiceName) {
        const pick = window.speechSynthesis.getVoices().find(v => v.name === voiceName);
        if (pick) u.voice = pick;
      }
      u.onstart = () => { if (amplitudeListener) amplitudeListener({ personaId, amp: 0.2 }); };
      u.onend = () => { if (amplitudeListener) amplitudeListener({ personaId, amp: 0 }); resolve(); };
      u.onerror = () => { if (amplitudeListener) amplitudeListener({ personaId, amp: 0 }); resolve(); };
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
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
  return new Promise<void>((resolve) => {
    try {
      const blob = new Blob([buf], { type: mime });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      // Optional visualization via Web Audio API
      let raf = 0;
      let ctx: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      let src: MediaElementAudioSourceNode | null = null;
      const sample = () => {
        if (!analyser) return;
        const arr = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(arr);
        // Compute simple RMS
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = (arr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / arr.length);
        const amp = Math.max(0, Math.min(1, rms * 3));
        if (amplitudeListener) amplitudeListener({ personaId, amp });
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
        if (raf) cancelAnimationFrame(raf);
        if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
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
      if (amplitudeListener) amplitudeListener({ personaId, amp: 0 });
      resolve();
    }
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


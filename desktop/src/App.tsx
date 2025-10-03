import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './components/MessageBubble';
import { personas } from './data/personas';
import { chatWithOllama, defaultOllamaBaseUrl, ChatMessage } from './services/ollama';

import { ttsSpeak, type TTSSettings, setTtsAmplitudeListener } from './services/tts';
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
  const [baseUrl, setBaseUrl] = useState(defaultOllamaBaseUrl);
  const [model, setModel] = useState('llama3.1');
  const [personaModels, setPersonaModels] = useState<Record<string, string>>({});
  const [contextSize, setContextSize] = useState<number>(20);
  const [mode, setMode] = useState<'persona' | 'fastest'>('persona');
  const [ttsProvider, setTtsProvider] = useState<'webspeech' | 'azure' | 'elevenlabs'>('webspeech');
  const [defaultVoice, setDefaultVoice] = useState('');
  const [personaVoices, setPersonaVoices] = useState<Record<string, string>>({});
  const [azureRegion, setAzureRegion] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());

  const [ampByPersona, setAmpByPersona] = useState<Record<string, number>>({});

  useEffect(() => {
    setTtsAmplitudeListener(info => {
      if (!info.personaId) return;
      setAmpByPersona(prev => ({ ...prev, [info.personaId!]: info.amp }));
    });
    return () => setTtsAmplitudeListener(null);
  }, []);

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
  const selectedPersonas = useMemo(() => personas.filter(p => ['maya','otto','opendata','marcus','jessica'].includes(p.id)), []);
  // Load saved settings on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('settings');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.baseUrl === 'string') setBaseUrl(s.baseUrl);
      if (typeof s.model === 'string') setModel(s.model);
      if (s && typeof s.personaModels === 'object') setPersonaModels(s.personaModels);
      if (typeof s.contextSize === 'number') setContextSize(s.contextSize);
      if (s.mode === 'persona' || s.mode === 'fastest') setMode(s.mode);
      if (s.ttsProvider === 'webspeech' || s.ttsProvider === 'azure' || s.ttsProvider === 'elevenlabs') setTtsProvider(s.ttsProvider);
      if (typeof s.defaultVoice === 'string') setDefaultVoice(s.defaultVoice);
      if (s && typeof s.personaVoices === 'object') setPersonaVoices(s.personaVoices);
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

  const speakQueued = useCallback((text: string, personaId?: string) => {
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
        await ttsSpeak(text, settings, personaId);
      } finally {
        if (personaId) setSpeakingId(prev => (prev === personaId ? null : prev));
      }
    });
    return ttsChain;
  }, [ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey]);


  // Persist settings when they change
  useEffect(() => {
    const s = { baseUrl, model, personaModels, contextSize, mode, ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey };
    try { localStorage.setItem('settings', JSON.stringify(s)); } catch {}
  }, [baseUrl, model, personaModels, contextSize, mode, ttsProvider, defaultVoice, personaVoices, azureRegion, azureKey, elevenKey]);


  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    });
  }, []);

  const onSend = useCallback(async () => {
    const question = input.trim();
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
        for (const p of selectedPersonas) {
          const sys: ChatMessage = { role: 'system', content: `${p.systemPrompt}\n\nYou are one panelist among several. Build on previous panelists' points when helpful.` };
          const usedModel = personaModels[p.id] || model;
          const reqMsgs: ChatMessage[] = [sys, ...history, { role: 'user', content: question }];
          const answer = await chatWithOllama(baseUrl, { model: usedModel, messages: reqMsgs });

          const aMsg: Msg = { id: `m-${Date.now()}-${p.id}`, role: 'assistant', personaId: p.id, author: p.name, text: answer, color: p.color };
          setMessages(prev => [...prev, aMsg]);

          scrollToEnd();
          speakQueued(answer, p.id);

          history = [...history, { role: 'assistant', content: `${p.name}: ${answer}` }];
        }
      } else {
        // Fastest-first + addendums
        setInFlight(new Set(selectedPersonas.map(p => p.id)));

        const requests = selectedPersonas.map(p => {

          const sys: ChatMessage = { role: 'system', content: `${p.systemPrompt}\n\nYou are one panelist among several.` };
          const usedModel = personaModels[p.id] || model;
          const reqMsgs: ChatMessage[] = [sys, ...baseHistory, { role: 'user', content: question }];
          return { p, usedModel, promise: chatWithOllama(baseUrl, { model: usedModel, messages: reqMsgs }) };
        });

        const initialAnswers: Record<string, string> = {};
        await Promise.all(


          requests.map(({ p, promise }) =>
            promise.then(answer => {
              initialAnswers[p.id] = answer;
              const aMsg: Msg = { id: `m-${Date.now()}-${p.id}`, role: 'assistant', personaId: p.id, author: p.name, text: answer, color: p.color };
              setMessages(prev => [...prev, aMsg]);
              setInFlight(prev => { const n = new Set(prev); n.delete(p.id); return n; });
              scrollToEnd();
              speakQueued(answer, p.id);
            })
          )
        );

        // Addendums in persona order, each referencing others' points
        for (const p of selectedPersonas) {
          const others = selectedPersonas
            .filter(o => o.id !== p.id)
            .map(o => (initialAnswers[o.id] ? `${o.name}: ${initialAnswers[o.id]}` : ''))
            .filter(Boolean);
          if (others.length === 0) continue;

          const sys: ChatMessage = { role: 'system', content: `${p.systemPrompt}\n\nProvide a brief addendum (1–2 sentences) responding to the panel so far.` };
          const usedModel = personaModels[p.id] || model;
          const addReq: ChatMessage[] = [

            sys,
            ...baseHistory,
            { role: 'assistant', content: `Panel so far:\n${others.join('\n')}` },
            { role: 'user', content: 'Give a concise addendum (1–2 sentences) acknowledging or refining your point.' }
          ];
          const addendum = await chatWithOllama(baseUrl, { model: usedModel, messages: addReq });
          const addMsg: Msg = { id: `m-${Date.now()}-${p.id}-add`, role: 'assistant', personaId: p.id, author: p.name, text: addendum, color: p.color };
          setMessages(prev => [...prev, addMsg]);
          scrollToEnd();
          speakQueued(addendum, p.id);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [input, busy, selectedPersonas, baseUrl, model, personaModels, scrollToEnd]);

  return (
    <div className="app stage">
      <div className="header">
        <div className="title">GeoAI MetaPanel</div>
        <button className="settings" onClick={() => setShowSettings(s => !s)}>{showSettings ? 'Close' : 'Settings'}</button>
      </div>

      {speakingPersona && (
        <div className="now-speaking" style={{ boxShadow: `0 6px 30px ${hexToRgba(speakingPersona.color, Math.min(0.35, (ampByPersona[speakingPersona.id] ?? 0) * 0.9))}` }}>
          <div className="ns-left">
            {speakingPersona.imageUrl ? (
              <img className="ns-avatar" src={speakingPersona.imageUrl} alt={speakingPersona.name} />
            ) : (
              <div className="avatar" style={{ backgroundColor: speakingPersona.color }}>{speakingPersona.avatarInitials}</div>
            )}
            <div className="ns-meta">
              <div className="ns-label">Now speaking</div>
              <div className="ns-name" style={{ color: speakingPersona.color }}>{speakingPersona.name}</div>
            </div>
          </div>
          <div className="ns-wave">
            {Array.from({ length: 20 }).map((_, i) => {
              const a = ampByPersona[speakingPersona.id] ?? 0;
              const h = 4 + (i % 3) * 2 + a * 20;
              return <div key={i} className="bar" style={{ height: `${h}px`, backgroundColor: speakingPersona.color, opacity: 0.6 }} />;
            })}
          </div>
        </div>
      )}

      {/* Panelist strip */}
      <div className="panel-strip">
        {selectedPersonas.map(p => {
          const usedModel = personaModels[p.id] || model;
          const speaking = speakingId === p.id;
          const thinking = inFlight.has(p.id);
          return (
            <div key={p.id} className={`panelist ${speaking ? 'speaking' : ''}`}>
              {p.imageUrl ? (
                <img className="img" src={p.imageUrl} alt={p.name} />
              ) : (
                <div className="avatar" style={{ backgroundColor: p.color }}>{p.avatarInitials}</div>
              )}
              <div className="meta">
                <div className="name">{p.name}</div>
                <div className="bio">{p.shortBio}</div>
              </div>
              <div className="badges">
                <span className="badge model">{usedModel}</span>
                {thinking && <span className="badge thinking">thinking</span>}
              </div>
            </div>
          );
        })}
      </div>

      {showSettings && (
        <div className="settings-panel">
          <div className="label">Ollama Base URL</div>
          <input className="text-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:11434" />

          <div className="label">Default Model</div>
          <input className="text-input" value={model} onChange={e => setModel(e.target.value)} placeholder="llama3" />

          <div className="label" style={{ marginTop: 8 }}>Per‑persona model overrides (optional)</div>
          <div className="tip">Leave blank to use the Default Model above</div>
          {selectedPersonas.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <div style={{ width: 140, color: '#374151' }}>{p.name}</div>
              <input
                className="text-input"
                placeholder="e.g. mistral, gemma, llama3.1, deepseek-r1:7b"
                value={personaModels[p.id] ?? ''}
                onChange={e => setPersonaModels(prev => ({ ...prev, [p.id]: e.target.value }))}
              />
            </div>
          ))}



          <div className="label" style={{ marginTop: 12 }}>TTS Provider</div>
          <select className="text-input" value={ttsProvider} onChange={e => setTtsProvider(e.target.value as any)}>


            <option value="webspeech">Web Speech (browser)</option>
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

          <div className="label" style={{ marginTop: 8 }}>Default voice (name or id)</div>
          <input
            className="text-input"
            value={defaultVoice}
            onChange={e => setDefaultVoice(e.target.value)}
            placeholder={ttsProvider === 'webspeech' ? 'e.g. Microsoft David Desktop - English (United States)' : (ttsProvider === 'azure' ? 'e.g. en-US-JennyNeural' : 'ElevenLabs voiceId')}
          />

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

          <div className="tip" style={{ marginTop: 8 }}>Running locally? Default is http://localhost:11434</div>
        </div>
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
        <input
          className="input-box"
          placeholder="Type your question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSend(); }}
        />
        <button className="send" onClick={onSend} disabled={busy}>
          Send
        </button>
      </div>
    </div>
  );
}


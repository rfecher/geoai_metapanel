import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Persona } from '../data/personas';

export type FaceAnchors = {
  mouth: { xPct: number; yPct: number; sizePct: number };
  eyes?: { yPct: number; heightPct?: number };
  showTeethHint?: boolean;
  // New gaze calibration parameters
  eyeSeparationPct?: number; // 18..34 (percentage of avatar width between pupil centers)
  pupilSizeScale?: number;   // 0.3..1.3 multiplier for pupil overlay size
  eyeScale?: number;         // 0.5..2.0 global multiplier for eye features (pupils, eyelids, gaze)
  eyeWidthPct?: number;      // 6..22 (horizontal span of each eyelid/pupil region)
  eyeCenterOffsetPct?: number; // -15..15 (horizontal offset from image center)
};

type AvatarCalibrationToolProps = {
  personas: Persona[];
  generatedAvatars?: Record<string, string>;
  useGeneratedAvatars?: boolean;
  onClose: () => void;
};

export default function AvatarCalibrationTool({ personas, generatedAvatars = {}, useGeneratedAvatars = false, onClose }: AvatarCalibrationToolProps) {
  const [anchors, setAnchors] = useState<Record<string, FaceAnchors>>({});
  const [activeId, setActiveId] = useState<string>(personas[0]?.id ?? '');
  const [previewOverlay, setPreviewOverlay] = useState(true);

  // Mouth size is persisted via anchors.mouth.sizePct; remove separate preview scale
  const [previewViseme, setPreviewViseme] = useState<'loop'|'Rest'|'A'|'E'|'O'|'FV'|'Custom'>('loop');
  const [customOpen, setCustomOpen] = useState(0.6);
  const [customWide, setCustomWide] = useState(0.4);
  const [customRound, setCustomRound] = useState(0.15);
  const [calibrationPath, setCalibrationPath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Prefer Electron persisted file
        if (window.electron?.calibrationLoad) {
          const res = await window.electron.calibrationLoad();
          if (res.success && res.data && typeof res.data === 'object') {
            setAnchors(res.data as Record<string, FaceAnchors>);
            return;
          }
        }
        // Fallback to localStorage
        const raw = localStorage.getItem('avatarFaceAnchors');
        if (raw) setAnchors(JSON.parse(raw));
      } catch {}
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        if (window.electron?.calibrationPath) {
          const res = await window.electron.calibrationPath();
          if (res.success && res.path) setCalibrationPath(res.path);
        }
      } catch {}
    })();
  }, []);


  const save = async () => {
    try {
      // Save to Electron file if available
      if (window.electron?.calibrationSave) {
        const res = await window.electron.calibrationSave(anchors);
        if (!res.success) {
          console.warn('Calibration file save failed, falling back to localStorage:', res.error);
        }
      }
      // Also keep localStorage as a fallback for non-Electron runs
      localStorage.setItem('avatarFaceAnchors', JSON.stringify(anchors));
    } catch {}
  };

  const resetPersona = (id: string) => {
    setAnchors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', borderBottom: '1px solid #374151' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 800 }}>Avatar Calibration</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
            Saving to: {calibrationPath || 'App user data directory (avatar-face-anchors.json)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => { save(); onClose(); }}>Save & Close</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 240, borderRight: '1px solid #374151', overflowY: 'auto' }}>
          {personas.map(p => (
            <div
              key={p.id}
              onClick={() => setActiveId(p.id)}
              style={{ padding: 12, cursor: 'pointer', color: activeId === p.id ? '#fff' : '#cbd5e1', background: activeId === p.id ? '#334155' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: p.color }}>
                <img src={(useGeneratedAvatars && generatedAvatars[p.id]) || p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{p.shortBio}</div>
              </div>
              <button className="btn" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); resetPersona(p.id); }}>Reset</button>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <PersonaCalibrationCanvas
            persona={personas.find(p => p.id === activeId)!}
            imageUrl={(useGeneratedAvatars && generatedAvatars[activeId]) || personas.find(p => p.id === activeId)?.imageUrl}
            anchors={anchors[activeId]}
            onChange={(a) => setAnchors(prev => ({ ...prev, [activeId]: a }))}
            previewOverlay={previewOverlay}
            previewTeeth={anchors[activeId]?.showTeethHint ?? (personas.find(p => p.id === activeId)?.animationConfig as any)?.showTeethHint ?? true}
            previewViseme={previewViseme}
            customOpen={customOpen}
            customWide={customWide}
            customRound={customRound}
          />
          <CalibrationControls
            preview={previewOverlay}
            setPreview={setPreviewOverlay}
            teeth={anchors[activeId]?.showTeethHint ?? (personas.find(p => p.id === activeId)?.animationConfig as any)?.showTeethHint ?? true}
            setTeeth={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: {
                ...(prev[activeId] || { mouth: { xPct: 50, yPct: 72, sizePct: 36 }, eyes: { yPct: 20, heightPct: 10 } }),
                showTeethHint: v,
              }
            }))}
            mouthPct={anchors[activeId]?.mouth?.sizePct ?? 36}
            setMouthPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: {
                ...(prev[activeId] || {}),
                mouth: { ...(prev[activeId]?.mouth || { xPct: 50, yPct: 72, sizePct: 36 }), sizePct: v },
              }
            }))}
            eyeSeparationPct={anchors[activeId]?.eyeSeparationPct ?? 26}
            setEyeSeparationPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), eyeSeparationPct: v },
            }))}
            eyeWidthPct={(anchors[activeId]?.eyeWidthPct ?? Math.max(6, Math.min(22, ((anchors[activeId]?.eyes?.heightPct ?? 10) * 1.5))))}
            setEyeWidthPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), eyeWidthPct: v },
            }))}
            pupilSizeScale={anchors[activeId]?.pupilSizeScale ?? 1.0}
            setPupilSizeScale={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), pupilSizeScale: v },
            }))}
            eyeScale={anchors[activeId]?.eyeScale ?? 1.0}
            setEyeScale={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), eyeScale: v },
            }))}
            eyeCenterOffsetPct={anchors[activeId]?.eyeCenterOffsetPct ?? 0}
            setEyeCenterOffsetPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), eyeCenterOffsetPct: v },
            }))}
            previewViseme={previewViseme}
            setPreviewViseme={setPreviewViseme}
            customOpen={customOpen}
            setCustomOpen={setCustomOpen}
            customWide={customWide}
            setCustomWide={setCustomWide}
            customRound={customRound}
            setCustomRound={setCustomRound}
          />
        </div>
      </div>

    </div>
  );
}
function CalibrationControls({ preview, setPreview, teeth, setTeeth, mouthPct, setMouthPct, eyeSeparationPct, setEyeSeparationPct, eyeWidthPct, setEyeWidthPct, pupilSizeScale, setPupilSizeScale, eyeScale, setEyeScale, eyeCenterOffsetPct, setEyeCenterOffsetPct, previewViseme, setPreviewViseme, customOpen, setCustomOpen, customWide, setCustomWide, customRound, setCustomRound }: { preview: boolean; setPreview: (v: boolean) => void; teeth: boolean; setTeeth: (v: boolean) => void; mouthPct: number; setMouthPct: (v: number) => void; eyeSeparationPct: number; setEyeSeparationPct: (v: number) => void; eyeWidthPct: number; setEyeWidthPct: (v: number) => void; pupilSizeScale: number; setPupilSizeScale: (v: number) => void; eyeScale: number; setEyeScale: (v: number) => void; eyeCenterOffsetPct: number; setEyeCenterOffsetPct: (v: number) => void; previewViseme: 'loop'|'Rest'|'A'|'E'|'O'|'FV'|'Custom'; setPreviewViseme: (v: 'loop'|'Rest'|'A'|'E'|'O'|'FV'|'Custom') => void; customOpen: number; setCustomOpen: (v: number) => void; customWide: number; setCustomWide: (v: number) => void; customRound: number; setCustomRound: (v: number) => void; }) {
  return (

    <div style={{ padding: 12, borderTop: '1px solid #374151', background: '#0f172a', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} />
            Preview overlay
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={teeth} onChange={e => setTeeth(e.target.checked)} />
            Show teeth hint
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Mouth size
            <input type="range" min={20} max={80} step={1} value={mouthPct} onChange={e => setMouthPct(parseFloat(e.target.value))} />
            <span style={{ width: 42, textAlign: 'right' }}>{Math.round(mouthPct)}%</span>
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Eye Separation
            <input type="range" min={18} max={34} step={0.5} value={eyeSeparationPct} onChange={e => setEyeSeparationPct(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{eyeSeparationPct.toFixed(1)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Eye Width
            <input type="range" min={6} max={22} step={0.5} value={eyeWidthPct} onChange={e => setEyeWidthPct(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{eyeWidthPct.toFixed(1)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Pupil Size
            <input type="range" min={0.3} max={1.3} step={0.01} value={pupilSizeScale} onChange={e => setPupilSizeScale(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{pupilSizeScale.toFixed(2)}×</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Eye Scale
            <input type="range" min={0.5} max={2.0} step={0.05} value={eyeScale} onChange={e => setEyeScale(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{eyeScale.toFixed(2)}×</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Eye Center Offset
            <input type="range" min={-15} max={15} step={0.5} value={eyeCenterOffsetPct} onChange={e => setEyeCenterOffsetPct(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{eyeCenterOffsetPct.toFixed(1)}%</span>
          </label>
        </div>
        <div>
          <details>
            <summary style={{ cursor: 'pointer' }}>Calibrate Gaze — Help</summary>
            <div style={{ fontSize: 12, opacity: 0.9, padding: '6px 8px', maxWidth: 560 }}>
              <div>• Eye Separation (18–34%): start at 26%. Adjust so the two pupils sit centered in each eye.</div>
              <div>• Eye Width (6–22%): match each eyelid’s horizontal span to the actual eye width in the photo.</div>
              <div>• Pupil Size (0.3–1.3×): match visible iris/pupil scale in the image. Larger eyes → slightly bigger.</div>
              <div>• Eye Scale (0.5–2.0×): proportionally scales pupils, eyelids, and gaze range together. Use &lt; 1.0 for very small eyes; &gt; 1.0 for larger eyes.</div>
              <div>• Eye Center Offset (±15%): shifts the entire eye pair left/right to align with off‑center faces.</div>
              <div>• While the pupils drift, they should stay inside the eye whites and not cross eyelids. If they do, reduce size or separation. For subtler motion, lower gazeMaxOffsetPct in animationConfig.</div>
              <div>• Tip: Drag the purple eyes band to set vertical position; scroll to change its thickness.</div>
            </div>
          </details>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Viseme
            <select value={previewViseme} onChange={e => setPreviewViseme(e.target.value as any)}>
              <option value="loop">Loop</option>
              <option value="Rest">Rest</option>
              <option value="A">A</option>
              <option value="E">E</option>
              <option value="O">O</option>
              <option value="FV">FV</option>
              <option value="Custom">Custom</option>
            </select>
          </label>
          {previewViseme === 'Custom' && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Open
                <input type="range" min={0} max={1} step={0.01} value={customOpen} onChange={e => setCustomOpen(parseFloat(e.target.value))} />
                <span style={{ width: 36, textAlign: 'right' }}>{customOpen.toFixed(2)}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Wide
                <input type="range" min={0} max={1} step={0.01} value={customWide} onChange={e => setCustomWide(parseFloat(e.target.value))} />
                <span style={{ width: 36, textAlign: 'right' }}>{customWide.toFixed(2)}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Round
                <input type="range" min={0} max={1} step={0.01} value={customRound} onChange={e => setCustomRound(parseFloat(e.target.value))} />
                <span style={{ width: 36, textAlign: 'right' }}>{customRound.toFixed(2)}</span>
              </label>
            </>
          )}
        </div>
        <div>
          <span style={{ opacity: 0.75 }}>These controls preview the mouth overlay. To persist, set animationConfig in personas.ts.</span>
        </div>
      </div>
    </div>
  );
}


function PersonaCalibrationCanvas({ persona, imageUrl, anchors, onChange, previewOverlay, previewTeeth, previewViseme, customOpen, customWide, customRound }: { persona: Persona; imageUrl?: string; anchors?: FaceAnchors; onChange: (a: FaceAnchors) => void; previewOverlay: boolean; previewTeeth: boolean; previewViseme: 'loop'|'Rest'|'A'|'E'|'O'|'FV'|'Custom'; customOpen: number; customWide: number; customRound: number; }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<null | { kind: 'mouth' | 'eyes'; dx: number; dy: number }>(null);
  const a: FaceAnchors = anchors || { mouth: { xPct: 50, yPct: 72, sizePct: 36 }, eyes: { yPct: 20, heightPct: 10 } };

  // Animation preview state (blink + breathing)
  const [animTick, setAnimTick] = useState(0);
  const prevTsRef = useRef<number>(0);
  const blinkNextRef = useRef<number>(0);
  const blinkProgRef = useRef<number>(0); // 1 -> fully closed; 0 -> open

  // Gaze animation state (micro-saccades + drift for preview)
  const gazeRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const kickXRef = useRef(0);
  const kickYRef = useRef(0);
  const nextSaccRef = useRef(0);
  const phxRef = useRef(Math.random() * Math.PI * 2);
  const phyRef = useRef(Math.random() * Math.PI * 2);

  useEffect(() => {
    let raf = 0;
    const loop = (ts: number) => {
      if (!prevTsRef.current) prevTsRef.current = ts;
      const dt = ts - prevTsRef.current;
      prevTsRef.current = ts;
      // schedule blinks

      if (ts >= blinkNextRef.current) {
        blinkProgRef.current = 1; // start blink

        blinkNextRef.current = ts + 2400 + Math.random() * 2000; // 2.4–4.4s
      }
      // decay blink over ~140ms
      if (blinkProgRef.current > 0) {
        blinkProgRef.current = Math.max(0, blinkProgRef.current - dt / 140);
      }
      // Gaze drift + micro-saccades
      const dtSec = Math.max(0.001, dt / 1000);
      const tSec = ts / 1000;
      const baseMax = ((persona.animationConfig as any)?.gazeMaxOffsetPct ?? 0.8) as number;
      const driftX = Math.sin(tSec * 0.6 + phxRef.current) * 0.3 + Math.sin(tSec * 1.1 + phxRef.current * 0.7) * 0.15;
      const driftY = Math.sin(tSec * 0.5 + phyRef.current) * 0.22 + Math.sin(tSec * 0.9 + phyRef.current * 0.6) * 0.1;
      const eyeScale = (a.eyes?.heightPct ?? 10) / 12;
      const sizeScale = Math.min(1, a.pupilSizeScale ?? 1.0);
      const maxOffset = baseMax * eyeScale * sizeScale * (a.eyeScale ?? 1.0);
      const decay = Math.exp(-dtSec / 0.12);
      kickXRef.current *= decay;
      kickYRef.current *= decay;
      if (ts >= nextSaccRef.current) {
        const mag = ((Math.random() * 0.9) + 0.6) * maxOffset;
        const ang = Math.random() * Math.PI * 2;
        kickXRef.current += Math.cos(ang) * mag;
        kickYRef.current += Math.sin(ang) * mag * 0.7;
        nextSaccRef.current = ts + 800 + Math.random() * 1400;

        {/* Gaze pupils preview (under eyelids) */}
        {previewOverlay && (
          <>
            <div
              style={{
                position: 'absolute',
                top: `${(a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) - ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 55%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.0) 72%)',
                opacity: 0.26,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${(a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) + ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 55%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.0) 72%)',
                opacity: 0.26,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
          </>
        )}

      let gx = driftX * maxOffset + kickXRef.current;
      let gy = driftY * maxOffset + kickYRef.current;
      const clamp = maxOffset * 1.6;
      const len = Math.hypot(gx, gy);
      if (len > clamp) { const s = clamp / len; gx *= s; gy *= s; }
      gazeRef.current = { x: gx, y: gy };

      }

      setAnimTick(t => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    blinkNextRef.current = performance.now() + 1500;
    nextSaccRef.current = performance.now() + 800 + Math.random() * 1400;

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    const kind = target.dataset.kind as 'mouth' | 'eyes';
    nextSaccRef.current = performance.now() + 800 + Math.random() * 1400;

    if (!kind) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ kind, dx: 0, dy: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width) * 100;
    const y = ((e.clientY - bounds.top) / bounds.height) * 100;
    const clampedX = Math.min(95, Math.max(5, x));
    const clampedY = Math.min(95, Math.max(5, y));

    if (dragging.kind === 'mouth') {
      onChange({ ...a, mouth: { ...a.mouth, xPct: clampedX, yPct: clampedY } });
    } else if (dragging.kind === 'eyes') {
      onChange({ ...a, eyes: { yPct: clampedY, heightPct: a.eyes?.heightPct ?? 10 } });
    }
  };

  const onWheelMouth = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -2 : 2;
    const next = Math.min(80, Math.max(10, (a.mouth.sizePct || 40) + delta));
    onChange({ ...a, mouth: { ...a.mouth, sizePct: next } });
  };

  const onWheelEyes = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const next = Math.min(25, Math.max(6, (a.eyes?.heightPct ?? 10) + delta));
    onChange({ ...a, eyes: { yPct: a.eyes?.yPct ?? 20, heightPct: next } });
  };

  return (
    <div>
      <div style={{ color: '#e5e7eb', marginBottom: 8 }}>
        Drag the mouth box; scroll to resize. Drag the eyes band; scroll to change thickness. Use the slider below to fine-tune mouth width (%).
      </div>
      <div ref={ref} style={{ position: 'relative', width: 480, height: 480, borderRadius: 12, overflow: 'hidden', background: '#111827' }}>
        {imageUrl ? (
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${Math.sin((prevTsRef.current || 0) * 0.001 * 0.8) * 1.2}px)` }}>
            <img src={imageUrl} alt={persona.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            No image
          </div>
        )}


        {/* Gaze pupils preview (under eyelids) */}
        {previewOverlay && (
          <>
            <div
              style={{
                position: 'absolute',
                top: `${(a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) - ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 55%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.0) 72%)',
                opacity: 0.26,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${(a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) + ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 10) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 55%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.0) 72%)',
                opacity: 0.26,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
          </>
        )}

        {/* Eyes band handle (full-width horizontal band) */}
        <div
          role="slider"
          aria-label="Eyes band position"
          data-kind="eyes"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragging(null)}
          onWheel={onWheelEyes}
          style={{
            position: 'absolute',
            top: `${(a.eyes?.yPct ?? 20) - (a.eyes?.heightPct ?? 10) / 2}%`,
            left: 0,
            right: 0,
            height: `${a.eyes?.heightPct ?? 10}%`,
            border: '2px dashed #a78bfa',
            background: 'rgba(167,139,250,0.12)',
            cursor: 'ns-resize',
          }}
        >
        {/* Eyes blink preview overlays (per-eye) */}
        {previewOverlay && (
          <>
            {/* Upper lids */}
            <div
              style={{
                position: 'absolute',
                top: `${Math.max(0, (a.eyes?.yPct ?? 20) - ((a.eyes?.heightPct ?? 12) / 2))}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) - ((a.eyeSeparationPct ?? 26) / 2)}%`,
                transform: `translateX(-50%) scaleY(${Math.max(0, Math.min(1, blinkProgRef.current))})`,
                transformOrigin: 'top center',
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 10) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${Math.max(0, (a.eyes?.yPct ?? 20) - ((a.eyes?.heightPct ?? 12) / 2))}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) + ((a.eyeSeparationPct ?? 26) / 2)}%`,
                transform: `translateX(-50%) scaleY(${Math.max(0, Math.min(1, blinkProgRef.current))})`,
                transformOrigin: 'top center',
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 10) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
                pointerEvents: 'none',
              }}
            />
            {/* Lower lids */}
            <div
              style={{
                position: 'absolute',
                top: `${(a.eyes?.yPct ?? 20)}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) - ((a.eyeSeparationPct ?? 26) / 2)}%`,
                transform: `translateX(-50%) scaleY(${Math.max(0, Math.min(1, blinkProgRef.current))})`,
                transformOrigin: 'bottom center',
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 10) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.32), rgba(0,0,0,0.14))',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${(a.eyes?.yPct ?? 20)}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) + ((a.eyeSeparationPct ?? 26) / 2)}%`,
                transform: `translateX(-50%) scaleY(${Math.max(0, Math.min(1, blinkProgRef.current))})`,
                transformOrigin: 'bottom center',
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 10) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.32), rgba(0,0,0,0.14))',
                pointerEvents: 'none',
              }}
            />
          </>
        )}

          <div style={{ position: 'absolute', top: -22, left: 0, right: 0, textAlign: 'center', color: '#c4b5fd', fontSize: 12 }}>
            eyes: {(a.eyes?.yPct ?? 20).toFixed(0)}% · {(a.eyes?.heightPct ?? 10).toFixed(0)}%
          </div>
        </div>

        {/* Mouth handle */}
        <div
          role="slider"
          aria-label="Mouth position"
          data-kind="mouth"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragging(null)}
          onWheel={onWheelMouth}
          style={{
            position: 'absolute',
            top: `${a.mouth.yPct}%`,
            left: `${a.mouth.xPct}%`,
            transform: 'translate(-50%, -50%)',
            width: `${a.mouth.sizePct}%`,
            height: `${Math.max(10, a.mouth.sizePct * 0.5)}%`,
            border: '2px solid #22d3ee',
            background: 'rgba(34,211,238,0.1)',
            borderRadius: 8,
            cursor: 'grab',
          }}
        >
          <div style={{ position: 'absolute', top: -22, left: 0, right: 0, textAlign: 'center', color: '#22d3ee', fontSize: 12 }}>
            {Math.round(a.mouth.xPct)},{Math.round(a.mouth.yPct)} · {Math.round(a.mouth.sizePct)}%
          </div>
        </div>
        {/* Preview mouth overlay for calibration */}
        {previewOverlay && (
          <svg
            className="mouth-preview"
            style={{ position: 'absolute', top: `${a.mouth.yPct}%`, left: `${a.mouth.xPct}%`, transform: 'translate(-50%, -50%)', width: `${Math.max(16, a.mouth.sizePct * 0.70)}%`, pointerEvents: 'none', opacity: 0.9 }}
            viewBox="0 0 100 50"
          >
            <defs>
              <linearGradient id="mouthShadeCal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(0,0,0,0.85)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
              </linearGradient>
              <clipPath id="mouthClipCal">
                <rect x="12" y="14" width="76" height="22" rx="10" ry="10" />
              </clipPath>
            </defs>
            {(() => {
              let lipOpen = 0.4, lipWide = 0.3, lipRound = 0.2;
              if (previewViseme === 'loop') {
                const t = performance.now() * 0.001;
                lipOpen = Math.max(0, Math.min(1, 0.5 + 0.45 * Math.sin(t * 2.2)));
                lipWide = Math.max(0, Math.min(1, 0.35 + 0.55 * Math.sin(t * 3.0)));
                lipRound = Math.max(0, Math.min(1, 0.2 + 0.4 * (Math.sin(t * 1.4 + 1) * 0.5 + 0.5)));
              } else if (previewViseme === 'Rest') {
                lipOpen = 0.05; lipWide = 0.2; lipRound = 0.1;
              } else if (previewViseme === 'A') {
                lipOpen = 0.9; lipWide = 0.2; lipRound = 0.15;
              } else if (previewViseme === 'E') {
                lipOpen = 0.45; lipWide = 0.8; lipRound = 0.1;
              } else if (previewViseme === 'O') {
                lipOpen = 0.55; lipWide = 0.2; lipRound = 0.8;
              } else if (previewViseme === 'FV') {
                lipOpen = 0.25; lipWide = 0.1; lipRound = 0.2;
              } else {
                // Custom
                lipOpen = Math.max(0, Math.min(1, customOpen));
                lipWide = Math.max(0, Math.min(1, customWide));
                lipRound = Math.max(0, Math.min(1, customRound));
              }
              return (
                <g>
                  <ellipse cx="50" cy={25 + lipOpen * 1} rx={10 + lipWide * 14 + (1 - lipRound) * 3} ry={3 + lipOpen * 14 + lipRound * 6} fill="url(#mouthShadeCal)" clipPath="url(#mouthClipCal)" />
                  {previewTeeth && (
                    <rect x={50 - (20 + lipWide * 10) / 2} y={22 + Math.max(0, 1 - lipOpen) * 4} width={20 + lipWide * 10} height={Math.max(0, (lipOpen - 0.25) * 10)} rx="2" ry="2" fill="rgba(255,255,255,0.7)" opacity={Math.max(0, Math.min(0.8, (lipOpen - 0.25) * 2))} clipPath="url(#mouthClipCal)" />
                  )}
                  <path d="M 14 25 C 38 20 62 20 86 25" stroke="rgba(80, 40, 40, 0.55)" strokeWidth={1.6 + lipOpen * 0.8} fill="none" />
                  <path d="M 14 25 C 38 30 62 30 86 25" stroke="rgba(60, 30, 30, 0.55)" strokeWidth={1.6 + lipOpen * 0.6} fill="none" />
                </g>
              );
            })()}
          </svg>
        )}

      </div>
    </div>
  );
}


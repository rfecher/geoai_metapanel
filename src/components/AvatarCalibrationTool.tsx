import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Persona } from '../data/personas';
import AutoEyeCalibration from './AutoEyeCalibration';
import { EyeCalibrationResult, manualCalibratePupils } from '../utils/eyeCalibration';
import BrandedAvatar from './BrandedAvatar';

export type FaceAnchors = {
  mouth: {
    xPct: number;
    yPct: number;
    sizePct: number;      // Legacy: used as default for widthPct if not set
    widthPct?: number;    // 20..80 (horizontal span of mouth overlay)
    heightPct?: number;   // 10..50 (vertical span of mouth overlay)
  };
  eyes?: { yPct: number; heightPct?: number };
  showTeethHint?: boolean;
  // New gaze calibration parameters
  eyeSeparationPct?: number; // 18..34 (percentage of avatar width between pupil centers)
  pupilSizeScale?: number;   // 0.3..1.3 multiplier for pupil overlay size
  eyeScale?: number;         // 0.5..2.0 global multiplier for eye features (pupils, eyelids, gaze)
  eyeWidthPct?: number;      // 6..22 (horizontal span of each eyelid/pupil region)
  eyeCenterOffsetPct?: number; // -15..15 (horizontal offset from image center)
  // Independent pupil Y positions (for avatars with asymmetric eye heights)
  leftPupilYPct?: number;    // Left pupil Y position as % (overrides eyes.yPct for left pupil)
  rightPupilYPct?: number;   // Right pupil Y position as % (overrides eyes.yPct for right pupil)
  // Pupil movement constraints (percentage-based safe movement boundaries)
  maxPupilOffsetX?: number;  // 0..2.0 (max horizontal pupil movement as % of avatar width)
  maxPupilOffsetY?: number;  // 0..1.5 (max vertical pupil movement as % of avatar height)
};

type AvatarCalibrationToolProps = {
  personas: Persona[];
  generatedAvatars?: Record<string, string>;
  useGeneratedAvatars?: boolean;
  onClose: () => void;
  embedded?: boolean; // If true, don't render full-screen overlay (for Settings integration)
};

export default function AvatarCalibrationTool({ personas, generatedAvatars = {}, useGeneratedAvatars = false, onClose, embedded = false }: AvatarCalibrationToolProps) {
  const [anchors, setAnchors] = useState<Record<string, FaceAnchors>>({});
  const [activeId, setActiveId] = useState<string>(personas[0]?.id ?? '');
  const [previewOverlay, setPreviewOverlay] = useState(true);
  const [showAutoCalibration, setShowAutoCalibration] = useState(false);
  const [showManualCalibration, setShowManualCalibration] = useState(false);

  // Mouth size is persisted via anchors.mouth.sizePct; remove separate preview scale
  const [previewViseme, setPreviewViseme] = useState<'loop'|'Rest'|'A'|'E'|'O'|'FV'|'Custom'>('loop');
  const [customOpen, setCustomOpen] = useState(0.6);
  const [customWide, setCustomWide] = useState(0.4);
  const [customRound, setCustomRound] = useState(0.15);
  const [calibrationPath, setCalibrationPath] = useState<string | null>(null);

  // Manual calibration state
  const [manualLeftX, setManualLeftX] = useState<string>('');
  const [manualLeftY, setManualLeftY] = useState<string>('');
  const [manualRightX, setManualRightX] = useState<string>('');
  const [manualRightY, setManualRightY] = useState<string>('');
  const [manualImageWidth, setManualImageWidth] = useState<string>('768');
  const [manualImageHeight, setManualImageHeight] = useState<string>('768');
  const [manualCalibrationResult, setManualCalibrationResult] = useState<EyeCalibrationResult | null>(null);

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

  const handleAutoCalibrationApply = (results: Record<string, EyeCalibrationResult>) => {
    setAnchors(prev => {
      const next = { ...prev };
      for (const [personaId, result] of Object.entries(results)) {
        next[personaId] = {
          ...(next[personaId] || { mouth: { xPct: 50, yPct: 72, sizePct: 36 }, eyes: { yPct: 20, heightPct: 7 } }),
          eyeSeparationPct: result.eyeSeparationPct,
          eyeCenterOffsetPct: result.eyeCenterOffsetPct,
          leftPupilYPct: result.leftPupilYPct,
          rightPupilYPct: result.rightPupilYPct,
        };
      }
      return next;
    });
  };

  const handleManualCalibrationCalculate = () => {
    try {
      const leftX = parseFloat(manualLeftX);
      const leftY = parseFloat(manualLeftY);
      const rightX = parseFloat(manualRightX);
      const rightY = parseFloat(manualRightY);
      const imgWidth = parseFloat(manualImageWidth);
      const imgHeight = parseFloat(manualImageHeight);

      if (isNaN(leftX) || isNaN(leftY) || isNaN(rightX) || isNaN(rightY) || isNaN(imgWidth) || isNaN(imgHeight)) {
        alert('Please enter valid numbers for all coordinates');
        return;
      }

      const result = manualCalibratePupils(leftX, leftY, rightX, rightY, imgWidth, imgHeight);
      setManualCalibrationResult(result);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleManualCalibrationApply = () => {
    if (!manualCalibrationResult) return;

    setAnchors(prev => ({
      ...prev,
      [activeId]: {
        ...(prev[activeId] || { mouth: { xPct: 50, yPct: 72, sizePct: 36 }, eyes: { yPct: 20, heightPct: 7 } }),
        eyeSeparationPct: manualCalibrationResult.eyeSeparationPct,
        eyeCenterOffsetPct: manualCalibrationResult.eyeCenterOffsetPct,
        leftPupilYPct: manualCalibrationResult.leftPupilYPct,
        rightPupilYPct: manualCalibrationResult.rightPupilYPct,
      }
    }));

    // Clear the form
    setManualCalibrationResult(null);
    setShowManualCalibration(false);
    alert(`Manual calibration applied to ${activeId}!`);
  };

  const containerStyle = embedded
    ? { height: '100%', display: 'flex', flexDirection: 'column' as const, background: '#111827' }
    : { position: 'fixed' as const, inset: 0, background: 'rgba(17,24,39,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column' as const };

  return (
    <div style={containerStyle}>
      {showAutoCalibration && (
        <AutoEyeCalibration
          personaIds={personas.map(p => p.id)}
          onClose={() => setShowAutoCalibration(false)}
          onApply={handleAutoCalibrationApply}
        />
      )}

      {showManualCalibration && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1f2937', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', color: 'white' }}>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Manual Pupil Calibration - {activeId}</h2>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>
              Enter the exact pixel coordinates of the pupil centers in the original {activeId}.png image (768x768).
              Open the image in an image editor to find the coordinates.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Left Pupil X</label>
                <input
                  type="number"
                  value={manualLeftX}
                  onChange={(e) => setManualLeftX(e.target.value)}
                  placeholder="e.g., 234"
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Left Pupil Y</label>
                <input
                  type="number"
                  value={manualLeftY}
                  onChange={(e) => setManualLeftY(e.target.value)}
                  placeholder="e.g., 285"
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Right Pupil X</label>
                <input
                  type="number"
                  value={manualRightX}
                  onChange={(e) => setManualRightX(e.target.value)}
                  placeholder="e.g., 523"
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Right Pupil Y</label>
                <input
                  type="number"
                  value={manualRightY}
                  onChange={(e) => setManualRightY(e.target.value)}
                  placeholder="e.g., 288"
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Image Width</label>
                <input
                  type="number"
                  value={manualImageWidth}
                  onChange={(e) => setManualImageWidth(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Image Height</label>
                <input
                  type="number"
                  value={manualImageHeight}
                  onChange={(e) => setManualImageHeight(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #374151', background: '#111827', color: 'white' }}
                />
              </div>
            </div>

            {manualCalibrationResult && (
              <div style={{ background: '#065f46', padding: 12, borderRadius: 4, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>✅ Calibration Results:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>Eye Separation: {manualCalibrationResult.eyeSeparationPct.toFixed(2)}%</div>
                  <div>Eye Center Offset: {manualCalibrationResult.eyeCenterOffsetPct.toFixed(2)}%</div>
                  <div>Left Pupil X: {manualCalibrationResult.leftPupilXPct.toFixed(2)}%</div>
                  <div>Right Pupil X: {manualCalibrationResult.rightPupilXPct.toFixed(2)}%</div>
                  <div>Left Pupil Y: {manualCalibrationResult.leftPupilYPct.toFixed(2)}%</div>
                  <div>Right Pupil Y: {manualCalibrationResult.rightPupilYPct.toFixed(2)}%</div>
                  <div>Avg Pupil Y: {manualCalibrationResult.pupilYPct.toFixed(2)}%</div>
                  <div>Confidence: {(manualCalibrationResult.confidence * 100).toFixed(0)}%</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={handleManualCalibrationCalculate}
                style={{ background: '#3b82f6' }}
              >
                Calculate
              </button>
              {manualCalibrationResult && (
                <button
                  className="btn"
                  onClick={handleManualCalibrationApply}
                  style={{ background: '#10b981' }}
                >
                  Apply to {activeId}
                </button>
              )}
              <button
                className="btn"
                onClick={() => {
                  setShowManualCalibration(false);
                  setManualCalibrationResult(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', borderBottom: '1px solid #374151' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 800 }}>Avatar Calibration</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
            Saving to: {calibrationPath || 'App user data directory (avatar-face-anchors.json)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowAutoCalibration(true)} style={{ background: '#8b5cf6' }}>
            Auto-Calibrate Eyes
          </button>
          <button className="btn" onClick={() => setShowManualCalibration(true)} style={{ background: '#3b82f6' }}>
            Manual Calibrate Eyes
          </button>
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
                ...(prev[activeId] || { mouth: { xPct: 50, yPct: 72, sizePct: 36 }, eyes: { yPct: 20, heightPct: 7 } }),
                showTeethHint: v,
              }
            }))}
            mouthXPct={anchors[activeId]?.mouth?.xPct ?? 50}
            setMouthXPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: {
                ...(prev[activeId] || {}),
                mouth: { ...(prev[activeId]?.mouth || { xPct: 50, yPct: 72, sizePct: 36 }), xPct: v },
              }
            }))}
            mouthYPct={anchors[activeId]?.mouth?.yPct ?? 72}
            setMouthYPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: {
                ...(prev[activeId] || {}),
                mouth: { ...(prev[activeId]?.mouth || { xPct: 50, yPct: 72, sizePct: 36 }), yPct: v },
              }
            }))}
            mouthWidthPct={anchors[activeId]?.mouth?.widthPct ?? anchors[activeId]?.mouth?.sizePct ?? 36}
            setMouthWidthPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: {
                ...(prev[activeId] || {}),
                mouth: { ...(prev[activeId]?.mouth || { xPct: 50, yPct: 72, sizePct: 36 }), widthPct: v },
              }
            }))}
            mouthHeightPct={anchors[activeId]?.mouth?.heightPct ?? 20}
            setMouthHeightPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: {
                ...(prev[activeId] || {}),
                mouth: { ...(prev[activeId]?.mouth || { xPct: 50, yPct: 72, sizePct: 36 }), heightPct: v },
              }
            }))}
            eyeSeparationPct={anchors[activeId]?.eyeSeparationPct ?? 26}
            setEyeSeparationPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), eyeSeparationPct: v },
            }))}
            eyeHeightPct={anchors[activeId]?.eyes?.heightPct ?? 7}
            setEyeHeightPct={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: {
                ...(prev[activeId] || {}),
                eyes: { yPct: prev[activeId]?.eyes?.yPct ?? 20, heightPct: v }
              },
            }))}
            eyeWidthPct={(anchors[activeId]?.eyeWidthPct ?? Math.max(6, Math.min(22, ((anchors[activeId]?.eyes?.heightPct ?? 7) * 1.5))))}
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
            maxPupilOffsetX={anchors[activeId]?.maxPupilOffsetX ?? 0.8}
            setMaxPupilOffsetX={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), maxPupilOffsetX: v },
            }))}
            maxPupilOffsetY={anchors[activeId]?.maxPupilOffsetY ?? 0.5}
            setMaxPupilOffsetY={(v) => setAnchors(prev => ({
              ...prev,
              [activeId]: { ...(prev[activeId] || {}), maxPupilOffsetY: v },
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
function CalibrationControls({ preview, setPreview, teeth, setTeeth, mouthXPct, setMouthXPct, mouthYPct, setMouthYPct, mouthWidthPct, setMouthWidthPct, mouthHeightPct, setMouthHeightPct, eyeSeparationPct, setEyeSeparationPct, eyeHeightPct, setEyeHeightPct, eyeWidthPct, setEyeWidthPct, pupilSizeScale, setPupilSizeScale, eyeScale, setEyeScale, eyeCenterOffsetPct, setEyeCenterOffsetPct, maxPupilOffsetX, setMaxPupilOffsetX, maxPupilOffsetY, setMaxPupilOffsetY, previewViseme, setPreviewViseme, customOpen, setCustomOpen, customWide, setCustomWide, customRound, setCustomRound }: { preview: boolean; setPreview: (v: boolean) => void; teeth: boolean; setTeeth: (v: boolean) => void; mouthXPct: number; setMouthXPct: (v: number) => void; mouthYPct: number; setMouthYPct: (v: number) => void; mouthWidthPct: number; setMouthWidthPct: (v: number) => void; mouthHeightPct: number; setMouthHeightPct: (v: number) => void; eyeSeparationPct: number; setEyeSeparationPct: (v: number) => void; eyeHeightPct: number; setEyeHeightPct: (v: number) => void; eyeWidthPct: number; setEyeWidthPct: (v: number) => void; pupilSizeScale: number; setPupilSizeScale: (v: number) => void; eyeScale: number; setEyeScale: (v: number) => void; eyeCenterOffsetPct: number; setEyeCenterOffsetPct: (v: number) => void; maxPupilOffsetX: number; setMaxPupilOffsetX: (v: number) => void; maxPupilOffsetY: number; setMaxPupilOffsetY: (v: number) => void; previewViseme: 'loop'|'Rest'|'A'|'E'|'O'|'FV'|'Custom'; setPreviewViseme: (v: 'loop'|'Rest'|'A'|'E'|'O'|'FV'|'Custom') => void; customOpen: number; setCustomOpen: (v: number) => void; customWide: number; setCustomWide: (v: number) => void; customRound: number; setCustomRound: (v: number) => void; }) {
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
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Mouth X Position
            <input type="range" min={5} max={95} step={0.5} value={mouthXPct} onChange={e => setMouthXPct(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{mouthXPct.toFixed(1)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Mouth Y Position
            <input type="range" min={5} max={95} step={0.5} value={mouthYPct} onChange={e => setMouthYPct(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{mouthYPct.toFixed(1)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Mouth Width
            <input type="range" min={8} max={80} step={1} value={mouthWidthPct} onChange={e => setMouthWidthPct(parseFloat(e.target.value))} />
            <span style={{ width: 42, textAlign: 'right' }}>{Math.round(mouthWidthPct)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Mouth Height
            <input type="range" min={3} max={50} step={1} value={mouthHeightPct} onChange={e => setMouthHeightPct(parseFloat(e.target.value))} />
            <span style={{ width: 42, textAlign: 'right' }}>{Math.round(mouthHeightPct)}%</span>
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Eye Separation
            <input type="range" min={18} max={34} step={0.5} value={eyeSeparationPct} onChange={e => setEyeSeparationPct(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{eyeSeparationPct.toFixed(1)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Eye Height
            <input type="range" min={6} max={25} step={0.5} value={eyeHeightPct} onChange={e => setEyeHeightPct(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{eyeHeightPct.toFixed(1)}%</span>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Max Pupil Offset X
            <input type="range" min={0} max={2.0} step={0.02} value={maxPupilOffsetX} onChange={e => setMaxPupilOffsetX(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{maxPupilOffsetX.toFixed(2)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Max Pupil Offset Y
            <input type="range" min={0} max={1.5} step={0.02} value={maxPupilOffsetY} onChange={e => setMaxPupilOffsetY(parseFloat(e.target.value))} />
            <span style={{ width: 48, textAlign: 'right' }}>{maxPupilOffsetY.toFixed(2)}%</span>
          </label>
        </div>
        <div>
          <details>
            <summary style={{ cursor: 'pointer' }}>Calibration Help</summary>
            <div style={{ fontSize: 12, opacity: 0.9, padding: '6px 8px', maxWidth: 560 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Mouth Controls:</div>
              <div>• Mouth X Position (5–95%): horizontal position of the mouth center. Adjust to align with the actual mouth location in the avatar image.</div>
              <div>• Mouth Y Position (5–95%): vertical position of the mouth center. Adjust to align with the actual mouth location in the avatar image.</div>
              <div>• Mouth Width (8–80%): controls the horizontal span of the mouth overlay. Adjust to match the actual mouth width in the avatar image.</div>
              <div>• Mouth Height (3–50%): controls the vertical span of the mouth overlay. Adjust independently to match the actual mouth height.</div>
              <div>• Tip: You can also drag the cyan mouth box on the calibration canvas to adjust position, and scroll on it to resize.</div>
              <div style={{ fontWeight: 'bold', marginTop: 8, marginBottom: 4 }}>Eye Controls:</div>
              <div>• Eye Separation (18–34%): start at 26%. Adjust so the two pupils sit centered in each eye.</div>
              <div>• Eye Width (6–22%): match each eyelid’s horizontal span to the actual eye width in the photo.</div>
              <div>• Pupil Size (0.3–1.3×): match visible iris/pupil scale in the image. Larger eyes → slightly bigger.</div>
              <div>• Eye Scale (0.5–2.0×): proportionally scales pupils, eyelids, and gaze range together. Use &lt; 1.0 for very small eyes; &gt; 1.0 for larger eyes.</div>
              <div>• Eye Center Offset (±15%): shifts the entire eye pair left/right to align with off‑center faces.</div>
              <div>• While the pupils drift, they should stay inside the eye whites and not cross eyelids. If they do, reduce size or separation. For subtler motion, lower gazeMaxOffsetPct in animationConfig.</div>
              <div>• Eye Height (6–25%): controls the vertical height of the eye region and eyelid size. Can also be adjusted by scrolling on the purple eyes band.</div>
              <div>• Tip: Drag the purple eyes band to set vertical position; use the Eye Height slider or scroll on the band to change its thickness.</div>
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
  const a: FaceAnchors = anchors || { mouth: { xPct: 50, yPct: 72, sizePct: 36 }, eyes: { yPct: 20, heightPct: 7 } };

  // Get eye color from persona (default to brown if not specified)
  const eyeColor = persona.eyeColor ?? '#6B4E3D';

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
      const eyeScale = (a.eyes?.heightPct ?? 7) / 12;
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
      }

      let gx = driftX * maxOffset + kickXRef.current;
      let gy = driftY * maxOffset + kickYRef.current;
      const clamp = maxOffset * 1.6;
      const len = Math.hypot(gx, gy);
      if (len > clamp) { const s = clamp / len; gx *= s; gy *= s; }
      gazeRef.current = { x: gx, y: gy };

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
      onChange({ ...a, eyes: { yPct: clampedY, heightPct: a.eyes?.heightPct ?? 7 } });
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
    const next = Math.min(25, Math.max(6, (a.eyes?.heightPct ?? 7) + delta));
    onChange({ ...a, eyes: { yPct: a.eyes?.yPct ?? 20, heightPct: next } });
  };

  // Compute viseme pose for preview
  const visemePose = useMemo(() => {
    if (previewViseme === 'loop') {
      const t = performance.now() * 0.001;
      return {
        viseme: 'loop',
        open: Math.max(0, Math.min(1, 0.5 + 0.45 * Math.sin(t * 2.2))),
        wide: Math.max(0, Math.min(1, 0.35 + 0.55 * Math.sin(t * 3.0))),
        round: Math.max(0, Math.min(1, 0.2 + 0.4 * (Math.sin(t * 1.4 + 1) * 0.5 + 0.5))),
      };
    } else if (previewViseme === 'Rest') {
      return { viseme: 'Rest', open: 0.05, wide: 0.2, round: 0.1 };
    } else if (previewViseme === 'A') {
      return { viseme: 'A', open: 0.9, wide: 0.2, round: 0.15 };
    } else if (previewViseme === 'E') {
      return { viseme: 'E', open: 0.45, wide: 0.8, round: 0.1 };
    } else if (previewViseme === 'O') {
      return { viseme: 'O', open: 0.55, wide: 0.2, round: 0.8 };
    } else if (previewViseme === 'FV') {
      return { viseme: 'FV', open: 0.25, wide: 0.1, round: 0.2 };
    } else {
      return { viseme: 'Custom', open: customOpen, wide: customWide, round: customRound };
    }
  }, [previewViseme, customOpen, customWide, customRound, animTick]);

  return (
    <div>
      <div style={{ color: '#e5e7eb', marginBottom: 8 }}>
        Drag the mouth box; scroll to resize. Drag the eyes band; scroll to change thickness. Use the slider below to fine-tune mouth width (%).
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Calibration canvas with overlays */}
        <div>
          <div style={{ color: '#e5e7eb', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Calibration Canvas</div>
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


        {/* Gaze pupils with iris preview (under eyelids) - now with independent Y positions */}
        {previewOverlay && (
          <>
            {/* Left iris (outer colored ring) */}
            <div
              style={{
                position: 'absolute',
                top: `${(a.leftPupilYPct ?? a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) - ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0) * 1.8}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0) * 1.8}%`,
                borderRadius: '50%',
                background: `radial-gradient(circle at 45% 55%, ${eyeColor}bb, ${eyeColor}99 60%, ${eyeColor}66 85%, ${eyeColor}33 100%)`,
                opacity: 0.22,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
            {/* Left pupil (inner black center) */}
            <div
              style={{
                position: 'absolute',
                top: `${(a.leftPupilYPct ?? a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) - ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 55%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.0) 72%)',
                opacity: 0.26,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
            {/* Right iris (outer colored ring) */}
            <div
              style={{
                position: 'absolute',
                top: `${(a.rightPupilYPct ?? a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) + ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0) * 1.8}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0) * 1.8}%`,
                borderRadius: '50%',
                background: `radial-gradient(circle at 45% 55%, ${eyeColor}bb, ${eyeColor}99 60%, ${eyeColor}66 85%, ${eyeColor}33 100%)`,
                opacity: 0.22,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
            {/* Right pupil (inner black center) */}
            <div
              style={{
                position: 'absolute',
                top: `${(a.rightPupilYPct ?? a.eyes?.yPct ?? 20) + gazeRef.current.y}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) + ((a.eyeSeparationPct ?? 26) / 2) + gazeRef.current.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
                height: `${Math.max(2.5, (a.eyes?.heightPct ?? 7) * 0.4 * (a.pupilSizeScale ?? 1.0)) * (a.eyeScale ?? 1.0)}%`,
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
            top: `${(a.eyes?.yPct ?? 20) - (a.eyes?.heightPct ?? 7) / 2}%`,
            left: 0,
            right: 0,
            height: `${a.eyes?.heightPct ?? 7}%`,
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
                top: `${Math.max(0, (a.eyes?.yPct ?? 20) - ((a.eyes?.heightPct ?? 7) / 2))}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) - ((a.eyeSeparationPct ?? 26) / 2)}%`,
                transform: `translateX(-50%) scaleY(${Math.max(0, Math.min(1, blinkProgRef.current))})`,
                transformOrigin: 'top center',
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 7) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 7) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${Math.max(0, (a.eyes?.yPct ?? 20) - ((a.eyes?.heightPct ?? 7) / 2))}%`,
                left: `${50 + (a.eyeCenterOffsetPct ?? 0) + ((a.eyeSeparationPct ?? 26) / 2)}%`,
                transform: `translateX(-50%) scaleY(${Math.max(0, Math.min(1, blinkProgRef.current))})`,
                transformOrigin: 'top center',
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 7) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 7) / 2}%`,
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
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 7) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 7) / 2}%`,
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
                width: `${Math.max(6, Math.min(22, (a.eyeWidthPct ?? ((a.eyes?.heightPct ?? 7) * 1.5)) * (a.eyeScale ?? 1.0)))}%`,
                height: `${(a.eyes?.heightPct ?? 7) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.32), rgba(0,0,0,0.14))',
                pointerEvents: 'none',
              }}
            />
          </>
        )}

          <div style={{ position: 'absolute', top: -22, left: 0, right: 0, textAlign: 'center', color: '#c4b5fd', fontSize: 12 }}>
            eyes: {(a.eyes?.yPct ?? 20).toFixed(0)}% · {(a.eyes?.heightPct ?? 7).toFixed(0)}%
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
              {/* Outer lip gradient - natural lip color tones */}
              <radialGradient id="lipOuterCal" cx="50%" cy="40%">
                <stop offset="0%" stopColor="rgba(180, 100, 100, 0.6)" />
                <stop offset="60%" stopColor="rgba(140, 70, 70, 0.7)" />
                <stop offset="100%" stopColor="rgba(100, 50, 50, 0.5)" />
              </radialGradient>

              {/* Inner mouth gradient - darker for depth */}
              <radialGradient id="mouthInnerCal" cx="50%" cy="45%">
                <stop offset="0%" stopColor="rgba(40, 15, 15, 0.85)" />
                <stop offset="50%" stopColor="rgba(20, 8, 8, 0.95)" />
                <stop offset="100%" stopColor="rgba(10, 5, 5, 0.75)" />
              </radialGradient>

              {/* Lip highlight gradient for 3D effect */}
              <linearGradient id="lipHighlightCal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(200, 120, 120, 0.3)" />
                <stop offset="40%" stopColor="rgba(160, 90, 90, 0.15)" />
                <stop offset="100%" stopColor="rgba(120, 60, 60, 0.05)" />
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
                  {/* Outer lip area - natural lip color (ENLARGED for more prominence) */}
                  <ellipse
                    cx="50"
                    cy={25 + lipOpen * 2.5}
                    rx={18 + lipWide * 20 + (1 - lipRound) * 7}
                    ry={5 + lipOpen * 20 + lipRound * 10}
                    fill="url(#lipOuterCal)"
                    clipPath="url(#mouthClipCal)"
                    opacity={0.8 + lipOpen * 0.15}
                  />

                  {/* Inner mouth opening - dark for depth (REDUCED for less dominance) */}
                  <ellipse
                    cx="50"
                    cy={25 + lipOpen * 4}
                    rx={5 + lipWide * 8 + (1 - lipRound) * 2}
                    ry={0.8 + lipOpen * 8 + lipRound * 4}
                    fill="url(#mouthInnerCal)"
                    clipPath="url(#mouthClipCal)"
                    opacity={0.7 + lipOpen * 0.2}
                  />

                  {/* Upper lip highlight for 3D effect (ENLARGED to match outer lip) */}
                  <ellipse
                    cx="50"
                    cy={23 + lipOpen * 1.5}
                    rx={14 + lipWide * 18 + (1 - lipRound) * 6}
                    ry={3 + lipOpen * 7 + lipRound * 4}
                    fill="url(#lipHighlightCal)"
                    clipPath="url(#mouthClipCal)"
                    opacity={0.45 - lipOpen * 0.15}
                  />

                  {previewTeeth && (
                    <rect
                      x={50 - (20 + lipWide * 10) / 2}
                      y={22 + Math.max(0, 1 - lipOpen) * 4}
                      width={20 + lipWide * 10}
                      height={Math.max(0, (lipOpen - 0.25) * 10)}
                      rx="2"
                      ry="2"
                      fill="rgba(255,255,255,0.7)"
                      opacity={Math.max(0, Math.min(0.8, (lipOpen - 0.25) * 2))}
                      clipPath="url(#mouthClipCal)"
                    />
                  )}

                  {/* Subtle lip contour lines */}
                  <path
                    d="M 14 25 C 38 20 62 20 86 25"
                    stroke="rgba(100, 50, 50, 0.4)"
                    strokeWidth={1.4 + lipOpen * 0.6}
                    fill="none"
                  />
                  <path
                    d="M 14 25 C 38 30 62 30 86 25"
                    stroke="rgba(80, 40, 40, 0.35)"
                    strokeWidth={1.4 + lipOpen * 0.5}
                    fill="none"
                  />
                </g>
              );
            })()}
          </svg>
        )}

          </div>
          {/* End calibration canvas div */}
        </div>
        {/* End calibration canvas wrapper */}

        {/* Live BrandedAvatar preview */}
        <div>
          <div style={{ color: '#e5e7eb', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Live Preview (BrandedAvatar)</div>
          <div style={{ background: '#1f2937', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'center' }}>
            <BrandedAvatar
              personaId={persona.id}
              name={persona.name}
              size="large"
              isSpeaking={previewViseme !== 'Rest'}
              audioAmplitude={previewViseme === 'loop' ? 0.5 : (visemePose.open * 0.8)}
              visemePose={visemePose}
              faceAnchors={a}
              animationConfig={persona.animationConfig}
            />
          </div>
          <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 8, maxWidth: 320 }}>
            This preview shows exactly how the avatar will appear with the current calibration settings.
            Adjust the controls below to see real-time changes.
          </div>
        </div>
      </div>
    </div>
  );
}


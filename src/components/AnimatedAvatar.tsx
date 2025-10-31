import React, { useEffect, useState, useRef } from 'react';
import { personas } from '../data/personas';

type AnimatedAvatarProps = {
  personaId?: string;
  faceAnchors?: { mouth: { xPct: number; yPct: number; sizePct: number }; eyes?: { yPct: number; heightPct?: number }; showTeethHint?: boolean };
  imageUrl?: string;
  avatarInitials: string;
  color: string;
  name: string;
  isSpeaking?: boolean;
  audioAmplitude?: number; // 0-1 range
  visemePose?: { viseme: string; open: number; wide: number; round: number };
  size?: 'small' | 'medium' | 'large';
  className?: string;
  animationConfig?: {
    mouthGain?: number;
    mouthSmoothing?: number;
    minOpen?: number;
    maxOpen?: number;
    mouthCavityThreshold?: number; // 0..0.5 (default 0.1) - lipOpen threshold below which mouth cavity is hidden
    blinkRateSec?: number;
    blinkJitterPct?: number;
    breatheScale?: number;
    swayScale?: number;
    speakingGlow?: number;
    mouthScale?: number;
    showTeethHint?: boolean;
  };
};

export default function AnimatedAvatar({
  personaId,
  faceAnchors: faceAnchorsProp,
  imageUrl,
  avatarInitials,
  color,
  name,
  isSpeaking = false,
  audioAmplitude = 0,
  visemePose,
  size = 'medium',
  className = '',
  animationConfig,
}: AnimatedAvatarProps) {
  // Resolve face anchors: prefer props (from personas.ts), fallback to localStorage calibration
  const anchors = React.useMemo(() => {
    if (faceAnchorsProp) return faceAnchorsProp;
    if (!personaId) return undefined as any;
    try {
      const raw = localStorage.getItem('avatarFaceAnchors');

      if (!raw) return undefined as any;
      const all = JSON.parse(raw) as Record<string, any>;
      return all[personaId];
    } catch {
      return undefined as any;
    }
  }, [personaId, faceAnchorsProp]);

  const mouthAnchor = anchors?.mouth || { xPct: 50, yPct: 72, sizePct: 36 };
  const mouthRotationDeg = mouthAnchor.rotationDeg ?? 0; // Rotation for asymmetric/smirk mouths
  const wideRef = useRef(0);
  const roundRef = useRef(0);

  const eyesAnchor = anchors?.eyes || { yPct: 20, heightPct: 12 };
  const [blinkState, setBlinkState] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Animation configuration with sensible defaults
  const cfg = React.useMemo(() => ({
    mouthGain: animationConfig?.mouthGain ?? 1,
    // If you prefer single-pole smoothing, set mouthSmoothing (0..0.95) and ignore attack/release
    mouthSmoothing: Math.min(Math.max(animationConfig?.mouthSmoothing ?? 0, 0), 0.95),
    // Attack/Release envelope (0..0.99). Lower attack => faster opening; higher release => slower closing
    attack: Math.min(Math.max((animationConfig as any)?.attack ?? 0.3, 0), 0.99),
    release: Math.min(Math.max((animationConfig as any)?.release ?? 0.9, 0), 0.999),
    minOpen: animationConfig?.minOpen ?? 0,
    maxOpen: animationConfig?.maxOpen ?? 1,
    mouthCavityThreshold: Math.max(0, Math.min(0.5, (animationConfig as any)?.mouthCavityThreshold ?? 0.1)),
    blinkRateSec: animationConfig?.blinkRateSec ?? 4,
    blinkJitterPct: animationConfig?.blinkJitterPct ?? 0.5,
    blinkDurationMs: Math.max(80, Math.min(220, (animationConfig as any)?.blinkDurationMs ?? 140)),
    doubleBlinkChance: Math.max(0, Math.min(0.5, (animationConfig as any)?.doubleBlinkChance ?? 0.18)),
    breatheScale: animationConfig?.breatheScale ?? 1,
    swayScale: animationConfig?.swayScale ?? 1,
    speakingGlow: animationConfig?.speakingGlow ?? 0.6,
    kenScale: Math.max(1, (animationConfig as any)?.kenScale ?? 1.01),
    kenSpeed: Math.max(0.02, (animationConfig as any)?.kenSpeed ?? 0.06),
    mouthScale: Math.max(0.6, Math.min(1.4, (animationConfig as any)?.mouthScale ?? 1)),
    showTeethHint: (anchors as any)?.showTeethHint ?? (animationConfig as any)?.showTeethHint ?? true,
    // Gaze configuration (micro-saccades + drift)
    gazeEnabled: (animationConfig as any)?.gazeEnabled ?? true,
    gazeMaxOffsetPct: Math.max(0.3, Math.min(3, (animationConfig as any)?.gazeMaxOffsetPct ?? 0.8)),
    eyeSeparationPct: Math.max(18, Math.min(34, (anchors as any)?.eyeSeparationPct ?? (animationConfig as any)?.eyeSeparationPct ?? 26)),
    eyeCenterOffsetPct: Math.max(-15, Math.min(15, (anchors as any)?.eyeCenterOffsetPct ?? (animationConfig as any)?.eyeCenterOffsetPct ?? 0)),
    eyeWidthPct: Math.max(6, Math.min(22, (anchors as any)?.eyeWidthPct ?? ((eyesAnchor?.heightPct ?? 12) * 1.5))),
    eyeScale: Math.max(0.5, Math.min(2.0, (anchors as any)?.eyeScale ?? (animationConfig as any)?.eyeScale ?? 1.0)),
    pupilSizeScale: Math.max(0.3, Math.min(1.3, (anchors as any)?.pupilSizeScale ?? (animationConfig as any)?.pupilSizeScale ?? 1.0)),
    // Independent pupil Y positions (with backward compatibility)
    leftPupilYPct: (anchors as any)?.leftPupilYPct ?? eyesAnchor?.yPct ?? 20,
    rightPupilYPct: (anchors as any)?.rightPupilYPct ?? eyesAnchor?.yPct ?? 20,
  }), [animationConfig, anchors, eyesAnchor]);

  // Get eye color from persona definition (default to brown if not specified)
  const eyeColor = React.useMemo(() => {
    if (!personaId) return '#6B4E3D'; // Default brown
    const persona = personas.find(p => p.id === personaId);
    return persona?.eyeColor ?? '#6B4E3D'; // Default brown
  }, [personaId]);

  // Mouth envelope: optional single-pole or attack/release smoothing
  const envRef = useRef(0);
  const effective = Math.min(cfg.maxOpen, Math.max(cfg.minOpen, (audioAmplitude || 0) * cfg.mouthGain));
  let nextEnv = effective;
  if (cfg.mouthSmoothing > 0) {
    nextEnv = envRef.current * cfg.mouthSmoothing + effective * (1 - cfg.mouthSmoothing);
  } else {
    const a = cfg.attack, r = cfg.release;
    nextEnv = effective > envRef.current
      ? envRef.current * a + effective * (1 - a)
      : envRef.current * r + effective * (1 - r);
  }
  const smoothedAmp = (envRef.current = nextEnv);
  // Viseme-driven mouth parameters (fallback to amplitude if no viseme)
  const targetOpen = visemePose ? Math.min(cfg.maxOpen, Math.max(cfg.minOpen, visemePose.open)) : smoothedAmp;
  const lipOpen = targetOpen;
  const lipWide = visemePose ? (wideRef.current = wideRef.current * 0.6 + visemePose.wide * 0.4) : smoothedAmp * 0.6;
  const lipRound = visemePose ? (roundRef.current = roundRef.current * 0.6 + visemePose.round * 0.4) : 0;


  // Blink animation - configurable intervals (disabled if reduced motion)
  useEffect(() => {
    if (prefersReducedMotion) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextBlink = () => {
      const mean = cfg.blinkRateSec * 1000;
      const jitter = Math.max(0, cfg.blinkJitterPct);
      const min = Math.max(250, mean * (1 - jitter));
      const max = mean * (1 + jitter);
      const delay = min + Math.random() * (max - min);
      timer = setTimeout(() => {
        setBlinkState(true);
        setTimeout(() => {
          setBlinkState(false);
          if (Math.random() < cfg.doubleBlinkChance) {
            setTimeout(() => {
              setBlinkState(true);
              setTimeout(() => setBlinkState(false), cfg.blinkDurationMs);
            }, 120);
          }
        }, cfg.blinkDurationMs);
        scheduleNextBlink();
      }, delay);
    };

    scheduleNextBlink();
    return () => { if (timer) clearTimeout(timer); };
  }, [prefersReducedMotion, cfg.blinkRateSec, cfg.blinkJitterPct, cfg.blinkDurationMs, cfg.doubleBlinkChance]);

  // Gentle Ken Burns pan/zoom with subtle noise
  const [ken, setKen] = useState({ tx: 0, ty: 0, scale: 1 });
  useEffect(() => {
    let raf = 0;
    const phx = Math.random() * Math.PI * 2;
    const phy = Math.random() * Math.PI * 2;
    const animate = () => {
      const t = performance.now() * 0.001 * cfg.kenSpeed;
      const tx = Math.sin(t * 0.7 + phx) * 0.8 * cfg.swayScale;
      const ty = Math.sin(t * 0.5 + phy) * 0.8 * cfg.swayScale;
      const scale = cfg.kenScale + 0.0025 * Math.sin(t * 0.6);
      setKen({ tx, ty, scale });

      raf = requestAnimationFrame(animate);
    };
    if (!prefersReducedMotion) raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [cfg.kenScale, cfg.kenSpeed, cfg.swayScale, prefersReducedMotion]);


  // Size configurations
  const sizeConfig = {
    small: { width: 80, height: 80, fontSize: 24 },
    medium: { width: 160, height: 160, fontSize: 48 },
    large: { width: 320, height: 320, fontSize: 96 },
  };

  const { width, height, fontSize } = sizeConfig[size];

  // Calculate animation intensity based on speaking state and amplitude
  const breathingIntensity = (isSpeaking ? 1 + smoothedAmp * 0.03 : 1) * cfg.breatheScale;
  const glowIntensity = isSpeaking ? smoothedAmp * cfg.speakingGlow : 0;

  // Micro-saccades and gaze drift (independent of head sway)
  const [gaze, setGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    if (prefersReducedMotion || !cfg.gazeEnabled) return;
    let raf = 0;
    const t0 = performance.now();
    const phx = Math.random() * Math.PI * 2;
    const phy = Math.random() * Math.PI * 2;
    let last = performance.now();
    let kickX = 0, kickY = 0; // transient saccade offset
    let nextSacc = performance.now() + 800 + Math.random() * 1400;
    const animate = () => {
      const now = performance.now();
      const t = (now - t0) / 1000;
      const dt = Math.max(0.001, (now - last) / 1000);
      last = now;

      // Smooth drift (very small amplitude)
      const driftX = (Math.sin(t * 0.6 + phx) * 0.3 + Math.sin(t * 1.1 + phx * 0.7) * 0.15);
      const driftY = (Math.sin(t * 0.5 + phy) * 0.22 + Math.sin(t * 0.9 + phy * 0.6) * 0.1);

      // Effective gaze range scales down for smaller eyes and smaller pupils
      const eyeScale = (eyesAnchor?.heightPct ?? 12) / 12;
      const sizeScale = Math.min(1, cfg.pupilSizeScale);
      const effMax = cfg.gazeMaxOffsetPct * eyeScale * sizeScale * cfg.eyeScale;

      // Saccade kick decays quickly
      const decay = Math.exp(-dt / 0.12);
      kickX *= decay;
      kickY *= decay;

      if (now >= nextSacc) {
        const mag = ((Math.random() * 0.9) + 0.6) * effMax; // 0.6..1.5 * effective max
        const ang = Math.random() * Math.PI * 2;
        // Smaller vertical extent feels more natural in portraits
        kickX += Math.cos(ang) * mag;
        kickY += Math.sin(ang) * mag * 0.7;
        nextSacc = now + 800 + Math.random() * 1400;
      }

      let gx = driftX * effMax + kickX;
      let gy = driftY * effMax + kickY;

      // Clamp resultant offset
      const max = effMax * 1.6;
      const len = Math.hypot(gx, gy);
      if (len > max) { const s = max / len; gx *= s; gy *= s; }

      setGaze({ x: gx, y: gy });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [prefersReducedMotion, cfg.gazeEnabled, cfg.gazeMaxOffsetPct, cfg.pupilSizeScale, cfg.eyeScale, eyesAnchor?.heightPct]);

  return (

    <div
      ref={containerRef}
      className={`animated-avatar ${className} ${isSpeaking ? 'speaking' : ''}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Main avatar container with breathing animation */}
      <div
        className="avatar-container"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transform: `scale(${breathingIntensity})`,
          transition: 'transform 0.3s ease-out',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="avatar-image"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: `translate(${ken.tx}px, ${ken.ty}px) scale(${ken.scale})`,

              transformOrigin: 'center center',
              willChange: 'transform',
            }}
          />
        ) : (
          <div
            className="avatar-initials"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: `${fontSize}px`,
            }}
          >
            {avatarInitials}
          </div>
        )}

        {/* Blink eyelids: upper + lower with curved motion */}
        {/* Gaze pupils with iris overlay (subtle, sits under eyelids) - now with independent Y positions */}
        {imageUrl && cfg.gazeEnabled && (
          <>
            {/* Left iris (outer colored ring) */}
            <div
              className="gaze-iris left"
              style={{
                position: 'absolute',
                top: `${cfg.leftPupilYPct + gaze.y}%`,
                left: `${50 + cfg.eyeCenterOffsetPct - (cfg.eyeSeparationPct / 2) + gaze.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale * 1.8}%`,
                height: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale * 1.8}%`,
                borderRadius: '50%',
                background: `radial-gradient(circle at 45% 55%, ${eyeColor}bb, ${eyeColor}99 60%, ${eyeColor}66 85%, ${eyeColor}33 100%)`,
                opacity: 0.22,
                mixBlendMode: 'multiply',
                willChange: 'transform',
              }}
            />
            {/* Left pupil (inner black center) */}
            <div
              className="gaze-pupil left"
              style={{
                position: 'absolute',
                top: `${cfg.leftPupilYPct + gaze.y}%`,
                left: `${50 + cfg.eyeCenterOffsetPct - (cfg.eyeSeparationPct / 2) + gaze.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale}%`,
                height: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 55%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.0) 72%)',
                opacity: 0.26,
                mixBlendMode: 'multiply',
                willChange: 'transform',
              }}
            />
            {/* Right iris (outer colored ring) */}
            <div
              className="gaze-iris right"
              style={{
                position: 'absolute',
                top: `${cfg.rightPupilYPct + gaze.y}%`,
                left: `${50 + cfg.eyeCenterOffsetPct + (cfg.eyeSeparationPct / 2) + gaze.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale * 1.8}%`,
                height: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale * 1.8}%`,
                borderRadius: '50%',
                background: `radial-gradient(circle at 45% 55%, ${eyeColor}bb, ${eyeColor}99 60%, ${eyeColor}66 85%, ${eyeColor}33 100%)`,
                opacity: 0.22,
                mixBlendMode: 'multiply',
                willChange: 'transform',
              }}
            />
            {/* Right pupil (inner black center) */}
            <div
              className="gaze-pupil right"
              style={{
                position: 'absolute',
                top: `${cfg.rightPupilYPct + gaze.y}%`,
                left: `${50 + cfg.eyeCenterOffsetPct + (cfg.eyeSeparationPct / 2) + gaze.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale}%`,
                height: `${Math.max(2.5, (eyesAnchor?.heightPct ?? 12) * 0.4 * cfg.pupilSizeScale) * cfg.eyeScale}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 55%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.0) 72%)',
                opacity: 0.26,
                mixBlendMode: 'multiply',
                willChange: 'transform',
              }}
            />
          </>
        )}

        {imageUrl && blinkState && (
          <>
            {/* Upper eyelids (left + right), constrained to eye regions */}
            <div
              className="blink-lid upper"
              style={{
                position: 'absolute',
                top: `${Math.max(0, (eyesAnchor?.yPct ?? 20) - ((eyesAnchor?.heightPct ?? 12) / 2))}%`,
                left: `${50 + cfg.eyeCenterOffsetPct - (cfg.eyeSeparationPct / 2)}%`,
                transform: 'translateX(-50%)',
                width: `${Math.max(6, Math.min(22, cfg.eyeWidthPct * cfg.eyeScale))}%`,
                height: `${(eyesAnchor?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
                animationDuration: `${cfg.blinkDurationMs}ms`,
                animationTimingFunction: 'linear',
              }}
            />
            <div
              className="blink-lid upper"
              style={{
                position: 'absolute',
                top: `${Math.max(0, (eyesAnchor?.yPct ?? 20) - ((eyesAnchor?.heightPct ?? 12) / 2))}%`,
                left: `${50 + cfg.eyeCenterOffsetPct + (cfg.eyeSeparationPct / 2)}%`,
                transform: 'translateX(-50%)',
                width: `${Math.max(6, Math.min(22, cfg.eyeWidthPct * cfg.eyeScale))}%`,
                height: `${(eyesAnchor?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
                animationDuration: `${cfg.blinkDurationMs}ms`,
                animationTimingFunction: 'linear',
              }}
            />
            {/* Lower eyelids (left + right), constrained to eye regions */}
            <div
              className="blink-lid lower"
              style={{
                position: 'absolute',
                top: `${(eyesAnchor?.yPct ?? 20)}%`,
                left: `${50 + cfg.eyeCenterOffsetPct - (cfg.eyeSeparationPct / 2)}%`,
                transform: 'translateX(-50%)',
                width: `${Math.max(6, Math.min(22, cfg.eyeWidthPct * cfg.eyeScale))}%`,
                height: `${(eyesAnchor?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.32), rgba(0,0,0,0.14))',
                animationDuration: `${cfg.blinkDurationMs}ms`,
                animationTimingFunction: 'linear',
                animationDelay: `${Math.max(12, Math.min(28, Math.round(cfg.blinkDurationMs * 0.12)))}ms`
              }}
            />
            <div
              className="blink-lid lower"
              style={{
                position: 'absolute',
                top: `${(eyesAnchor?.yPct ?? 20)}%`,
                left: `${50 + cfg.eyeCenterOffsetPct + (cfg.eyeSeparationPct / 2)}%`,
                transform: 'translateX(-50%)',
                width: `${Math.max(6, Math.min(22, cfg.eyeWidthPct * cfg.eyeScale))}%`,
                height: `${(eyesAnchor?.heightPct ?? 12) / 2}%`,
                borderRadius: '999px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.32), rgba(0,0,0,0.14))',
                animationDuration: `${cfg.blinkDurationMs}ms`,
                animationTimingFunction: 'linear',
                animationDelay: `${Math.max(12, Math.min(28, Math.round(cfg.blinkDurationMs * 0.12)))}ms`
              }}
            />
          </>
        )}

        {/* Mouth animation overlay for speaking - viseme-driven when available */}
        {imageUrl && isSpeaking && (visemePose ? (visemePose.viseme !== 'Rest' || (visemePose.open ?? 0) > 0.05) : smoothedAmp > 0.05) && (

          <svg
            className="mouth-overlay"
            style={{
              position: 'absolute',
              top: `${mouthAnchor.yPct}%`,
              left: `${mouthAnchor.xPct}%`,
              transform: `translate(-50%, -50%) rotate(${mouthRotationDeg}deg)`,
              transformOrigin: 'center center',
              width: `${Math.max(16, mouthAnchor.sizePct * 0.70 * cfg.mouthScale)}%`,
              pointerEvents: 'none',
              opacity: 0.9,
            }}
            viewBox="0 0 100 50"
          >
            <defs>
              {/* Outer lip gradient - natural lip color tones */}
              <radialGradient id="lipOuter" cx="50%" cy="40%">
                <stop offset="0%" stopColor="rgba(180, 100, 100, 0.6)" />
                <stop offset="60%" stopColor="rgba(140, 70, 70, 0.7)" />
                <stop offset="100%" stopColor="rgba(100, 50, 50, 0.5)" />
              </radialGradient>

              {/* Inner mouth gradient - darker for depth */}
              <radialGradient id="mouthInner" cx="50%" cy="45%">
                <stop offset="0%" stopColor="rgba(40, 15, 15, 0.85)" />
                <stop offset="50%" stopColor="rgba(20, 8, 8, 0.95)" />
                <stop offset="100%" stopColor="rgba(10, 5, 5, 0.75)" />
              </radialGradient>

              {/* Lip highlight gradient for 3D effect */}
              <linearGradient id="lipHighlight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(200, 120, 120, 0.3)" />
                <stop offset="40%" stopColor="rgba(160, 90, 90, 0.15)" />
                <stop offset="100%" stopColor="rgba(120, 60, 60, 0.05)" />
              </linearGradient>

              {/* Lip line gradient: subtle shadow for closed mouth appearance */}
              <linearGradient id="lipLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(58, 36, 32, 0)" />
                <stop offset="35%" stopColor="rgba(45, 27, 24, 0.45)" />
                <stop offset="50%" stopColor="rgba(31, 18, 16, 0.65)" />
                <stop offset="65%" stopColor="rgba(45, 27, 24, 0.45)" />
                <stop offset="100%" stopColor="rgba(58, 36, 32, 0)" />
              </linearGradient>

              <clipPath id="mouthClip">
                <ellipse cx="50" cy="25" rx="40" ry="15" />
              </clipPath>
            </defs>

            {/* Subtle lip line: visible when mouth is closed to suggest lip seam */}
            <ellipse
              cx="50"
              cy={25}
              rx={18}
              ry={0.6}
              fill="url(#lipLine)"
              opacity={
                lipOpen < cfg.mouthCavityThreshold
                  ? Math.max(0.5, 0.75 - (lipOpen / cfg.mouthCavityThreshold) * 0.25)
                  : Math.max(0, 0.5 - ((lipOpen - cfg.mouthCavityThreshold) / (1 - cfg.mouthCavityThreshold)) * 0.5)
              }
              style={{ transition: 'opacity 0.12s ease-out' }}
            />

            {/* Outer lip area - natural lip color (ENLARGED for more prominence) */}
            <ellipse
              cx="50"
              cy={25 + lipOpen * 2.5}
              rx={18 + lipWide * 26 + (1 - lipRound) * 9}
              ry={5 + lipOpen * 24 + lipRound * 13}
              fill="url(#lipOuter)"
              clipPath="url(#mouthClip)"
              opacity={0.8 + lipOpen * 0.15}
              style={{ transition: 'all 0.06s ease-out' }}
            />

            {/* Inner mouth opening - dark for depth (only visible when lipOpen exceeds threshold) */}
            {/* Reshaped to be more horizontally elongated (wider rx) and vertically compressed (narrower ry) */}
            {lipOpen >= cfg.mouthCavityThreshold && (
              <ellipse
                cx="50"
                cy={25 + lipOpen * 4}
                rx={7 + lipWide * 14 + (1 - lipRound) * 3}
                ry={0.5 + lipOpen * 6 + lipRound * 3}
                fill="url(#mouthInner)"
                clipPath="url(#mouthClip)"
                opacity={0.7 + lipOpen * 0.2}
                style={{ transition: 'all 0.06s ease-out' }}
              />
            )}

            {/* Upper lip highlight for 3D effect (ENLARGED to match outer lip) */}
            <ellipse
              cx="50"
              cy={23 + lipOpen * 1.5}
              rx={14 + lipWide * 22 + (1 - lipRound) * 7}
              ry={3 + lipOpen * 8 + lipRound * 5}
              fill="url(#lipHighlight)"
              clipPath="url(#mouthClip)"
              opacity={0.45 - lipOpen * 0.15}
              style={{ transition: 'all 0.06s ease-out' }}
            />

            {/* Teeth hint - brighter and more visible */}
            {cfg.showTeethHint && lipOpen > 0.15 && (
              <rect
                x={50 - (20 + lipWide * 15) / 2}
                y={22 + Math.max(0, (1 - lipOpen) * 2)}
                width={20 + lipWide * 15}
                height={Math.max(0, (lipOpen - 0.15) * 12)}
                rx="2"
                ry="2"
                fill="rgba(255,255,255,0.85)"
                opacity={Math.max(0, Math.min(0.9, (lipOpen - 0.15) * 3))}
                clipPath="url(#mouthClip)"
                style={{ transition: 'all 0.06s ease-out' }}
              />
            )}

            {/* Subtle lip contour lines */}
            <path
              d={`M ${15 - lipWide * 4} ${25 - lipOpen * 3} Q 50 ${18 - lipOpen * 5} ${85 + lipWide * 4} ${25 - lipOpen * 3}`}
              stroke="rgba(100, 50, 50, 0.4)"
              strokeWidth={1.2 + lipOpen * 0.8}
              fill="none"
              style={{ transition: 'all 0.08s ease-out' }}
            />

            <path
              d={`M ${15 - lipWide * 3} ${25 + lipOpen * 2} Q 50 ${32 + lipOpen * 6} ${85 + lipWide * 3} ${25 + lipOpen * 2}`}
              stroke="rgba(80, 40, 40, 0.35)"
              strokeWidth={1 + lipOpen * 0.6}
              fill="none"
              style={{ transition: 'all 0.08s ease-out' }}
            />

            {/* Corner depth shadows for realism */}
            <ellipse
              cx="18"
              cy={25 + lipOpen * 1.5}
              rx={3 + lipWide * 2}
              ry={2 + lipOpen * 4}
              fill="rgba(30, 15, 15, 0.6)"
              opacity={0.5 + lipOpen * 0.5}
              style={{ transition: 'all 0.06s ease-out' }}
            />
            <ellipse
              cx="82"
              cy={25 + lipOpen * 1.5}
              rx={3 + lipWide * 2}
              ry={2 + lipOpen * 4}
              fill="rgba(30, 15, 15, 0.6)"
              opacity={0.5 + lipOpen * 0.5}
              style={{ transition: 'all 0.06s ease-out' }}
            />

            {/* Deep interior shadow for additional depth (REDUCED) */}
            <ellipse
              cx="50"
              cy={27 + lipOpen * 5}
              rx={3 + lipWide * 6}
              ry={0.5 + lipOpen * 4}
              fill="rgba(10, 5, 5, 0.9)"
              opacity={lipOpen * 0.6}
              clipPath="url(#mouthClip)"
              style={{ transition: 'all 0.06s ease-out' }}
            />
          </svg>
        )}
      </div>

      {/* Speaking glow effect */}
      {isSpeaking && (
        <div
          className="speaking-glow"
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${color}40, ${color}20)`,
            opacity: glowIntensity,
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease-out',
            zIndex: -1,
          }}
        />
      )}

      {/* Idle animations container */}
      <style>{`
        .animated-avatar {
          animation: subtle-sway 4s ease-in-out infinite;
          will-change: transform;
        }

        .animated-avatar .avatar-container {
          animation: breathing 3s ease-in-out infinite, micro-rotate 6s ease-in-out infinite;
          transform-origin: center center;
        }

        .animated-avatar.speaking .avatar-container {
          animation: speaking-pulse 0.3s ease-in-out infinite; /* Active speaking animation */
        }

        @keyframes breathing {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        @keyframes micro-rotate {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(0.5deg);
          }
          75% {
            transform: rotate(-0.5deg);
          }
        }

        @keyframes speaking-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.01);
          }
        }

        @keyframes subtle-sway {
          0%, 100% {
            transform: translateX(0) translateY(0);
          }
          25% {
            transform: translateX(${1 * cfg.swayScale}px) translateY(-${1 * cfg.swayScale}px);
          }
          50% {
            transform: translateX(0) translateY(0);
          }
          75% {
            transform: translateX(-${1 * cfg.swayScale}px) translateY(${1 * cfg.swayScale}px);
          }
        }

        .avatar-image {
          will-change: transform;
          transform: translateZ(0); /* GPU acceleration */
        }

        .animated-avatar .avatar-container {
          will-change: transform;
          transform: translateZ(0); /* GPU acceleration */
        }

        /* Blink eyelid animation */
        .blink-lid {
          pointer-events: none;
          border-radius: 8px;
          mix-blend-mode: multiply;
          will-change: transform, opacity;
        }
        .blink-lid.upper {
          transform-origin: top center;
          animation-name: blink-upper;
        }
        .blink-lid.lower {
          transform-origin: bottom center;
          animation-name: blink-lower;
        }
        @keyframes blink-upper {
          0%   { transform: scaleY(0); opacity: 0; animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1); }
          22%  { transform: scaleY(1); opacity: 1; }
          36%  { transform: scaleY(1); opacity: 1; animation-timing-function: cubic-bezier(0.1, 0.35, 0.2, 1); }
          100% { transform: scaleY(0); opacity: 0; }
        }
        @keyframes blink-lower {
          0%   { transform: scaleY(0); opacity: 0; animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1); }
          22%  { transform: scaleY(1); opacity: 1; }
          36%  { transform: scaleY(1); opacity: 1; animation-timing-function: cubic-bezier(0.1, 0.35, 0.2, 1); }
          100% { transform: scaleY(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}


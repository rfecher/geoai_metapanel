import React, { useEffect, useMemo, useRef, useState } from 'react';
import { personas } from '../data/personas';

export type VisemePose = { viseme: string; open: number; wide: number; round: number };

/**
 * BrandedAvatar
 *
 * Layered composition that keeps background + conference logo static,
 * while only the transparent avatar PNG (with facial animations) moves with subtle micro‑movements.
 */
export type BrandedAvatarProps = {
  personaId: string;
  name: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  isSpeaking?: boolean;
  isListening?: boolean;
  audioAmplitude?: number;
  visemePose?: VisemePose;
  faceAnchors?: {
    mouth: {
      xPct: number;
      yPct: number;
      sizePct: number;      // Legacy: used as default for widthPct if not set
      widthPct?: number;    // 20..80 (horizontal span of mouth overlay)
      heightPct?: number;   // 10..50 (vertical span of mouth overlay)
      rotationDeg?: number; // -45..45 (default 0) - rotation angle for asymmetric/smirk mouths
    };
    eyes?: { yPct: number; heightPct?: number };
    eyeSeparationPct?: number; // 18..34 (percentage of avatar width between pupil centers)
    pupilSizeScale?: number;   // 0.3..1.3 multiplier for pupil overlay size
    eyeScale?: number;         // 0.5..2.0 global multiplier for eye features
    eyeWidthPct?: number;      // 6..22 (horizontal span of each eyelid/pupil region)
    eyeCenterOffsetPct?: number; // -15..15 (horizontal offset from image center)
    leftPupilYPct?: number;    // Left pupil Y position as % (independent vertical position)
    rightPupilYPct?: number;   // Right pupil Y position as % (independent vertical position)
  };
  animationConfig?: {
    mouthGain?: number;
    mouthSmoothing?: number;
    minOpen?: number;
    maxOpen?: number;
    mouthCavityThreshold?: number; // 0..0.5 (default 0.1) - lipOpen threshold below which mouth cavity is hidden
    blinkRateSec?: number;
    blinkJitterPct?: number;
    headSwayPx?: number;
    headTiltDeg?: number;
    nodThreshold?: number;
    nodMaxDeg?: number;
    headOriginYPx?: number;
    gazeEnabled?: boolean;
    gazeIntervalSec?: number;
    gazeLateralPx?: number;
    gazeVerticalPx?: number;
    lidCoupleThresholdPx?: number;
    dilationEnabled?: boolean;
    dilationRangeLPx?: number;
    dilationRangeRPx?: number;
    dilationPeriodSec?: number;
    mouthScale?: number;
    showTeethHint?: boolean; // if false, hides subtle teeth hint layer
    teethThreshold?: number; // 0.15..0.5 (default 0.25) - lipOpen threshold above which teeth hint appears
    teethMaxOpacity?: number; // 0.3..1.0 (default 0.85) - maximum opacity for teeth hint
    teethSizeMultiplier?: number; // 0.5..1.5 (default 1.0) - scales teeth ellipse rx/ry
    maxPupilOffsetX?: number;  // 0..2.0 (max horizontal pupil movement as % of avatar width)
    maxPupilOffsetY?: number;  // 0..1.5 (max vertical pupil movement as % of avatar height)
  };
  className?: string;
};

const SIZE = {
  small: { w: 110, h: 110 },
  medium: { w: 240, h: 240 },
  large: { w: 384, h: 384 },
  xlarge: { w: 512, h: 512 },
} as const;

const BACKDROP_URL = '/avatars/unsplash-image-isg8AL7-6uk.png';
const LOGO_URL = '/avatars/FOSS4G+NA+2025_Logo_600x600.png';

export default function BrandedAvatar({
  personaId,
  name,
  size = 'medium',
  isSpeaking = false,
  isListening = false,
  audioAmplitude = 0,
  visemePose,
  faceAnchors,
  animationConfig,
  className = '',
}: BrandedAvatarProps) {
  const { w, h } = SIZE[size];
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const mouthRef = useRef<HTMLDivElement>(null);
  const pupilLRef = useRef<HTMLDivElement>(null);
  const pupilRRef = useRef<HTMLDivElement>(null);
  const lidULRef = useRef<HTMLDivElement>(null);
  const lidURRef = useRef<HTMLDivElement>(null);
  const lidLLRef = useRef<HTMLDivElement>(null);
  const lidLRRef = useRef<HTMLDivElement>(null);

  const [motion, setMotion] = useState({ tx: 0, ty: 0, rot: 0, scale: 1 });
  const [blink, setBlink] = useState(false);
  const [listeningNod, setListeningNod] = useState(0);
  const [gazeOffset, setGazeOffset] = useState({ dx: 0, dy: 0 });
  const [pupilSizes, setPupilSizes] = useState({ l: 4, r: 3 });
  const [pupilTransitionsEnabled, setPupilTransitionsEnabled] = useState(false);

  // Config with defaults
  const cfg = useMemo(() => ({
    mouthGain: animationConfig?.mouthGain ?? 1,
    mouthSmoothing: Math.min(Math.max(animationConfig?.mouthSmoothing ?? 0.18, 0), 0.95),
    minOpen: animationConfig?.minOpen ?? 0.05,
    maxOpen: animationConfig?.maxOpen ?? 1,
    mouthCavityThreshold: Math.max(0, Math.min(0.5, animationConfig?.mouthCavityThreshold ?? 0.1)),
    blinkRateSec: animationConfig?.blinkRateSec ?? 4,
    blinkJitterPct: animationConfig?.blinkJitterPct ?? 0.5,
    headSwayPx: Math.max(0, Math.min(5.0, animationConfig?.headSwayPx ?? 2.5)),
    headTiltDeg: Math.max(0, Math.min(4.0, animationConfig?.headTiltDeg ?? 1.8)),
    nodThreshold: Math.max(0.3, Math.min(0.9, animationConfig?.nodThreshold ?? 0.65)),
    nodMaxDeg: Math.max(0, Math.min(3.0, animationConfig?.nodMaxDeg ?? 1.5)),
    headOriginYPx: Math.max(140, Math.min(200, animationConfig?.headOriginYPx ?? 170)),
    gazeEnabled: animationConfig?.gazeEnabled ?? true,
    gazeIntervalSec: Math.max(2, Math.min(12, animationConfig?.gazeIntervalSec ?? 5)),
    gazeLateralPx: Math.max(0, Math.min(20, animationConfig?.gazeLateralPx ?? 3)),
    gazeVerticalPx: Math.max(0, Math.min(15, animationConfig?.gazeVerticalPx ?? 1.2)),
    lidCoupleThresholdPx: Math.max(2, Math.min(5, animationConfig?.lidCoupleThresholdPx ?? 3)),
    dilationEnabled: animationConfig?.dilationEnabled ?? true,
    dilationRangeLPx: Math.max(0, Math.min(1.0, animationConfig?.dilationRangeLPx ?? 0.4)),
    dilationRangeRPx: Math.max(0, Math.min(1.0, animationConfig?.dilationRangeRPx ?? 0.4)),
    dilationPeriodSec: Math.max(5, Math.min(20, animationConfig?.dilationPeriodSec ?? 11)),
    maxPupilOffsetX: Math.max(0, Math.min(2.0, animationConfig?.maxPupilOffsetX ?? 0.8)),
    maxPupilOffsetY: Math.max(0, Math.min(1.5, animationConfig?.maxPupilOffsetY ?? 0.5)),
    showTeethHint: animationConfig?.showTeethHint ?? true,
    teethThreshold: Math.max(0.15, Math.min(0.5, animationConfig?.teethThreshold ?? 0.25)),
    teethMaxOpacity: Math.max(0.3, Math.min(1.0, animationConfig?.teethMaxOpacity ?? 0.85)),
    teethSizeMultiplier: Math.max(0.5, Math.min(1.5, animationConfig?.teethSizeMultiplier ?? 1.0)),
  }), [animationConfig]);

  // Envelope smoothing for amplitude
  const envRef = useRef(0);
  const effective = Math.min(cfg.maxOpen, Math.max(cfg.minOpen, (audioAmplitude || 0) * cfg.mouthGain));
  const nextEnv = envRef.current * cfg.mouthSmoothing + effective * (1 - cfg.mouthSmoothing);
  const smoothedAmp = (envRef.current = nextEnv);

  // Derived mouth params

  const lipOpen = visemePose ? Math.min(cfg.maxOpen, Math.max(cfg.minOpen, visemePose.open)) : smoothedAmp;
  const lipWide = visemePose ? visemePose.wide : smoothedAmp * 0.6;
  const lipRound = visemePose ? visemePose.round : 0;

  // Use -transparent.png files which have transparent background and pupils removed
  const avatarUrl = useMemo(() => `/avatars/${personaId}-transparent.png`, [personaId]);

  // Get eye color from persona definition (default to brown if not specified)
  const eyeColor = useMemo(() => {
    const persona = personas.find(p => p.id === personaId);
    return persona?.eyeColor ?? '#6B4E3D'; // Default brown
  }, [personaId]);

  // Default face anchors if not provided
  // TEMP: Debug teeth condition and lipOpen values (remove when verified)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__AVATAR_DEBUG) {
      const ok = cfg.showTeethHint && lipOpen > cfg.teethThreshold;
      // eslint-disable-next-line no-console
      console.debug('[BrandedAvatar] lipOpen:', lipOpen.toFixed(2), 'showTeethHint:', cfg.showTeethHint, 'teethCond:', ok, 'threshold:', cfg.teethThreshold.toFixed(2));
    }
  }, [lipOpen, cfg.showTeethHint]);

  const mouth = faceAnchors?.mouth ?? { xPct: 50, yPct: 55, sizePct: 40 };
  const eyes = faceAnchors?.eyes ?? { yPct: 35, heightPct: 12 };

  // Eye calibration parameters (matching AnimatedAvatar defaults)
  const eyeSeparationPct = faceAnchors?.eyeSeparationPct ?? 26; // Distance between pupils as % of width
  const eyeCenterOffsetPct = faceAnchors?.eyeCenterOffsetPct ?? 0; // Horizontal offset from center
  const eyeWidthPct = faceAnchors?.eyeWidthPct ?? ((eyes.heightPct ?? 12) * 1.5); // Width of each eye region
  const eyeScale = faceAnchors?.eyeScale ?? 1.0;
  const pupilSizeScale = faceAnchors?.pupilSizeScale ?? 1.0;
  const mouthScale = animationConfig?.mouthScale ?? 1.0;

  // Calculate pixel positions from percentages (matching AnimatedAvatar approach)
  // Mouth: direct percentage positioning
  const mouthXPct = mouth.xPct;
  const mouthYPct = mouth.yPct;

  // Mouth dimensions with separate width and height control
  // Backward compatible: if widthPct not set, fall back to sizePct * 0.30 (legacy behavior)
  const mouthWidthPct = mouth.widthPct ?? Math.max(16, mouth.sizePct * 0.30 * mouthScale);
  // Height control: if heightPct not set, use default of 14% (typical mouth height relative to face)
  const mouthHeightPct = mouth.heightPct ?? 14;

  // Mouth rotation for asymmetric/smirk mouths (default: 0)
  const mouthRotationDeg = mouth.rotationDeg ?? 0;

  // Eyes: positioned relative to center with separation
  const eyeYPct = eyes.yPct;
  const eyeHeightPct = eyes.heightPct ?? 12;
  const eyeLeftXPct = 50 + eyeCenterOffsetPct - (eyeSeparationPct / 2);
  const eyeRightXPct = 50 + eyeCenterOffsetPct + (eyeSeparationPct / 2);

  // Independent pupil Y positions (with backward compatibility fallback to shared eyeYPct)
  const leftPupilYPct = faceAnchors?.leftPupilYPct ?? eyeYPct;
  const rightPupilYPct = faceAnchors?.rightPupilYPct ?? eyeYPct;

  // REDUCED: eyeHeightPct * 0.5 → 0.35 (30% reduction) to fix oversized pupils
  // Pupil sizes as percentage of container
  const pupilSizePct = Math.max(2.0, eyeHeightPct * 0.35 * pupilSizeScale) * eyeScale;

  // Convert percentage gaze offsets to pixels relative to fixed container size
  const gazeDxPx = useMemo(() => (gazeOffset.dx / 100) * w, [gazeOffset.dx, w]);
  const gazeDyPx = useMemo(() => (gazeOffset.dy / 100) * h, [gazeOffset.dy, h]);

  // REDUCED: eyeWidthPct * 1.0 → 0.7 → 0.5 (50% total reduction) for eyelid width
  // REDUCED: eyeHeightPct / 2 → eyeHeightPct * 0.3 (40% reduction) for eyelid height
  // Eyelid dimensions as percentage
  const eyelidWidthPct = Math.max(6, Math.min(22, eyeWidthPct * 0.5 * eyeScale));
  const eyelidHeightPct = eyeHeightPct * 0.3;

  // Enable pupil transitions after initial mount to prevent visible transition on first render
  useEffect(() => {
    const timer = setTimeout(() => {
      setPupilTransitionsEnabled(true);
    }, 50); // Small delay to ensure initial layout is complete
    return () => clearTimeout(timer);
  }, []);

  // When an avatar starts speaking, temporarily disable transitions to avoid any flicker during panel activation
  useEffect(() => {
    if (!isSpeaking) return;
    setPupilTransitionsEnabled(false);
    const t = setTimeout(() => setPupilTransitionsEnabled(true), 300);
    return () => clearTimeout(t);
  }, [isSpeaking]);

  // Blink scheduler
  useEffect(() => {
    let timer: any;
    const schedule = () => {
      const mean = cfg.blinkRateSec * 1000;
      const jitter = Math.max(0, cfg.blinkJitterPct);
      const min = Math.max(250, mean * (1 - jitter));
      const max = mean * (1 + jitter);
      const delay = min + Math.random() * (max - min);
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 160);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [cfg.blinkRateSec, cfg.blinkJitterPct]);

  // Listening animation scheduler
  useEffect(() => {
    if (!isListening || isSpeaking) return;
    let timer: any;
    const schedule = () => {
      const delay = 3000 + Math.random() * 5000;
      timer = setTimeout(() => {
        setListeningNod(prev => prev + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [isListening, isSpeaking]);

  // Head micro-movement (only affects avatar image, not container)
  useEffect(() => {
    let raf = 0;
    const startTime = performance.now(); // Track elapsed time from mount
    let lastT = 0; // Start at 0 for predictable initial values
    let impulse = 0;
    let impulseVel = 0;
    let cooldown = 0;
    let lastListeningNod = listeningNod;

    // Random phase offsets for variety, but we'll use elapsed time so initial frame is always zero
    const phx = Math.random() * Math.PI * 2;
    const phy = Math.random() * Math.PI * 2;
    const prt = Math.random() * Math.PI * 2;

    // Brief startup delay to ensure component renders in neutral position first
    const startupDelay = 150; // ms

    // Natural amplitude ramp-up parameters
    // The avatar "eases into" its idle state over 1.2-1.8 seconds
    const rampUpDuration = 1200 + Math.random() * 600; // 1.2-1.8 seconds

    let animationStarted = false;

    const loop = (now: number) => {
      const elapsed = now - startTime;

      // Don't start animating until after startup delay
      if (elapsed < startupDelay) {
        setMotion({ tx: 0, ty: 0, rot: 0, scale: 1 });
        raf = requestAnimationFrame(loop);
        return;
      }

      if (!animationStarted) {
        animationStarted = true;
        lastT = elapsed; // Initialize lastT when animation actually starts
      }

      const t = elapsed - startupDelay; // Time since animation started (always starts at 0)
      const dt = t - lastT;
      lastT = t;

      const speakLevel = Math.max(smoothedAmp, isSpeaking ? 0.4 : 0);
      const idleGain = Math.max(0.15, 1 - speakLevel * 0.9);

      // Natural amplitude ramp-up: gradually increase from 0 to full strength
      // Uses a smooth ease-out curve that mimics natural settling behavior
      let amplitudeMultiplier = 1.0;
      if (t < rampUpDuration) {
        const progress = t / rampUpDuration;
        // Smooth ease-out: starts slow, accelerates, then gently settles
        // This feels like the avatar is naturally "coming to life" rather than jumping into motion
        amplitudeMultiplier = progress * progress * (3 - 2 * progress); // Smoothstep function
      }

      // Multi-layer motion - now t starts at 0, so initial values are determined purely by phases
      // The amplitude multiplier scales the entire natural motion system organically
      let tx = (Math.sin(t * 0.00036 + phx) * 1.1 + Math.sin(t * 0.00093 + phx * 0.7) * 0.35) * idleGain * cfg.headSwayPx * amplitudeMultiplier;
      let ty = (Math.sin(t * 0.00028 + phy) * 1.0 + Math.sin(t * 0.00081 + phy * 0.6) * 0.25) * idleGain * cfg.headSwayPx * amplitudeMultiplier;
      const baseTilt = Math.sin(t * 0.00018 + prt) * cfg.headTiltDeg * idleGain * amplitudeMultiplier;

      // Emphasis nod impulse
      cooldown = Math.max(0, cooldown - dt);
      const spike = smoothedAmp > cfg.nodThreshold && cooldown === 0;
      if (spike) {
        impulseVel += 0.012 + Math.random() * 0.008;
        cooldown = 1800 + Math.random() * 1400;
      }

      // Listening nod impulse
      if (listeningNod !== lastListeningNod && cooldown === 0) {
        impulseVel += 0.008 + Math.random() * 0.004;
        cooldown = 2000 + Math.random() * 1000;
        lastListeningNod = listeningNod;
      }

      impulse += impulseVel * dt;
      impulseVel += (-0.015 * impulse - 0.008 * impulseVel) * dt;
      const maxImp = cfg.nodMaxDeg * (isSpeaking ? 1 : 0.6);
      impulse = Math.max(-maxImp, Math.min(maxImp, impulse));

      const totalRotate = baseTilt + impulse;
      // Apply amplitude ramp-up to scale animation as well for complete consistency
      const scaleVariation = Math.sin(t * 0.00022 + prt) * 0.005 * (0.6 + 0.4 * idleGain) * amplitudeMultiplier;
      const scale = 1.01 + scaleVariation;

      setMotion({ tx, ty, rot: totalRotate, scale });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [smoothedAmp, isSpeaking, listeningNod, cfg]);

  // Gaze shifts (using percentage-based offsets matching AnimatedAvatar)
  useEffect(() => {
    if (!cfg.gazeEnabled) return;
    let alive = true;
    let timer: any;

    const schedule = () => {
      if (!alive) return;
      const mean = cfg.gazeIntervalSec * 1000;
      const jitter = 0.3 + Math.random() * 0.6;
      const baseDelay = mean * jitter;
      const delay = isSpeaking ? baseDelay * 1.5 : baseDelay;
      timer = setTimeout(() => shift(), delay);
    };

    const shift = () => {
      if (!alive) return;
      // Use per-persona calibrated pupil movement constraints
      // These values are calibrated for each avatar's specific eye dimensions
      const dx = (Math.random() * 2 - 1) * cfg.maxPupilOffsetX;
      const dy = (Math.random() * 2 - 1) * cfg.maxPupilOffsetY;
      const holdMs = 2000 + Math.random() * 2000;

      setGazeOffset({ dx, dy });

      setTimeout(() => {
        setGazeOffset({ dx: 0, dy: 0 });
        schedule();
      }, holdMs);
    };

    // Add initial delay before first gaze shift to prevent immediate movement on mount
    const initialDelay = 1500 + Math.random() * 2000; // 1.5-3.5 seconds
    timer = setTimeout(() => schedule(), initialDelay);

    return () => { alive = false; clearTimeout(timer); };
  }, [isSpeaking, cfg.gazeEnabled, cfg.gazeIntervalSec]);

  // Pupil dilation
  useEffect(() => {
    if (!cfg.dilationEnabled) return;
    let raf = 0;
    const baseL = 4;
    const baseR = 3;
    const phaseL = Math.random() * Math.PI * 2;
    const phaseR = Math.random() * Math.PI * 2;
    const periodMean = cfg.dilationPeriodSec * 1000;
    const periodL = periodMean * (0.7 + Math.random() * 0.6);
    const periodR = periodMean * (0.7 + Math.random() * 0.6);

    const loop = (t: number) => {
      const dL = Math.sin((t + phaseL) / periodL * Math.PI * 2);
      const dR = Math.sin((t + phaseR) / periodR * Math.PI * 2);
      const l = baseL + dL * cfg.dilationRangeLPx;
      const r = baseR + dR * cfg.dilationRangeRPx;
      setPupilSizes({ l, r });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cfg.dilationEnabled, cfg.dilationRangeLPx, cfg.dilationRangeRPx, cfg.dilationPeriodSec]);




  // Debug logging for mouth rotation
  useEffect(() => {
    console.log('[BrandedAvatar] Mouth rotation updated:', {
      personaId,
      rotationDeg: mouthRotationDeg,
      faceAnchors: faceAnchors?.mouth
    });
  }, [mouthRotationDeg, personaId, faceAnchors]);

  // Mouth animation parameters (matching AnimatedAvatar approach)
  // The mouth is rendered as an SVG viewBox, so we work in normalized coordinates
  // Base ellipse dimensions in viewBox units (100x50 viewBox)
  const mouthBaseRx = 40; // Base horizontal radius in viewBox units
  // Scale base vertical radius by mouthHeightPct (default 14% → 10.5 units, range 3-50% → 2.25-37.5 units)
  const mouthBaseRy = (mouthHeightPct / 14) * 10.5; // Scale from default 10.5 units based on heightPct

  // Animate based on lip parameters
  const mouthRx = mouthBaseRx + lipWide * (mouthBaseRx * 0.3) + (1 - lipRound) * 5;
  const mouthRy = mouthBaseRy + lipOpen * (mouthBaseRy * 0.8) + lipRound * 8;
  const mouthCy = 25 + lipOpen * 5; // Center Y in viewBox coordinates

  return (
    <div
      className={`branded-avatar ${className}`}
      style={{ width: w, height: h, position: 'relative', borderRadius: 12, overflow: 'hidden' }}
      aria-label={name}
      title={name}
    >
      {/* Static backdrop (brand) */}
      <div
        className="brand-backdrop"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <img
          src={BACKDROP_URL}
          alt="Conference backdrop"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '5% 35%', // Position reference point in upper-center area
            transform: 'scale(1.9)', // Zoom in significantly to make monument more prominent and recognizable
            transformOrigin: '50% 35%', // Zoom from the upper-center where monument is located
            filter: 'saturate(0.95) brightness(0.9) contrast(1.05)',
          }}
        />
      </div>

      {/* Soft vignette for focus */}
      <div
        className="brand-vignette"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 100% at 50% 80%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Static logo (brand) */}
      <img
        className="brand-logo"
        src={LOGO_URL}
        alt="FOSS4G NA 2025"
        style={{
          position: 'absolute',
          top: 1,
          left: 1,
          width: Math.round(w * 0.38),
          height: Math.round(w * 0.38),
          objectFit: 'contain',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
        }}
      />

      {/* Moving avatar container (only this moves with micro-movements) */}
      <div
        ref={avatarContainerRef}
        className="avatar-motion-layer"
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${motion.tx.toFixed(2)}px, ${motion.ty.toFixed(2)}px) rotate(${motion.rot.toFixed(2)}deg) scale(${motion.scale.toFixed(3)})`,
          transformOrigin: '50% 80%',
          willChange: 'transform',
        }}
      >
        {/* Avatar image */}
        <img
          className="avatar-portrait"
          src={avatarUrl}
          alt={name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />

        {/* Facial feature overlays */}
        {/* Mouth overlay (SVG-based, matching AnimatedAvatar) */}
        <svg
          ref={mouthRef as any}
          className="mouth-overlay"
          style={{
            position: 'absolute',
            top: `${mouthYPct}%`,
            left: `${mouthXPct}%`,
            transform: `translate(-50%, -50%) rotate(${mouthRotationDeg}deg)`,
            transformOrigin: 'center center',
            width: `${mouthWidthPct}%`,
            pointerEvents: 'none',
            opacity: 0.9,
          }}
          viewBox="0 0 100 50"
        >
          <defs>
            {/* Outer lip gradient - natural lip color tones */}
            <radialGradient id={`lipOuter-${personaId}`} cx="50%" cy="40%">
              <stop offset="0%" stopColor="rgba(180, 100, 100, 0.6)" />
              <stop offset="60%" stopColor="rgba(140, 70, 70, 0.7)" />
              <stop offset="100%" stopColor="rgba(100, 50, 50, 0.5)" />
            </radialGradient>

            {/* Transition gradient - blends from lip color to dark cavity */}
            <radialGradient id={`mouthTransition-${personaId}`} cx="50%" cy="42%">
              <stop offset="0%" stopColor="rgba(80, 45, 45, 0.7)" />
              <stop offset="40%" stopColor="rgba(60, 30, 30, 0.8)" />
              <stop offset="70%" stopColor="rgba(45, 20, 20, 0.85)" />
              <stop offset="100%" stopColor="rgba(30, 12, 12, 0.8)" />
            </radialGradient>

            {/* Inner mouth gradient - darker for depth */}
            <radialGradient id={`mouthInner-${personaId}`} cx="50%" cy="45%">
              <stop offset="0%" stopColor="rgba(40, 15, 15, 0.85)" />
              <stop offset="50%" stopColor="rgba(20, 8, 8, 0.95)" />
              <stop offset="100%" stopColor="rgba(10, 5, 5, 0.75)" />
            </radialGradient>

            {/* Teeth fill - off-white ivory with subtle vertical shading */}
            <linearGradient id={`teethFill-${personaId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 252, 0.98)" />
              <stop offset="60%" stopColor="rgba(250, 248, 244, 0.96)" />
              <stop offset="100%" stopColor="rgba(240, 236, 230, 0.92)" />
            </linearGradient>

            {/* Inner rim highlight - subtle warm rim just inside the lips */}
            <linearGradient id={`innerRim-${personaId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 200, 180, 0.18)" />
              <stop offset="100%" stopColor="rgba(255, 200, 180, 0)" />
            </linearGradient>

            {/* Lip highlight gradient for 3D effect */}
            <linearGradient id={`lipHighlight-${personaId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(200, 120, 120, 0.3)" />
              <stop offset="40%" stopColor="rgba(160, 90, 90, 0.15)" />
              <stop offset="100%" stopColor="rgba(120, 60, 60, 0.05)" />
            </linearGradient>

            {/* Lip line gradient: subtle shadow for closed mouth appearance */}
            <linearGradient id={`lipLine-${personaId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(58, 36, 32, 0)" />
              <stop offset="35%" stopColor="rgba(45, 27, 24, 0.45)" />
              <stop offset="50%" stopColor="rgba(31, 18, 16, 0.65)" />
              <stop offset="65%" stopColor="rgba(45, 27, 24, 0.45)" />
              <stop offset="100%" stopColor="rgba(58, 36, 32, 0)" />
            </linearGradient>

            <clipPath id={`mouthClip-${personaId}`}>
              <ellipse cx="50" cy="25" rx="40" ry="15" />
            </clipPath>
          </defs>

          {/* Subtle lip line: visible when mouth is closed to suggest lip seam */}
          <ellipse
            cx="50"
            cy={25}
            rx={mouthBaseRx * 0.45}
            ry={0.6}
            fill={`url(#lipLine-${personaId})`}
            opacity={
              lipOpen < cfg.mouthCavityThreshold
                ? Math.max(0.5, 0.75 - (lipOpen / cfg.mouthCavityThreshold) * 0.25)
                : Math.max(0, 0.5 - ((lipOpen - cfg.mouthCavityThreshold) / (1 - cfg.mouthCavityThreshold)) * 0.5)
            }
            style={{ transition: 'opacity 120ms ease-out' }}
          />

          {/* Outer lip area - natural lip color (ENLARGED for more prominence) */}
          <ellipse
            cx="50"
            cy={mouthCy}
            rx={mouthRx * 1.35}
            ry={mouthRy * 1.35}
            fill={`url(#lipOuter-${personaId})`}
            clipPath={`url(#mouthClip-${personaId})`}
            opacity={Math.min(0.95, 0.8 + lipOpen * 0.15)}
          />


          {/* Inner mouth opening - dark for depth (only visible when lipOpen exceeds threshold) */}
          {/* Reshaped to be more horizontally elongated (wider rx) and vertically compressed (narrower ry) */}
          {lipOpen >= cfg.mouthCavityThreshold && (
            <ellipse
              cx="50"
              cy={mouthCy + lipOpen * 2}
              rx={mouthRx * 0.55}
              ry={mouthRy * 0.35}
              fill={`url(#mouthInner-${personaId})`}
              clipPath={`url(#mouthClip-${personaId})`}
              opacity={Math.min(0.95, 0.7 + lipOpen * 0.2)}
            />
          )}

          {/* Teeth hint - subtle upper incisors (rendered above dark cavity, below transition) */}
          {cfg.showTeethHint && lipOpen > cfg.teethThreshold && (
            <ellipse
              cx="50"
              cy={mouthCy + lipOpen * 1.2 - mouthRy * 0.35}
              rx={mouthRx * (0.6 + lipWide * 0.12) * (0.9 + Math.min(1, Math.max(0, (lipOpen - cfg.teethThreshold) / 0.4)) * 0.3) * cfg.teethSizeMultiplier}
              ry={Math.max(0.3, mouthRy * (0.16 + Math.min(1, Math.max(0, (lipOpen - cfg.teethThreshold) / 0.4)) * 0.16) * cfg.teethSizeMultiplier)}
              fill={`url(#teethFill-${personaId})`}
              clipPath={`url(#mouthClip-${personaId})`}
              opacity={Math.min(cfg.teethMaxOpacity, 0.15 + Math.min(1, Math.max(0, (lipOpen - cfg.teethThreshold) / 0.4)) * 0.7)}
            />
          )}

          {/* Transition layer - smooth blend from lip color to cavity (only visible when lipOpen exceeds threshold) */}
          {lipOpen >= cfg.mouthCavityThreshold && (
            <ellipse
              cx="50"
              cy={mouthCy + lipOpen * 1.2}
              rx={mouthRx * 0.85}
              ry={mouthRy * 0.65}
              fill={`url(#mouthTransition-${personaId})`}
              clipPath={`url(#mouthClip-${personaId})`}
              opacity={Math.min(0.9, 0.65 + lipOpen * 0.15)}
            />
          )}

          {/* Inner rim highlight - subtle warm rim just inside upper lip */}
          {lipOpen > 0.12 && (
            <ellipse
              cx="50"
              cy={mouthCy - lipOpen * 0.2}
              rx={mouthRx * 1.1}
              ry={mouthRy * 0.6}
              fill={`url(#innerRim-${personaId})`}
              clipPath={`url(#mouthClip-${personaId})`}
              opacity={Math.max(0, 0.22 - lipOpen * 0.12)}
            />
          )}

          {/* Upper lip highlight for 3D effect (ENLARGED to match outer lip) */}
          <ellipse
            cx="50"
            cy={mouthCy - lipOpen * 0.5}
            rx={mouthRx * 1.1}
            ry={mouthRy * 0.75}
            fill={`url(#lipHighlight-${personaId})`}
            clipPath={`url(#mouthClip-${personaId})`}
            opacity={0.45 - lipOpen * 0.15}
          />
        </svg>



        {/* Eyes - Left pupil with iris (percentage-based positioning with independent Y) */}
        {cfg.gazeEnabled && (
          <>
            {/* Iris layer (outer colored ring) */}
            <div
              className="iris-left"
              style={{
                position: 'absolute',
                top: `${leftPupilYPct}%`,
                left: `${eyeLeftXPct}%`,
                transform: `translate(-50%, -50%) translate(${gazeDxPx.toFixed(2)}px, ${gazeDyPx.toFixed(2)}px)`,
                width: `${pupilSizePct * 1.8}%`,
                height: `${pupilSizePct * 1.8}%`,
                borderRadius: '50%',
                background: `radial-gradient(circle at 40% 40%, ${eyeColor}dd, ${eyeColor}cc 50%, ${eyeColor}99 80%, ${eyeColor}66 100%)`,
                opacity: 0.65,
                filter: 'blur(0.4px)',
                transition: pupilTransitionsEnabled ? 'transform 220ms ease-out' : 'none',
                pointerEvents: 'none',
                zIndex: 9,
              }}
            />
            {/* Pupil layer (inner black center) */}
            <div
              ref={pupilLRef}
              className="pupil-left"
              style={{
                position: 'absolute',
                top: `${leftPupilYPct}%`,
                left: `${eyeLeftXPct}%`,
                transform: `translate(-50%, -50%) translate(${gazeDxPx.toFixed(2)}px, ${gazeDyPx.toFixed(2)}px)`,
                width: `${pupilSizePct}%`,
                height: `${pupilSizePct}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 40%, rgba(20, 15, 10, 0.85), rgba(10, 8, 6, 0.95) 60%, rgba(0, 0, 0, 0.7) 100%)',
                opacity: 0.75,
                filter: 'blur(0.3px)',
                transition: pupilTransitionsEnabled ? 'transform 220ms ease-out' : 'none',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
          </>
        )}

        {/* Eyes - Right pupil with iris (percentage-based positioning with independent Y) */}
        {cfg.gazeEnabled && (
          <>
            {/* Iris layer (outer colored ring) */}
            <div
              className="iris-right"
              style={{
                position: 'absolute',
                top: `${rightPupilYPct}%`,
                left: `${eyeRightXPct}%`,
                transform: `translate(-50%, -50%) translate(${gazeDxPx.toFixed(2)}px, ${gazeDyPx.toFixed(2)}px)`,
                width: `${pupilSizePct * 1.8}%`,
                height: `${pupilSizePct * 1.8}%`,
                borderRadius: '50%',
                background: `radial-gradient(circle at 40% 40%, ${eyeColor}dd, ${eyeColor}cc 50%, ${eyeColor}99 80%, ${eyeColor}66 100%)`,
                opacity: 0.65,
                filter: 'blur(0.4px)',
                transition: pupilTransitionsEnabled ? 'transform 220ms ease-out' : 'none',
                pointerEvents: 'none',
                zIndex: 9,
              }}
            />
            {/* Pupil layer (inner black center) */}
            <div
              ref={pupilRRef}
              className="pupil-right"
              style={{
                position: 'absolute',
                top: `${rightPupilYPct}%`,
                left: `${eyeRightXPct}%`,
                transform: `translate(-50%, -50%) translate(${gazeDxPx.toFixed(2)}px, ${gazeDyPx.toFixed(2)}px)`,
                width: `${pupilSizePct}%`,
                height: `${pupilSizePct}%`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 40%, rgba(20, 15, 10, 0.85), rgba(10, 8, 6, 0.95) 60%, rgba(0, 0, 0, 0.7) 100%)',
                opacity: 0.75,
                filter: 'blur(0.3px)',
                transition: pupilTransitionsEnabled ? 'transform 220ms ease-out' : 'none',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
          </>
        )}

        {/* Eyelids - Upper Left (percentage-based positioning) */}
        <div
          ref={lidULRef}
          className="eyelid-upper-left"
          style={{
            position: 'absolute',
            top: `${Math.max(0, eyeYPct - (eyelidHeightPct / 2))}%`,
            left: `${eyeLeftXPct}%`,
            transform: `translateX(-50%) scaleY(${blink ? 1 : 0})`,
            transformOrigin: 'top center',
            width: `${eyelidWidthPct}%`,
            height: `${eyelidHeightPct}%`,
            borderRadius: '999px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
            opacity: blink ? 1 : 0,
            transition: `transform ${blink ? 85 : 140}ms linear, opacity ${blink ? 85 : 140}ms linear`,
            pointerEvents: 'none',
          }}
        />

        {/* Eyelids - Upper Right (percentage-based positioning) */}
        <div
          ref={lidURRef}
          className="eyelid-upper-right"
          style={{
            position: 'absolute',
            top: `${Math.max(0, eyeYPct - (eyelidHeightPct / 2))}%`,
            left: `${eyeRightXPct}%`,
            transform: `translateX(-50%) scaleY(${blink ? 1 : 0})`,
            transformOrigin: 'top center',
            width: `${eyelidWidthPct}%`,
            height: `${eyelidHeightPct}%`,
            borderRadius: '999px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
            opacity: blink ? 1 : 0,
            transition: `transform ${blink ? 85 : 140}ms linear, opacity ${blink ? 85 : 140}ms linear`,
            pointerEvents: 'none',
          }}
        />

        {/* Eyelids - Lower Left (percentage-based positioning) */}
        <div
          ref={lidLLRef}
          className="eyelid-lower-left"
          style={{
            position: 'absolute',
            top: `${eyeYPct}%`,
            left: `${eyeLeftXPct}%`,
            transform: `translateX(-50%) scaleY(${blink ? 1 : 0})`,
            transformOrigin: 'bottom center',
            width: `${eyelidWidthPct * 0.92}%`,
            height: `${eyelidHeightPct}%`,
            borderRadius: '999px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
            opacity: blink ? 1 : 0,
            transition: `transform ${blink ? 85 : 140}ms linear, opacity ${blink ? 85 : 140}ms linear`,
            pointerEvents: 'none',
          }}
        />

        {/* Eyelids - Lower Right (percentage-based positioning) */}
        <div
          ref={lidLRRef}
          className="eyelid-lower-right"
          style={{
            position: 'absolute',
            top: `${eyeYPct}%`,
            left: `${eyeRightXPct}%`,
            transform: `translateX(-50%) scaleY(${blink ? 1 : 0})`,
            transformOrigin: 'bottom center',
            width: `${eyelidWidthPct * 0.92}%`,
            height: `${eyelidHeightPct}%`,
            borderRadius: '999px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.18))',
            opacity: blink ? 1 : 0,
            transition: `transform ${blink ? 85 : 140}ms linear, opacity ${blink ? 85 : 140}ms linear`,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Optional speaking halo (subtle, static container) */}
      {isSpeaking && (
        <div
          className="speaking-halo"
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 3px rgba(59,130,246,0.25)',
            borderRadius: 12,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}


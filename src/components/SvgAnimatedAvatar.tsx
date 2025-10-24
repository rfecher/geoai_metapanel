import React, { useEffect, useMemo, useRef, useState } from 'react';

export type VisemePose = { viseme: string; open: number; wide: number; round: number };

type Props = {
  name: string;
  color: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  svgUrl: string; // inline this SVG for DOM control
  isSpeaking?: boolean;
  isListening?: boolean; // NEW: Show subtle engagement animations when not speaking
  audioAmplitude?: number; // 0..1
  visemePose?: VisemePose;
  animationConfig?: {
    // Existing
    mouthGain?: number;
    mouthSmoothing?: number; // 0..0.95
    minOpen?: number;
    maxOpen?: number;
    blinkRateSec?: number;
    blinkJitterPct?: number;
    // New: head micro-movement
    headSwayPx?: number;        // 0..5.0 (default 2.5) - increased for more visible movement
    headTiltDeg?: number;       // 0..4.0 (default 1.8) - increased for more visible rotation
    nodThreshold?: number;      // 0.3..0.9 (default 0.65)
    nodMaxDeg?: number;         // 0..3.0 (default 1.5) - increased for more visible nods
    headOriginYPx?: number;     // 140..200 (default 170)
    // New: gaze shifts
    gazeEnabled?: boolean;      // default true
    gazeIntervalSec?: number;   // 2..12 (default 5)
    gazeLateralPx?: number;     // 0..6 (default 3)
    gazeVerticalPx?: number;    // 0..4 (default 1.2)
    lidCoupleThresholdPx?: number; // 2..5 (default 3)
    // New: pupil dilation
    dilationEnabled?: boolean;  // default true
    dilationRangeLPx?: number;  // 0..1.0 (default 0.4)
    dilationRangeRPx?: number;  // 0..1.0 (default 0.4)
    dilationPeriodSec?: number; // 5..20 (default 11)
  };
};

export default function SvgAnimatedAvatar({
  name,
  color,
  size = 'medium',
  className = '',
  svgUrl,
  isSpeaking = false,
  isListening = false,
  audioAmplitude = 0,
  visemePose,
  animationConfig,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  const [listeningNod, setListeningNod] = useState(0); // Trigger for listening nods

  // Load the SVG markup and inline it
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(svgUrl);
      const text = await res.text();
      if (!cancelled) setSvgMarkup(text);
    })();
    return () => { cancelled = true; };
  }, [svgUrl]);

  // Config
  const cfg = useMemo(() => ({
    // Existing
    mouthGain: animationConfig?.mouthGain ?? 1,
    mouthSmoothing: Math.min(Math.max(animationConfig?.mouthSmoothing ?? 0.18, 0), 0.95),
    minOpen: animationConfig?.minOpen ?? 0.05,
    maxOpen: animationConfig?.maxOpen ?? 1,
    blinkRateSec: animationConfig?.blinkRateSec ?? 4,
    blinkJitterPct: animationConfig?.blinkJitterPct ?? 0.5,
    // Head - INCREASED defaults for more visible movement
    headSwayPx: Math.max(0, Math.min(5.0, animationConfig?.headSwayPx ?? 2.5)),
    headTiltDeg: Math.max(0, Math.min(4.0, animationConfig?.headTiltDeg ?? 1.8)),
    nodThreshold: Math.max(0.3, Math.min(0.9, animationConfig?.nodThreshold ?? 0.65)),
    nodMaxDeg: Math.max(0, Math.min(3.0, animationConfig?.nodMaxDeg ?? 1.5)),
    headOriginYPx: Math.max(140, Math.min(200, animationConfig?.headOriginYPx ?? 170)),
    // Gaze
    gazeEnabled: animationConfig?.gazeEnabled ?? true,
    gazeIntervalSec: Math.max(2, Math.min(12, animationConfig?.gazeIntervalSec ?? 5)),
    gazeLateralPx: Math.max(0, Math.min(20, animationConfig?.gazeLateralPx ?? 3)),
    gazeVerticalPx: Math.max(0, Math.min(15, animationConfig?.gazeVerticalPx ?? 1.2)),
    lidCoupleThresholdPx: Math.max(2, Math.min(5, animationConfig?.lidCoupleThresholdPx ?? 3)),
    // Dilation
    dilationEnabled: animationConfig?.dilationEnabled ?? true,
    dilationRangeLPx: Math.max(0, Math.min(1.0, animationConfig?.dilationRangeLPx ?? 0.4)),
    dilationRangeRPx: Math.max(0, Math.min(1.0, animationConfig?.dilationRangeRPx ?? 0.4)),
    dilationPeriodSec: Math.max(5, Math.min(20, animationConfig?.dilationPeriodSec ?? 11)),
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

  // Listening animation scheduler - occasional nods when listening but not speaking
  useEffect(() => {
    if (!isListening || isSpeaking) return;

    let timer: any;
    const schedule = () => {
      // Random interval between 3-8 seconds for listening nods
      const delay = 3000 + Math.random() * 5000;
      timer = setTimeout(() => {
        // Trigger a subtle nod by incrementing the counter
        setListeningNod(prev => prev + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [isListening, isSpeaking]);

  // After the SVG is inlined, cache element refs
  const refs = useRef<{
    rigRoot?: SVGGElement;
    mouth?: SVGEllipseElement;
    mouthCavity?: SVGEllipseElement;
    lidUL?: SVGRectElement; lidLL?: SVGRectElement; lidUR?: SVGRectElement; lidLR?: SVGRectElement;
    pupilL?: SVGCircleElement; pupilR?: SVGCircleElement;
    eyeL?: SVGEllipseElement; eyeR?: SVGEllipseElement;
    baseMouth?: { rx: number; ry: number; cy: number; opacity: number };
    basePupils?: { rL: number; rR: number };
  } | null>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    // Scale the inlined SVG to the container and center it
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    (svg.style as any).width = '100%';
    (svg.style as any).height = '100%';
    (svg.style as any).display = 'block';

    const rigRoot = svg.querySelector('#rigRoot') as SVGGElement | undefined;
    const mouth = svg.querySelector('#mouthShape') as SVGEllipseElement | undefined;
    const mouthCavity = svg.querySelector('#mouthCavity') as SVGEllipseElement | undefined;
    const lidUL = svg.querySelector('#lidUpperL') as SVGRectElement | undefined;
    const lidLL = svg.querySelector('#lidLowerL') as SVGRectElement | undefined;
    const lidUR = svg.querySelector('#lidUpperR') as SVGRectElement | undefined;
    const lidLR = svg.querySelector('#lidLowerR') as SVGRectElement | undefined;
    const pupilL = svg.querySelector('#pupilL') as SVGCircleElement | undefined;
    const pupilR = svg.querySelector('#pupilR') as SVGCircleElement | undefined;
    const eyeL = svg.querySelector('#eyeL') as SVGEllipseElement | undefined;
    const eyeR = svg.querySelector('#eyeR') as SVGEllipseElement | undefined;

    refs.current = { rigRoot, mouth, mouthCavity, lidUL, lidLL, lidUR, lidLR, pupilL, pupilR, eyeL, eyeR };

    console.log('[SvgAnimatedAvatar] Refs populated:', {
      hasPupilL: !!pupilL,
      hasPupilR: !!pupilR,
      hasMouth: !!mouth,
      hasRigRoot: !!rigRoot,
    });

    // Cache base mouth geometry from the SVG (respects calibration)
    if (mouth) {
      refs.current.baseMouth = {
        rx: parseFloat(mouth.getAttribute('rx') || '12'),
        ry: parseFloat(mouth.getAttribute('ry') || '2'),
        cy: parseFloat(mouth.getAttribute('cy') || '200'),
        opacity: parseFloat(mouth.getAttribute('opacity') || '0.7'),
      };
    }

    // Cache base pupil radii and prepare transform composition using CSS vars
    if (pupilL && pupilR) {
      const rL = parseFloat(pupilL.getAttribute('r') || '4');
      const rR = parseFloat(pupilR.getAttribute('r') || '3');
      if (!refs.current.basePupils) refs.current.basePupils = { rL, rR };
      [pupilL, pupilR].forEach((el) => {
        el.style.setProperty('transform-box', 'fill-box');
        el.style.transform = 'translate(var(--gazeDx, 0px), var(--gazeDy, 0px)) translate(var(--microDx, 0px), var(--microDy, 0px))';
        el.style.transition = 'transform 220ms ease-out';
      });
      console.log('[SvgAnimatedAvatar] Pupil transforms initialized');
    } else {
      console.warn('[SvgAnimatedAvatar] Pupils NOT found in SVG! pupilL:', pupilL, 'pupilR:', pupilR);
    }

    // Ensure transforms on eyelids use element's geometry box
    ;[lidUL, lidLL, lidUR, lidLR].forEach((el) => {
      if (!el) return;
      el.style.setProperty('transform-box', 'fill-box');
    });

    // Ensure rig root origin is set (also present in SVG as a fallback)
    if (rigRoot) {
      (rigRoot.style as any).transformOrigin = `200px ${cfg.headOriginYPx}px`;
    }
  }, [svgMarkup, cfg.headOriginYPx]);

  // Drive mouth dimensions from viseme/amp (relative to calibrated base)
  useEffect(() => {
    const r = refs.current; if (!r?.mouth) return;
    const baseRx = r.baseMouth?.rx ?? 12;
    const baseRy = r.baseMouth?.ry ?? 2;
    const baseCy = r.baseMouth?.cy ?? 200;
    // Toned-down contributions for more natural motion
    const rx = baseRx + lipWide * (baseRx * 0.5) + (1 - lipRound) * 3;
    const ry = baseRy + lipOpen * (baseRy * 5.5) + lipRound * 6;
    r.mouth.setAttribute('rx', String(rx));
    r.mouth.setAttribute('ry', String(ry));
    r.mouth.setAttribute('cy', String(baseCy + lipOpen * 6));
    (r.mouth.style as any).transition = 'opacity 120ms ease-out';
    r.mouth.style.opacity = String(Math.min(0.9, (r.baseMouth?.opacity ?? 0.7) + lipOpen * 0.1));

    // Drive mouth cavity for depth effect (becomes visible when mouth opens)
    if (r.mouthCavity) {
      // Cavity is slightly smaller and positioned to create depth illusion
      const cavityRx = rx * 0.75; // 75% of mouth width
      const cavityRy = Math.max(0.5, ry * 0.85); // 85% of mouth height, min 0.5
      r.mouthCavity.setAttribute('rx', String(cavityRx));
      r.mouthCavity.setAttribute('ry', String(cavityRy));
      r.mouthCavity.setAttribute('cy', String(baseCy + lipOpen * 6));

      // Cavity opacity increases with mouth opening (lowered threshold to 0.10 for earlier visibility)
      // Peak opacity increased to 0.90 for more prominent depth effect
      // Increased multiplier to 1.5 for faster opacity ramp-up
      const cavityOpacity = lipOpen < 0.10 ? 0 : Math.min(0.90, (lipOpen - 0.10) * 1.5);
      (r.mouthCavity.style as any).transition = 'opacity 120ms ease-out';
      r.mouthCavity.style.opacity = String(cavityOpacity);
    }
  }, [lipOpen, lipWide, lipRound]);

  // Drive blink with natural two-phase timing and easing
  useEffect(() => {
    const r = refs.current; if (!r) return;
    const closeDur = 85;   // fast close (slightly faster for more snap)
    const holdDur = 45;    // tiny hold
    const openDur = 140;   // slower open (slightly slower for natural ease)

    const applyPhase = (factor: number, easing: string) => {
      const set = (el?: SVGRectElement, origin: 'top' | 'bottom' = 'top') => {
        if (!el) return;
        el.style.transformOrigin = origin === 'top' ? '50% 0%' : '50% 100%';
        el.style.transition = `transform ${blink ? closeDur : openDur}ms ${easing}, opacity ${blink ? closeDur : openDur}ms ${easing}`;
        el.style.transform = `scaleY(${factor})`;
        // Increased opacity from 0.8 to 0.95 for much more visible blinks
        // Use a gradient: full opacity when fully closed, fade out as opening
        el.style.opacity = factor > 0.7 ? '0.95' : (factor > 0.3 ? '0.6' : '0');
      };
      set(r.lidUL, 'top'); set(r.lidUR, 'top');
      set(r.lidLL, 'bottom'); set(r.lidLR, 'bottom');
    };

    if (blink) {
      // Close quickly with sharper ease-in for more pronounced motion
      applyPhase(1, 'cubic-bezier(0.4, 0, 0.6, 1)');
      const t = setTimeout(() => {
        applyPhase(0, 'cubic-bezier(0.2, 0, 0.3, 1)');
      }, closeDur + holdDur);
      return () => clearTimeout(t);
    } else {
      // Ensure we ease back to open state when blink flag drops
      applyPhase(0, 'cubic-bezier(0.2, 0, 0.3, 1)');
    }
  }, [blink]);

  // Optional: subtle micro-saccades for pupils (uses CSS vars to compose with gaze layer)
  useEffect(() => {
    const r = refs.current; if (!r?.pupilL || !r?.pupilR) {
      console.log('[SvgAnimatedAvatar] Micro-saccades: pupils not found in refs');
      return;
    }
    console.log('[SvgAnimatedAvatar] Micro-saccades ENABLED');
    let alive = true;
    let timer: any;
    const jitter = () => {
      if (!alive) return;
      const dx = (Math.random() - 0.5) * 2.0; // ~[-1, 1] px
      const dy = (Math.random() - 0.5) * 1.6; // ~[-0.8, 0.8] px
      [r.pupilL, r.pupilR].forEach((el) => {
        if (!el) return;
        el.style.transition = 'transform 180ms ease-out';
        el.style.setProperty('--microDx', `${dx}px`);
        el.style.setProperty('--microDy', `${dy}px`);
      });
      // Ease back to center
      setTimeout(() => {
        [r.pupilL, r.pupilR].forEach((el) => {
          if (!el) return;
          el.style.transition = 'transform 240ms ease-in';
          el.style.setProperty('--microDx', `0px`);
          el.style.setProperty('--microDy', `0px`);
        });
      }, 220);
      // Schedule next microsaccade
      const nextDelay = 2200 + Math.random() * 3800;
      timer = setTimeout(jitter, nextDelay);
    };
    // Start after a brief delay to avoid first-frame jump
    timer = setTimeout(jitter, 1800);
    return () => { alive = false; clearTimeout(timer); };
  }, [svgMarkup]);


  // Head micro-movement via rigRoot: breathing sway, micro-tilts, and emphasis nods
  useEffect(() => {
    const r = refs.current; if (!r?.rigRoot) return;
    let raf = 0;
    let lastT = performance.now();
    let impulse = 0; // degrees added briefly for emphasis
    let impulseVel = 0;
    let cooldown = 0; // ms until next allowed impulse
    let debugCounter = 0; // For periodic debug logging
    let lastListeningNod = listeningNod; // Track listening nod triggers

    console.log('[SvgAnimatedAvatar] Head micromovement animation STARTED', {
      headSwayPx: cfg.headSwayPx,
      headTiltDeg: cfg.headTiltDeg,
      hasRigRoot: !!r.rigRoot
    });

    const twoPi = Math.PI * 2;

    // Multi-layered natural movement system with varied periods (using prime-like numbers to avoid repetition)
    // Layer 1: Breathing rhythm (slow, primary vertical)
    const breathPhase = Math.random() * twoPi;
    const breathPeriod = 3700 + Math.random() * 1300; // 3.7-5s breathing cycle

    // Layer 2: Slow drift (very slow random walk)
    const driftPhaseX = Math.random() * twoPi;
    const driftPhaseY = Math.random() * twoPi;
    const driftPeriodX = 23000 + Math.random() * 17000; // 23-40s
    const driftPeriodY = 19000 + Math.random() * 13000; // 19-32s

    // Layer 3: Micro-adjustments (small corrections)
    const microPhaseX = Math.random() * twoPi;
    const microPhaseY = Math.random() * twoPi;
    const microPhaseTilt = Math.random() * twoPi;
    const microPeriodX = 7300 + Math.random() * 3700; // 7.3-11s
    const microPeriodY = 5900 + Math.random() * 4100; // 5.9-10s
    const microPeriodTilt = 8700 + Math.random() * 5300; // 8.7-14s

    // Layer 4: Subtle tremor/noise (high frequency, very low amplitude)
    const tremorPhaseX = Math.random() * twoPi;
    const tremorPhaseY = Math.random() * twoPi;
    const tremorPeriodX = 1100 + Math.random() * 900; // 1.1-2s
    const tremorPeriodY = 1300 + Math.random() * 700; // 1.3-2s

    // Amplitude modulation over time (makes movement less predictable)
    const ampModPhase = Math.random() * twoPi;
    const ampModPeriod = 31000 + Math.random() * 19000; // 31-50s very slow amplitude variation

    // Easing function for more natural acceleration/deceleration
    const smoothstep = (x: number) => x * x * (3 - 2 * x);
    const easeInOutCubic = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

    const loop = (t: number) => {
      const dt = t - lastT; lastT = t;

      // Idle gain: reduce idle sway when speaking (or when mouth is very open)
      const speakLevel = Math.max(smoothedAmp, isSpeaking ? 0.4 : 0);
      const idleGain = Math.max(0.15, 1 - speakLevel * 0.9);

      // Amplitude modulation: slowly vary the overall movement intensity
      const ampMod = 0.7 + 0.3 * Math.sin((t + ampModPhase) / ampModPeriod * twoPi);

      // Layer 1: Breathing - primary vertical movement with natural ease-in-out
      const breathRaw = Math.sin((t + breathPhase) / breathPeriod * twoPi);
      const breathEased = easeInOutCubic((breathRaw + 1) / 2) * 2 - 1; // Apply easing to sine
      const breathY = breathEased * cfg.headSwayPx * 0.5 * idleGain * ampMod; // Increased from 0.6 to 0.5 (but base is now 2.5px)

      // Layer 2: Slow drift - gentle random walk in both axes
      const driftX = Math.sin((t + driftPhaseX) / driftPeriodX * twoPi) * cfg.headSwayPx * 0.35 * idleGain * ampMod; // Increased from 0.25
      const driftY = Math.sin((t + driftPhaseY) / driftPeriodY * twoPi) * cfg.headSwayPx * 0.25 * idleGain * ampMod; // Increased from 0.3

      // Layer 3: Micro-adjustments - small periodic corrections
      const microX = Math.sin((t + microPhaseX) / microPeriodX * twoPi) * cfg.headSwayPx * 0.2 * idleGain; // Increased from 0.15
      const microY = Math.sin((t + microPhaseY) / microPeriodY * twoPi) * cfg.headSwayPx * 0.15 * idleGain; // Increased from 0.2
      const microTiltRaw = Math.sin((t + microPhaseTilt) / microPeriodTilt * twoPi);
      const microTiltEased = smoothstep((microTiltRaw + 1) / 2) * 2 - 1;
      const microTilt = microTiltEased * cfg.headTiltDeg * 0.6 * idleGain * ampMod; // Increased from 0.5

      // Layer 4: Tremor - very subtle high-frequency noise
      const tremorX = Math.sin((t + tremorPhaseX) / tremorPeriodX * twoPi) * cfg.headSwayPx * 0.08 * idleGain; // Increased from 0.05
      const tremorY = Math.sin((t + tremorPhaseY) / tremorPeriodY * twoPi) * cfg.headSwayPx * 0.08 * idleGain; // Increased from 0.05

      // Layer 5: Slow rotational drift
      const driftTiltRaw = Math.sin((t + driftPhaseY * 1.3) / (driftPeriodY * 1.4) * twoPi);
      const driftTiltEased = smoothstep((driftTiltRaw + 1) / 2) * 2 - 1;
      const driftTilt = driftTiltEased * cfg.headTiltDeg * 0.5 * idleGain * ampMod; // Increased from 0.4

      // Combine all layers
      const translateX = driftX + microX + tremorX;
      const translateY = breathY + driftY + microY + tremorY;
      const baseTilt = microTilt + driftTilt;

      // Emphasis nod impulse based on amplitude spikes; simple velocity/decay model
      cooldown = Math.max(0, cooldown - dt);
      const spike = smoothedAmp > cfg.nodThreshold && cooldown === 0;
      if (spike) {
        impulseVel += 0.012 + Math.random() * 0.008; // kick
        cooldown = 1800 + Math.random() * 1400;      // 1.8–3.2s
      }

      // Listening nod impulse - triggered by listeningNod state changes
      if (listeningNod !== lastListeningNod && cooldown === 0) {
        impulseVel += 0.008 + Math.random() * 0.004; // Gentler kick for listening nods
        cooldown = 2000 + Math.random() * 1000;      // 2-3s cooldown
        lastListeningNod = listeningNod;
      }

      // Damped integrator for impulse
      impulse += impulseVel * dt;
      impulseVel += (-0.015 * impulse - 0.008 * impulseVel) * dt; // spring-damper
      // Clamp impulse to configured envelope
      const maxImp = cfg.nodMaxDeg * (isSpeaking ? 1 : 0.6);
      impulse = Math.max(-maxImp, Math.min(maxImp, impulse));

      const totalRotate = baseTilt + impulse;
      const transformStr = `translate(${translateX.toFixed(3)}px, ${translateY.toFixed(3)}px) rotate(${totalRotate.toFixed(3)}deg)`;
      r.rigRoot.style.transform = transformStr;

      // Debug logging every 3 seconds
      debugCounter++;
      if (debugCounter % 180 === 0) { // ~3 seconds at 60fps
        console.log('[SvgAnimatedAvatar] Head movement values:', {
          translateX: translateX.toFixed(3),
          translateY: translateY.toFixed(3),
          totalRotate: totalRotate.toFixed(3),
          idleGain: idleGain.toFixed(3),
          ampMod: ampMod.toFixed(3),
          transform: transformStr,
          layers: {
            breathY: breathY.toFixed(3),
            driftX: driftX.toFixed(3),
            driftY: driftY.toFixed(3),
            microX: microX.toFixed(3),
            microY: microY.toFixed(3),
            microTilt: microTilt.toFixed(3),
            tremorX: tremorX.toFixed(3),
            tremorY: tremorY.toFixed(3),
            driftTilt: driftTilt.toFixed(3)
          }
        });
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      console.log('[SvgAnimatedAvatar] Head micromovement animation STOPPED');
      cancelAnimationFrame(raf);
    };
  }, [smoothedAmp, isSpeaking, listeningNod, cfg.headSwayPx, cfg.headTiltDeg, cfg.nodThreshold, cfg.nodMaxDeg]);

  // Eye gaze shifts (slow layer) composed with micro-saccades via CSS vars
  useEffect(() => {
    if (!cfg.gazeEnabled) {
      console.log('[SvgAnimatedAvatar] Gaze animation DISABLED');
      return;
    }
    const r = refs.current; if (!r?.pupilL || !r?.pupilR) {
      console.log('[SvgAnimatedAvatar] Gaze animation: pupils not found in refs');
      return;
    }
    console.log('[SvgAnimatedAvatar] Gaze animation ENABLED - config:', {
      gazeIntervalSec: cfg.gazeIntervalSec,
      gazeLateralPx: cfg.gazeLateralPx,
      gazeVerticalPx: cfg.gazeVerticalPx,
    });
    let alive = true;
    let timer: any;

    const schedule = () => {
      if (!alive) return;
      const mean = cfg.gazeIntervalSec * 1000;
      const jitter = 0.3 + Math.random() * 0.6; // 0.3–0.9 multiplier around mean
      const baseDelay = mean * jitter;
      const delay = isSpeaking ? baseDelay * 1.5 : baseDelay; // less frequent during speech
      console.log(`[SvgAnimatedAvatar] Scheduling next gaze shift in ${(delay/1000).toFixed(1)}s`);
      timer = setTimeout(() => shift(), delay);
    };

    const shift = () => {
      if (!alive) return;
      // Pick target offsets (px)
      const dx = (Math.random() * 2 - 1) * cfg.gazeLateralPx;
      const dy = (Math.random() * 2 - 1) * cfg.gazeVerticalPx;
      const goMs = 300 + Math.random() * 400;   // 300–700ms
      const holdMs = 2000 + Math.random() * 2000; // 2–4s

      console.log(`[SvgAnimatedAvatar] GAZE SHIFT: dx=${dx.toFixed(2)}px, dy=${dy.toFixed(2)}px, duration=${goMs}ms, hold=${holdMs}ms`);

      [r.pupilL, r.pupilR].forEach((el) => {
        if (!el) return;
        el.style.transition = `transform ${goMs}ms cubic-bezier(0.2, 0, 0.2, 1)`;
        el.style.setProperty('--gazeDx', `${dx.toFixed(2)}px`);
        el.style.setProperty('--gazeDy', `${dy.toFixed(2)}px`);
        console.log(`[SvgAnimatedAvatar] Set ${el.id}: --gazeDx=${el.style.getPropertyValue('--gazeDx')}, --gazeDy=${el.style.getPropertyValue('--gazeDy')}`);
      });

      // Slight lid response when far lateral
      const far = Math.abs(dx) > cfg.lidCoupleThresholdPx;
      if (r.lidUL && r.lidUR) {
        [r.lidUL, r.lidUR].forEach((el) => {
          el.style.transition = 'opacity 240ms ease';
          el.style.opacity = far ? '0.12' : '0';
        });
      }

      // Return to center after hold
      setTimeout(() => {
        console.log(`[SvgAnimatedAvatar] GAZE RETURN to center`);
        [r.pupilL, r.pupilR].forEach((el) => {
          if (!el) return;
          el.style.transition = `transform ${goMs + 120}ms cubic-bezier(0.2, 0, 0.2, 1)`;
          el.style.setProperty('--gazeDx', `0px`);
          el.style.setProperty('--gazeDy', `0px`);
        });
        if (r.lidUL && r.lidUR) {
          [r.lidUL, r.lidUR].forEach((el) => {
            el.style.transition = 'opacity 240ms ease';
            el.style.opacity = '0';
          });
        }
        schedule();
      }, holdMs + goMs);
    };

    schedule();
    return () => { alive = false; clearTimeout(timer); };
  }, [svgMarkup, isSpeaking, cfg.gazeEnabled, cfg.gazeIntervalSec, cfg.gazeLateralPx, cfg.gazeVerticalPx, cfg.lidCoupleThresholdPx]);

  // Pupil dilation (slow variation)
  useEffect(() => {
    if (!cfg.dilationEnabled) return;
    const r = refs.current; if (!r?.pupilL || !r?.pupilR || !r.basePupils) {
      console.log('[SvgAnimatedAvatar] Pupil dilation: pupils not found in refs');
      return;
    }
    console.log('[SvgAnimatedAvatar] Pupil dilation ENABLED');
    let raf = 0;
    const baseL = r.basePupils.rL; // e.g., 4
    const baseR = r.basePupils.rR; // e.g., 3
    const phaseL = Math.random() * Math.PI * 2;
    const phaseR = Math.random() * Math.PI * 2;
    const periodMean = cfg.dilationPeriodSec * 1000;
    const periodL = periodMean * (0.7 + Math.random() * 0.6);
    const periodR = periodMean * (0.7 + Math.random() * 0.6);

    const loop = (t: number) => {
      const dL = Math.sin((t + phaseL) / periodL * Math.PI * 2);
      const dR = Math.sin((t + phaseR) / periodR * Math.PI * 2);
      const l = baseL + dL * cfg.dilationRangeLPx;
      const rR = baseR + dR * cfg.dilationRangeRPx;
      r.pupilL.setAttribute('r', l.toFixed(2));
      r.pupilR.setAttribute('r', rR.toFixed(2));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [svgMarkup, cfg.dilationEnabled, cfg.dilationRangeLPx, cfg.dilationRangeRPx, cfg.dilationPeriodSec]);


  const sizeConfig = { small: { w: 80, h: 80 }, medium: { w: 160, h: 160 }, large: { w: 320, h: 320 } };
  const { w, h } = sizeConfig[size];

  return (
    <div
      ref={containerRef}
      className={`svg-animated-avatar ${className}`}
      style={{ width: w, height: h, position: 'relative', borderRadius: 12, overflow: 'hidden' }}
      aria-label={name}
      title={name}
    >
      {/* Inline the SVG so we can manipulate inner nodes */}
      {svgMarkup ? (
        <div
          style={{ width: '100%', height: '100%' }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: color }} />
      )}
    </div>
  );
}


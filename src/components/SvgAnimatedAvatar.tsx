import React, { useEffect, useMemo, useRef, useState } from 'react';

export type VisemePose = { viseme: string; open: number; wide: number; round: number };

type Props = {
  name: string;
  color: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  svgUrl: string; // inline this SVG for DOM control
  isSpeaking?: boolean;
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
    headSwayPx?: number;        // 0..1.5 (default 0.45)
    headTiltDeg?: number;       // 0..2.5 (default 0.9)
    nodThreshold?: number;      // 0.3..0.9 (default 0.65)
    nodMaxDeg?: number;         // 0..2.0 (default 0.9)
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
  audioAmplitude = 0,
  visemePose,
  animationConfig,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);

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
    // Head
    headSwayPx: Math.max(0, Math.min(1.5, animationConfig?.headSwayPx ?? 0.45)),
    headTiltDeg: Math.max(0, Math.min(2.5, animationConfig?.headTiltDeg ?? 0.9)),
    nodThreshold: Math.max(0.3, Math.min(0.9, animationConfig?.nodThreshold ?? 0.65)),
    nodMaxDeg: Math.max(0, Math.min(2.0, animationConfig?.nodMaxDeg ?? 0.9)),
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

  // After the SVG is inlined, cache element refs
  const refs = useRef<{
    rigRoot?: SVGGElement;
    mouth?: SVGEllipseElement;
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
    const lidUL = svg.querySelector('#lidUpperL') as SVGRectElement | undefined;
    const lidLL = svg.querySelector('#lidLowerL') as SVGRectElement | undefined;
    const lidUR = svg.querySelector('#lidUpperR') as SVGRectElement | undefined;
    const lidLR = svg.querySelector('#lidLowerR') as SVGRectElement | undefined;
    const pupilL = svg.querySelector('#pupilL') as SVGCircleElement | undefined;
    const pupilR = svg.querySelector('#pupilR') as SVGCircleElement | undefined;
    const eyeL = svg.querySelector('#eyeL') as SVGEllipseElement | undefined;
    const eyeR = svg.querySelector('#eyeR') as SVGEllipseElement | undefined;

    refs.current = { rigRoot, mouth, lidUL, lidLL, lidUR, lidLR, pupilL, pupilR, eyeL, eyeR };

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
  }, [lipOpen, lipWide, lipRound]);

  // Drive blink with natural two-phase timing and easing
  useEffect(() => {
    const r = refs.current; if (!r) return;
    const closeDur = 90;   // fast close
    const holdDur = 40;    // tiny hold
    const openDur = 130;   // slower open

    const applyPhase = (factor: number, easing: string) => {
      const set = (el?: SVGRectElement, origin: 'top' | 'bottom' = 'top') => {
        if (!el) return;
        el.style.transformOrigin = origin === 'top' ? '50% 0%' : '50% 100%';
        el.style.transition = `transform ${blink ? closeDur : openDur}ms ${easing}, opacity ${blink ? closeDur : openDur}ms ${easing}`;
        el.style.transform = `scaleY(${factor})`;
        el.style.opacity = factor > 0.5 ? '0.8' : '0';
      };
      set(r.lidUL, 'top'); set(r.lidUR, 'top');
      set(r.lidLL, 'bottom'); set(r.lidLR, 'bottom');
    };

    if (blink) {
      // Close quickly with ease-out, then reopen after a tiny hold
      applyPhase(1, 'cubic-bezier(0.25, 0.1, 0.25, 1)');
      const t = setTimeout(() => {
        applyPhase(0, 'cubic-bezier(0.2, 0, 0.2, 1)');
      }, closeDur + holdDur);
      return () => clearTimeout(t);
    } else {
      // Ensure we ease back to open state when blink flag drops
      applyPhase(0, 'cubic-bezier(0.2, 0, 0.2, 1)');
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

    const twoPi = Math.PI * 2;
    const phase1 = Math.random() * twoPi;
    const phase2 = Math.random() * twoPi;
    const period1 = 9000 + Math.random() * 4000; // 9–13s
    const period2 = 12000 + Math.random() * 6000; // 12–18s

    const loop = (t: number) => {
      const dt = t - lastT; lastT = t;

      // Idle gain: reduce idle sway when speaking (or when mouth is very open)
      const speakLevel = Math.max(smoothedAmp, isSpeaking ? 0.4 : 0);
      const idleGain = Math.max(0.15, 1 - speakLevel * 0.9);

      // Baseline breathing sway (translateY in px) and micro tilt (deg)
      const baseSway = cfg.headSwayPx; // px
      const baseTilt = cfg.headTiltDeg;  // deg
      const sway = Math.sin((t + phase1) / period1 * twoPi) * baseSway * idleGain;
      const tilt = Math.sin((t + phase2) / period2 * twoPi) * baseTilt * idleGain;

      // Emphasis nod impulse based on amplitude spikes; simple velocity/decay model
      cooldown = Math.max(0, cooldown - dt);
      const spike = smoothedAmp > cfg.nodThreshold && cooldown === 0;
      if (spike) {
        impulseVel += 0.012 + Math.random() * 0.008; // kick
        cooldown = 1800 + Math.random() * 1400;      // 1.8–3.2s
      }
      // Damped integrator for impulse
      impulse += impulseVel * dt;
      impulseVel += (-0.015 * impulse - 0.008 * impulseVel) * dt; // spring-damper
      // Clamp impulse to configured envelope
      const maxImp = cfg.nodMaxDeg * (isSpeaking ? 1 : 0.6);
      impulse = Math.max(-maxImp, Math.min(maxImp, impulse));

      const totalRotate = tilt + impulse;
      const translateY = sway;
      r.rigRoot.style.transform = `translate(0px, ${translateY.toFixed(3)}px) rotate(${totalRotate.toFixed(3)}deg)`;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [smoothedAmp, isSpeaking, cfg.headSwayPx, cfg.headTiltDeg, cfg.nodThreshold, cfg.nodMaxDeg]);

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


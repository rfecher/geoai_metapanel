import React, { useEffect, useMemo, useRef, useState } from 'react';
import { personas } from '../data/personas';

// Persona-agnostic hybrid SVG calibrator
// - Select which persona to calibrate (Maya, Otto, Sarah, Marcus, Jessica)
// - Displays the selected persona's hybrid SVG (photo base + vector overlays)
// - Lets you adjust eyelid rects, mouth ellipse, pupils, eyes in real time
// - Saves calibration directly to SVG file and personas.ts via Electron IPC

type Lid = 'lidUpperL' | 'lidLowerL' | 'lidUpperR' | 'lidLowerR';
type PersonaId = 'maya' | 'otto' | 'sarah' | 'marcus' | 'jessica';

export default function HybridAvatarCalibrator() {
  const [selectedPersona, setSelectedPersona] = useState<PersonaId>('marcus');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const HYBRID_URL = `/avatars/${selectedPersona}_hybrid.svg`;

  // Get current persona data
  const currentPersona = useMemo(() => personas.find(p => p.id === selectedPersona), [selectedPersona]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [blinkNow, setBlinkNow] = useState(false);
  const [autoBlink, setAutoBlink] = useState(true);

  // Viseme preview values
  const [open, setOpen] = useState(0.2);
  const [wide, setWide] = useState(0.2);
  const [round, setRound] = useState(0.0);
  const [animateMouth, setAnimateMouth] = useState(true);


  const [autoMouth, setAutoMouth] = useState(false);

  // Overlay params (initialized from SVG after load)
  const [lid, setLid] = useState<Record<Lid, { x: number; y: number; width: number; height: number; opacity: number }>>({
    lidUpperL: { x: 126, y: 116, width: 48, height: 10, opacity: 0 },
    lidLowerL: { x: 126, y: 126, width: 48, height: 10, opacity: 0 },
    lidUpperR: { x: 226, y: 116, width: 48, height: 10, opacity: 0 },
    lidLowerR: { x: 226, y: 126, width: 48, height: 10, opacity: 0 },
  });
  const [mouth, setMouth] = useState<{ cx: number; cy: number; rx: number; ry: number; opacity: number }>({
    cx: 200, cy: 212, rx: 12, ry: 2, opacity: 0.8,
  });
  const [pupil, setPupil] = useState<{ L: { cx: number; cy: number; r: number; opacity: number }; R: { cx: number; cy: number; r: number; opacity: number } }>({
    L: { cx: 150, cy: 126, r: 5, opacity: 0.85 },
    R: { cx: 250, cy: 126, r: 5, opacity: 0.85 },
  });
  const [eye, setEye] = useState<{ L: { cx: number; cy: number; rx: number; ry: number; opacity: number }; R: { cx: number; cy: number; rx: number; ry: number; opacity: number } }>({
    L: { cx: 150, cy: 126, rx: 24, ry: 10, opacity: 0.15 },
    R: { cx: 250, cy: 126, rx: 24, ry: 10, opacity: 0.15 },
  });

  // Mouth styling: gradient, feather blur, animation multipliers
  const [mouthGrad, setMouthGrad] = useState<{
    topColor: string; topOpacity: number;
    midColor: string; midOpacity: number;
    botColor: string; botOpacity: number;
  }>({
    topColor: '#4a2a2a', topOpacity: 0.70,
    midColor: '#6b3a3a', midOpacity: 0.80,
    botColor: '#4a2a2a', botOpacity: 0.70,
  });
  const [mouthFeatherStdDev, setMouthFeatherStdDev] = useState(0.55);
  const [mouthAnim, setMouthAnim] = useState<{ wideFactor: number; verticalMovePx: number; opacityRange: number }>({
    wideFactor: 0.5,
    verticalMovePx: 6,
    opacityRange: 0.10,
  });

  // Advanced animations config
  const [advOpen, setAdvOpen] = useState(true);
  const [advancedAnimations, setAdvancedAnimations] = useState({
    head: {
      swayPx: 2.5,  // Increased from 0.45 for more visible movement
      tiltDeg: 1.8,  // Increased from 0.9 for more visible rotation
      nodThreshold: 0.65,
      nodMaxDeg: 1.5,  // Increased from 0.9
      originY: 170,
    },
    gaze: {
      enabled: true,
      intervalSec: 5,
      lateralPx: 3,
      verticalPx: 1.2,
      lidThresholdPx: 3,
    },
    dilation: {
      enabled: true,
      rangeLPx: 0.4,
      rangeRPx: 0.4,
      periodSec: 11,
    },
  });


  // Load persona's animationConfig when persona changes
  useEffect(() => {
    if (!currentPersona?.animationConfig) return;
    const ac = currentPersona.animationConfig;

    setAdvancedAnimations({
      head: {
        swayPx: ac.headSwayPx ?? 0.45,
        tiltDeg: ac.headTiltDeg ?? 0.9,
        nodThreshold: ac.nodThreshold ?? 0.65,
        nodMaxDeg: ac.nodMaxDeg ?? 0.9,
        originY: ac.headOriginYPx ?? 170,
      },
      gaze: {
        enabled: ac.gazeEnabled ?? true,
        intervalSec: ac.gazeIntervalSec ?? 5,
        lateralPx: ac.gazeLateralPx ?? 3,
        verticalPx: ac.gazeVerticalPx ?? 1,
        lidThresholdPx: ac.lidCoupleThresholdPx ?? 3,
      },
      dilation: {
        enabled: ac.dilationEnabled ?? true,
        rangeLPx: ac.dilationRangeLPx ?? 0.4,
        rangeRPx: ac.dilationRangeRPx ?? 0.4,
        periodSec: ac.dilationPeriodSec ?? 11,
      },
    });
  }, [currentPersona]);

  // Fetch and inline SVG when persona changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(HYBRID_URL);
      const text = await res.text();
      if (!cancelled) setSvgMarkup(text);
    })();
    return () => { cancelled = true; };
  }, [HYBRID_URL, selectedPersona]);

  // Cache DOM nodes and initialize state from the SVG defaults
  const refs = useRef<{
    svg?: SVGSVGElement;
    rigRoot?: SVGGElement;
    lids: Partial<Record<Lid, SVGRectElement>>;
    mouth?: SVGEllipseElement;
    mouthCavity?: SVGEllipseElement;
    pupils: { L?: SVGCircleElement; R?: SVGCircleElement };
    eyes: { L?: SVGEllipseElement; R?: SVGEllipseElement };
    gradMouth?: SVGLinearGradientElement;
    gradStops?: SVGStopElement[];
    mouthFeather?: SVGFEGaussianBlurElement;
  }>({ lids: {}, pupils: {}, eyes: {} });

  useEffect(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    // Scale and center
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    (svg.style as any).width = '100%';
    (svg.style as any).height = '100%';
    (svg.style as any).display = 'block';

    // Cache nodes
    refs.current.svg = svg;
    refs.current.rigRoot = svg.querySelector('#rigRoot') as SVGGElement;
    refs.current.lids = {
      lidUpperL: svg.querySelector('#lidUpperL') as SVGRectElement,
      lidLowerL: svg.querySelector('#lidLowerL') as SVGRectElement,
      lidUpperR: svg.querySelector('#lidUpperR') as SVGRectElement,
      lidLowerR: svg.querySelector('#lidLowerR') as SVGRectElement,
    };
    refs.current.mouth = svg.querySelector('#mouthShape') as SVGEllipseElement;
    refs.current.mouthCavity = svg.querySelector('#mouthCavity') as SVGEllipseElement;
    refs.current.pupils = {
      L: svg.querySelector('#pupilL') as SVGCircleElement,
      R: svg.querySelector('#pupilR') as SVGCircleElement,
    };
    // Prepare pupil transform composition to preview gaze
    if (refs.current.pupils.L) {
      const el = refs.current.pupils.L as SVGCircleElement;
      el.style.setProperty('transform-box', 'fill-box');
      el.style.transform = 'translate(var(--gazeDx, 0px), var(--gazeDy, 0px))';
    }
    if (refs.current.pupils.R) {
      const el = refs.current.pupils.R as SVGCircleElement;
      el.style.setProperty('transform-box', 'fill-box');
      el.style.transform = 'translate(var(--gazeDx, 0px), var(--gazeDy, 0px))';
    }
    refs.current.eyes = {
      L: svg.querySelector('#eyeL') as SVGEllipseElement,
      R: svg.querySelector('#eyeR') as SVGEllipseElement,
    };

    // Fix eye gradient opacity: ensure gradient stops use full opacity (1.0)
    // so that the eye ellipse opacity attribute controls visibility directly
    const gradEye = svg.querySelector('#gradEye') as SVGLinearGradientElement;
    if (gradEye) {
      const stops = gradEye.querySelectorAll('stop');
      if (stops.length >= 2) {
        stops[0].setAttribute('stop-opacity', '1.0'); // Top stop: full opacity
        stops[1].setAttribute('stop-opacity', '1.0'); // Bottom stop: full opacity
      }
    }
    // Mouth styling nodes
    refs.current.gradMouth = svg.querySelector('#gradMouthVert') as unknown as SVGLinearGradientElement;
    if (refs.current.gradMouth) {
      const stops = Array.from(refs.current.gradMouth.querySelectorAll('stop')) as SVGStopElement[];
      refs.current.gradStops = stops;
      // Initialize gradient state from DOM
      if (stops.length >= 3) {
        const s0 = stops[0]; const s1 = stops[1]; const s2 = stops[2];
        setMouthGrad({
          topColor: s0.getAttribute('stop-color') || '#4a2a2a',
          topOpacity: parseFloat(s0.getAttribute('stop-opacity') || '0.70'),
          midColor: s1.getAttribute('stop-color') || '#6b3a3a',
          midOpacity: parseFloat(s1.getAttribute('stop-opacity') || '0.80'),
          botColor: s2.getAttribute('stop-color') || '#4a2a2a',
          botOpacity: parseFloat(s2.getAttribute('stop-opacity') || '0.70'),
        });
      }
    }
    const fe = svg.querySelector('#mouthFeather feGaussianBlur') as SVGFEGaussianBlurElement | null;
    if (fe) {
      refs.current.mouthFeather = fe;
      const sd = fe.getAttribute('stdDeviation');
      if (sd) setMouthFeatherStdDev(parseFloat(sd));
    }

    // Initialize lids
    const nextLid = { ...lid };
    (Object.keys(refs.current.lids) as Lid[]).forEach((key) => {
      const el = refs.current.lids[key];
      if (!el) return;
      nextLid[key] = {
        x: parseFloat(el.getAttribute('x') || `${nextLid[key].x}`),
        y: parseFloat(el.getAttribute('y') || `${nextLid[key].y}`),
        width: parseFloat(el.getAttribute('width') || `${nextLid[key].width}`),
        height: parseFloat(el.getAttribute('height') || `${nextLid[key].height}`),
        opacity: parseFloat(el.getAttribute('opacity') || `${nextLid[key].opacity}`),
      };
    });
    setLid(nextLid);

    // Initialize mouth
    if (refs.current.mouth) {
      setMouth({
        cx: parseFloat(refs.current.mouth.getAttribute('cx') || '200'),
        cy: parseFloat(refs.current.mouth.getAttribute('cy') || '212'),
        rx: parseFloat(refs.current.mouth.getAttribute('rx') || '12'),
        ry: parseFloat(refs.current.mouth.getAttribute('ry') || '2'),
        opacity: parseFloat(refs.current.mouth.getAttribute('opacity') || '0.8'),
      });
    }

    // Initialize pupils
    if (refs.current.pupils.L && refs.current.pupils.R) {
      setPupil({
        L: {
          cx: parseFloat(refs.current.pupils.L.getAttribute('cx') || '150'),
          cy: parseFloat(refs.current.pupils.L.getAttribute('cy') || '126'),
          r: parseFloat(refs.current.pupils.L.getAttribute('r') || '5'),
          opacity: parseFloat(refs.current.pupils.L.getAttribute('opacity') || '0.85'),
        },
        R: {
          cx: parseFloat(refs.current.pupils.R.getAttribute('cx') || '250'),
          cy: parseFloat(refs.current.pupils.R.getAttribute('cy') || '126'),
          r: parseFloat(refs.current.pupils.R.getAttribute('r') || '5'),
          opacity: parseFloat(refs.current.pupils.R.getAttribute('opacity') || '0.85'),
        },
      });
    }

    // Initialize eyes (sclera/highlight)
    if (refs.current.eyes.L && refs.current.eyes.R) {
      setEye({
        L: {
          cx: parseFloat(refs.current.eyes.L.getAttribute('cx') || '150'),
          cy: parseFloat(refs.current.eyes.L.getAttribute('cy') || '126'),
          rx: parseFloat(refs.current.eyes.L.getAttribute('rx') || '24'),
          ry: parseFloat(refs.current.eyes.L.getAttribute('ry') || '10'),
          opacity: parseFloat(refs.current.eyes.L.getAttribute('opacity') || '0.15'),
        },
        R: {
          cx: parseFloat(refs.current.eyes.R.getAttribute('cx') || '250'),
          cy: parseFloat(refs.current.eyes.R.getAttribute('cy') || '126'),
          rx: parseFloat(refs.current.eyes.R.getAttribute('rx') || '24'),
          ry: parseFloat(refs.current.eyes.R.getAttribute('ry') || '10'),
          opacity: parseFloat(refs.current.eyes.R.getAttribute('opacity') || '0.15'),
        },
      });
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgMarkup]);

  // Apply pupil updates
  useEffect(() => {
    const p = refs.current.pupils;
    if (!p) return;
    if (p.L) {
      p.L.setAttribute('cx', `${pupil.L.cx}`);
      p.L.setAttribute('cy', `${pupil.L.cy}`);
      p.L.setAttribute('r', `${pupil.L.r}`);
      p.L.setAttribute('opacity', `${pupil.L.opacity}`);
    }
    if (p.R) {
      p.R.setAttribute('cx', `${pupil.R.cx}`);
      p.R.setAttribute('cy', `${pupil.R.cy}`);
      p.R.setAttribute('r', `${pupil.R.r}`);
      p.R.setAttribute('opacity', `${pupil.R.opacity}`);
    }
  }, [pupil]);

  // Apply eye (sclera/highlight) updates

	  // Apply mouth styling updates (gradient + feather)
	  useEffect(() => {
	    const stops = refs.current.gradStops; if (!stops || stops.length < 3) return;
	    const { topColor, topOpacity, midColor, midOpacity, botColor, botOpacity } = mouthGrad;
	    stops[0].setAttribute('stop-color', topColor);
	    stops[0].setAttribute('stop-opacity', String(topOpacity));
	    stops[1].setAttribute('stop-color', midColor);
	    stops[1].setAttribute('stop-opacity', String(midOpacity));
	    stops[2].setAttribute('stop-color', botColor);
	    stops[2].setAttribute('stop-opacity', String(botOpacity));
	  }, [mouthGrad]);

	  useEffect(() => {
	    const fe = refs.current.mouthFeather; if (!fe) return;
	    fe.setAttribute('stdDeviation', String(mouthFeatherStdDev));
	  }, [mouthFeatherStdDev]);

  useEffect(() => {
    const e = refs.current.eyes;
    if (!e) return;
    if (e.L) {
      e.L.setAttribute('cx', `${eye.L.cx}`);
      e.L.setAttribute('cy', `${eye.L.cy}`);
      e.L.setAttribute('rx', `${eye.L.rx}`);
      e.L.setAttribute('ry', `${eye.L.ry}`);
      e.L.setAttribute('opacity', `${eye.L.opacity}`);
    }
    if (e.R) {
      e.R.setAttribute('cx', `${eye.R.cx}`);
      e.R.setAttribute('cy', `${eye.R.cy}`);
      e.R.setAttribute('rx', `${eye.R.rx}`);
      e.R.setAttribute('ry', `${eye.R.ry}`);
      e.R.setAttribute('opacity', `${eye.R.opacity}`);
    }
  }, [eye]);

  // Apply lid updates
  useEffect(() => {
    (Object.keys(refs.current.lids) as Lid[]).forEach((key) => {
      const el = refs.current.lids[key];
      const v = lid[key];
      if (!el || !v) return;
      el.setAttribute('x', `${v.x}`);
      el.setAttribute('y', `${v.y}`);
      el.setAttribute('width', `${v.width}`);
      el.setAttribute('height', `${v.height}`);
      el.setAttribute('opacity', `${v.opacity}`);
      el.style.setProperty('transform-box', 'fill-box');
      el.style.transformOrigin = key.includes('Upper') ? '50% 0%' : '50% 100%';
    });
  }, [lid]);

  // Apply mouth updates
  useEffect(() => {
    const el = refs.current.mouth; if (!el) return;
    el.setAttribute('cx', `${mouth.cx}`);
    el.setAttribute('cy', `${mouth.cy}`);
    el.setAttribute('rx', `${mouth.rx}`);
    el.setAttribute('ry', `${mouth.ry}`);
    el.setAttribute('opacity', `${mouth.opacity}`);
  }, [mouth]);

  // Blink preview
  useEffect(() => {
    if (!autoBlink && !blinkNow) return;
    let timer: any;
    // Safety: prevent accidental React hook calls inside nested callbacks in this effect
    // The blink setTimeout previously contained hook calls by mistake; shadow useEffect here to no-op within this scope
    const useEffect = ((..._args: any[]) => {}) as any;

    const once = () => {
      const lids = refs.current.lids;
      const closeDur = 85;   // fast close
      const holdDur = 45;    // tiny hold
      const openDur = 140;   // slower open

      // Close phase - increased opacity for more visible blinks
      (Object.keys(lids) as Lid[]).forEach(key => {
        const el = lids[key]; if (!el) return;
        el.style.transition = `transform ${closeDur}ms cubic-bezier(0.4, 0, 0.6, 1), opacity ${closeDur}ms cubic-bezier(0.4, 0, 0.6, 1)`;
        el.style.transform = 'scaleY(1)';
        // Increased from 0.7 to 0.95 for much more visible blinks
        el.style.opacity = '0.95';
      });

      // Open phase after hold
      setTimeout(() => {
        (Object.keys(lids) as Lid[]).forEach(key => {
          const el = lids[key]; if (!el) return;
          el.style.transition = `transform ${openDur}ms cubic-bezier(0.2, 0, 0.3, 1), opacity ${openDur}ms cubic-bezier(0.2, 0, 0.3, 1)`;
          el.style.transform = 'scaleY(0)';
          el.style.opacity = `${lid[key]?.opacity ?? 0}`;
        });
      }, closeDur + holdDur);
    };

    if (blinkNow) {
      once();
      setBlinkNow(false);
      return;
    }

    const schedule = () => {
      // Faster blink rate for calibration (1.5s mean vs 4s in production)
      const mean = 1500; // ms - much faster for easier calibration
      const jitter = 0.5;
      const min = Math.max(250, mean * (1 - jitter));
      const max = mean * (1 + jitter);
      const delay = min + Math.random() * (max - min);
      timer = setTimeout(() => { once(); schedule(); }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [autoBlink, blinkNow, lid]);

  // Apply rig root transform origin per calibrator control
  useEffect(() => {
    const rr = refs.current.rigRoot; if (!rr) return;
    (rr.style as any).transformOrigin = `200px ${advancedAnimations.head.originY}px`;
  }, [advancedAnimations.head.originY, svgMarkup]);

  // Head micro-movement preview: sway + tilt + emphasis nods (uses mouth 'open' as amplitude proxy)
  useEffect(() => {
    const rr = refs.current.rigRoot; if (!rr) return;
    let raf = 0; let lastT = performance.now();
    let impulse = 0; let impulseVel = 0; let cooldown = 0;
    const twoPi = Math.PI * 2;
    let sm = 0; // smoothed open

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
	      sm = sm * 0.85 + open * 0.15;
	      const speakLevel = Math.max(sm, animateMouth ? 0.4 : 0);
	      const idleGain = Math.max(0.15, 1 - speakLevel * 0.9);

	      // Amplitude modulation: slowly vary the overall movement intensity
	      const ampMod = 0.7 + 0.3 * Math.sin((t + ampModPhase) / ampModPeriod * twoPi);

	      // Layer 1: Breathing - primary vertical movement with natural ease-in-out
	      const breathRaw = Math.sin((t + breathPhase) / breathPeriod * twoPi);
	      const breathEased = easeInOutCubic((breathRaw + 1) / 2) * 2 - 1; // Apply easing to sine
	      const breathY = breathEased * advancedAnimations.head.swayPx * 0.5 * idleGain * ampMod; // Increased from 0.6 to 0.5 (but base is now 2.5px)

	      // Layer 2: Slow drift - gentle random walk in both axes
	      const driftX = Math.sin((t + driftPhaseX) / driftPeriodX * twoPi) * advancedAnimations.head.swayPx * 0.35 * idleGain * ampMod; // Increased from 0.25
	      const driftY = Math.sin((t + driftPhaseY) / driftPeriodY * twoPi) * advancedAnimations.head.swayPx * 0.25 * idleGain * ampMod; // Increased from 0.3

	      // Layer 3: Micro-adjustments - small periodic corrections
	      const microX = Math.sin((t + microPhaseX) / microPeriodX * twoPi) * advancedAnimations.head.swayPx * 0.2 * idleGain; // Increased from 0.15
	      const microY = Math.sin((t + microPhaseY) / microPeriodY * twoPi) * advancedAnimations.head.swayPx * 0.15 * idleGain; // Increased from 0.2
	      const microTiltRaw = Math.sin((t + microPhaseTilt) / microPeriodTilt * twoPi);
	      const microTiltEased = smoothstep((microTiltRaw + 1) / 2) * 2 - 1;
	      const microTilt = microTiltEased * advancedAnimations.head.tiltDeg * 0.6 * idleGain * ampMod; // Increased from 0.5

	      // Layer 4: Tremor - very subtle high-frequency noise
	      const tremorX = Math.sin((t + tremorPhaseX) / tremorPeriodX * twoPi) * advancedAnimations.head.swayPx * 0.08 * idleGain; // Increased from 0.05
	      const tremorY = Math.sin((t + tremorPhaseY) / tremorPeriodY * twoPi) * advancedAnimations.head.swayPx * 0.08 * idleGain; // Increased from 0.05

	      // Layer 5: Slow rotational drift
	      const driftTiltRaw = Math.sin((t + driftPhaseY * 1.3) / (driftPeriodY * 1.4) * twoPi);
	      const driftTiltEased = smoothstep((driftTiltRaw + 1) / 2) * 2 - 1;
	      const driftTilt = driftTiltEased * advancedAnimations.head.tiltDeg * 0.5 * idleGain * ampMod; // Increased from 0.4

	      // Combine all layers
	      const translateX = driftX + microX + tremorX;
	      const translateY = breathY + driftY + microY + tremorY;
	      const baseTilt = microTilt + driftTilt;

	      // Emphasis nod impulse
	      cooldown = Math.max(0, cooldown - dt);
	      const spike = sm > advancedAnimations.head.nodThreshold && cooldown === 0;
	      if (spike) { impulseVel += 0.012 + Math.random() * 0.008; cooldown = 1800 + Math.random() * 1400; }
	      impulse += impulseVel * dt;
	      impulseVel += (-0.015 * impulse - 0.008 * impulseVel) * dt;
	      const maxImp = advancedAnimations.head.nodMaxDeg * (animateMouth ? 1 : 0.6);
	      impulse = Math.max(-maxImp, Math.min(maxImp, impulse));

	      const totalRotate = baseTilt + impulse;
	      rr.style.transform = `translate(${translateX.toFixed(3)}px, ${translateY.toFixed(3)}px) rotate(${totalRotate.toFixed(3)}deg)`;
	      raf = requestAnimationFrame(loop);
	    };
	    raf = requestAnimationFrame(loop);
	    return () => cancelAnimationFrame(raf);
	  }, [advancedAnimations.head.swayPx, advancedAnimations.head.tiltDeg, advancedAnimations.head.nodThreshold, advancedAnimations.head.nodMaxDeg, animateMouth, open]);

	  // Gaze shift preview (slow layer)
	  useEffect(() => {
	    const pL = refs.current.pupils.L, pR = refs.current.pupils.R; if (!pL || !pR) return;
	    if (!advancedAnimations.gaze.enabled) return;
	    let alive = true; let timer: any;
	    const schedule = () => {
	      if (!alive) return;
	      const mean = advancedAnimations.gaze.intervalSec * 1000;
	      const jitter = 0.3 + Math.random() * 0.6;
	      const baseDelay = mean * jitter;
	      const delay = animateMouth ? baseDelay * 1.5 : baseDelay;
	      timer = setTimeout(shift, delay);
	    };
	    const shift = () => {
	      if (!alive) return;
	      const dx = (Math.random() * 2 - 1) * advancedAnimations.gaze.lateralPx;
	      const dy = (Math.random() * 2 - 1) * advancedAnimations.gaze.verticalPx;
	      const goMs = 300 + Math.random() * 400;
	      const holdMs = 2000 + Math.random() * 2000;
	      [pL, pR].forEach((el) => {
	        el.style.transition = `transform ${goMs}ms cubic-bezier(0.2, 0, 0.2, 1)`;
	        el.style.setProperty('--gazeDx', `${dx.toFixed(2)}px`);
	        el.style.setProperty('--gazeDy', `${dy.toFixed(2)}px`);
	      });
	      const far = Math.abs(dx) > advancedAnimations.gaze.lidThresholdPx;
	      const lidUL = refs.current.lids.lidUpperL; const lidUR = refs.current.lids.lidUpperR;
	      if (lidUL && lidUR) {
	        [lidUL, lidUR].forEach(el => { el.style.transition = 'opacity 240ms ease'; el.style.opacity = far ? '0.12' : '0'; });
	      }
	      setTimeout(() => {
	        [pL, pR].forEach((el) => {
	          el.style.transition = `transform ${goMs + 120}ms cubic-bezier(0.2, 0, 0.2, 1)`;
	          el.style.setProperty('--gazeDx', `0px`);
	          el.style.setProperty('--gazeDy', `0px`);
	        });
	        if (lidUL && lidUR) { [lidUL, lidUR].forEach(el => { el.style.transition = 'opacity 240ms ease'; el.style.opacity = '0'; }); }
	        schedule();
	      }, holdMs + goMs);
	    };
	    schedule();
	    return () => { alive = false; clearTimeout(timer); };
	  }, [advancedAnimations.gaze.enabled, advancedAnimations.gaze.intervalSec, advancedAnimations.gaze.lateralPx, advancedAnimations.gaze.verticalPx, advancedAnimations.gaze.lidThresholdPx, animateMouth]);

	  // Pupil dilation preview
	  useEffect(() => {
	    const pL = refs.current.pupils.L, pR = refs.current.pupils.R; if (!pL || !pR) return;
	    if (!advancedAnimations.dilation.enabled) return;
	    let raf = 0;
	    const baseL = parseFloat(pL.getAttribute('r') || '4');
	    const baseR = parseFloat(pR.getAttribute('r') || '3');
	    const phaseL = Math.random() * Math.PI * 2; const phaseR = Math.random() * Math.PI * 2;
	    const mean = advancedAnimations.dilation.periodSec * 1000;
	    const periodL = mean * (0.7 + Math.random() * 0.6);
	    const periodR = mean * (0.7 + Math.random() * 0.6);
	    const loop = (t: number) => {
	      const dL = Math.sin((t + phaseL) / periodL * Math.PI * 2);
	      const dR = Math.sin((t + phaseR) / periodR * Math.PI * 2);
	      const rl = baseL + dL * advancedAnimations.dilation.rangeLPx;
	      const rr = baseR + dR * advancedAnimations.dilation.rangeRPx;
	      pL.setAttribute('r', rl.toFixed(2));
	      pR.setAttribute('r', rr.toFixed(2));
	      raf = requestAnimationFrame(loop);
	    };
	    raf = requestAnimationFrame(loop);
	    return () => cancelAnimationFrame(raf);
	  }, [advancedAnimations.dilation.enabled, advancedAnimations.dilation.rangeLPx, advancedAnimations.dilation.rangeRPx, advancedAnimations.dilation.periodSec]);

  // Mouth viseme preview: drive rx/ry/cy/opacity relative to calibrated base
  useEffect(() => {
    if (!animateMouth) return;
    const el = refs.current.mouth; if (!el) return;
    const baseRx = mouth.rx, baseRy = mouth.ry, baseCy = mouth.cy;
    const rx = baseRx + wide * (baseRx * mouthAnim.wideFactor) + (1 - round) * 3;
    const ry = baseRy + open * (baseRy * 5.5) + round * 6;
    el.setAttribute('rx', `${rx}`);
    el.setAttribute('ry', `${ry}`);
    el.setAttribute('cy', `${baseCy + open * mouthAnim.verticalMovePx}`);
    // Dynamic opacity preview (style overrides attribute during preview)

    (el.style as any).transition = 'opacity 100ms ease-out';
    el.style.opacity = String(Math.min(1, Math.max(0, mouth.opacity + open * mouthAnim.opacityRange)));

    // Drive mouth cavity for depth effect
    if (refs.current.mouthCavity) {
      const cavity = refs.current.mouthCavity;
      const cavityRx = rx * 0.75;
      const cavityRy = Math.max(0.5, ry * 0.85);
      cavity.setAttribute('rx', `${cavityRx}`);
      cavity.setAttribute('ry', `${cavityRy}`);
      cavity.setAttribute('cy', `${baseCy + open * mouthAnim.verticalMovePx}`);
      // Enhanced visibility: lower threshold (0.10), higher max opacity (0.90), faster ramp-up (1.5x)
      const cavityOpacity = open < 0.10 ? 0 : Math.min(0.90, (open - 0.10) * 1.5);
      (cavity.style as any).transition = 'opacity 100ms ease-out';
      cavity.style.opacity = String(cavityOpacity);
    }
  }, [animateMouth, open, wide, round, mouth.rx, mouth.ry, mouth.cy, mouth.opacity, mouthAnim]);

  // Auto mouth animation loop to simulate speech-like motion
  useEffect(() => {
    if (!autoMouth) return;

    let raf = 0;

    // A small set of target visemes; the loop picks among them with variable timing
    const visemes = [
      { open: 0.05, wide: 0.20, round: 0.10 }, // closed/rest
      { open: 0.22, wide: 0.25, round: 0.10 }, // slight open
      { open: 0.80, wide: 0.30, round: 0.05 }, // "ah"
      { open: 0.45, wide: 0.10, round: 0.85 }, // "oo"
      { open: 0.35, wide: 0.85, round: 0.05 }, // "ee"
      { open: 0.12, wide: 0.10, round: 0.18 }, // tight
    ];

    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    let from = { open, wide, round };
    let to = visemes[(Math.random() * visemes.length) | 0];
    let phase: 'transition' | 'hold' = 'transition';
    let start = performance.now();
    let duration = 140 + Math.random() * 220; // 140–360ms
    let holdDur = 80 + Math.random() * 180;   // 80–260ms

    const step = (ts: number) => {
      // Even if auto is on, respect the Animate mouth toggle for DOM updates
      // Auto only drives the slider values (open/wide/round)
      if (phase === 'transition') {
        const t = Math.min(1, (ts - start) / duration);
        const k = easeInOutCubic(t);
        const nextOpen = from.open + (to.open - from.open) * k;
        const nextWide = from.wide + (to.wide - from.wide) * k;
        const nextRound = from.round + (to.round - from.round) * k;
        setOpen(nextOpen);
        setWide(nextWide);
        setRound(nextRound);
        if (t >= 1) {
          phase = 'hold';
          start = ts;
        }
      } else {
        if (ts - start >= holdDur) {
          phase = 'transition';
          from = { open: to.open, wide: to.wide, round: to.round };
          // Avoid picking a nearly identical next viseme too often
          let next = visemes[(Math.random() * visemes.length) | 0];
          const dist = (a: typeof from, b: typeof from) => Math.abs(a.open - b.open) + Math.abs(a.wide - b.wide) + Math.abs(a.round - b.round);
          if (dist(next, from) < 0.25) next = visemes[(Math.random() * visemes.length) | 0];
          to = next;
          duration = 120 + Math.random() * 240; // retime per hop
          holdDur = 60 + Math.random() * 180;
          start = ts;
        }
      }
      raf = requestAnimationFrame(step);
    };


    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [autoMouth]);
  // Apply rig root transform origin per calibrator control (top-level)
  useEffect(() => {
    const rr = refs.current.rigRoot; if (!rr) return;
    (rr.style as any).transformOrigin = `200px ${advancedAnimations.head.originY}px`;
    rr.style.setProperty('transform-box', 'view-box');
  }, [advancedAnimations.head.originY, svgMarkup]);

  // Head micro-movement preview: sway + tilt + emphasis nods (uses mouth 'open' as amplitude proxy)
  useEffect(() => {
    const rr = refs.current.rigRoot; if (!rr) return;
    let raf = 0; let lastT = performance.now();
    let impulse = 0; let impulseVel = 0; let cooldown = 0;
    const twoPi = Math.PI * 2;
    const phase1 = Math.random() * twoPi;
    const phase2 = Math.random() * twoPi;
    const period1 = 9000 + Math.random() * 4000;
    const period2 = 12000 + Math.random() * 6000;
    let sm = 0; // smoothed open

    const loop = (t: number) => {
      const dt = t - lastT; lastT = t;
      sm = sm * 0.85 + open * 0.15;
      const speakLevel = Math.max(sm, animateMouth ? 0.4 : 0);
      const idleGain = Math.max(0.15, 1 - speakLevel * 0.9);
      const sway = Math.sin((t + phase1) / period1 * twoPi) * advancedAnimations.head.swayPx * idleGain;
      const tilt = Math.sin((t + phase2) / period2 * twoPi) * advancedAnimations.head.tiltDeg * idleGain;
      cooldown = Math.max(0, cooldown - dt);
      const spike = sm > advancedAnimations.head.nodThreshold && cooldown === 0;
      if (spike) { impulseVel += 0.012 + Math.random() * 0.008; cooldown = 1800 + Math.random() * 1400; }
      impulse += impulseVel * dt;
      impulseVel += (-0.015 * impulse - 0.008 * impulseVel) * dt;
      const maxImp = advancedAnimations.head.nodMaxDeg * (animateMouth ? 1 : 0.6);
      impulse = Math.max(-maxImp, Math.min(maxImp, impulse));
      rr.style.transform = `translate(0px, ${sway.toFixed(3)}px) rotate(${(tilt + impulse).toFixed(3)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [advancedAnimations.head.swayPx, advancedAnimations.head.tiltDeg, advancedAnimations.head.nodThreshold, advancedAnimations.head.nodMaxDeg, animateMouth, open]);

  // Gaze shift preview (slow layer)
  useEffect(() => {
    const pL = refs.current.pupils.L, pR = refs.current.pupils.R; if (!pL || !pR) return;
    if (!advancedAnimations.gaze.enabled) return;
    let alive = true; let timer: any;
    const schedule = () => {
      if (!alive) return;
      const mean = advancedAnimations.gaze.intervalSec * 1000;
      const jitter = 0.3 + Math.random() * 0.6;
      const baseDelay = mean * jitter;
      const delay = animateMouth ? baseDelay * 1.5 : baseDelay;
      timer = setTimeout(shift, delay);
    };
    const shift = () => {
      if (!alive) return;
      const dx = (Math.random() * 2 - 1) * advancedAnimations.gaze.lateralPx;
      const dy = (Math.random() * 2 - 1) * advancedAnimations.gaze.verticalPx;
      const goMs = 300 + Math.random() * 400;
      const holdMs = 2000 + Math.random() * 2000;
      [pL, pR].forEach((el) => {
        el.style.transition = `transform ${goMs}ms cubic-bezier(0.2, 0, 0.2, 1)`;
        el.style.setProperty('--gazeDx', `${dx.toFixed(2)}px`);
        el.style.setProperty('--gazeDy', `${dy.toFixed(2)}px`);
      });
      const far = Math.abs(dx) > advancedAnimations.gaze.lidThresholdPx;
      const lidUL = refs.current.lids.lidUpperL; const lidUR = refs.current.lids.lidUpperR;
      if (lidUL && lidUR) {
        [lidUL, lidUR].forEach(el => { el.style.transition = 'opacity 240ms ease'; el.style.opacity = far ? '0.12' : '0'; });
      }
      setTimeout(() => {
        [pL, pR].forEach((el) => {
          el.style.transition = `transform ${goMs + 120}ms cubic-bezier(0.2, 0, 0.2, 1)`;
          el.style.setProperty('--gazeDx', `0px`);
          el.style.setProperty('--gazeDy', `0px`);
        });
        if (lidUL && lidUR) { [lidUL, lidUR].forEach(el => { el.style.transition = 'opacity 240ms ease'; el.style.opacity = '0'; }); }
        schedule();
      }, holdMs + goMs);
    };
    schedule();
    return () => { alive = false; clearTimeout(timer); };
  }, [advancedAnimations.gaze.enabled, advancedAnimations.gaze.intervalSec, advancedAnimations.gaze.lateralPx, advancedAnimations.gaze.verticalPx, advancedAnimations.gaze.lidThresholdPx, animateMouth]);

  // Pupil dilation preview
  useEffect(() => {
    const pL = refs.current.pupils.L, pR = refs.current.pupils.R; if (!pL || !pR) return;
    if (!advancedAnimations.dilation.enabled) return;
    let raf = 0;
    const baseL = parseFloat(pL.getAttribute('r') || '4');
    const baseR = parseFloat(pR.getAttribute('r') || '3');
    const phaseL = Math.random() * Math.PI * 2; const phaseR = Math.random() * Math.PI * 2;
    const mean = advancedAnimations.dilation.periodSec * 1000;
    const periodL = mean * (0.7 + Math.random() * 0.6);
    const periodR = mean * (0.7 + Math.random() * 0.6);
    const loop = (t: number) => {
      const dL = Math.sin((t + phaseL) / periodL * Math.PI * 2);
      const dR = Math.sin((t + phaseR) / periodR * Math.PI * 2);
      const rl = baseL + dL * advancedAnimations.dilation.rangeLPx;
      const rr = baseR + dR * advancedAnimations.dilation.rangeRPx;
      pL.setAttribute('r', rl.toFixed(2));
      pR.setAttribute('r', rr.toFixed(2));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [advancedAnimations.dilation.enabled, advancedAnimations.dilation.rangeLPx, advancedAnimations.dilation.rangeRPx, advancedAnimations.dilation.periodSec]);


  // Save calibration to files
  const handleSaveCalibration = async () => {
    try {
      setSaveStatus('Saving...');

      // Get current SVG markup from DOM
      const svg = containerRef.current?.querySelector('svg');
      if (!svg) throw new Error('SVG not found');

      // CRITICAL: Reset all animated elements to their base calibrated values before saving
      // This ensures we save the exact values from the UI state, not the animated values

      // Store current animation states to restore later
      const wasAnimatingMouth = animateMouth;
      const wasAutoMouth = autoMouth;
      const wasAutoBlink = autoBlink;

      // Temporarily disable animations
      setAnimateMouth(false);
      setAutoMouth(false);
      setAutoBlink(false);

      // Wait for next frame to ensure animations have stopped
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Manually reset mouth to exact calibrated base values
      const mouthEl = refs.current.mouth;
      if (mouthEl) {
        mouthEl.setAttribute('cx', String(mouth.cx));
        mouthEl.setAttribute('cy', String(mouth.cy));
        mouthEl.setAttribute('rx', String(mouth.rx));
        mouthEl.setAttribute('ry', String(mouth.ry));
        mouthEl.setAttribute('opacity', String(mouth.opacity));
        mouthEl.style.opacity = ''; // Clear any style overrides
      }

      // Reset eyelids to base calibrated values
      (Object.keys(lid) as Lid[]).forEach(key => {
        const el = refs.current.lids[key];
        if (el) {
          el.setAttribute('x', String(lid[key].x));
          el.setAttribute('y', String(lid[key].y));
          el.setAttribute('width', String(lid[key].width));
          el.setAttribute('height', String(lid[key].height));
          el.setAttribute('opacity', String(lid[key].opacity));
          el.style.transform = ''; // Clear any animation transforms
          el.style.opacity = ''; // Clear any style overrides
        }
      });

      // Reset pupils to base calibrated values
      ['L', 'R'].forEach(side => {
        const el = refs.current.pupils[side as 'L' | 'R'];
        const p = pupil[side as 'L' | 'R'];
        if (el && p) {
          el.setAttribute('cx', String(p.cx));
          el.setAttribute('cy', String(p.cy));
          el.setAttribute('r', String(p.r));
          el.setAttribute('opacity', String(p.opacity));
          el.style.setProperty('--gazeDx', '0px'); // Clear gaze shifts
          el.style.setProperty('--gazeDy', '0px');
        }
      });

      // Reset eyes to base calibrated values
      ['L', 'R'].forEach(side => {
        const el = refs.current.eyes[side as 'L' | 'R'];
        const e = eye[side as 'L' | 'R'];
        if (el && e) {
          el.setAttribute('cx', String(e.cx));
          el.setAttribute('cy', String(e.cy));
          el.setAttribute('rx', String(e.rx));
          el.setAttribute('ry', String(e.ry));
          el.setAttribute('opacity', String(e.opacity));
        }
      });

      // Reset rig root transform
      const rigRoot = refs.current.rigRoot;
      if (rigRoot) {
        rigRoot.style.transform = ''; // Clear head movement transforms
      }

      // Wait one more frame to ensure DOM is updated
      await new Promise(resolve => requestAnimationFrame(resolve));

      // NOW capture the SVG with exact calibrated values
      const svgContent = svg.outerHTML;

      // Restore animation states
      setAnimateMouth(wasAnimatingMouth);
      setAutoMouth(wasAutoMouth);
      setAutoBlink(wasAutoBlink);

      // Build animationConfig object
      const animationConfig = {
        mouthScale: currentPersona?.animationConfig?.mouthScale ?? 1.0,
        showTeethHint: currentPersona?.animationConfig?.showTeethHint ?? false,
        maxOpen: currentPersona?.animationConfig?.maxOpen ?? 0.6,
        mouthSmoothing: currentPersona?.animationConfig?.mouthSmoothing ?? 0.12,
        blinkRateSec: currentPersona?.animationConfig?.blinkRateSec ?? 4.0,
        blinkJitterPct: currentPersona?.animationConfig?.blinkJitterPct ?? 0.5,
        breatheScale: currentPersona?.animationConfig?.breatheScale ?? 1.0,
        swayScale: currentPersona?.animationConfig?.swayScale ?? 0.85,
        speakingGlow: currentPersona?.animationConfig?.speakingGlow ?? 0.6,
        headSwayPx: advancedAnimations.head.swayPx,
        headTiltDeg: advancedAnimations.head.tiltDeg,
        nodThreshold: advancedAnimations.head.nodThreshold,
        nodMaxDeg: advancedAnimations.head.nodMaxDeg,
        headOriginYPx: advancedAnimations.head.originY,
        gazeEnabled: advancedAnimations.gaze.enabled,
        gazeIntervalSec: advancedAnimations.gaze.intervalSec,
        gazeLateralPx: advancedAnimations.gaze.lateralPx,
        gazeVerticalPx: advancedAnimations.gaze.verticalPx,
        lidCoupleThresholdPx: advancedAnimations.gaze.lidThresholdPx,
        dilationEnabled: advancedAnimations.dilation.enabled,
        dilationRangeLPx: advancedAnimations.dilation.rangeLPx,
        dilationRangeRPx: advancedAnimations.dilation.rangeRPx,
        dilationPeriodSec: advancedAnimations.dilation.periodSec,
      };

      // Save via Electron IPC
      if (window.electron?.calibrationSaveSvg && window.electron?.calibrationSavePersonaConfig) {
        const svgResult = await window.electron.calibrationSaveSvg(selectedPersona, svgContent);
        if (!svgResult.success) throw new Error(`SVG save failed: ${svgResult.error}`);

        const configResult = await window.electron.calibrationSavePersonaConfig(selectedPersona, animationConfig);
        if (!configResult.success) throw new Error(`Config save failed: ${configResult.error}`);

        setSaveStatus(`✅ Calibration saved for ${currentPersona?.name}`);
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        throw new Error('Electron IPC not available. Make sure you are running in Electron.');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  // Reset to current saved values
  const handleReset = () => {
    // Reload SVG to reset all values
    setSvgMarkup(null);
    setTimeout(() => {
      fetch(HYBRID_URL).then(res => res.text()).then(text => setSvgMarkup(text));
    }, 50);
  };

  const LidControls = (props: { id: Lid; label: string }) => {
    const v = lid[props.id];
    return (
      <fieldset style={{ marginBottom: 12 }}>

        <legend>{props.label}</legend>
        <div className="row">
          <label>x</label><input type="number" value={v.x} onChange={e => setLid({ ...lid, [props.id]: { ...v, x: parseFloat(e.target.value) } })} />
          <label>y</label><input type="number" value={v.y} onChange={e => setLid({ ...lid, [props.id]: { ...v, y: parseFloat(e.target.value) } })} />
        </div>
        <div className="row">
          <label>w</label><input type="number" value={v.width} onChange={e => setLid({ ...lid, [props.id]: { ...v, width: parseFloat(e.target.value) } })} />
          <label>h</label><input type="number" value={v.height} onChange={e => setLid({ ...lid, [props.id]: { ...v, height: parseFloat(e.target.value) } })} />
        </div>
        <div className="row">
          <label>opacity</label><input type="number" step={0.05} min={0} max={1} value={v.opacity} onChange={e => setLid({ ...lid, [props.id]: { ...v, opacity: parseFloat(e.target.value) } })} />
        </div>
      </fieldset>
    );
  };

  const EyeControls = (props: { side: 'L' | 'R'; label: string }) => {
    const v = eye[props.side];
    return (
      <fieldset style={{ marginBottom: 12 }}>
        <legend>{props.label}</legend>
        <div className="row"><label>cx</label><input type="number" value={v.cx} onChange={e => setEye({ ...eye, [props.side]: { ...v, cx: parseFloat(e.target.value) } })} /></div>
        <div className="row"><label>cy</label><input type="number" value={v.cy} onChange={e => setEye({ ...eye, [props.side]: { ...v, cy: parseFloat(e.target.value) } })} /></div>
        <div className="row"><label>rx</label><input type="number" value={v.rx} onChange={e => setEye({ ...eye, [props.side]: { ...v, rx: parseFloat(e.target.value) } })} /></div>
        <div className="row"><label>ry</label><input type="number" value={v.ry} onChange={e => setEye({ ...eye, [props.side]: { ...v, ry: parseFloat(e.target.value) } })} /></div>
        <div className="row"><label>opacity</label><input type="number" step={0.05} min={0} max={1} value={v.opacity} onChange={e => setEye({ ...eye, [props.side]: { ...v, opacity: parseFloat(e.target.value) } })} /></div>
      </fieldset>
    );
  };

  const PupilControls = (props: { side: 'L' | 'R'; label: string }) => {
    const v = pupil[props.side];
    return (
      <fieldset style={{ marginBottom: 12 }}>
        <legend>{props.label}</legend>
        <div className="row"><label>cx</label><input type="number" value={v.cx} onChange={e => setPupil({ ...pupil, [props.side]: { ...v, cx: parseFloat(e.target.value) } })} /></div>
        <div className="row"><label>cy</label><input type="number" value={v.cy} onChange={e => setPupil({ ...pupil, [props.side]: { ...v, cy: parseFloat(e.target.value) } })} /></div>
        <div className="row"><label>r</label><input type="number" value={v.r} onChange={e => setPupil({ ...pupil, [props.side]: { ...v, r: parseFloat(e.target.value) } })} /></div>
        <div className="row"><label>opacity</label><input type="number" step={0.05} min={0} max={1} value={v.opacity} onChange={e => setPupil({ ...pupil, [props.side]: { ...v, opacity: parseFloat(e.target.value) } })} /></div>
      </fieldset>
    );
  };


  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ flex: '0 0 420px', padding: 16, background: '#0b1220', color: '#e5e7eb', overflowY: 'auto', maxHeight: '100%' }}>
        <h2>Hybrid Avatar Calibrator</h2>

        {/* Persona Selector */}
        <fieldset style={{ marginBottom: 12 }}>
          <legend>Select Persona</legend>
          <select
            value={selectedPersona}
            onChange={e => setSelectedPersona(e.target.value as PersonaId)}
            style={{ width: '100%', padding: '8px', background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: '6px', fontSize: '14px' }}
          >
            <option value="maya">Maya Ríos</option>
            <option value="otto">Prof. Otto Reinhardt</option>
            <option value="sarah">Dr. Sarah Chen</option>
            <option value="marcus">Dr. Marcus Webb</option>
            <option value="jessica">Lt. Colonel Jessica Hayes</option>
          </select>
        </fieldset>

        {/* Save/Reset Buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={handleSaveCalibration} style={{ flex: 1, background: '#059669', padding: '10px' }}>
            💾 Save Calibration
          </button>
          <button onClick={handleReset} style={{ flex: 1, background: '#dc2626', padding: '10px' }}>
            ↺ Reset
          </button>
        </div>

        {saveStatus && (
          <div style={{
            padding: '8px 12px',
            marginBottom: 12,
            borderRadius: '6px',
            background: saveStatus.startsWith('✅') ? '#065f46' : '#991b1b',
            color: '#fff',
            fontSize: '13px'
          }}>
            {saveStatus}
          </div>
        )}

        <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
          Adjust overlays to align with {currentPersona?.name}'s facial features.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <LidControls id="lidUpperL" label="Upper Left Lid" />
          <LidControls id="lidUpperR" label="Upper Right Lid" />

        <details open={advOpen} onToggle={(e) => setAdvOpen((e.currentTarget as HTMLDetailsElement).open)} style={{ marginTop: 12, gridColumn: '1 / -1', position: 'relative', zIndex: 1 }}>
          <summary style={{ color: '#93c5fd', cursor: 'pointer' }}>Advanced Animations</summary>
          <div style={{ paddingTop: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            <fieldset>
              <legend>Head micro-movement</legend>
              <div className="row"><label>Head sway amplitude (px)</label><input type="range" min={0} max={5.0} step={0.05} value={advancedAnimations.head.swayPx} onChange={e => setAdvancedAnimations({ ...advancedAnimations, head: { ...advancedAnimations.head, swayPx: parseFloat(e.target.value) } })} /><span>{advancedAnimations.head.swayPx.toFixed(2)}</span></div>
              <div className="row"><label>Head tilt amplitude (deg)</label><input type="range" min={0} max={4.0} step={0.05} value={advancedAnimations.head.tiltDeg} onChange={e => setAdvancedAnimations({ ...advancedAnimations, head: { ...advancedAnimations.head, tiltDeg: parseFloat(e.target.value) } })} /><span>{advancedAnimations.head.tiltDeg.toFixed(2)}</span></div>
              <div className="row"><label>Emphasis nod threshold</label><input type="range" min={0.3} max={0.9} step={0.01} value={advancedAnimations.head.nodThreshold} onChange={e => setAdvancedAnimations({ ...advancedAnimations, head: { ...advancedAnimations.head, nodThreshold: parseFloat(e.target.value) } })} /><span>{advancedAnimations.head.nodThreshold.toFixed(2)}</span></div>
              <div className="row"><label>Emphasis nod strength (deg)</label><input type="range" min={0} max={3.0} step={0.05} value={advancedAnimations.head.nodMaxDeg} onChange={e => setAdvancedAnimations({ ...advancedAnimations, head: { ...advancedAnimations.head, nodMaxDeg: parseFloat(e.target.value) } })} /><span>{advancedAnimations.head.nodMaxDeg.toFixed(2)}</span></div>
              <div className="row"><label>Transform origin Y (px)</label><input type="range" min={140} max={200} step={1} value={advancedAnimations.head.originY} onChange={e => setAdvancedAnimations({ ...advancedAnimations, head: { ...advancedAnimations.head, originY: parseFloat(e.target.value) } })} /><span>{advancedAnimations.head.originY.toFixed(0)}</span></div>
            </fieldset>

            <fieldset>
              <legend>Eye gaze shifts</legend>
              <div className="row"><label><input type="checkbox" checked={advancedAnimations.gaze.enabled} onChange={e => setAdvancedAnimations({ ...advancedAnimations, gaze: { ...advancedAnimations.gaze, enabled: e.target.checked } })} /> Gaze shift enabled</label></div>
              <div className="row"><label>Gaze interval (sec)</label><input type="range" min={2} max={12} step={0.1} value={advancedAnimations.gaze.intervalSec} onChange={e => setAdvancedAnimations({ ...advancedAnimations, gaze: { ...advancedAnimations.gaze, intervalSec: parseFloat(e.target.value) } })} /><span>{advancedAnimations.gaze.intervalSec.toFixed(1)}</span></div>
              <div className="row"><label>Lateral range (px)</label><input type="range" min={0} max={6} step={0.1} value={advancedAnimations.gaze.lateralPx} onChange={e => setAdvancedAnimations({ ...advancedAnimations, gaze: { ...advancedAnimations.gaze, lateralPx: parseFloat(e.target.value) } })} /><span>{advancedAnimations.gaze.lateralPx.toFixed(1)}</span></div>
              <div className="row"><label>Vertical range (px)</label><input type="range" min={0} max={4} step={0.1} value={advancedAnimations.gaze.verticalPx} onChange={e => setAdvancedAnimations({ ...advancedAnimations, gaze: { ...advancedAnimations.gaze, verticalPx: parseFloat(e.target.value) } })} /><span>{advancedAnimations.gaze.verticalPx.toFixed(1)}</span></div>
              <div className="row"><label>Lid coupling threshold (px)</label><input type="range" min={2} max={5} step={0.1} value={advancedAnimations.gaze.lidThresholdPx} onChange={e => setAdvancedAnimations({ ...advancedAnimations, gaze: { ...advancedAnimations.gaze, lidThresholdPx: parseFloat(e.target.value) } })} /><span>{advancedAnimations.gaze.lidThresholdPx.toFixed(1)}</span></div>
            </fieldset>

            <fieldset>
              <legend>Pupil dilation</legend>
              <div className="row"><label><input type="checkbox" checked={advancedAnimations.dilation.enabled} onChange={e => setAdvancedAnimations({ ...advancedAnimations, dilation: { ...advancedAnimations.dilation, enabled: e.target.checked } })} /> Dilation enabled</label></div>
              <div className="row"><label>Dilation range (left) px</label><input type="range" min={0} max={1.0} step={0.01} value={advancedAnimations.dilation.rangeLPx} onChange={e => setAdvancedAnimations({ ...advancedAnimations, dilation: { ...advancedAnimations.dilation, rangeLPx: parseFloat(e.target.value) } })} /><span>{advancedAnimations.dilation.rangeLPx.toFixed(2)}</span></div>
              <div className="row"><label>Dilation range (right) px</label><input type="range" min={0} max={1.0} step={0.01} value={advancedAnimations.dilation.rangeRPx} onChange={e => setAdvancedAnimations({ ...advancedAnimations, dilation: { ...advancedAnimations.dilation, rangeRPx: parseFloat(e.target.value) } })} /><span>{advancedAnimations.dilation.rangeRPx.toFixed(2)}</span></div>
              <div className="row"><label>Dilation period (sec)</label><input type="range" min={5} max={20} step={0.5} value={advancedAnimations.dilation.periodSec} onChange={e => setAdvancedAnimations({ ...advancedAnimations, dilation: { ...advancedAnimations.dilation, periodSec: parseFloat(e.target.value) } })} /><span>{advancedAnimations.dilation.periodSec.toFixed(1)}</span></div>
            </fieldset>
          </div>
        </details>

          <LidControls id="lidLowerL" label="Lower Left Lid" />
          <LidControls id="lidLowerR" label="Lower Right Lid" />
        </div>

        <fieldset style={{ marginTop: 12 }}>
          <legend>Mouth</legend>
          <div className="row"><label>cx</label><input type="number" value={mouth.cx} onChange={e => setMouth({ ...mouth, cx: parseFloat(e.target.value) })} /></div>
          <div className="row"><label>cy</label><input type="number" value={mouth.cy} onChange={e => setMouth({ ...mouth, cy: parseFloat(e.target.value) })} /></div>
          <div className="row"><label>rx</label><input type="number" value={mouth.rx} onChange={e => setMouth({ ...mouth, rx: parseFloat(e.target.value) })} /></div>
          <div className="row"><label>ry</label><input type="number" value={mouth.ry} onChange={e => setMouth({ ...mouth, ry: parseFloat(e.target.value) })} /></div>
          <div className="row"><label>opacity</label><input type="number" step={0.05} min={0} max={1} value={mouth.opacity} onChange={e => setMouth({ ...mouth, opacity: parseFloat(e.target.value) })} /></div>
        </fieldset>

        <fieldset style={{ marginTop: 12 }}>
          <legend>Mouth Styling</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <fieldset>
              <legend>Gradient stops</legend>
              <div className="row"><label>Top color</label><input type="color" value={mouthGrad.topColor} onChange={e => setMouthGrad({ ...mouthGrad, topColor: e.target.value })} /></div>
              <div className="row"><label>Top opacity</label><input type="number" min={0} max={1} step={0.01} value={mouthGrad.topOpacity} onChange={e => setMouthGrad({ ...mouthGrad, topOpacity: parseFloat(e.target.value) })} /><span>{mouthGrad.topOpacity.toFixed(2)}</span></div>
              <div className="row"><label>Center color</label><input type="color" value={mouthGrad.midColor} onChange={e => setMouthGrad({ ...mouthGrad, midColor: e.target.value })} /></div>
              <div className="row"><label>Center opacity</label><input type="number" min={0} max={1} step={0.01} value={mouthGrad.midOpacity} onChange={e => setMouthGrad({ ...mouthGrad, midOpacity: parseFloat(e.target.value) })} /><span>{mouthGrad.midOpacity.toFixed(2)}</span></div>
              <div className="row"><label>Bottom color</label><input type="color" value={mouthGrad.botColor} onChange={e => setMouthGrad({ ...mouthGrad, botColor: e.target.value })} /></div>
              <div className="row"><label>Bottom opacity</label><input type="number" min={0} max={1} step={0.01} value={mouthGrad.botOpacity} onChange={e => setMouthGrad({ ...mouthGrad, botOpacity: parseFloat(e.target.value) })} /><span>{mouthGrad.botOpacity.toFixed(2)}</span></div>
            </fieldset>
            <fieldset>
              <legend>Feather / base opacity</legend>
              <div className="row"><label>Feather stdDev</label><input type="range" min={0} max={1.5} step={0.01} value={mouthFeatherStdDev} onChange={e => setMouthFeatherStdDev(parseFloat(e.target.value))} /></div>
              <div className="row"><label>Base opacity</label><input type="number" min={0} max={1} step={0.01} value={mouth.opacity} onChange={e => setMouth({ ...mouth, opacity: parseFloat(e.target.value) })} /><span>{mouth.opacity.toFixed(2)}</span></div>
            </fieldset>
          </div>
          <fieldset style={{ marginTop: 8 }}>
            <legend>Animation scaling</legend>
            <div className="row"><label>lipWide factor</label><input type="range" min={0} max={1} step={0.01} value={mouthAnim.wideFactor} onChange={e => setMouthAnim({ ...mouthAnim, wideFactor: parseFloat(e.target.value) })} /></div>
            <div className="row"><label>open vertical move (px)</label><input type="range" min={0} max={12} step={0.5} value={mouthAnim.verticalMovePx} onChange={e => setMouthAnim({ ...mouthAnim, verticalMovePx: parseFloat(e.target.value) })} /></div>
            <div className="row"><label>dynamic opacity range</label><input type="range" min={0} max={0.3} step={0.01} value={mouthAnim.opacityRange} onChange={e => setMouthAnim({ ...mouthAnim, opacityRange: parseFloat(e.target.value) })} /></div>
          </fieldset>
        </fieldset>


        <fieldset style={{ marginTop: 12 }}>
          <legend>Eyes (ellipses)</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <EyeControls side="L" label="Left Eye" />
            <EyeControls side="R" label="Right Eye" />
          </div>
        </fieldset>

        <fieldset style={{ marginTop: 12 }}>
          <legend>Pupils (circles)</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <PupilControls side="L" label="Left Pupil" />
            <PupilControls side="R" label="Right Pupil" />
          </div>
        </fieldset>


        <fieldset style={{ marginTop: 12 }}>
          <legend>Preview</legend>
          <div className="row"><label><input type="checkbox" checked={autoBlink} onChange={e => setAutoBlink(e.target.checked)} /> Auto blink</label></div>

          <button onClick={() => setBlinkNow(true)} style={{ marginTop: 6 }}>Blink now</button>
          <div style={{ height: 8 }} />
          <div className="row"><label><input type="checkbox" checked={animateMouth} onChange={e => setAnimateMouth(e.target.checked)} /> Animate mouth</label></div>
          <div className="row"><label><input type="checkbox" checked={autoMouth} onChange={e => setAutoMouth(e.target.checked)} /> Auto animate mouth</label></div>
          <div className="row">open <input type="range" min={0} max={1} step={0.01} value={open} onChange={e => setOpen(parseFloat(e.target.value))} /></div>
          <div className="row">wide <input type="range" min={0} max={1} step={0.01} value={wide} onChange={e => setWide(parseFloat(e.target.value))} /></div>
          <div className="row">round <input type="range" min={0} max={1} step={0.01} value={round} onChange={e => setRound(parseFloat(e.target.value))} /></div>
        </fieldset>

        <fieldset style={{ marginTop: 12 }}>
          <legend>Current values</legend>
          <button onClick={() => navigator.clipboard.writeText(JSON.stringify({ lids: lid, mouth, eyes: eye, pupils: pupil, mouthGradient: mouthGrad, mouthFeatherStdDev, mouthAnim, advancedAnimations }, null, 2))} style={{ marginBottom: 6 }}>Copy JSON</button>
          <button onClick={() => {
            const ac = {
              headSwayPx: advancedAnimations.head.swayPx,
              headTiltDeg: advancedAnimations.head.tiltDeg,
              nodThreshold: advancedAnimations.head.nodThreshold,
              nodMaxDeg: advancedAnimations.head.nodMaxDeg,
              headOriginYPx: advancedAnimations.head.originY,
              gazeEnabled: advancedAnimations.gaze.enabled,
              gazeIntervalSec: advancedAnimations.gaze.intervalSec,
              gazeLateralPx: advancedAnimations.gaze.lateralPx,
              gazeVerticalPx: advancedAnimations.gaze.verticalPx,
              lidCoupleThresholdPx: advancedAnimations.gaze.lidThresholdPx,
              dilationEnabled: advancedAnimations.dilation.enabled,
              dilationRangeLPx: advancedAnimations.dilation.rangeLPx,
              dilationRangeRPx: advancedAnimations.dilation.rangeRPx,
              dilationPeriodSec: advancedAnimations.dilation.periodSec,
            };
            navigator.clipboard.writeText(JSON.stringify(ac, null, 2));
          }} style={{ marginLeft: 8, marginBottom: 6 }}>Copy persona animationConfig</button>

          <textarea readOnly style={{ width: '100%', height: 160, fontFamily: 'monospace', fontSize: 12 }} value={JSON.stringify({ lids: lid, mouth, eyes: eye, pupils: pupil, mouthGradient: mouthGrad, mouthFeatherStdDev, mouthAnim, advancedAnimations }, null, 2)} />
          <p style={{ fontSize: 12, opacity: 0.8 }}>Copy these values into marcus_hybrid.svg or use them to adjust SvgAnimatedAvatar if you prefer code-based offsets.</p>
        </fieldset>

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>Tip: If lids don’t fully cover the eyes when blinking, increase lid height or y-range slightly and try again.</p>
      </div>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: '#0f172a' }}>
        <div style={{ width: 360, height: 360, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', background: '#111827' }}>
          {svgMarkup ? (
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}
                 dangerouslySetInnerHTML={{ __html: svgMarkup }} />
          ) : (
            <div style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      </div>

      <style>{`
        .row { display: grid; grid-template-columns: auto 1fr auto; gap: 6px; align-items: center; margin: 4px 0; }
        fieldset { border: 1px solid #334155; border-radius: 8px; padding: 8px; }
        legend { padding: 0 6px; color: #93c5fd; }
        input[type=number] {
          width: 100%;
          min-width: 70px;
          background: #111827;
          color: #e5e7eb;
          border: 1px solid #374151;
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 13px;
        }
        input[type=color] {
          min-width: 60px;
          height: 28px;
          border: 1px solid #374151;
          border-radius: 6px;
          cursor: pointer;
        }
        input[type=range] { width: 100%; }
        button { background: #2563eb; color: white; border: 0; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
        button:hover { background: #1d4ed8; }
      `}</style>
    </div>
  );
}


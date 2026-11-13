import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isReducedMotionActive, registerPageLifecycle, setScrollGradientPhase } from './domUtils';

gsap.registerPlugin(ScrollTrigger);

interface RawZoomConfig {
  scale?: number;
  mobileScale?: number;
  origin?: string;
  mobileOrigin?: string;
}

const DEFAULT_ORIGIN = 'top center';

let seqCtx: gsap.Context | null = null;
let videoTickerFns: Array<() => void> = [];
let sequenceAbortController: AbortController | null = null;

function parseZoomConfig(el: HTMLElement, isMobile: boolean) {
  let parsed: RawZoomConfig = {};
  try {
    parsed = JSON.parse(el.dataset.zoom || '{}') as RawZoomConfig;
  } catch {
    // Use fallback zoom defaults if JSON attribute is empty or invalid
  }
  return {
    scale: (isMobile ? parsed.mobileScale : parsed.scale) ?? (isMobile ? 1.45 : 1.75),
    origin: (isMobile ? parsed.mobileOrigin : parsed.origin) ?? (isMobile ? 'top left' : 'top center'),
  };
}

/**
 * Hardware-friendly scroll-driven video controller:
 * Only ticks while the video step is actively scrubbed in view; pauses and
 * detaches ticker activity when idle or off-screen to preserve battery.
 */
function bindScrollVideo(
  video: HTMLVideoElement,
  frameEl: HTMLElement,
  signal: AbortSignal
): (progress: number) => void {
  let targetTime = 0;
  let isSeeking = false;
  let isStepActive = false;

  video.muted = true;
  video.playsInline = true;

  const onMetadata = () => {
    if (video.currentTime === 0) {
      try {
        video.currentTime = 0.001;
      } catch {}
    }
  };
  if (video.readyState >= 1) onMetadata();
  else video.addEventListener('loadedmetadata', onMetadata, { once: true, signal });

  video.addEventListener('seeked', () => {
    isSeeking = false;
  }, { signal });

  const tick = () => {
    if (!isStepActive) return;

    const frameOpacity = parseFloat(frameEl.style.opacity || '0');
    if (frameOpacity <= 0.01) {
      if (!video.paused) video.pause();
      isStepActive = false;
      return;
    }

    const dur = video.duration;
    if (!dur || Number.isNaN(dur)) return;

    const curr = video.currentTime;
    const diff = targetTime - curr;

    if (diff > 0.045) {
      const speed = Math.min(3.5, Math.max(0.8, diff * 4.5));
      if (Math.abs(video.playbackRate - speed) > 0.08) {
        video.playbackRate = speed;
      }
      if (video.paused && !isSeeking) {
        video.play().catch(() => {
          if (!isSeeking) {
            isSeeking = true;
            video.currentTime = targetTime;
          }
        });
      }
    } else if (diff < -0.065) {
      if (!video.paused) video.pause();
      if (!isSeeking) {
        isSeeking = true;
        video.currentTime = Math.max(targetTime, curr - Math.max(0.14, Math.abs(diff) * 0.45));
      }
    } else {
      if (!video.paused) video.pause();
      if (Math.abs(diff) > 0.02 && !isSeeking) {
        isSeeking = true;
        video.currentTime = targetTime;
      } else {
        isStepActive = false;
      }
    }
  };

  gsap.ticker.add(tick);
  videoTickerFns.push(tick);

  return (progress: number) => {
    const dur = video.duration;
    if (!dur || Number.isNaN(dur)) {
      if (video.preload === 'metadata') {
        video.preload = 'auto';
        video.load();
      }
      return;
    }
    const maxTime = Math.max(0, dur - 0.04);
    const nextTarget = Math.max(0, Math.min(maxTime, progress * maxTime));
    if (Math.abs(nextTarget - targetTime) > 0.005) {
      targetTime = nextTarget;
      isStepActive = true;
    }
  };
}

function addHeadingGradientTween(
  tl: gsap.core.Timeline,
  headingEl: HTMLElement | null,
  stepIndex: number,
  holdDuration: number,
  label: string
): void {
  if (!headingEl) return;
  const gradProxy = { p: 0 };
  const baseOffset = (stepIndex * 0.22) % 1;
  let lastGradKey = '';

  const applyGrad = (p: number) => {
    const phase = (baseOffset + p * 0.85) % 1;
    const key = phase.toFixed(3);
    if (key === lastGradKey) return;
    lastGradKey = key;
    setScrollGradientPhase(headingEl, phase);
  };

  applyGrad(0);
  tl.fromTo(
    gradProxy,
    { p: 0 },
    {
      p: 1,
      duration: holdDuration + 1,
      ease: 'none',
      onUpdate: () => applyGrad(gradProxy.p),
    },
    label
  );
}

function setupSequenceRoot(root: HTMLElement, signal: AbortSignal): void {
  const texts = gsap.utils.toArray<HTMLElement>('.text-step', root);
  const medias = gsap.utils.toArray<HTMLElement>('.media-frame', root);
  const phone = root.querySelector<HTMLElement>('.phone');
  if (!phone || texts.length === 0) return;

  const perStep = Number(root.dataset.scrollPerStep) || 1500;
  const isMobile = window.innerWidth <= 768;
  const yShift = isMobile ? 12 : 40;
  phone.style.transformOrigin = DEFAULT_ORIGIN;

  texts.forEach((text, idx) => {
    if (idx > 0) gsap.set(text, { opacity: 0, y: yShift });
  });

  const framesOf = (i: number) => medias.filter((m) => Number(m.dataset.stepIndex) === i);
  const totalStepsWeight = texts.reduce((acc, _text, i) => {
    const hasVideo = Boolean(framesOf(i)[0]?.querySelector('video'));
    return acc + (hasVideo ? 1.3 : 1.0);
  }, 0);

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: {
      trigger: root,
      start: 'top top',
      end: `+=${Math.round(totalStepsWeight * perStep * (isMobile ? 0.75 : 1))}`,
      pin: true,
      pinSpacing: true,
      scrub: isMobile ? 0.35 : 0.65,
      invalidateOnRefresh: true,
    },
  });

  texts.forEach((text, i) => {
    const isLast = i === texts.length - 1;
    const label = `step${i}`;
    const frames = framesOf(i);
    const prevFrames = i > 0 ? framesOf(i - 1) : [];
    const hasZoom = text.dataset.zoom !== undefined;
    const hadPrevZoom = i > 0 && texts[i - 1].dataset.zoom !== undefined;
    const videoEl = frames[0]?.querySelector<HTMLVideoElement>('video');
    const holdDuration = videoEl ? 4.5 : 2.0 + frames.length;

    tl.addLabel(label);
    tl.to(text, { opacity: 1, y: 0, duration: 1 }, label);
    addHeadingGradientTween(tl, text.querySelector<HTMLElement>('h2'), i, holdDuration, label);

    if (i > 0) {
      tl.to(prevFrames[prevFrames.length - 1], { opacity: 0, duration: 1 }, label);
      tl.to(frames[0], { opacity: 1, duration: 1 }, label);
    }

    if (hasZoom) {
      const zc = parseZoomConfig(text, isMobile);
      tl.to(phone, { scale: zc.scale, transformOrigin: zc.origin, duration: 1.5, ease: 'power2.inOut' }, label);
    } else if (hadPrevZoom) {
      tl.to(phone, { scale: 1, transformOrigin: DEFAULT_ORIGIN, duration: 1, ease: 'power2.inOut' }, label);
    }

    if (videoEl && frames[0]) {
      const setVideoProgress = bindScrollVideo(videoEl, frames[0], signal);
      const videoProxy = { progress: 0 };
      tl.fromTo(
        videoProxy,
        { progress: 0 },
        {
          progress: 1,
          duration: holdDuration,
          ease: 'none',
          onUpdate: () => setVideoProgress(videoProxy.progress),
        },
        label
      );
    }

    frames.slice(1).forEach((frame, k) => {
      const stepOffset = `${label}+=${1.5 + k}`;
      tl.to(frames[k], { opacity: 0, duration: 1 }, stepOffset);
      tl.to(frame, { opacity: 1, duration: 1 }, stepOffset);
    });

    if (!isLast) {
      tl.to(text, { opacity: 0, y: -yShift, duration: 1 }, `${label}+=${holdDuration}`);
    } else {
      tl.to({}, { duration: 1 });
    }
  });
}

/** Initialize all Apple-style scroll-pinned feature sequences. */
export function initScrollSequence(): void {
  if (seqCtx) {
    seqCtx.revert();
    seqCtx = null;
  }
  videoTickerFns.forEach((fn) => gsap.ticker.remove(fn));
  videoTickerFns = [];
  sequenceAbortController?.abort();
  sequenceAbortController = new AbortController();

  const roots = document.querySelectorAll<HTMLElement>('.scroll-sequence');
  if (!roots.length) return;

  if (isReducedMotionActive()) {
    roots.forEach((root) => {
      root.classList.add('is-static');
      const firstVideo = root.querySelector<HTMLVideoElement>('.media-frame video');
      if (firstVideo) firstVideo.controls = true;
    });
    return;
  }

  const { signal } = sequenceAbortController;
  seqCtx = gsap.context(() => {
    roots.forEach((root) => setupSequenceRoot(root, signal));
  });

  ScrollTrigger.refresh();
}

registerPageLifecycle(initScrollSequence);

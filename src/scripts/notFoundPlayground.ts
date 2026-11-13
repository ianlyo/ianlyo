import { isReducedMotionActive, registerPageLifecycle } from './domUtils';

interface NotFoundStrings {
  title: string;
  lead: string;
  home: string;
  back: string;
  score: string;
  quotes: readonly string[];
}

interface Star {
  x: number;
  y: number;
  origX: number;
  origY: number;
  vx: number;
  vy: number;
  size: number;
  colorBase: string;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vRot: number;
  color: string;
  life: number;
}

interface PhysicsBody {
  el: HTMLElement;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  isDragging: boolean;
  recovering: boolean;
  sx: number;
  sy: number;
  moved: boolean;
  lastX: number;
  lastY: number;
  lastT: number;
  hitCooldown: number;
}

const CONFETTI_COLORS = ['#7c8cff', '#ff7ca8', '#ffd166', '#06d6a0', '#4cc9f0'] as const;
const CHARACTER_IDS = ['char-robot', 'char-astronaut', 'char-android'] as const;

let playgroundAbortController: AbortController | null = null;
let starfieldRafId = 0;
let physicsRafId = 0;
let confettiRafId = 0;

function parseCssColorToRgb(colorStr: string, isDark: boolean): string {
  const c = (colorStr || '').trim();
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
    if (c.length === 4) {
      return `${parseInt(c[1] + c[1], 16)}, ${parseInt(c[2] + c[2], 16)}, ${parseInt(c[3] + c[3], 16)}`;
    }
    return `${parseInt(c.slice(1, 3), 16)}, ${parseInt(c.slice(3, 5), 16)}, ${parseInt(c.slice(5, 7), 16)}`;
  }
  const m = c.match(/\d+/g);
  if (m && m.length >= 3) return `${m[0]}, ${m[1]}, ${m[2]}`;
  return isDark ? '129, 140, 248' : '79, 70, 229';
}

function initStarfieldCanvas(signal: AbortSignal): void {
  const canvas = document.getElementById('nf-starfield') as HTMLCanvasElement | null;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  let stars: Star[] = [];
  let isDark = false;
  let accentRgb = '79, 70, 229';
  const mouse = { x: -1000, y: -1000, radius: 130 };

  const syncTheme = () => {
    const themeAttr = document.documentElement.getAttribute('data-bs-theme');
    isDark =
      themeAttr === 'dark' ||
      (!themeAttr && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches));
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary');
    accentRgb = parseCssColorToRgb(accent, isDark);
  };

  const populateStars = () => {
    syncTheme();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = [];

    const count = Math.floor((canvas.width * canvas.height) / 9000);
    const palette = isDark
      ? ['rgba(255, 255, 255, ', `rgba(${accentRgb}, `, 'rgba(226, 232, 240, ']
      : ['rgba(51, 65, 85, ', `rgba(${accentRgb}, `, 'rgba(100, 116, 139, '];

    for (let i = 0; i < count; i++) {
      const origX = Math.random() * canvas.width;
      const origY = Math.random() * canvas.height;
      stars.push({
        x: origX,
        y: origY,
        origX,
        origY,
        vx: 0,
        vy: 0,
        size: Math.random() * 1.5 + 0.8,
        colorBase: palette[Math.floor(Math.random() * palette.length)],
        baseAlpha: Math.random() * 0.45 + 0.25,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  };

  const renderFrame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    const reducedMotion = isReducedMotionActive();

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const dx = mouse.x - s.x;
      const dy = mouse.y - s.y;
      const dist = Math.hypot(dx, dy);

      if (!reducedMotion && dist < mouse.radius && dist > 0) {
        const force = (mouse.radius - dist) / mouse.radius;
        const angle = Math.atan2(dy, dx);
        s.vx -= Math.cos(angle) * force * 1.6;
        s.vy -= Math.sin(angle) * force * 1.6;
      }

      if (!reducedMotion) {
        s.vx = (s.vx + (s.origX - s.x) * 0.035) * 0.88;
        s.vy = (s.vy + (s.origY - s.y) * 0.035) * 0.88;
        s.x += s.vx;
        s.y += s.vy;
      }

      let alpha = reducedMotion
        ? s.baseAlpha
        : s.baseAlpha + Math.sin(now * s.twinkleSpeed + s.twinkleOffset) * 0.12;
      alpha = Math.max(0.15, Math.min(0.85, alpha));
      if (!reducedMotion && dist < mouse.radius) {
        alpha = Math.min(1, alpha + (1 - dist / mouse.radius) * 0.35);
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `${s.colorBase}${alpha.toFixed(2)})`;
      ctx.fill();
    }

    if (!reducedMotion) {
      const connectDist = 85;
      for (let i = 0; i < stars.length; i++) {
        const s1 = stars[i];
        const dMouse = Math.hypot(mouse.x - s1.x, mouse.y - s1.y);
        if (dMouse >= mouse.radius * 1.25) continue;

        for (let j = i + 1; j < stars.length; j++) {
          const s2 = stars[j];
          const dStars = Math.hypot(s1.x - s2.x, s1.y - s2.y);
          if (dStars >= connectDist) continue;
          const lineAlpha = (1 - dStars / connectDist) * (1 - dMouse / (mouse.radius * 1.25)) * 0.35;
          if (lineAlpha <= 0.02) continue;

          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.strokeStyle = `rgba(${accentRgb}, ${(isDark ? lineAlpha : lineAlpha * 0.7).toFixed(3)})`;
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      }
      starfieldRafId = window.requestAnimationFrame(renderFrame);
    }
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    },
    { signal }
  );
  window.addEventListener(
    'pointerleave',
    () => {
      mouse.x = -1000;
      mouse.y = -1000;
    },
    { signal }
  );

  const rebuildAndRender = () => {
    window.cancelAnimationFrame(starfieldRafId);
    populateStars();
    renderFrame();
  };

  window.addEventListener('resize', rebuildAndRender, { signal });
  window.addEventListener('site:preferences-change', rebuildAndRender, { signal });
  rebuildAndRender();
}

function createCelebrationSystem(scorePrefix: string, signal: AbortSignal) {
  const canvas = document.getElementById('nf-confetti') as HTMLCanvasElement | null;
  const ctx = canvas?.getContext('2d');
  const scoreEl = document.getElementById('nf-score');
  let particles: ConfettiParticle[] = [];
  let score = 0;

  const resizeCanvas = () => {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { signal });

  const tickConfetti = () => {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life-- > 0 && p.y < canvas.height + 20);
    particles.forEach((p) => {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.vRot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });

    confettiRafId = particles.length ? window.requestAnimationFrame(tickConfetti) : 0;
    if (!confettiRafId) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const addScore = (pts: number) => {
    score += pts;
    if (!scoreEl) return;
    scoreEl.hidden = false;
    scoreEl.textContent = scorePrefix + score;
    scoreEl.classList.remove('score-pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('score-pop');
  };

  const celebrate = () => {
    addScore(1);
    if (isReducedMotionActive() || !canvas || !ctx) return;
    for (let i = 0; i < 140; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.6,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 16 - 4,
        size: Math.random() * 7 + 4,
        rot: Math.random() * 6,
        vRot: (Math.random() - 0.5) * 0.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        life: 140 + Math.random() * 60,
      });
    }
    if (!confettiRafId) {
      confettiRafId = window.requestAnimationFrame(tickConfetti);
    }
  };

  return { addScore, celebrate };
}

function applyTranslate(body: PhysicsBody): void {
  body.el.style.translate = `${body.ox.toFixed(2)}px ${body.oy.toFixed(2)}px`;
}

function pushCollidingBody(
  target: PhysicsBody,
  source: PhysicsBody,
  nx: number,
  ny: number,
  overlap: number,
  dir: 1 | -1
): void {
  target.ox += dir * nx * overlap;
  target.oy += dir * ny * overlap;
  const speed = Math.max(Math.hypot(source.vx, source.vy), 6) * 1.2;
  target.vx = dir * nx * speed;
  target.vy = dir * ny * speed;
  applyTranslate(target);
}

function initDraggablePhysics(
  addScore: (pts: number) => void,
  celebrate: () => void,
  signal: AbortSignal
): void {
  const bodies: PhysicsBody[] = [];
  let justDragged = false;

  const registerBody = (el: HTMLElement | null) => {
    if (!el) return;
    const body: PhysicsBody = {
      el,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      isDragging: false,
      recovering: false,
      sx: 0,
      sy: 0,
      moved: false,
      lastX: 0,
      lastY: 0,
      lastT: 0,
      hitCooldown: 0,
    };

    el.addEventListener(
      'pointerdown',
      (e) => {
        body.sx = e.clientX - body.ox;
        body.sy = e.clientY - body.oy;
        body.moved = false;
        body.isDragging = true;
        body.vx = 0;
        body.vy = 0;
        body.lastX = e.clientX;
        body.lastY = e.clientY;
        body.lastT = performance.now();
        el.setPointerCapture(e.pointerId);
        el.classList.add('is-dragging');
      },
      { signal }
    );

    el.addEventListener(
      'pointermove',
      (e) => {
        if (!body.isDragging) return;
        const nx = e.clientX - body.sx;
        const ny = e.clientY - body.sy;
        if (Math.abs(nx - body.ox) + Math.abs(ny - body.oy) > 3) body.moved = true;

        const now = performance.now();
        const dt = Math.max(1, now - body.lastT);
        body.vx = ((e.clientX - body.lastX) / dt) * 16;
        body.vy = ((e.clientY - body.lastY) / dt) * 16;
        body.lastX = e.clientX;
        body.lastY = e.clientY;
        body.lastT = now;

        body.ox = nx;
        body.oy = ny;
        el.style.translate = `${body.ox}px ${body.oy}px`;
      },
      { signal }
    );

    const endDrag = (e: PointerEvent) => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      body.isDragging = false;
      el.classList.remove('is-dragging');
      if (body.moved) {
        justDragged = true;
        window.setTimeout(() => {
          justDragged = false;
        }, 0);
      }
    };

    el.addEventListener('pointerup', endDrag, { signal });
    el.addEventListener('pointercancel', endDrag, { signal });
    el.addEventListener(
      'dblclick',
      () => {
        body.ox = 0;
        body.oy = 0;
        body.vx = 0;
        body.vy = 0;
        el.style.translate = '';
      },
      { signal }
    );

    bodies.push(body);
  };

  let charIndex = Math.floor(Math.random() * CHARACTER_IDS.length);
  const updateCharacterDisplay = () => {
    CHARACTER_IDS.forEach((id, idx) => {
      const charEl = document.getElementById(id);
      if (charEl) charEl.style.display = idx === charIndex ? 'block' : 'none';
    });
  };
  updateCharacterDisplay();

  const astroEl = document.getElementById('nf-astro');
  const avatarEl = document.getElementById('nf-avatar');
  registerBody(astroEl);
  registerBody(avatarEl);
  registerBody(document.getElementById('nf-code'));

  astroEl?.addEventListener(
    'click',
    () => {
      if (justDragged) return;
      charIndex = (charIndex + 1) % CHARACTER_IDS.length;
      updateCharacterDisplay();
      celebrate();
    },
    { signal }
  );

  avatarEl?.addEventListener(
    'click',
    () => {
      if (!justDragged) celebrate();
    },
    { signal }
  );

  const physicsTick = () => {
    physicsRafId = window.requestAnimationFrame(physicsTick);

    const pad = 10;
    const targetX = window.innerWidth * 0.22;
    const targetY = window.innerHeight * 0.32;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.isDragging) {
        b.recovering = false;
        continue;
      }

      const rect = b.el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const isOffscreen =
        rect.right < pad ||
        rect.left > window.innerWidth - pad ||
        rect.bottom < pad ||
        rect.top > window.innerHeight - pad;

      const now = performance.now();
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 1.2 && now - b.hitCooldown > 350) {
        const hitWall =
          rect.left <= 0 ||
          rect.right >= window.innerWidth ||
          rect.top <= 0 ||
          rect.bottom >= window.innerHeight;
        if (hitWall || isOffscreen) {
          b.hitCooldown = now;
          addScore(1);
        }
      }

      if (isOffscreen) b.recovering = true;

      if (b.recovering) {
        const toTargetX = targetX - cx;
        const toTargetY = targetY - cy;
        const distToTarget = Math.hypot(toTargetX, toTargetY) || 1;
        b.vx = (b.vx + (toTargetX / distToTarget) * 0.35) * 0.9;
        b.vy = (b.vy + (toTargetY / distToTarget) * 0.35) * 0.9;
        if (distToTarget < 80) b.recovering = false;
      }

      if (Math.abs(b.vx) > 0.05 || Math.abs(b.vy) > 0.05) {
        b.ox += b.vx;
        b.oy += b.vy;
        if (!b.recovering) {
          b.vx *= 0.94;
          b.vy *= 0.94;
        }
        applyTranslate(b);
      } else {
        b.vx = 0;
        b.vy = 0;
      }
    }

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const b1 = bodies[i];
        const b2 = bodies[j];
        const r1 = b1.el.getBoundingClientRect();
        const r2 = b2.el.getBoundingClientRect();

        const dx = r2.left + r2.width / 2 - (r1.left + r1.width / 2);
        const dy = r2.top + r2.height / 2 - (r1.top + r1.height / 2);
        const dist = Math.hypot(dx, dy);
        const minR = (Math.min(r1.width, r1.height) + Math.min(r2.width, r2.height)) * 0.44;
        if (dist >= minR || dist <= 0) continue;

        const overlap = minR - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        if (b1.isDragging && !b2.isDragging) {
          pushCollidingBody(b2, b1, nx, ny, overlap, 1);
        } else if (!b1.isDragging && b2.isDragging) {
          pushCollidingBody(b1, b2, nx, ny, overlap, -1);
        } else if (!b1.isDragging && !b2.isDragging) {
          b1.ox -= nx * overlap * 0.5;
          b1.oy -= ny * overlap * 0.5;
          b2.ox += nx * overlap * 0.5;
          b2.oy += ny * overlap * 0.5;

          const impulse = ((b1.vx - b2.vx) * nx + (b1.vy - b2.vy) * ny) * 1.1;
          b1.vx -= impulse * nx;
          b1.vy -= impulse * ny;
          b2.vx += impulse * nx;
          b2.vy += impulse * ny;

          applyTranslate(b1);
          applyTranslate(b2);
        }
      }
    }
  };

  physicsRafId = window.requestAnimationFrame(physicsTick);
}

/** Initialize the interactive 404 playground (localization, starfield, confetti, physics). */
export function initNotFoundPlayground(): void {
  window.cancelAnimationFrame(starfieldRafId);
  window.cancelAnimationFrame(physicsRafId);
  window.cancelAnimationFrame(confettiRafId);
  playgroundAbortController?.abort();

  const root = document.getElementById('nf');
  if (!root) return;

  playgroundAbortController = new AbortController();
  const { signal } = playgroundAbortController;

  let dict: Record<'zh-Hant' | 'en', NotFoundStrings> | null = null;
  try {
    dict = JSON.parse(root.dataset.i18n || 'null');
  } catch {
    return;
  }
  if (!dict) return;

  const isEn = window.location.pathname.startsWith('/en/') || window.location.pathname === '/en';
  const d = dict[isEn ? 'en' : 'zh-Hant'];
  const siteName = root.dataset.siteName || 'ianlyo';

  document.documentElement.lang = isEn ? 'en' : 'zh-Hant';
  document.title = `${d.title} | ${siteName}`;

  const titleEl = document.getElementById('nf-title');
  const leadEl = document.getElementById('nf-lead');
  const homeEl = document.getElementById('nf-home') as HTMLAnchorElement | null;
  const backEl = document.getElementById('nf-back');
  const quoteEl = document.getElementById('nf-quote');

  if (titleEl) titleEl.textContent = d.title;
  if (leadEl) leadEl.textContent = d.lead;
  if (homeEl) {
    homeEl.textContent = d.home;
    homeEl.href = isEn ? '/en/' : '/';
  }
  if (backEl) {
    backEl.textContent = d.back;
    backEl.addEventListener(
      'click',
      () => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = homeEl?.href || '/';
      },
      { signal }
    );
  }
  if (quoteEl && d.quotes.length > 0) {
    quoteEl.textContent = d.quotes[Math.floor(Math.random() * d.quotes.length)];
  }

  if (!isReducedMotionActive()) {
    root.addEventListener(
      'pointermove',
      (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        root.style.setProperty('--px', x.toFixed(3));
        root.style.setProperty('--py', y.toFixed(3));
      },
      { signal }
    );
  }

  initStarfieldCanvas(signal);
  const { addScore, celebrate } = createCelebrationSystem(d.score, signal);
  initDraggablePhysics(addScore, celebrate, signal);
}

registerPageLifecycle(initNotFoundPlayground);

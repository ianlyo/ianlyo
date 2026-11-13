import { registerPageLifecycle } from './domUtils';
import { getPreferencesState, setThemeMode } from './themeManager';

const INTENSITY_CLASSES = [
  'text-glow-aberration',
  'text-glow-aberration-subtle',
  'text-glow-aberration-intense',
] as const;

const INTENSITY_MAP: Record<string, (typeof INTENSITY_CLASSES)[number]> = {
  'intensity-subtle': 'text-glow-aberration-subtle',
  'intensity-standard': 'text-glow-aberration',
  'intensity-intense': 'text-glow-aberration-intense',
};

/** Bind interactive controls on the Chromatic Glow showcase page. */
export function initChromaticGlowDemo(): void {
  const textInput = document.getElementById('custom-text-input') as HTMLInputElement | null;
  const previewEl = document.getElementById('preview-text-element');
  const heroText = document.getElementById('hero-display-text');
  const themeBtn = document.getElementById('demo-theme-toggle');
  const copyBtn = document.getElementById('copy-astro-snippet') as HTMLButtonElement | null;
  const rootCard = document.querySelector<HTMLElement>('.demo-page');
  if (!rootCard || rootCard.dataset.demoBound === '1') return;
  rootCard.dataset.demoBound = '1';

  const fallbackText = textInput?.placeholder || 'CHROMATIC GLOW';

  textInput?.addEventListener('input', () => {
    const val = textInput.value.trim() || fallbackText;
    if (previewEl) previewEl.textContent = val;
    if (heroText) heroText.textContent = val;
  });

  document.querySelectorAll<HTMLInputElement>('input[name="intensityRadio"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!previewEl || !radio.checked) return;
      previewEl.classList.remove(...INTENSITY_CLASSES);
      previewEl.classList.add(INTENSITY_MAP[radio.id] || 'text-glow-aberration');
    });
  });

  themeBtn?.addEventListener('click', () => {
    const { resolvedTheme } = getPreferencesState();
    setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  });

  copyBtn?.addEventListener('click', () => {
    const snippet = document.getElementById('astro-snippet-text');
    if (!snippet) return;
    navigator.clipboard
      .writeText(snippet.innerText)
      .then(() => {
        const originalNodes = Array.from(copyBtn.childNodes);
        const copiedSpan = document.createElement('span');
        copiedSpan.className = 'text-success fw-bold';
        copiedSpan.textContent = `✓ ${copyBtn.dataset.copied || 'Copied!'}`;
        copyBtn.replaceChildren(copiedSpan);
        window.setTimeout(() => {
          copyBtn.replaceChildren(...originalNodes);
        }, 2000);
      })
      .catch(() => {});
  });
}

registerPageLifecycle(initChromaticGlowDemo);

import { useState, useEffect, useRef, useCallback } from 'react';
import './AccessibilityFab.css';

interface A11ySettings {
  fontSize: 's' | 'm' | 'l';
  highContrast: boolean;
  dyslexiaFont: boolean;
  theme: 'dark' | 'light';
}

const STORAGE_KEY = 'wosweat-a11y';

const DEFAULTS: A11ySettings = {
  fontSize: 's',
  highContrast: false,
  dyslexiaFont: false,
  theme: 'dark',
};

const FONT_SCALE: Record<A11ySettings['fontSize'], string> = {
  s: '1',
  m: '1.15',
  l: '1.3',
};

function loadSettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* use defaults */ }
  return { ...DEFAULTS };
}

function saveSettings(settings: A11ySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applyFontSize(size: A11ySettings['fontSize']) {
  document.documentElement.style.setProperty('--a11y-font-scale', FONT_SCALE[size]);
}

function applyHighContrast(enabled: boolean) {
  if (enabled) {
    document.documentElement.setAttribute('data-high-contrast', '');
  } else {
    document.documentElement.removeAttribute('data-high-contrast');
  }
}

function applyTheme(theme: A11ySettings['theme']) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

let dyslexiaFontLoaded = false;

async function applyDyslexiaFont(enabled: boolean) {
  if (!enabled) {
    document.documentElement.removeAttribute('data-dyslexia');
    return;
  }
  // attribute first: the system fallback shows immediately, OpenDyslexic swaps in when loaded
  document.documentElement.setAttribute('data-dyslexia', '');
  if (!dyslexiaFontLoaded) {
    try {
      const font = new FontFace(
        'OpenDyslexic',
        'url(https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/fonts/OpenDyslexic-Regular.woff)'
      );
      await font.load();
      document.fonts.add(font);
      dyslexiaFontLoaded = true;
    } catch (error) {
      document.documentElement.removeAttribute('data-dyslexia');
      throw error;
    }
  }
}

function applyAll(settings: A11ySettings) {
  applyFontSize(settings.fontSize);
  applyHighContrast(settings.highContrast);
  applyTheme(settings.theme);
  applyDyslexiaFont(settings.dyslexiaFont).catch((error) => {
    console.error('Failed to load dyslexia font:', error);
  });
}

const FONT_SIZE_LABELS: Record<A11ySettings['fontSize'], string> = {
  s: 'Schriftgröße klein',
  m: 'Schriftgröße mittel',
  l: 'Schriftgröße groß',
};

const AccessibilityFab: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(DEFAULTS);
  const [fontLoading, setFontLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applyAll(loaded);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    fabRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const update = (patch: Partial<A11ySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const handleFontSize = (size: A11ySettings['fontSize']) => {
    update({ fontSize: size });
    applyFontSize(size);
  };

  const handleHighContrast = () => {
    const next = !settings.highContrast;
    update({ highContrast: next });
    applyHighContrast(next);
  };

  const handleDyslexiaFont = async () => {
    const next = !settings.dyslexiaFont;
    if (next) setFontLoading(true);
    try {
      await applyDyslexiaFont(next);
      update({ dyslexiaFont: next });
    } catch (error) {
      console.error('Failed to load dyslexia font:', error);
    } finally {
      setFontLoading(false);
    }
  };

  const handleTheme = (theme: A11ySettings['theme']) => {
    update({ theme });
    applyTheme(theme);
  };

  return (
    <>
      {open && <div className="a11y-backdrop" onClick={close} aria-hidden="true" />}

      <div
        className={`a11y-drawer${open ? ' a11y-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a11y-drawer-title"
        inert={!open}
      >
        <div className="a11y-drawer__header">
          <h2 className="a11y-drawer__title" id="a11y-drawer-title">Barrierefreiheit</h2>
          <button ref={closeButtonRef} className="a11y-drawer__close" onClick={close} aria-label="Schließen">
            ×
          </button>
        </div>

        <div className="a11y-drawer__content">
          <div className="a11y-setting">
            <span className="a11y-setting__label">Schriftgr&ouml;&szlig;e</span>
            <div className="a11y-btn-group">
              {(['s', 'm', 'l'] as const).map(size => (
                <button
                  key={size}
                  className={`a11y-btn${settings.fontSize === size ? ' a11y-btn--active' : ''}`}
                  onClick={() => handleFontSize(size)}
                  aria-label={FONT_SIZE_LABELS[size]}
                  aria-pressed={settings.fontSize === size}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="a11y-setting">
            <div className="a11y-setting__row">
              <span className="a11y-setting__label">Hoher Kontrast</span>
              <label className="a11y-toggle">
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={handleHighContrast}
                  aria-label="Hoher Kontrast"
                />
                <span className="a11y-toggle__track" />
              </label>
            </div>
          </div>

          <div className="a11y-setting">
            <div className="a11y-setting__row">
              <span className="a11y-setting__label">Legasthenie-Schrift</span>
              <label className={`a11y-toggle${fontLoading ? ' a11y-toggle--loading' : ''}`}>
                <input
                  type="checkbox"
                  checked={settings.dyslexiaFont}
                  onChange={handleDyslexiaFont}
                  disabled={fontLoading}
                  aria-label="Legasthenie-Schrift"
                />
                <span className="a11y-toggle__track" />
              </label>
            </div>
          </div>

          <div className="a11y-setting">
            <span className="a11y-setting__label">Farbschema</span>
            <div className="a11y-btn-group">
              <button
                className={`a11y-btn${settings.theme === 'dark' ? ' a11y-btn--active' : ''}`}
                onClick={() => handleTheme('dark')}
                aria-label="Dunkles Design"
                aria-pressed={settings.theme === 'dark'}
              >
                &#9790;
              </button>
              <button
                className={`a11y-btn${settings.theme === 'light' ? ' a11y-btn--active' : ''}`}
                onClick={() => handleTheme('light')}
                aria-label="Helles Design"
                aria-pressed={settings.theme === 'light'}
              >
                &#9728;
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        ref={fabRef}
        className="a11y-fab"
        onClick={() => setOpen(prev => !prev)}
        aria-label="Barrierefreiheits-Einstellungen"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="12" cy="4.5" r="2" fill="var(--on-accent)" />
          <path
            d="M12 8c-3.5 0-6.5-1-6.5-1v2s2.5.5 4.5.7V22h2v-6h1v6h2V9.7c2-.2 4.5-.7 4.5-.7V7s-3 1-6.5 1z"
            fill="var(--on-accent)"
          />
        </svg>
      </button>
    </>
  );
};

export default AccessibilityFab;

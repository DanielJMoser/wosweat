import { useState, useEffect, useCallback } from 'react';
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

async function applyDyslexiaFont(enabled: boolean) {
  if (enabled) {
    const font = new FontFace(
      'OpenDyslexic',
      'url(https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/fonts/OpenDyslexic-Regular.woff)'
    );
    await font.load();
    document.fonts.add(font);
    document.documentElement.style.setProperty('--a11y-font-family', "'OpenDyslexic', sans-serif");
  } else {
    document.documentElement.style.setProperty('--a11y-font-family', 'var(--font-body)');
  }
}

function applyAll(settings: A11ySettings) {
  applyFontSize(settings.fontSize);
  applyHighContrast(settings.highContrast);
  applyTheme(settings.theme);
  applyDyslexiaFont(settings.dyslexiaFont);
}

const AccessibilityFab: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(DEFAULTS);
  const [fontLoading, setFontLoading] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applyAll(loaded);
  }, []);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

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
      {open && <div className="a11y-backdrop" onClick={() => setOpen(false)} />}

      <div className={`a11y-drawer${open ? ' a11y-drawer--open' : ''}`}>
        <div className="a11y-drawer__header">
          <h2 className="a11y-drawer__title">Barrierefreiheit</h2>
          <button className="a11y-drawer__close" onClick={() => setOpen(false)} aria-label="Close">
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
              >
                &#9790;
              </button>
              <button
                className={`a11y-btn${settings.theme === 'light' ? ' a11y-btn--active' : ''}`}
                onClick={() => handleTheme('light')}
              >
                &#9728;
              </button>
            </div>
          </div>
        </div>
      </div>

      <button className="a11y-fab" onClick={() => setOpen(prev => !prev)} aria-label="Accessibility settings">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="4.5" r="2" fill="var(--ctp-crust)" />
          <path
            d="M12 8c-3.5 0-6.5-1-6.5-1v2s2.5.5 4.5.7V22h2v-6h1v6h2V9.7c2-.2 4.5-.7 4.5-.7V7s-3 1-6.5 1z"
            fill="var(--ctp-crust)"
          />
        </svg>
      </button>
    </>
  );
};

export default AccessibilityFab;

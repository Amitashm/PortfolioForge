import { useEffect, useState } from "react";

const STORAGE_KEY = "portfolioforge-theme";

function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The theme still works for this session if storage is unavailable.
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="site-theme-toggle"
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      aria-label={`Switch to ${isLight ? "night" : "day"} mode`}
      aria-pressed={isLight}
      title={`Switch to ${isLight ? "night" : "day"} mode`}
    >
      <span className="site-theme-toggle__icon" aria-hidden="true">
        {isLight ? "☾" : "☀"}
      </span>
      <span className="site-theme-toggle__label">{isLight ? "Day mode" : "Night mode"}</span>
    </button>
  );
}

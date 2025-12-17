import { useState, useEffect, useCallback } from "react";

export type PerformanceSettings = {
  reduceMotion: boolean;
  lowerDPR: boolean;
  pause3DWhenHUDExpanded: boolean;
};

const DEFAULT_SETTINGS: PerformanceSettings = {
  reduceMotion: false,
  lowerDPR: false,
  pause3DWhenHUDExpanded: true,
};

const STORAGE_KEY = "wba-performance-settings";

function loadSettings(): PerformanceSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore storage errors
  }

  // Check for system preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    ...DEFAULT_SETTINGS,
    reduceMotion: prefersReducedMotion,
  };
}

function saveSettings(settings: PerformanceSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function usePerformance() {
  const [settings, setSettingsState] = useState<PerformanceSettings>(loadSettings);
  const [isHUDExpanded, setIsHUDExpanded] = useState(false);

  // Listen for reduced motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSettingsState((prev) => ({ ...prev, reduceMotion: e.matches }));
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setSettings = useCallback((newSettings: Partial<PerformanceSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Calculate effective DPR
  const baseDPR = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const dpr = settings.lowerDPR ? Math.min(baseDPR, 1) : Math.min(baseDPR, 2);

  // Determine if 3D should be paused
  const should3DPause = settings.pause3DWhenHUDExpanded && isHUDExpanded;

  return {
    settings,
    setSettings,
    dpr,
    should3DPause,
    isHUDExpanded,
    setIsHUDExpanded,
  };
}

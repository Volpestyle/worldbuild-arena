import { useState, useEffect } from "react";

export type ViewportInfo = {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

function getViewportInfo(): ViewportInfo {
  if (typeof window === "undefined") {
    return {
      width: 0,
      height: 0,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Get safe area insets from CSS environment variables
  const computedStyle = getComputedStyle(document.documentElement);
  const getSafeArea = (prop: string): number => {
    const value = computedStyle.getPropertyValue(prop);
    return parseFloat(value) || 0;
  };

  return {
    width,
    height,
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
    isDesktop: width >= TABLET_BREAKPOINT,
    safeAreaInsets: {
      top: getSafeArea("--safe-top"),
      right: getSafeArea("--safe-right"),
      bottom: getSafeArea("--safe-bottom"),
      left: getSafeArea("--safe-left"),
    },
  };
}

export function useViewport(): ViewportInfo {
  const [viewport, setViewport] = useState<ViewportInfo>(getViewportInfo);

  useEffect(() => {
    const handleResize = () => {
      setViewport(getViewportInfo());
    };

    // Initial update
    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return viewport;
}

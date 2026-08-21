"use client";

import type React from "react";
import { createContext, useContext, useEffect } from "react";

type Theme = "light";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * The dashboard is light-only by design, not by default.
 *
 * The Cognizant palette is navy-anchored and the data ramps were contrast-tuned
 * against near-black surfaces; the same colours on white fail legibility. Rather
 * than ship a light mode that nobody has designed, the theme is pinned. The
 * toggle is kept as a no-op so TailAdmin's header control does not crash, and it
 * is hidden in the header itself.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

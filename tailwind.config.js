import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // MD3 Primary (Modern B2B Blue)
        "primary": "#135bec",
        "on-primary": "#ffffff",
        "primary-container": "#dce1ff",
        "on-primary-container": "#001552",
        
        // MD3 Secondary (Subtle Grey-Blue)
        "secondary": "#585e71",
        "on-secondary": "#ffffff",
        "secondary-container": "#dce2f9",
        "on-secondary-container": "#151b2c",

        // MD3 Surface (Racional hierarchy)
        "surface": "#fdfbff",
        "on-surface": "#1b1b1f",
        "surface-variant": "#e1e2ec",
        "on-surface-variant": "#44464f",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f4f3f7",
        "surface-container": "#f0eff3",
        "surface-container-high": "#eae9ee",
        "surface-container-highest": "#e4e3e8",
        
        "outline": "#74777f",
        "outline-variant": "#c4c6d0",
        
        // MD3 Semantic
        "error": "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#410002",
        
        "success": "#006d3a",
        "on-success": "#ffffff",
        "success-container": "#96f7b5",
        "on-success-container": "#00210e",

        "warning": "#8b5000",
        "on-warning": "#ffffff",
        "warning-container": "#ffdcbe",
        "on-warning-container": "#2d1600",
        
        "background": "#fdfbff",
        "on-background": "#1b1b1f",
      },
      fontFamily: {
        "headline": ["Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"],
        "mono": ["Roboto Mono", "monospace"]
      },
      borderRadius: {
        "none": "0",
        "xs": "4px",
        "sm": "8px",
        "md": "12px",
        "lg": "16px",
        "xl": "28px",
        "full": "9999px",
      },
      boxShadow: {
        // MD3 Precise Elevation levels (Subtle & Diffused)
        "elevation-1": "0 1px 2px 0 rgba(0,0,0,0.05), 0 1px 3px 1px rgba(0,0,0,0.1)",
        "elevation-2": "0 2px 4px 0 rgba(0,0,0,0.08), 0 4px 12px 2px rgba(0,0,0,0.08)",
        "elevation-3": "0 8px 16px 0 rgba(0,0,0,0.1), 0 12px 24px 4px rgba(0,0,0,0.08)",
        "none": "none",
      },
      scale: {
        "interactive": "1.01",
      },
      fontSize: {
        "display-lg": ["3.5rem",   { lineHeight: "4rem",    letterSpacing: "-0.025em", fontWeight: "400" }],
        "display-md": ["2.8rem",   { lineHeight: "3.25rem", letterSpacing: "-0.015em", fontWeight: "400" }],
        "headline-lg":["2rem",     { lineHeight: "2.5rem",  letterSpacing: "-0.01em",  fontWeight: "400" }],
        "headline-md":["1.75rem",  { lineHeight: "2.25rem", letterSpacing: "0",        fontWeight: "400" }],
        "headline-sm":["1.5rem",   { lineHeight: "2rem",    letterSpacing: "0",        fontWeight: "400" }],
        "title-lg":   ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "0",        fontWeight: "600" }],
        "title-md":   ["1rem",     { lineHeight: "1.5rem",  letterSpacing: "0.009em",  fontWeight: "600" }],
        "title-sm":   ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.006em",  fontWeight: "600" }],
        "body-lg":    ["1rem",     { lineHeight: "1.5rem",  letterSpacing: "0.009em",  fontWeight: "400" }],
        "body-md":    ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.016em",  fontWeight: "400" }],
        "body-sm":    ["0.75rem",  { lineHeight: "1rem",    letterSpacing: "0.025em",  fontWeight: "400" }],
        "label-lg":   ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.006em",  fontWeight: "500" }],
        "label-md":   ["0.75rem",  { lineHeight: "1rem",    letterSpacing: "0.031em",  fontWeight: "500" }],
        "label-sm":   ["0.6875rem",{ lineHeight: "1rem",    letterSpacing: "0.05em",   fontWeight: "500" }],
      },
    },
  },
  plugins: [
    forms,
    containerQueries
  ],
}

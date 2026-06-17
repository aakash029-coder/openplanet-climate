import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Four-typeface system — strict role assignment, one job each
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],        // Instrument Serif — display only
        serif:   ["var(--font-reading)", "Georgia", "serif"],        // Source Serif 4  — prose
        sans:    ["var(--font-sans)", "Inter", "sans-serif"],        // Inter            — UI/labels
        mono:    ["var(--font-mono)", "JetBrains Mono", "monospace"], // JetBrains Mono  — ALL numbers
      },

      // Archival color palette — §3 — color encodes meaning, never decorates.
      // Aligned to the canonical globals.css :root variables so the Tailwind
      // utilities and the CSS custom properties share ONE source of truth.
      colors: {
        canvas:   "#050608",  // page background (matches --canvas)
        panel:    "#0A0A0C",  // sidebars, sunken panels (matches --panel)
        raised:   "#0F0F12",  // card surface (matches --raised)
        ink:      "#EDEDEF",  // primary text (matches --text)
        ink2:     "#B4B4BD",  // secondary (matches --text-2; raised for AA)
        muted:    "#8C8C96",  // labels, captions (matches --muted; AA-compliant)
        copper:   "#B08D57",  // monetary headline — muted copper
        positive: "#5E8C6A",  // saved/improved — sage, not neon
        ref:      "#6E8CA8",  // links, references — ink blue
        // Heat / risk ramp — perceptually ordered, desaturated earth pigments
        heat: {
          1: "#2F6F8F",  // low      — muted steel
          2: "#B79237",  // moderate — ochre
          3: "#BE6A2E",  // high     — burnt amber
          4: "#A23A30",  // severe   — oxide red
          5: "#6E2020",  // critical — deep oxide
        },
      },

      // Type scale (1.25 ratio on 16px base — do not invent sizes)
      fontSize: {
        "display": ["clamp(2.75rem,6vw,4.5rem)", { letterSpacing: "-0.02em", lineHeight: "1.05" }],
        "h1":      ["2.25rem",   { letterSpacing: "-0.01em", lineHeight: "1.1" }],
        "h2":      ["1.5rem",    { letterSpacing: "0",       lineHeight: "1.25" }],
        "body-s":  ["1.0625rem", { lineHeight: "1.6" }],
        "body-ui": ["0.875rem",  { lineHeight: "1.5" }],
        "metric":  ["clamp(1.75rem,3vw,2.5rem)", { letterSpacing: "-0.01em", lineHeight: "1" }],
        "data":    ["0.8125rem", { letterSpacing: "-0.01em" }],
        "eye":     ["0.6875rem", { letterSpacing: "0.14em",  lineHeight: "1.4" }],
        "prov":    ["0.6875rem", { lineHeight: "1.5" }],
      },
    },
  },
  plugins: [],
};

export default config;

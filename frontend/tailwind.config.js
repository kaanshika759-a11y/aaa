/** @type {import('tailwindcss').Config} */
module.exports = {
  // Only generate classes used in these files (tree-shaking)
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  // Force dark mode via class strategy (.dark on <html>)
  darkMode: "class",

  theme: {
    extend: {
      // ── Color Palette ──────────────────────────────────────────────────────
      colors: {
        // Deep space dark backgrounds
        void: {
          950: "#03030a",
          900: "#06060f",
          800: "#0a0a18",
          700: "#0e0e22",
        },
        // Neon Blue – primary brand / glow colour
        neon: {
          50:  "#e8f4ff",
          100: "#c6e5ff",
          200: "#90cbff",
          300: "#52aaff",
          400: "#1a87ff",
          500: "#0062ff",  // primary
          600: "#0047cc",
          700: "#0033a0",
          800: "#002280",
          900: "#001260",
        },
        // Electric Cyan – accent
        cyan: {
          neon: "#00eeff",
          glow: "#00ccdd",
        },
        // Purple – secondary accent
        violet: {
          neon: "#a855f7",
          dark: "#7c3aed",
        },
        // Glass overlays
        glass: {
          white:  "rgba(255, 255, 255, 0.06)",
          border: "rgba(255, 255, 255, 0.10)",
        },
      },

      // ── Typography ─────────────────────────────────────────────────────────
      fontFamily: {
        sans:  ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "sans-serif"],
        mono:  ["JetBrains Mono", "Fira Code", "monospace"],
      },

      // ── Background Gradients ───────────────────────────────────────────────
      backgroundImage: {
        "gradient-radial":  "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":   "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-gradient":    "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,98,255,0.30) 0%, transparent 60%)",
        "neon-glow-card":   "linear-gradient(135deg, rgba(0,98,255,0.08) 0%, rgba(168,85,247,0.08) 100%)",
        "dark-mesh":        "radial-gradient(circle at 20% 50%, rgba(0,98,255,0.07) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.07) 0%, transparent 50%)",
      },

      // ── Box Shadows (neon glows) ───────────────────────────────────────────
      boxShadow: {
        "neon-sm":    "0 0 8px rgba(0,98,255,0.4), 0 0 16px rgba(0,98,255,0.2)",
        "neon-md":    "0 0 16px rgba(0,98,255,0.5), 0 0 32px rgba(0,98,255,0.25), 0 0 64px rgba(0,98,255,0.12)",
        "neon-lg":    "0 0 24px rgba(0,98,255,0.6), 0 0 48px rgba(0,98,255,0.3), 0 0 96px rgba(0,98,255,0.15)",
        "neon-cyan":  "0 0 16px rgba(0,238,255,0.5), 0 0 32px rgba(0,238,255,0.25)",
        "neon-violet":"0 0 16px rgba(168,85,247,0.5), 0 0 32px rgba(168,85,247,0.25)",
        "glass":      "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        "glass-hover":"0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
      },

      // ── Border Radius ──────────────────────────────────────────────────────
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },

      // ── Backdrop Blur ──────────────────────────────────────────────────────
      backdropBlur: {
        xs:  "2px",
        sm:  "8px",
        md:  "16px",
        lg:  "24px",
        xl:  "40px",
        "2xl": "64px",
      },

      // ── Animations ─────────────────────────────────────────────────────────
      keyframes: {
        "pulse-neon": {
          "0%, 100%": {
            boxShadow: "0 0 8px rgba(0,98,255,0.4), 0 0 16px rgba(0,98,255,0.2)",
          },
          "50%": {
            boxShadow: "0 0 24px rgba(0,98,255,0.8), 0 0 48px rgba(0,98,255,0.4)",
          },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.6" },
          "50%":      { opacity: "1.0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        "equalizer": {
          "0%, 100%": { scaleY: "0.3" },
          "50%":      { scaleY: "1.0" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-neon":  "pulse-neon 2s ease-in-out infinite",
        "glow-breathe":"glow-breathe 3s ease-in-out infinite",
        "float":       "float 4s ease-in-out infinite",
        "equalizer-1": "equalizer 0.8s ease-in-out infinite",
        "equalizer-2": "equalizer 0.8s ease-in-out 0.15s infinite",
        "equalizer-3": "equalizer 0.8s ease-in-out 0.3s infinite",
        "equalizer-4": "equalizer 0.8s ease-in-out 0.45s infinite",
        "equalizer-5": "equalizer 0.8s ease-in-out 0.6s infinite",
        "spin-slow":   "spin-slow 8s linear infinite",
        "fade-up":     "fade-up 0.6s ease-out forwards",
        "shimmer":     "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

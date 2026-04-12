/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        luxury: {
          light: "#F5F0E8",   // Warm Creamy Latte
          stone: "#EBE3D5",   // Warm Sand
          clay: "#D6C7B3",    // Toasted beige
          umber: "#261C15",   // Rich Espresso
          gold: "#C4A484",    // Muted Bronze/Gold
          dark: "#1A1410",    // Deep mahogany
          glow: "rgba(142, 107, 83, 0.2)" // Warm coffee glow
        },
        coffee: {
          50: "#FAF7F2",
          100: "#F2E8D9",
          200: "#E6D1B8",
          300: "#D4B08A",
          400: "#B88A5E",
          500: "#966B44",
          600: "#755236",
          700: "#543A29",
          800: "#36251B",
          900: "#1A120E"
        }
      },
      keyframes: {
        "loading-bar": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" }
        }
      },
      animation: {
        "loading-bar": "loading-bar 1.5s infinite ease-in-out"
      }
    }
  },
  plugins: []
};


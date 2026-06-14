import { useState, useEffect } from "react";

/**
 * Fetches an SVG file, parses it with DOMParser, and returns
 * the path data as structured objects for inline rendering.
 *
 * @param {string} url - Path to the SVG file (e.g., "/india-map.svg")
 * @returns {{ paths: Array<{id, title, d}>, viewBox: string, loading: boolean }}
 */
export default function useInlineSvg(url) {
  const [paths, setPaths] = useState([]);
  const [viewBox, setViewBox] = useState("0 0 611.86 695.70");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndParse() {
      try {
        const res = await fetch(url);
        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svgEl = doc.querySelector("svg");

        if (!svgEl || cancelled) return;

        // Extract viewBox or construct from width/height
        const vb = svgEl.getAttribute("viewBox");
        const width = svgEl.getAttribute("width") || "611.86";
        const height = svgEl.getAttribute("height") || "695.70";
        const computedViewBox = vb || `0 0 ${width} ${height}`;

        // Extract all <path> elements
        const pathEls = svgEl.querySelectorAll("path");
        const parsed = [];

        pathEls.forEach((p) => {
          const id = p.getAttribute("id");
          const d = p.getAttribute("d");
          const title = p.getAttribute("title") || "";
          if (id && d) {
            parsed.push({ id, title, d });
          }
        });

        if (!cancelled) {
          setViewBox(computedViewBox);
          setPaths(parsed);
          setLoading(false);
        }
      } catch (err) {
        console.error("[useInlineSvg] Failed to load SVG:", err);
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndParse();
    return () => { cancelled = true; };
  }, [url]);

  return { paths, viewBox, loading };
}

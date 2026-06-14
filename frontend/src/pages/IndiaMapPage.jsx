import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useInlineSvg from "../hooks/useInlineSvg";
import IndiaSvgMap from "../components/IndiaSvgMap";
import RegionPopover from "../components/RegionPopover";

// ─── Region ID → canonical origin (as stored in DB via originNormalizer) ──────
const REGION_TO_ORIGIN = {
  coorg: "Coorg",
  chikkamagaluru: "Chikmagalur",
  araku: "Araku Valley",
  wayanad: "Wayanad",
  nilgiris: "Nilgiris",
  shevaroy: "Shevaroy Hills",
  bababudangiri: "Bababudan Giri",
  "manipur-nagaland": "Nagaland",
  mizoram: "Mizoram",
};

// ─── Coffee region data ──────────────────────────────────────────────────────
// posX/posY are percentage positions on the map image
// Calculated from lat/lon: x% = (lon-68.184)/29.234*100, y% = (37.084-lat)/30.33*100
const REGIONS = [
  {
    id: "coorg",
    name: "Coorg (Kodagu)",
    state: "Karnataka",
    posX: 26.0,
    posY: 81.4,
    color: "#7C4A1E",
    accent: "#E8B86D",
    emoji: "🏔️",
    varieties: ["Arabica", "Robusta"],
    process: ["Washed", "Natural", "Honey"],
    altitude: "900–1,500 m",
    flavourNotes: ["Dark Chocolate", "Black Pepper", "Cardamom", "Earthy Sweetness"],
    tagline: "The coffee heartland — misty hills and spice-laced cups.",
    harvest: "Nov – Feb",
    funFact: "Over 40% of India's total coffee output comes from this single district. The forest shade from Nandi Parvata means every bean grows slow and dense.",
    topRoasters: ["Blue Tokai", "Araku", "Bloom Coffee"],
  },
  {
    id: "chikkamagaluru",
    name: "Chikkamagaluru",
    state: "Karnataka",
    posX: 25.7,
    posY: 78.4,
    color: "#6B5B2E",
    accent: "#D4A853",
    emoji: "🌿",
    varieties: ["Arabica (Kent, S795)", "Robusta"],
    process: ["Washed", "Natural"],
    altitude: "1,000–1,800 m",
    flavourNotes: ["Citrus Zest", "Floral Jasmine", "Milk Chocolate", "Walnut"],
    tagline: "Where India's coffee story began — lush, layered, legendary.",
    harvest: "Nov – Jan",
    funFact: "Baba Budan, a Sufi saint, is said to have smuggled seven coffee beans from Yemen here in the 1600s — literally the origin of Indian coffee.",
    topRoasters: ["Corridor Seven", "Blue Tokai", "A&B Coffee"],
  },
  {
    id: "araku",
    name: "Araku Valley",
    state: "Andhra Pradesh",
    posX: 50.3,
    posY: 61.9,
    color: "#3D6B4A",
    accent: "#85C98A",
    emoji: "🌱",
    varieties: ["Arabica (Indigenous heirlooms)"],
    process: ["Washed", "Natural", "Anaerobic"],
    altitude: "900–1,100 m",
    flavourNotes: ["Stone Fruit", "Brown Sugar", "Turmeric", "Wildflower"],
    tagline: "Tribal-grown, terroir-driven, award-winning.",
    harvest: "Dec – Feb",
    funFact: "Over 50,000 tribal families under the Girijan Cooperative Corporation grow coffee here with zero synthetic inputs. Araku beans won a Parisian cupping trophy in 2017.",
    topRoasters: ["Araku Coffee", "Ainmane"],
  },
  {
    id: "wayanad",
    name: "Wayanad",
    state: "Kerala",
    posX: 27.1,
    posY: 84.0,
    color: "#2D6E4A",
    accent: "#6CBF7F",
    emoji: "🌴",
    varieties: ["Robusta", "Arabica"],
    process: ["Washed", "Natural"],
    altitude: "700–2,100 m",
    flavourNotes: ["Dark Chocolate", "Coconut", "Pepper Spice", "Tobacco"],
    tagline: "Robusta royalty — bold, brooding, and brilliantly tropical.",
    harvest: "Jan – Mar",
    funFact: "Wayanad produces some of the finest natural-process Robustas in the world. The high-altitude lots from Lakkidi can cup at 84+ SCA — almost specialty-tier for Robusta.",
    topRoasters: ["Ainmane", "Bloom Coffee", "Kapikottai"],
  },
  {
    id: "nilgiris",
    name: "Nilgiris",
    state: "Tamil Nadu",
    posX: 29.1,
    posY: 84.7,
    color: "#4A5B8C",
    accent: "#9BB4E8",
    emoji: "☁️",
    varieties: ["Arabica", "Robusta"],
    process: ["Washed", "Honey"],
    altitude: "1,200–2,200 m",
    flavourNotes: ["Earl Grey Tea", "Bergamot", "Caramel", "Cedar"],
    tagline: "Blue mountains, tea-country vibes — but the coffee slaps.",
    harvest: "Nov – Jan",
    funFact: "At Ooty and Coonoor the estates share land with tea gardens at 2,200 m — the highest coffee farms in India. The cup tastes almost more like oolong than Arabica anywhere else.",
    topRoasters: ["Fraction 9", "Curious Life Coffee"],
  },
  {
    id: "shevaroy",
    name: "Shevaroy Hills (Yercaud)",
    state: "Tamil Nadu",
    posX: 34.2,
    posY: 83.3,
    color: "#885533",
    accent: "#E09966",
    emoji: "⛰️",
    varieties: ["Arabica (Old Kent)"],
    process: ["Washed"],
    altitude: "1,200–1,650 m",
    flavourNotes: ["Dried Apricot", "Dark Molasses", "Roasted Almond", "Clove"],
    tagline: "Salem's secret — old-Kent trees and a cup that smells like the bazaar.",
    harvest: "Nov – Jan",
    funFact: "The Shevaroy Hills hold some of the oldest Kent-variety trees still in production. The dry winds from the Deccan plateau concentrate sugars in the cherry unusually early.",
    topRoasters: ["Savorworks", "Quick Brown Fox"],
  },
  {
    id: "bababudangiri",
    name: "Baba Budan Giri",
    state: "Karnataka",
    posX: 25.7,
    posY: 77.7,
    color: "#8C4A2D",
    accent: "#E0956E",
    emoji: "🕌",
    varieties: ["Arabica (ancient heirlooms)", "Robusta"],
    process: ["Natural", "Washed"],
    altitude: "1,400–2,000 m",
    flavourNotes: ["Ripe Berry", "Cardamom", "Butter Toffee", "Smoky Incense"],
    tagline: "Pilgrimage coffee — sacred hills, ancient varietals.",
    harvest: "Oct – Jan",
    funFact: "The dargah (shrine) of Baba Budan sits at 1,895 m. The micro-climate here — fog-drenched mornings and sunny afternoons — creates dramatically complex fruit-forward profiles.",
    topRoasters: ["Blue Tokai", "Corridor Seven"],
  },
  {
    id: "manipur-nagaland",
    name: "Nagaland / Manipur",
    state: "North-East India",
    posX: 88.3,
    posY: 37.5,
    color: "#5B3D8C",
    accent: "#A87EDD",
    emoji: "🌄",
    varieties: ["Arabica (Wild / Shade-grown)"],
    process: ["Natural", "Washed"],
    altitude: "1,200–2,000 m",
    flavourNotes: ["Wild Strawberry", "Purple Grape", "Fermented Plum", "Pine Resin"],
    tagline: "India's newest frontier — wildly experimental, deeply terroir.",
    harvest: "Dec – Feb",
    funFact: "Nagaland farmers only began specialty processing in the 2010s. Some lots from Pfütsero district have scored 87–88 SCA — tiny quantities but phenomenal quality.",
    topRoasters: ["Subko", "Naivo Coffee"],
  },
  {
    id: "mizoram",
    name: "Mizoram",
    state: "North-East India",
    posX: 83.8,
    posY: 45.8,
    color: "#3D6B8C",
    accent: "#7AC0E0",
    emoji: "🌊",
    varieties: ["Arabica"],
    process: ["Washed", "Natural"],
    altitude: "1,000–1,600 m",
    flavourNotes: ["Green Apple", "Lemongrass", "Honey", "White Peach"],
    tagline: "The cool northeast — clean cups with a tropical twist.",
    harvest: "Jan – Mar",
    funFact: "Mizoram's coffee was historically consumed only locally. Since 2018, a handful of specialty roasters have started sourcing small lots, revealing a distinctive clean-sweet profile.",
    topRoasters: ["Subko", "Tulum Coffee"],
  },
];

// ─── Colour legend bands ─────────────────────────────────────────────────────
const ALTITUDE_BANDS = [
  { label: "700–1,000 m", color: "#B5D99C" },
  { label: "1,000–1,400 m", color: "#7DC57A" },
  { label: "1,400–1,800 m", color: "#4A8C5A" },
  { label: "1,800 m +", color: "#2E5E3E" },
];

// Coffee-growing state IDs to highlight in the SVG
const COFFEE_STATE_IDS = ["IN-KA", "IN-KL", "IN-TN", "IN-AP", "IN-OR", "IN-NL", "IN-MN", "IN-MZ", "IN-ML", "IN-AS"];

// Map SVG state IDs → coffee region IDs (for click handling)
const STATE_TO_REGIONS = {
  "IN-KA": ["coorg", "chikkamagaluru", "bababudangiri"], // Karnataka — 3 regions
  "IN-KL": ["wayanad"],                                    // Kerala
  "IN-TN": ["nilgiris", "shevaroy"],                       // Tamil Nadu — 2 regions
  "IN-AP": ["araku"],                                      // Andhra Pradesh
  "IN-NL": ["manipur-nagaland"],                           // Nagaland (shared region)
  "IN-MN": ["manipur-nagaland"],                           // Manipur (shared region)
  "IN-MZ": ["mizoram"],                                    // Mizoram
};

// Reverse lookup: region → parent state(s)
const getStatesForRegion = (regionId) =>
  Object.entries(STATE_TO_REGIONS)
    .filter(([_, regions]) => regions.includes(regionId))
    .map(([stateId]) => stateId);

export default function IndiaMapPage() {
  const navigate = useNavigate();
  const [activeRegion, setActiveRegion] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [popover, setPopover] = useState(null); // { stateId, x, y } or null

  // Fetch and parse the SVG for inline rendering
  const { paths, viewBox, loading: svgLoading } = useInlineSvg("/india-map.svg");

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const lastPinchDist = useRef(null);
  const mapContainerRef = useRef(null);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;

  // Attach wheel listener imperatively with { passive: false } so preventDefault works
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      setZoom((z) => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));
        if (newZoom <= MIN_ZOOM) setPan({ x: 0, y: 0 });
        return newZoom;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return; // left click only
    // Only start pan tracking if clicking on the map background, not on a marker
    if (e.target.closest("[data-region-marker]")) return;
    setIsPanning(true);
    didDrag.current = false;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
  }, [pan]);

  const handlePointerMove = useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Pinch-to-zoom for touch
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current !== null) {
        const delta = (dist - lastPinchDist.current) * 0.01;
        setZoom((z) => {
          const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));
          if (newZoom <= MIN_ZOOM) setPan({ x: 0, y: 0 });
          return newZoom;
        });
      }
      lastPinchDist.current = dist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5));
  const handleZoomOut = () => {
    setZoom((z) => {
      const newZoom = Math.max(MIN_ZOOM, z - 0.5);
      if (newZoom <= MIN_ZOOM) setPan({ x: 0, y: 0 });
      return newZoom;
    });
  };
  const handleResetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Only select a region if the user didn't drag
  const handleRegionClick = (regionId) => {
    setActiveRegion((cur) => cur === regionId ? null : regionId);
  };

  // Click on an SVG state path
  const handleStateClick = useCallback((stateId, event) => {
    if (didDrag.current) return;
    const regionIds = STATE_TO_REGIONS[stateId] || [];
    if (regionIds.length === 0) return;

    if (regionIds.length === 1) {
      // Single region → select directly
      setActiveRegion((prev) => prev === regionIds[0] ? null : regionIds[0]);
      setPopover(null);
    } else {
      // Multiple regions → pick the one closest to click position
      const rect = mapContainerRef.current.getBoundingClientRect();
      // Convert click to percentage coordinates (matching posX/posY system)
      const wrapper = event.currentTarget.closest("[data-map-wrapper]");
      if (!wrapper) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const clickXPct = ((event.clientX - wrapperRect.left) / wrapperRect.width) * 100;
      const clickYPct = ((event.clientY - wrapperRect.top) / wrapperRect.height) * 100;

      // Find the nearest region by distance to its marker position
      const matchedRegions = REGIONS.filter((r) => regionIds.includes(r.id));
      let closest = matchedRegions[0];
      let minDist = Infinity;

      matchedRegions.forEach((r) => {
        const dx = r.posX - clickXPct;
        const dy = r.posY - clickYPct;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          closest = r;
        }
      });

      setActiveRegion((prev) => prev === closest.id ? null : closest.id);
      setPopover(null);
    }
  }, []);

  // Hover on an SVG state path
  const handleStateHover = useCallback((stateId) => {
    setHoveredState(stateId);
  }, []);

  const active = activeRegion
    ? REGIONS.find((r) => r.id === activeRegion)
    : null;

  const handleExploreRegion = (region) => {
    const origin = REGION_TO_ORIGIN[region.id] || region.name.split(" (")[0];
    navigate(`/explore?origin=${encodeURIComponent(origin)}`);
  };

  return (
    <div className="min-h-screen bg-[#1A1410] text-luxury-light flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-luxury-gold/20 bg-[#1A1410]/90 backdrop-blur sticky top-0 z-50">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-luxury-clay hover:text-luxury-gold transition-colors text-sm font-semibold tracking-widest uppercase"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-2xl">☕</span>
          <div>
            <h1 className="text-base font-bold tracking-tight text-luxury-light leading-none">India Coffee Atlas</h1>
            <p className="text-[10px] text-luxury-clay uppercase tracking-[0.2em] mt-0.5">Where the terroir lives</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/explore")}
          className="flex items-center gap-2 px-4 py-2 bg-luxury-gold/20 text-luxury-gold hover:bg-luxury-gold/30 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border border-luxury-gold/30"
        >
          Explore Coffees →
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* ── Left: Map — the entire left panel IS the zoom bounding box ── */}
        <div
          ref={mapContainerRef}
          className="flex-1 relative min-h-[480px] overflow-hidden"
          style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default", touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Background texture */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#C4A484 0px,#C4A484 1px,transparent 1px,transparent 8px)",
            }}
          />

          {/* Map title */}
          <div className="absolute top-3 left-0 right-0 text-center z-10 pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-luxury-clay/60">
              India — Coffee Growing Regions
            </span>
          </div>

          {/* Zoom controls */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-lg bg-[#1A1410]/90 border border-luxury-gold/30 text-luxury-gold hover:bg-luxury-gold/20 flex items-center justify-center text-sm font-bold transition-all"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-lg bg-[#1A1410]/90 border border-luxury-gold/30 text-luxury-gold hover:bg-luxury-gold/20 flex items-center justify-center text-sm font-bold transition-all"
              title="Zoom out"
            >
              −
            </button>
            {zoom !== 1 && (
              <button
                onClick={handleResetZoom}
                className="w-8 h-8 rounded-lg bg-[#1A1410]/90 border border-luxury-gold/30 text-luxury-gold hover:bg-luxury-gold/20 flex items-center justify-center transition-all"
                title="Reset zoom"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>

          {/* Zoom level indicator */}
          {zoom !== 1 && (
            <div className="absolute top-3 left-14 z-20 px-2 py-1 rounded-md bg-[#1A1410]/90 border border-luxury-gold/20">
              <span className="text-[9px] font-bold text-luxury-gold">{Math.round(zoom * 100)}%</span>
            </div>
          )}

          {/* Transform wrapper — zooms & pans within the full left panel */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: "center center",
              transitionDuration: isPanning ? "0ms" : "200ms",
            }}
          >
              {/* Inline SVG map with clickable states */}
              <div className="relative" data-map-wrapper>
              {svgLoading ? (
                <div style={{ height: "calc(100vh - 140px)", width: "auto", aspectRatio: "611.86 / 695.70" }} className="flex items-center justify-center">
                  <span className="text-luxury-clay/50 text-sm animate-pulse">Loading map...</span>
                </div>
              ) : (
                <IndiaSvgMap
                  paths={paths}
                  viewBox={viewBox}
                  coffeeStateIds={COFFEE_STATE_IDS}
                  stateToRegions={STATE_TO_REGIONS}
                  activeRegion={activeRegion}
                  hoveredState={hoveredState}
                  onStateClick={handleStateClick}
                  onStateHover={handleStateHover}
                />
              )}

              {/* Sea labels overlaid */}
              <span
                className="absolute text-[9px] font-light italic tracking-[0.2em] text-[#4A7A9B]/50 pointer-events-none select-none"
                style={{ left: "2%", top: "68%", transform: "rotate(-15deg)" }}
              >
                Arabian Sea
              </span>
              <span
                className="absolute text-[9px] font-light italic tracking-[0.2em] text-[#4A7A9B]/50 pointer-events-none select-none"
                style={{ right: "8%", top: "55%", transform: "rotate(10deg)" }}
              >
                Bay of Bengal
              </span>

              {/* Coffee region markers overlaid on map — above SVG */}
              {REGIONS.map((r) => {
                const isActive = activeRegion === r.id;
                const isHov = hovered === r.id;
                const show = isActive || isHov;
                // Scale markers inversely so they shrink visually when zoomed,
                // keeping them separated and readable
                const markerScale = 1 / zoom;
                return (
                  <div
                    key={r.id}
                    data-region-marker
                    className="absolute"
                    style={{
                      left: `${r.posX}%`,
                      top: `${r.posY}%`,
                      transform: `translate(-50%, -50%) scale(${markerScale})`,
                      zIndex: 30,
                    }}
                  >
                    {/* Large clickable hit area */}
                    <div
                      className="absolute cursor-pointer"
                      style={{
                        width: "56px",
                        height: "56px",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        borderRadius: "50%",
                      }}
                      onClick={() => handleRegionClick(r.id)}
                      onMouseEnter={() => {
                        setHovered(r.id);
                        const states = getStatesForRegion(r.id);
                        if (states.length > 0) setHoveredState(states[0]);
                      }}
                      onMouseLeave={() => {
                        setHovered(null);
                        setHoveredState(null);
                      }}
                    />
                    {/* Pulse ring */}
                    <div
                      className="absolute rounded-full transition-all duration-500 pointer-events-none"
                      style={{
                        width: show ? "40px" : "28px",
                        height: show ? "40px" : "28px",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        background: `radial-gradient(circle, ${r.color}40 0%, transparent 70%)`,
                      }}
                    />
                    {/* Mid ring */}
                    <div
                      className="absolute rounded-full transition-all duration-400 pointer-events-none"
                      style={{
                        width: show ? "22px" : "16px",
                        height: show ? "22px" : "16px",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        background: r.color,
                        opacity: show ? 0.5 : 0.3,
                      }}
                    />
                    {/* Core dot */}
                    <div
                      className="rounded-full transition-all duration-300 shadow-lg pointer-events-none"
                      style={{
                        width: show ? "14px" : "10px",
                        height: show ? "14px" : "10px",
                        background: r.accent,
                        boxShadow: `0 0 ${show ? "12px" : "6px"} ${r.accent}88`,
                      }}
                    />
                    {/* Label — clickable */}
                    <span
                      className="absolute whitespace-nowrap font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer select-none"
                      style={{
                        fontSize: `${Math.max(7, 8)}px`,
                        top: r.posY > 70 ? "-18px" : "calc(100% + 6px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        color: show ? r.accent : "#C4A484",
                        opacity: show ? 1 : 0.7,
                        textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)",
                        padding: "2px 4px",
                        borderRadius: "3px",
                        background: show ? "rgba(26,20,16,0.8)" : "transparent",
                      }}
                      onClick={() => handleRegionClick(r.id)}
                      onMouseEnter={() => {
                        setHovered(r.id);
                        const states = getStatesForRegion(r.id);
                        if (states.length > 0) setHoveredState(states[0]);
                      }}
                      onMouseLeave={() => {
                        setHovered(null);
                        setHoveredState(null);
                      }}
                    >
                      {r.name.split(" (")[0]}
                    </span>
                  </div>
                );
              })}

              {/* Compass arrow pointing true north */}
              <div className="absolute top-3 right-3 w-9 h-9 rounded-full border border-luxury-gold/40 bg-[#1A1410]/80 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  {/* North half (red/gold) */}
                  <path d="M12 2 L15 10 L12 8 L9 10 Z" fill="#C4A484" />
                  {/* South half (dark) */}
                  <path d="M12 22 L9 14 L12 16 L15 14 Z" fill="#5A4A3A" />
                  {/* Center dot */}
                  <circle cx="12" cy="12" r="1.5" fill="#C4A484" />
                </svg>
              </div>

              {/* Hover tooltip for states */}
              {hoveredState && !activeRegion && (
                <StateTooltip
                  stateId={hoveredState}
                  stateToRegions={STATE_TO_REGIONS}
                  regions={REGIONS}
                  paths={paths}
                />
              )}

              </div>{/* end relative wrapper */}
          </div>{/* end transform wrapper */}

          {/* Altitude legend */}
          <div className="absolute bottom-3 right-3 bg-[#1A1410]/90 border border-luxury-gold/20 rounded-xl p-3 backdrop-blur z-10">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-luxury-clay/60 mb-2">Altitude</p>
            {ALTITUDE_BANDS.map((b) => (
              <div key={b.label} className="flex items-center gap-2 mb-1">
                <div className="w-3 h-2 rounded-sm" style={{ background: b.color, opacity: 0.7 }} />
                <span className="text-[9px] text-luxury-clay/70 font-medium">{b.label}</span>
              </div>
            ))}
          </div>

          {/* Zoom hint */}
          {zoom <= 1 && (
            <div className="absolute bottom-3 left-3 z-10">
              <span className="text-[9px] text-luxury-clay/40 italic">Scroll to zoom · Drag to pan</span>
            </div>
          )}
        </div>

        {/* ── Right: Detail panel ── */}
        <div className="lg:w-[400px] xl:w-[440px] border-t lg:border-t-0 lg:border-l border-luxury-gold/15 flex flex-col overflow-y-auto">
          {active ? (
            <DetailPanel region={active} onClose={() => setActiveRegion(null)} onExplore={handleExploreRegion} />
          ) : (
            <EmptyState regions={REGIONS} onSelect={setActiveRegion} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state — show all regions as clickable cards ───────────────────────
function EmptyState({ regions, onSelect }) {
  return (
    <div className="flex-1 flex flex-col p-6 gap-4">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-luxury-light tracking-tight">Pick a Region</h2>
        <p className="text-xs text-luxury-clay/70 mt-1">Click a marker on the map or select below to explore the terroir.</p>
      </div>
      <div className="flex flex-col gap-3">
        {regions.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className="flex items-center gap-4 p-4 rounded-2xl border border-luxury-gold/15 bg-white/3 hover:bg-white/8 hover:border-luxury-gold/35 text-left transition-all group"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 border"
              style={{ background: r.color + "44", borderColor: r.accent + "55" }}
            >
              {r.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-luxury-light group-hover:text-luxury-gold transition-colors leading-snug">
                {r.name}
              </p>
              <p className="text-[10px] text-luxury-clay/60 uppercase tracking-widest mt-0.5">{r.state}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {r.flavourNotes.slice(0, 2).map((n) => (
                  <span
                    key={n}
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: r.accent + "20", color: r.accent }}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <svg className="w-4 h-4 text-luxury-clay/30 group-hover:text-luxury-gold shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────
function DetailPanel({ region: r, onClose, onExplore }) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Hero strip */}
      <div
        className="relative px-6 pt-8 pb-6 flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${r.color}33 0%, ${r.color}11 50%, transparent 100%)`,
          borderBottom: `1px solid ${r.accent}22`,
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-luxury-clay" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border"
            style={{ background: r.color + "55", borderColor: r.accent + "44" }}
          >
            {r.emoji}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: r.accent }}>
              {r.state}
            </p>
            <h2 className="text-xl font-bold text-luxury-light leading-tight">{r.name}</h2>
            <p className="text-xs text-luxury-clay/70 mt-1 italic">{r.tagline}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

        {/* Quick stats row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Altitude", value: r.altitude, icon: "🏔️" },
            { label: "Harvest", value: r.harvest, icon: "🌿" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 border"
              style={{ background: r.color + "18", borderColor: r.accent + "25" }}
            >
              <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-luxury-clay/60 mb-1">{s.icon} {s.label}</p>
              <p className="text-sm font-bold text-luxury-light">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Flavour notes */}
        <div>
          <SectionHeading accent={r.accent}>Flavour Notes</SectionHeading>
          <div className="flex flex-wrap gap-2 mt-2">
            {r.flavourNotes.map((note) => (
              <span
                key={note}
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: r.accent + "20", color: r.accent, border: `1px solid ${r.accent}30` }}
              >
                {note}
              </span>
            ))}
          </div>
        </div>

        {/* Varieties */}
        <div>
          <SectionHeading accent={r.accent}>Varieties Grown</SectionHeading>
          <div className="flex flex-col gap-1.5 mt-2">
            {r.varieties.map((v) => (
              <div key={v} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.accent }} />
                <span className="text-xs text-luxury-clay/80 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Processing */}
        <div>
          <SectionHeading accent={r.accent}>Processing Methods</SectionHeading>
          <div className="flex flex-wrap gap-2 mt-2">
            {r.process.map((p) => (
              <span
                key={p}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-luxury-clay/80 border"
                style={{ borderColor: r.accent + "30", background: "#1A1410" }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Fun fact */}
        <div
          className="rounded-2xl p-4 border-l-4 relative overflow-hidden"
          style={{ borderColor: r.accent, background: r.color + "15" }}
        >
          <div
            className="absolute top-2 right-3 text-4xl opacity-10 select-none"
            style={{ color: r.accent }}
          >
            ☕
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: r.accent }}>
            Coffee Nerd Fact
          </p>
          <p className="text-xs text-luxury-clay/90 leading-relaxed">{r.funFact}</p>
        </div>

        {/* Roasters */}
        <div>
          <SectionHeading accent={r.accent}>Top Roasters Sourcing Here</SectionHeading>
          <div className="flex flex-wrap gap-2 mt-2">
            {r.topRoasters.map((ro) => (
              <span
                key={ro}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-luxury-light border"
                style={{ borderColor: r.accent + "40", background: r.color + "25" }}
              >
                <span style={{ color: r.accent }}>●</span> {ro}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="pt-1 pb-2">
          <button
            onClick={() => onExplore(r)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${r.color}, ${r.color}CC)`,
              color: "#F5F0E8",
              border: `1px solid ${r.accent}40`,
            }}
          >
            Explore {r.name.split(" (")[0]} coffees →
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ accent, children }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-4 rounded-full" style={{ background: accent }} />
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-clay/60">{children}</p>
    </div>
  );
}

// ─── Hover tooltip for coffee states ────────────────────────────────────────
function StateTooltip({ stateId, stateToRegions, regions, paths }) {
  const regionIds = stateToRegions[stateId] || [];
  const matchedRegions = regions.filter((r) => regionIds.includes(r.id));
  const statePath = paths.find((p) => p.id === stateId);
  const stateName = statePath?.title || stateId;

  if (regionIds.length === 0) {
    // Coffee state with no detailed data yet
    return (
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="bg-[#1A1410]/95 border border-luxury-gold/25 rounded-lg px-3 py-1.5 backdrop-blur whitespace-nowrap">
          <span className="text-[10px] font-bold text-luxury-clay/70">{stateName}</span>
          <span className="text-[9px] text-luxury-clay/40 ml-2">Coming soon</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div className="bg-[#1A1410]/95 border border-luxury-gold/25 rounded-lg px-3 py-2 backdrop-blur whitespace-nowrap">
        <span className="text-[10px] font-bold text-luxury-gold">{stateName}</span>
        <span className="text-[9px] text-luxury-clay/50 ml-2">
          {matchedRegions.length} {matchedRegions.length === 1 ? "region" : "regions"}
        </span>
        {matchedRegions.length > 1 && (
          <p className="text-[8px] text-luxury-clay/40 mt-0.5">Click to choose</p>
        )}
      </div>
    </div>
  );
}

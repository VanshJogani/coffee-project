import React, { useMemo } from "react";

/**
 * Renders the India SVG map inline with interactive coffee-growing states.
 * Coffee states get click/hover handlers and dynamic styling.
 */
const IndiaSvgMap = React.memo(function IndiaSvgMap({
  paths,
  viewBox,
  coffeeStateIds,
  stateToRegions,
  activeRegion,
  hoveredState,
  onStateClick,
  onStateHover,
}) {
  // Determine which state is "active" based on the selected region
  const activeStateIds = useMemo(() => {
    if (!activeRegion) return [];
    return Object.entries(stateToRegions)
      .filter(([_, regions]) => regions.includes(activeRegion))
      .map(([stateId]) => stateId);
  }, [activeRegion, stateToRegions]);

  // Get the accent color for the active region (if any)
  // We'll receive it from the parent via a lookup — keep this component pure
  // by computing fill inline based on state

  return (
    <svg
      viewBox={viewBox}
      className="select-none block"
      style={{
        height: "calc(100vh - 140px)",
        aspectRatio: "611.86 / 695.70",
        pointerEvents: "none",
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Gold glow filter for hovered/active coffee states */}
      <defs>
        <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feFlood floodColor="#C4A484" floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="gold-glow-strong" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
          <feFlood floodColor="#E8B86D" floodOpacity="0.5" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map(({ id, title, d }) => {
        const isCoffeeState = coffeeStateIds.includes(id);
        const isHovered = hoveredState === id;
        const isActive = activeStateIds.includes(id);
        const hasRegions = (stateToRegions[id]?.length || 0) > 0;

        // Compute visual style
        let fill, stroke, strokeWidth, filter, cursor;

        if (!isCoffeeState) {
          // Non-coffee state: dark, subtle
          fill = "#33281E";
          stroke = "#8B7355";
          strokeWidth = 0.5;
          filter = "none";
          cursor = "default";
        } else if (isActive) {
          // Active state (its region is selected)
          fill = "#5A4020";
          stroke = "#E8B86D";
          strokeWidth = 1.8;
          filter = "url(#gold-glow-strong)";
          cursor = hasRegions ? "pointer" : "default";
        } else if (isHovered) {
          // Hovered coffee state
          fill = "#4D3A25";
          stroke = "#E8B86D";
          strokeWidth = 1.4;
          filter = "url(#gold-glow)";
          cursor = hasRegions ? "pointer" : "default";
        } else {
          // Default coffee state — visibly distinct from non-coffee
          fill = "#3D2E1E";
          stroke = "#C4A484";
          strokeWidth = 0.9;
          filter = "none";
          cursor = hasRegions ? "pointer" : "default";
        }

        return (
          <path
            key={id}
            id={id}
            d={d}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            filter={isHovered ? filter : isActive ? filter : undefined}
            style={{
              cursor,
              transition: "fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease",
              pointerEvents: isCoffeeState ? "auto" : "none",
            }}
            onClick={
              isCoffeeState && hasRegions
                ? (e) => onStateClick(id, e)
                : undefined
            }
            onMouseEnter={
              isCoffeeState ? () => onStateHover(id) : undefined
            }
            onMouseLeave={
              isCoffeeState ? () => onStateHover(null) : undefined
            }
          >
            {title && <title>{title}</title>}
          </path>
        );
      })}
    </svg>
  );
});

export default IndiaSvgMap;

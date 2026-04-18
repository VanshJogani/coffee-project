import { useEffect, useRef } from "react";

const DATA = [
  {
    name: "Floral", color: "#D88BA2",
    subs: [
      { name: "Black Tea", subs: [""] },
      { name: "Floral", subs: ["Honeysuckle","Saffron","Greeny","Rose","Jasmine","Chamomile"] }
    ]
  },
  {
    name: "Fruity", color: "#E25B3A",
    subs: [
      { name: "Berry", subs: ["Strawberry","Raspberry","Mulberry","Blueberry","Raisin","Plum","Dates","Fig"] },
      { name: "Dried Fruit", subs: ["Apricot","Coconut","Tender Banana","Cherry","Pomegranate","Mango","Pineapple","Passionfruit"] },
      { name: "Other Fruit", subs: ["Grape","Apple","Papaya","Muskmelon","Peach","Pear","Chikoo","Malta Orange"] },
      { name: "Citrus Fruit", subs: ["Orange","Mosambi","Lemon","Lime"] }
    ]
  },
  {
    name: "Sour / Fermented", color: "#8DBF4A",
    subs: [
      { name: "Sour Aromatics", subs: ["Acetic Acid","Butyric Acid","Citric Acid","Isovaleric Acid","Malic Acid"] },
      { name: "Alcohol / Fermented", subs: ["Wine","Whiskey","Fermented","Overripe"] }
    ]
  },
  {
    name: "Green / Vegetative", color: "#3E8F54",
    subs: [
      { name: "Olive Oil", subs: [] },
      { name: "Raw", subs: [] },
      { name: "Green / Vegetative", subs: ["Beany","Under-Ripe","Green Peas","Fresh","Spinach/Palak","Vegetative"] },
      { name: "Bay Leaf", subs: [] },
      { name: "Coriander", subs: [] },
      { name: "Tulsi", subs: [] }
    ]
  },
  {
    name: "Others", color: "#7E8D96",
    subs: [
      { name: "Papery / Musty", color: "#8E9BA5", subs: ["Mouldy/Damp","Woody","Papery","Cardboard","Stale"] },
      { name: "Chemical", color: "#6B7F8E", subs: ["Musty/Earthy","Animalic","Meaty/Brothy","Phenolic","Bitter","Salty","Medicinal","Petroleum","Skunky","Rubber"] }
    ]
  },
  {
    name: "Roasted", color: "#7C5233",
    subs: [
      { name: "Pipe Tobacco", subs: [] },
      { name: "Acrid", subs: [] },
      { name: "Ashy", subs: [] },
      { name: "Smokey", subs: [] },
      { name: "Brown, Roast", subs: ["Grain","Malt"] },
      { name: "Cereal", subs: [] }
    ]
  },
  {
    name: "Spices", color: "#C23B3B",
    subs: [
      { name: "Pungent", subs: ["Pepper","Anise","Fennel"] },
      { name: "Brown Spice", subs: ["Cardamom","Nutmeg","Cinnamon","Clove"] }
    ]
  },
  {
    name: "Nutty / Cocoa", color: "#6B3A22",
    subs: [
      { name: "Nutty", subs: ["Almond","Hazelnut","Cashewnut","Peanut","Walnut"] },
      { name: "Cocoa", subs: ["Chocolate","Dark Chocolate","Cocoa Nibs","Honey","Caramelised"] }
    ]
  },
  {
    name: "Sweet", color: "#D4A33C",
    subs: [
      { name: "Brown Sugar", subs: ["Jaggery","Molasses"] },
      { name: "Sugar / Candy", subs: ["Sugarcane","Vanilla"] }
    ]
  }
];

function hexToRGB(h) { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function rgbToHex(r,g,b) { return '#'+[r,g,b].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join(''); }
function lighten(hex,amt) { const[r,g,b]=hexToRGB(hex); return rgbToHex(r+(255-r)*amt,g+(255-g)*amt,b+(255-b)*amt); }
function darken(hex,amt) { const[r,g,b]=hexToRGB(hex); return rgbToHex(r*(1-amt),g*(1-amt),b*(1-amt)); }
function alpha(hex,a) { const[r,g,b]=hexToRGB(hex); return `rgba(${r},${g},${b},${a})`; }

export default function InteractiveFlavourWheel() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const tipCatRef = useRef(null);
  const tipSwatchRef = useRef(null);
  const tipLabelRef = useRef(null);
  const detailRef = useRef(null);
  const detailLabelRef = useRef(null);
  const detailPathRef = useRef(null);
  const legendRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const tooltip = tooltipRef.current;
    const tipCat = tipCatRef.current;
    const tipSwatch = tipSwatchRef.current;
    const tipLabel = tipLabelRef.current;
    const detail = detailRef.current;
    const detailLabel = detailLabelRef.current;
    const detailPath = detailPathRef.current;

    // Build legend
    const legendEl = legendRef.current;
    legendEl.innerHTML = '';
    DATA.forEach(cat => {
      const d = document.createElement('div');
      d.className = 'legend-item';
      d.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:0.65rem;color:#9B8E7E;font-weight:400;letter-spacing:0.02em;';
      d.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${cat.color};flex-shrink:0;display:inline-block;"></span>${cat.name}`;
      legendEl.appendChild(d);
    });

    const DPR = window.devicePixelRatio || 1;
    let W, H, cx, cy, segments = [];
    let hoveredSeg = null;

    function resize() {
      const rect = container.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2;
      buildSegments();
      render();
    }

    function buildSegments() {
      segments = [];
      const maxR = Math.min(cx, cy) * 0.95;
      const r0 = maxR * 0.14, r1 = maxR * 0.34, r2 = maxR * 0.58, r3 = maxR * 0.94;

      let totalLeaves = 0;
      DATA.forEach(cat => {
        let n = 0;
        cat.subs.forEach(sub => { n += Math.max(sub.subs.length, 1); });
        cat._leaves = n; totalLeaves += n;
      });

      const GAP = 0.005;
      const TWO_PI = Math.PI * 2;
      let angle = -Math.PI / 2;

      DATA.forEach(cat => {
        const catSweep = (cat._leaves / totalLeaves) * TWO_PI;
        const catStart = angle, catEnd = angle + catSweep;
        segments.push({ r0, r1, a0: catStart + GAP, a1: catEnd - GAP, color: cat.color, label: cat.name, cat: cat.name, level: 0, path: cat.name });

        let subAngle = catStart;
        cat.subs.forEach((sub, si) => {
          const subLeaves = Math.max(sub.subs.length, 1);
          const subSweep = (subLeaves / cat._leaves) * catSweep;
          const subStart = subAngle, subEnd = subAngle + subSweep;
          const baseColor = sub.color || cat.color;
          const subColor = sub.color || lighten(cat.color, 0.15 + si * 0.04);
          segments.push({ r0: r1, r1: r2, a0: subStart + GAP, a1: subEnd - GAP, color: subColor, label: sub.name, cat: cat.name, level: 1, path: cat.name + ' → ' + sub.name });

          if (sub.subs.length > 0) {
            const noteAngle = subSweep / sub.subs.length;
            sub.subs.forEach((note, ni) => {
              const nStart = subStart + ni * noteAngle;
              const nEnd = nStart + noteAngle;
              const noteColor = lighten(baseColor, 0.32 + ni * 0.025);
              segments.push({ r0: r2, r1: r3, a0: nStart + GAP, a1: nEnd - GAP, color: noteColor, label: note, cat: cat.name, level: 2, path: cat.name + ' → ' + sub.name + ' → ' + note });
            });
          } else {
            const noteColor = lighten(baseColor, 0.35);
            segments.push({ r0: r2, r1: r3, a0: subStart + GAP, a1: subEnd - GAP, color: noteColor, label: sub.name, cat: cat.name, level: 2, path: cat.name + ' → ' + sub.name });
          }
          subAngle = subEnd;
        });
        angle = catEnd;
      });
    }

    function render() {
      ctx.clearRect(0, 0, W, H);
      const maxR = Math.min(cx, cy) * 0.95;
      const r0 = maxR * 0.14;

      const grd = ctx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR * 1.05);
      grd.addColorStop(0, 'rgba(196,151,59,0.05)');
      grd.addColorStop(1, 'rgba(196,151,59,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      const hovCat = hoveredSeg !== null ? segments[hoveredSeg].cat : null;

      segments.forEach((s, i) => {
        const isHovered = hoveredSeg === i;
        const isSameCat = hovCat && s.cat === hovCat;
        const isDimmed = hovCat !== null && !isSameCat;

        ctx.beginPath();
        const expand = isHovered ? 4 : 0;
        ctx.arc(cx, cy, s.r1 + expand, s.a0, s.a1);
        ctx.arc(cx, cy, s.r0 - (isHovered ? 1 : 0), s.a1, s.a0, true);
        ctx.closePath();

        let fillColor = s.color;
        if (isDimmed) fillColor = lighten(s.color, 0.4);
        if (isHovered) fillColor = darken(s.color, 0.1);

        const midA = (s.a0 + s.a1) / 2;
        const gx = cx + Math.cos(midA) * s.r0;
        const gy = cy + Math.sin(midA) * s.r0;
        const gx2 = cx + Math.cos(midA) * s.r1;
        const gy2 = cy + Math.sin(midA) * s.r1;
        const segGrd = ctx.createLinearGradient(gx, gy, gx2, gy2);
        segGrd.addColorStop(0, fillColor);
        segGrd.addColorStop(1, isHovered ? lighten(fillColor, 0.06) : darken(fillColor, 0.04));
        ctx.fillStyle = segGrd;
        ctx.fill();

        ctx.strokeStyle = alpha('#FBF7F1', isDimmed ? 0.5 : 0.75);
        ctx.lineWidth = 1.6;
        ctx.stroke();

        drawSegmentText(s, isDimmed, isHovered);
      });

      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = alpha('#C4973B', 0.12);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r0 - 1, 0, Math.PI * 2);
      const cGrd = ctx.createRadialGradient(cx, cy - r0 * 0.3, 0, cx, cy, r0);
      cGrd.addColorStop(0, '#FFFBF3');
      cGrd.addColorStop(1, '#F2EAD8');
      ctx.fillStyle = cGrd;
      ctx.fill();
      ctx.strokeStyle = alpha('#C4973B', 0.35);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r0 + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = alpha('#C4973B', 0.2);
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const fs = maxR * 0.034;
      ctx.fillStyle = '#2C2318';
      ctx.font = `700 ${fs * 1.1}px 'Playfair Display', serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('INDIAN', cx, cy - fs * 0.75);
      ctx.fillText('COFFEE', cx, cy + fs * 0.75);

      ctx.beginPath();
      ctx.arc(cx, cy + fs * 2.1, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = alpha('#C4973B', 0.5);
      ctx.fill();
    }

    function drawSegmentText(s, isDimmed, isHovered) {
      const sweep = s.a1 - s.a0;
      const midAngle = s.a0 + sweep / 2;
      const midR = (s.r0 + s.r1) / 2;
      const arcLen = sweep * midR;
      const ringThickness = s.r1 - s.r0;

      let fontSize;
      if (s.level === 0) fontSize = Math.min(ringThickness * 0.22, 13);
      else if (s.level === 1) fontSize = Math.min(ringThickness * 0.17, 11);
      else fontSize = Math.min(ringThickness * 0.14, 10);

      if (fontSize < 4.5) return;
      if (arcLen < fontSize * 1.1 && s.level > 0) return;

      const bold = s.level === 0;
      ctx.save();
      ctx.font = `${bold ? '600' : '400'} ${fontSize}px 'Outfit', sans-serif`;

      let textColor;
      if (s.level === 0) {
        textColor = isDimmed ? alpha('#ffffff', 0.45) : '#ffffff';
        if (isHovered) textColor = '#ffffff';
      } else if (s.level === 1) {
        textColor = isDimmed ? alpha('#2C2318', 0.2) : darken(s.color, 0.55);
      } else {
        textColor = isDimmed ? alpha('#2C2318', 0.18) : darken(s.color, 0.62);
      }

      if (s.level === 0 && !isDimmed) {
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 1;
      }

      ctx.fillStyle = textColor;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      const text = s.label;
      const measuredW = ctx.measureText(text).width;

      if (arcLen > measuredW * 1.15 && sweep > 0.12) {
        const flip = midAngle > Math.PI * 0.5 && midAngle < Math.PI * 1.5;
        const chars = text.split('');
        const charWidths = chars.map(c => ctx.measureText(c).width);
        const totalCharW = charWidths.reduce((a, b) => a + b, 0);

        if (flip) {
          let ca = midAngle + totalCharW / (2 * midR);
          chars.forEach((ch, i) => {
            ctx.save();
            ctx.translate(cx + Math.cos(ca) * midR, cy + Math.sin(ca) * midR);
            ctx.rotate(ca + Math.PI);
            ctx.fillText(ch, 0, 0);
            ctx.restore();
            ca -= charWidths[i] / midR;
          });
        } else {
          let ca = midAngle - totalCharW / (2 * midR);
          chars.forEach((ch, i) => {
            ctx.save();
            ctx.translate(cx + Math.cos(ca) * midR, cy + Math.sin(ca) * midR);
            ctx.rotate(ca + Math.PI / 2);
            ctx.fillText(ch, 0, 0);
            ctx.restore();
            ca += charWidths[i] / midR;
          });
        }
      } else {
        ctx.translate(cx + Math.cos(midAngle) * midR, cy + Math.sin(midAngle) * midR);
        let rot = midAngle;
        if (midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5) rot += Math.PI;
        ctx.rotate(rot);
        let display = text;
        if (measuredW > ringThickness * 0.88) {
          while (ctx.measureText(display + '…').width > ringThickness * 0.85 && display.length > 2) display = display.slice(0, -1);
          display += '…';
        }
        ctx.fillText(display, 0, 0);
      }
      ctx.restore();
    }

    function hitTest(mx, my) {
      const dx = mx - cx, dy = my - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let ang = Math.atan2(dy, dx);
      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i];
        let t = ang;
        if (t < s.a0 - 0.5) t += Math.PI * 2;
        if (t > s.a1 + 0.5) t -= Math.PI * 2;
        if (dist >= s.r0 && dist <= s.r1 && t >= s.a0 && t <= s.a1) return i;
      }
      return null;
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const idx = hitTest(mx, my);

      if (idx !== hoveredSeg) { hoveredSeg = idx; render(); }

      if (idx !== null) {
        const s = segments[idx];
        tipCat.textContent = s.level > 0 ? s.cat : '';
        tipSwatch.style.background = s.color;
        tipLabel.textContent = s.label;
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
        tooltip.style.left = (e.clientX + 16) + 'px';
        tooltip.style.top = (e.clientY - 40) + 'px';
        canvas.style.cursor = 'pointer';
        detailLabel.textContent = s.label;
        detailLabel.style.color = darken(s.color, 0.15);
        detailPath.textContent = s.level > 0 ? s.path : '';
        detail.style.opacity = '1';
      } else {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(4px)';
        canvas.style.cursor = 'default';
        detail.style.opacity = '0';
      }
    }

    function onMouseLeave() {
      hoveredSeg = null;
      tooltip.style.opacity = '0';
      detail.style.opacity = '0';
      render();
    }

    function onTouchStart(e) {
      e.preventDefault();
      const t = e.touches[0], rect = canvas.getBoundingClientRect();
      const idx = hitTest(t.clientX - rect.left, t.clientY - rect.top);
      hoveredSeg = idx; render();
      if (idx !== null) {
        const s = segments[idx];
        detailLabel.textContent = s.label;
        detailLabel.style.color = darken(s.color, 0.15);
        detailPath.textContent = s.level > 0 ? s.path : '';
        detail.style.opacity = '1';
      }
    }

    function onTouchEnd() {
      setTimeout(() => { hoveredSeg = null; detail.style.opacity = '0'; render(); }, 1200);
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', resize);
    resize();

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: '#FBF7F1', fontFamily: "'Outfit', sans-serif", color: '#2C2318' }}>
      <div
        ref={legendRef}
        style={{ display: 'flex', gap: '0.3rem 1rem', flexWrap: 'wrap', justifyContent: 'center', padding: '0.5rem 1rem 0', marginBottom: '0.25rem' }}
      />

      <div
        ref={containerRef}
        style={{ position: 'relative', width: 'min(80vw, 640px)', height: 'min(80vw, 640px)', margin: '0 auto' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'default' }} />
        <div
          ref={detailRef}
          style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', opacity: 0, transition: 'opacity 0.3s', pointerEvents: 'none' }}
        >
          <div ref={detailLabelRef} style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700 }} />
          <div ref={detailPathRef} style={{ fontSize: '0.72rem', color: '#9B8E7E', marginTop: '2px' }} />
        </div>
      </div>

      <div
        ref={tooltipRef}
        style={{ position: 'fixed', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.18s, transform 0.18s', transform: 'translateY(4px)', zIndex: 200 }}
      >
        <div style={{ background: '#2C2318', color: '#FBF7F1', padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 500, letterSpacing: '0.02em', boxShadow: '0 8px 32px rgba(44,35,24,0.28)', border: '1px solid rgba(196,151,59,0.25)', whiteSpace: 'nowrap' }}>
          <span ref={tipCatRef} style={{ fontSize: '0.65rem', color: '#E4C770', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: '2px', fontWeight: 400 }} />
          <span ref={tipSwatchRef} style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px', verticalAlign: 'middle', border: '1px solid rgba(255,255,255,0.2)' }} />
          <span ref={tipLabelRef} />
        </div>
      </div>

      <p style={{ fontSize: '0.72rem', color: '#9B8E7E', margin: '1.25rem 1rem 0.5rem', textAlign: 'center', fontWeight: 300 }}>
        Based on the original Flavour Guide by{' '}
        <a href="https://bluetokaicoffee.com" target="_blank" rel="noopener" style={{ color: '#C4973B', textDecoration: 'none', fontWeight: 500 }}>
          Blue Tokai Coffee Roasters
        </a>
      </p>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import styles from './ComposeGraph.module.css';

export default function ComposeGraph({ services, networks }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);
  const sizeRef = useRef({ w: 900, h: 560 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 560 });

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      sizeRef.current = { w, h };
      setCanvasSize({ w, h });
      if (canvasRef.current) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Static layout — recompute when services or size changes
  useEffect(() => {
    if (!services || services.length === 0) return;
    const { w: W, h: H } = sizeRef.current;

    const getDepth = (name, visited = new Set()) => {
      if (visited.has(name)) return 0;
      visited.add(name);
      const svc = services.find(s => s.name === name);
      if (!svc || !svc.depends_on || svc.depends_on.length === 0) return 0;
      return 1 + Math.max(...svc.depends_on.map(d => getDepth(d, visited)));
    };

    const depths = {};
    services.forEach(s => { depths[s.name] = getDepth(s.name); });
    const maxDepth = Math.max(...Object.values(depths));

    const layers = {};
    services.forEach(s => {
      const d = depths[s.name];
      if (!layers[d]) layers[d] = [];
      layers[d].push(s);
    });

    const dpr = window.devicePixelRatio || 1;
    const nodeRadius = 44 * dpr;
    const nodes = [];
    const padTop = 90 * dpr;
    const padBot = 90 * dpr;
    const usableH = H - padTop - padBot;

    Object.entries(layers).forEach(([depth, svcs]) => {
      const d = parseInt(depth);
      const y = padTop + (maxDepth > 0 ? (d / maxDepth) * usableH : usableH / 2);
      const padSide = 120 * dpr;
      const usableW = W - padSide * 2;
      svcs.forEach((svc, i) => {
        const x = padSide + (usableW / (svcs.length + 1)) * (i + 1);
        nodes.push({ ...svc, x, y, radius: nodeRadius, depth: d });
      });
    });

    nodesRef.current = nodes;
  }, [services, canvasSize]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !services || services.length === 0) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;
    const dpr = window.devicePixelRatio || 1;

    const edges = [];
    services.forEach(svc => {
      if (svc.depends_on) {
        svc.depends_on.forEach(dep => { edges.push({ from: svc.name, to: dep }); });
      }
    });

    const netColors = {};
    const palette = [
      { fill: "rgba(0,100,255,0.04)", stroke: "rgba(0,100,255,0.18)", text: "rgba(0,100,255,0.4)" },
      { fill: "rgba(0,255,65,0.04)", stroke: "rgba(0,255,65,0.18)", text: "rgba(0,255,65,0.4)" },
      { fill: "rgba(255,170,0,0.04)", stroke: "rgba(255,170,0,0.18)", text: "rgba(255,170,0,0.4)" },
      { fill: "rgba(160,80,255,0.04)", stroke: "rgba(160,80,255,0.18)", text: "rgba(160,80,255,0.4)" },
    ];
    const fallbackColor = { fill: "rgba(0,255,65,0.03)", stroke: "rgba(0,255,65,0.12)", text: "rgba(0,255,65,0.3)" };

    if (networks) {
      networks.forEach((net, i) => {
        netColors[net] = palette[i % palette.length];
      });
    }

    const draw = () => {
      frame++;
      const nodes = nodesRef.current;
      const W = sizeRef.current.w;
      const H = sizeRef.current.h;

      ctx.fillStyle = "#080c08";
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      const gridStep = 50 * dpr;
      ctx.strokeStyle = "rgba(0,77,20,0.12)";
      ctx.lineWidth = 0.5 * dpr;
      for (let x = 0; x < W; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += gridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Network zones
      if (networks) {
        networks.forEach(net => {
          const netNodes = nodes.filter(n => n.networks && n.networks.includes(net));
          if (netNodes.length < 1) return;
          const pad = 65 * dpr;
          const minX = Math.min(...netNodes.map(n => n.x)) - pad;
          const maxX = Math.max(...netNodes.map(n => n.x)) + pad;
          const minY = Math.min(...netNodes.map(n => n.y)) - pad;
          const maxY = Math.max(...netNodes.map(n => n.y)) + pad;
          const c = netColors[net] || fallbackColor;

          ctx.fillStyle = c.fill;
          ctx.strokeStyle = c.stroke;
          ctx.lineWidth = 1 * dpr;
          ctx.setLineDash([5 * dpr, 5 * dpr]);
          const r = 14 * dpr;
          ctx.beginPath();
          ctx.moveTo(minX + r, minY);
          ctx.lineTo(maxX - r, minY); ctx.arcTo(maxX, minY, maxX, minY + r, r);
          ctx.lineTo(maxX, maxY - r); ctx.arcTo(maxX, maxY, maxX - r, maxY, r);
          ctx.lineTo(minX + r, maxY); ctx.arcTo(minX, maxY, minX, maxY - r, r);
          ctx.lineTo(minX, minY + r); ctx.arcTo(minX, minY, minX + r, minY, r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = c.text;
          ctx.font = `${10 * dpr}px 'Share Tech Mono', monospace`;
          ctx.fillText(`net: ${net}`, minX + 8 * dpr, minY + 14 * dpr);
        });
      }

      // Dependency edges with arrows
      edges.forEach(({ from, to }) => {
        const a = nodes.find(n => n.name === from);
        const b = nodes.find(n => n.name === to);
        if (!a || !b) return;

        const isHighlighted = hoveredNode === from || hoveredNode === to;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const x1 = a.x + ux * (a.radius + 4 * dpr);
        const y1 = a.y + uy * (a.radius + 4 * dpr);
        const x2 = b.x - ux * (b.radius + 4 * dpr);
        const y2 = b.y - uy * (b.radius + 4 * dpr);

        const dashOffset = (frame * 0.5) % (20 * dpr);
        ctx.strokeStyle = isHighlighted ? "rgba(0,255,65,0.75)" : "rgba(0,255,65,0.2)";
        ctx.lineWidth = (isHighlighted ? 2.5 : 1.5) * dpr;
        ctx.setLineDash([10 * dpr, 7 * dpr]);
        ctx.lineDashOffset = -dashOffset;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Arrow
        const arrowSize = (isHighlighted ? 12 : 9) * dpr;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.fillStyle = isHighlighted ? "rgba(0,255,65,0.85)" : "rgba(0,255,65,0.3)";
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize * Math.cos(angle - 0.35), y2 - arrowSize * Math.sin(angle - 0.35));
        ctx.lineTo(x2 - arrowSize * Math.cos(angle + 0.35), y2 - arrowSize * Math.sin(angle + 0.35));
        ctx.closePath();
        ctx.fill();

        if (isHighlighted) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          ctx.fillStyle = "rgba(0,255,65,0.45)";
          ctx.font = `${9 * dpr}px 'Share Tech Mono', monospace`;
          ctx.textAlign = "center";
          ctx.fillText("depends_on", mx, my - 8 * dpr);
          ctx.textAlign = "left";
        }
      });

      // Nodes
      nodes.forEach(node => {
        const isHovered = hoveredNode === node.name;
        const baseColor = "#00ff41";
        const glowRgba = "rgba(0,255,65,";
        const R = node.radius;

        // Outer glow on hover
        if (isHovered) {
          const grad = ctx.createRadialGradient(node.x, node.y, R, node.x, node.y, R + 30 * dpr);
          grad.addColorStop(0, glowRgba + "0.18)");
          grad.addColorStop(1, glowRgba + "0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, R + 30 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }

        // Hexagon
        ctx.fillStyle = isHovered ? glowRgba + "0.1)" : "rgba(8,12,8,0.85)";
        ctx.strokeStyle = isHovered ? baseColor : "rgba(0,255,65,0.25)";
        ctx.lineWidth = (isHovered ? 2.5 : 1.5) * dpr;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k - Math.PI / 6;
          const hx = node.x + R * Math.cos(a);
          const hy = node.y + R * Math.sin(a);
          if (k === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Status dot (always "created" = neutral cyan/dim green)
        ctx.fillStyle = "#007a22";
        ctx.beginPath();
        ctx.arc(node.x + R * 0.7, node.y - R * 0.7, 5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Service name — auto-fit inside hex
        const maxTextW = R * 1.55;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let nameFontSize = 11 * dpr;
        const minFontSize = 7 * dpr;
        let displayName = node.name;
        ctx.font = `${isHovered ? "bold " : ""}${nameFontSize}px 'Share Tech Mono', monospace`;
        let tw = ctx.measureText(displayName).width;

        if (tw > maxTextW) {
          nameFontSize = 9 * dpr;
          ctx.font = `${isHovered ? "bold " : ""}${nameFontSize}px 'Share Tech Mono', monospace`;
          tw = ctx.measureText(displayName).width;
        }
        if (tw > maxTextW) {
          nameFontSize = minFontSize;
          ctx.font = `${isHovered ? "bold " : ""}${nameFontSize}px 'Share Tech Mono', monospace`;
          tw = ctx.measureText(displayName).width;
        }
        if (tw > maxTextW) {
          while (displayName.length > 3 && ctx.measureText(displayName + "\u2026").width > maxTextW) {
            displayName = displayName.slice(0, -1);
          }
          displayName += "\u2026";
        }

        ctx.fillStyle = isHovered ? baseColor : "#00cc38";
        ctx.font = `${isHovered ? "bold " : ""}${nameFontSize}px 'Share Tech Mono', monospace`;
        ctx.fillText(displayName, node.x, node.y - 4 * dpr);

        // Image tag — also auto-fit
        const imgFontSize = Math.min(8 * dpr, nameFontSize - 1 * dpr);
        ctx.fillStyle = "rgba(0,170,48,0.45)";
        ctx.font = `${imgFontSize}px 'Share Tech Mono', monospace`;
        let imgTag = node.image || "";
        let imgW = ctx.measureText(imgTag).width;
        if (imgW > maxTextW) {
          while (imgTag.length > 3 && ctx.measureText(imgTag + "\u2026").width > maxTextW) {
            imgTag = imgTag.slice(0, -1);
          }
          imgTag += "\u2026";
        }
        ctx.fillText(imgTag, node.x, node.y + 10 * dpr);

        // Ports below hex
        ctx.textBaseline = "alphabetic";
        if (node.ports && node.ports.length > 0) {
          ctx.fillStyle = "rgba(68,136,255,0.5)";
          ctx.font = `${8 * dpr}px 'Share Tech Mono', monospace`;
          ctx.fillText(node.ports[0], node.x, node.y + R + 14 * dpr);
        }

        ctx.textAlign = "left";
      });

      // Legend
      ctx.fillStyle = "#007a22";
      ctx.font = `${10 * dpr}px 'Share Tech Mono', monospace`;
      ctx.fillText("\u2500\u2500\u25B6 depends_on     \u2504\u2504\u2504 shared network     \u2B21 service", 16 * dpr, H - 14 * dpr);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [services, networks, hoveredNode]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  };

  const handleMouseMove = (e) => {
    const { x, y } = getCanvasCoords(e);
    const hit = nodesRef.current.find(n => {
      const dx = n.x - x, dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < n.radius;
    });
    setHoveredNode(hit ? hit.name : null);
  };

  if (!services || services.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>{"\u2B21"}</div>
        <div className={styles.emptyText}>Add services to<br />compose.yaml to see graph</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        onMouseMove={handleMouseMove}
      />
    </div>
  );
}

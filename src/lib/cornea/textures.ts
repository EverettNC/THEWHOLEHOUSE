import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

function canvasTex(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 1024) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  draw(ctx, size);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function makeSiliconTexture() {
  return canvasTex((ctx, size) => {
    ctx.fillStyle = "#0b100e";
    ctx.fillRect(0, 0, size, size);
    const n = 88;
    const cell = size / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const even = (x + y) % 2 === 0;
        ctx.fillStyle = even ? "#15221c" : "#101a16";
        ctx.fillRect(x * cell + 0.7, y * cell + 0.7, cell - 1.4, cell - 1.4);
        ctx.fillStyle = even ? "rgba(180,210,190,0.05)" : "rgba(120,150,140,0.04)";
        ctx.fillRect(x * cell + cell * 0.28, y * cell + cell * 0.28, cell * 0.44, cell * 0.44);
      }
    }
    ctx.fillStyle = "#9a9ea4";
    const pad = 18;
    const pitch = 56;
    for (let i = 3; i < 15; i++) {
      ctx.fillRect(i * pitch, 8, pad, pad);
      ctx.fillRect(i * pitch, size - 8 - pad, pad, pad);
      ctx.fillRect(8, i * pitch, pad, pad);
      ctx.fillRect(size - 8 - pad, i * pitch, pad, pad);
    }
    ctx.fillStyle = "rgba(236,236,236,0.14)";
    ctx.font = "500 28px 'IBM Plex Mono', monospace";
    ctx.fillText("Si  CMOS  ·  PHOTODIODE ARRAY", 48, size - 48);
  });
}

export function makeTableTexture() {
  return canvasTex((ctx, size) => {
    ctx.fillStyle = "#141416";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(236,236,236,0.05)";
    ctx.lineWidth = 1;
    const step = size / 16;
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(8,8,10,0.9)";
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.beginPath();
        ctx.arc((x + 0.5) * step, (y + 0.5) * step, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 512);
}

export function makeFallbackWorld() {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 900;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const g = ctx.createLinearGradient(0, 0, 0, 900);
  g.addColorStop(0, "#8aa0b0");
  g.addColorStop(0.45, "#c5c1b2");
  g.addColorStop(1, "#6d6a62");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1600, 900);
  ctx.fillStyle = "#d8dde0";
  ctx.fillRect(180, 80, 1240, 740);
  ctx.fillStyle = "#9eb0bc";
  ctx.fillRect(210, 110, 1180, 500);
  ctx.fillStyle = "#4d5a48";
  for (let i = 0; i < 9; i++) {
    const x = 260 + i * 130;
    ctx.beginPath();
    ctx.moveTo(x, 610);
    ctx.lineTo(x + 40, 280);
    ctx.lineTo(x + 90, 610);
    ctx.fill();
  }
  ctx.fillStyle = "#3d3a36";
  ctx.fillRect(210, 610, 1180, 180);
  return c;
}

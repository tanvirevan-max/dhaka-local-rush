// Procedural canvas textures: Bangla sign atlas + building facade tiles.
// Everything is drawn at runtime so the game ships with no image assets.
import * as THREE from 'three';
import { SIGN_DEFS } from '../config/signs.js';

const FONT = '"Noto Sans Bengali","Hind Siliguri","Nirmala UI","Kohinoor Bangla","Siyam Rupali",Vrinda,"Noto Sans",Arial,sans-serif';

const CELL_W = 256, CELL_H = 64, COLS = 4;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxW, startSize, weight = 800) {
  let size = startSize;
  while (size > 12) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  }
  return size;
}

function drawCell(ctx, def, col, row) {
  const x = col * CELL_W, y = row * CELL_H;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, CELL_W, CELL_H); ctx.clip();
  // background
  ctx.fillStyle = def.bg;
  ctx.fillRect(x, y, CELL_W, CELL_H);
  if (def.kind === 'shop') {
    // subtle shop-board look: bright top band + dark bottom edge
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, CELL_W, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + CELL_H - 5, CELL_W, 5);
  } else if (def.kind === 'ad') {
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 8; i++) ctx.fillRect(x + i * 40, y, 20, CELL_H);
  } else if (def.kind === 'gate') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, CELL_W, 6);
    ctx.fillRect(x, y + CELL_H - 6, CELL_W, 6);
  }
  if (def.border) {
    ctx.strokeStyle = def.border; ctx.lineWidth = 5; roundRect(ctx, x + 3, y + 3, CELL_W - 6, CELL_H - 6, 10); ctx.stroke();
  } else if (def.kind === 'road') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; roundRect(ctx, x + 3, y + 3, CELL_W - 6, CELL_H - 6, 6); ctx.stroke();
  }
  // text
  const arrowW = def.arrow ? 40 : 0;
  const maxW = CELL_W - 22 - arrowW;
  const size = fitText(ctx, def.t, maxW, def.kind === 'gate' ? 34 : 38);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const tx = x + (def.arrow === 'left' ? CELL_W / 2 + arrowW / 2 : def.arrow === 'right' ? CELL_W / 2 - arrowW / 2 : CELL_W / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillText(def.t, tx + 1.5, y + CELL_H / 2 + 2);
  ctx.fillStyle = def.fg;
  ctx.fillText(def.t, tx, y + CELL_H / 2 + 1);
  if (def.arrow) {
    ctx.fillStyle = def.fg;
    const ax = def.arrow === 'right' ? x + CELL_W - 26 : x + 26;
    const dir = def.arrow === 'right' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(ax + dir * 14, y + CELL_H / 2);
    ctx.lineTo(ax - dir * 4, y + CELL_H / 2 - 16);
    ctx.lineTo(ax - dir * 4, y + CELL_H / 2 - 6);
    ctx.lineTo(ax - dir * 16, y + CELL_H / 2 - 6);
    ctx.lineTo(ax - dir * 16, y + CELL_H / 2 + 6);
    ctx.lineTo(ax - dir * 4, y + CELL_H / 2 + 6);
    ctx.lineTo(ax - dir * 4, y + CELL_H / 2 + 16);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** One texture holding every sign. cells[i] = [u0,v0,u1,v1] ready for GeoBuilder.signZ/signX. */
export function createSignAtlas() {
  const rows = Math.ceil(SIGN_DEFS.length / COLS);
  const W = COLS * CELL_W;
  const H = 1024; // power-of-two height; rows*64 <= 1024
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const cells = SIGN_DEFS.map((_, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const pad = 0.002;
    return [
      col * CELL_W / W + pad, 1 - (row + 1) * CELL_H / H + pad,
      (col + 1) * CELL_W / W - pad, 1 - row * CELL_H / H - pad,
    ];
  });

  const redraw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#888'; ctx.fillRect(0, 0, W, H);
    SIGN_DEFS.forEach((def, i) => drawCell(ctx, def, i % COLS, Math.floor(i / COLS)));
    texture.needsUpdate = true;
  };
  redraw();
  return { texture, cells, redraw, rows };
}

// ---------------------------------------------------------------------------------------------------
// Facade tiles. One tile = 3 m wide x 3.2 m tall (see GeoBuilder uvW/uvH defaults).
function noise(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Residential/commercial concrete block with a barred window and a floor slab line. */
export function createFacadeTexture(kind = 'concrete') {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  if (kind === 'glass') {
    // glass-curtain tower: pale spandrel band + blue glass with mullions
    ctx.fillStyle = '#dfe4e6'; ctx.fillRect(0, 0, S, S);
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#6f9fb3'); g.addColorStop(1, '#3c6577');
    ctx.fillStyle = g; ctx.fillRect(4, 10, S - 8, S - 40);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(46, 10); ctx.lineTo(16, S - 30); ctx.lineTo(4, S - 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c5ccd0'; ctx.fillRect(S / 2 - 1.5, 10, 3, S - 40);
    ctx.fillStyle = '#b4bcc0'; ctx.fillRect(0, S - 22, S, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, S - 22, S, 2);
  } else {
    ctx.fillStyle = '#f3f1ec'; ctx.fillRect(0, 0, S, S);
    // rain stains
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(60,50,40,${0.04 + Math.random() * 0.07})`;
      ctx.fillRect(Math.random() * S, 0, 2 + Math.random() * 6, S);
    }
    // window with frame
    ctx.fillStyle = '#6b6e72'; ctx.fillRect(22, 22, 84, 66);
    ctx.fillStyle = '#26323b'; ctx.fillRect(26, 26, 76, 58);
    const g = ctx.createLinearGradient(0, 26, 0, 84);
    g.addColorStop(0, '#53707f'); g.addColorStop(1, '#1f2c35');
    ctx.fillStyle = g; ctx.fillRect(26, 26, 76, 58);
    // grille bars
    ctx.fillStyle = '#15191c';
    for (let x = 34; x < 102; x += 12) ctx.fillRect(x, 26, 2.5, 58);
    ctx.fillRect(26, 52, 76, 2.5);
    // sill + slab line
    ctx.fillStyle = '#bdb7ab'; ctx.fillRect(18, 88, 92, 6);
    ctx.fillStyle = '#a79f91'; ctx.fillRect(0, S - 10, S, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, S - 10, S, 2);
  }
  noise(ctx, S, S, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function waitForBengaliFont(timeoutMs = 2500) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const load = Promise.all([
    document.fonts.load('800 32px "Noto Sans Bengali"', 'আবগ বাংলা'),
    document.fonts.load('700 20px "Noto Sans Bengali"', 'আবগ বাংলা'),
  ]).catch(() => {});
  return Promise.race([load, new Promise((r) => setTimeout(r, timeoutMs))]);
}

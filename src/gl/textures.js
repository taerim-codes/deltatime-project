import * as THREE from 'three';
import { spineAuthor } from '../data.js';

// 모바일 GPU 메모리 보호: 텍스처 해상도·이방성 필터를 낮춘다
const MOBILE = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) <= 820;
const FACE_W = MOBILE ? 704 : 1280;
const ANISO = MOBILE ? 4 : 16;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function grain(x, w, h, a = 0.045) {
  const n = Math.floor((w * h) / 170);
  for (let i = 0; i < n; i++) {
    x.fillStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${(Math.random() * a).toFixed(3)})`
      : `rgba(0,0,0,${(Math.random() * a).toFixed(3)})`;
    x.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3);
  }
}

function weave(x, w, h) {
  for (let y = 0; y < h; y += 2) {
    x.fillStyle = `rgba(${y % 4 ? '255,255,255' : '0,0,0'},${(0.012 + Math.random() * 0.03).toFixed(3)})`;
    x.fillRect(0, y, w, 1);
  }
  for (let vx = 0; vx < w; vx += 3) {
    x.fillStyle = `rgba(0,0,0,${(Math.random() * 0.02).toFixed(3)})`;
    x.fillRect(vx, 0, 1, h);
  }
}

function toTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

export function spineTex(b, wPx, hPx) {
  const W = FACE_W, H = Math.max(64, Math.round(W * hPx / wPx));
  const [c, x] = canvas(W, H);
  const S = W / wPx;

  x.fillStyle = b.spine;
  x.fillRect(0, 0, W, H);
  weave(x, W, H);

  const light = x.createLinearGradient(0, 0, 0, H);
  light.addColorStop(0, 'rgba(255,255,255,.15)');
  light.addColorStop(0.36, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,.17)');
  x.fillStyle = light;
  x.fillRect(0, 0, W, H);

  const edgeAO = x.createLinearGradient(0, 0, W, 0);
  edgeAO.addColorStop(0, 'rgba(0,0,0,.14)');
  edgeAO.addColorStop(0.02, 'rgba(0,0,0,0)');
  edgeAO.addColorStop(0.98, 'rgba(0,0,0,0)');
  edgeAO.addColorStop(1, 'rgba(0,0,0,.14)');
  x.fillStyle = edgeAO;
  x.fillRect(0, 0, W, H);

  x.textBaseline = 'middle';
  x.fillStyle = b.fg;

  x.globalAlpha = 0.72;
  x.textAlign = 'left';
  x.font = `400 ${Math.round(9.6 * S)}px "IBM Plex Mono"`;
  x.letterSpacing = `${(1.6 * S).toFixed(1)}px`;
  x.fillText(spineAuthor(b), 30 * S, H / 2);

  x.globalAlpha = 1;
  x.textAlign = 'center';
  let ts = 19.5 * S;
  x.font = `400 ${Math.round(ts)}px "Gowun Batang"`;
  x.letterSpacing = `${(2.2 * S).toFixed(1)}px`;
  const maxW = W * 0.56;
  const tw = x.measureText(b.t).width;
  if (tw > maxW) {
    ts *= maxW / tw;
    x.font = `400 ${Math.round(ts)}px "Gowun Batang"`;
  }
  x.fillText(b.t, W / 2, H / 2);

  x.globalAlpha = 0.5;
  x.textAlign = 'right';
  x.font = `400 ${Math.round(10.5 * S)}px "IBM Plex Mono"`;
  x.letterSpacing = `${(1 * S).toFixed(1)}px`;
  x.fillText('ΔT', W - 30 * S, H / 2);
  x.globalAlpha = 1;

  x.strokeStyle = 'rgba(0,0,0,.15)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, W - 2, H - 2);
  grain(x, W, H, 0.05);
  return toTex(c);
}

// 꽂힌 책등: 세로쓰기 — 한글이 위에서 아래로, 저자 아래, ΔT 맨 밑.
// 면의 u축은 책 길이 방향이므로 세로 레이아웃을 따로 그려 90° 돌려 얹는다.
export function spineVTex(b, wPx, hPx) {
  const W = FACE_W, H = Math.max(64, Math.round(W * hPx / wPx));
  const [c, x] = canvas(W, H);

  x.fillStyle = b.spine;
  x.fillRect(0, 0, W, H);
  weave(x, W, H);

  // 세로 레이아웃 (폭 = 책 두께, 높이 = 책 길이)
  const P = document.createElement('canvas');
  P.width = H; P.height = W;
  const p = P.getContext('2d');
  p.fillStyle = b.fg;
  p.textAlign = 'center';
  p.textBaseline = 'middle';

  const chars = [...b.t];
  let fs = Math.min(H * 0.5, 46);
  const gap = 1.16;
  const authorChars = [...spineAuthor(b)];
  const need = chars.length * fs * gap + 70 + authorChars.length * fs * 0.62 * gap + 160;
  if (need > P.height * 0.92) fs *= (P.height * 0.92) / need;

  let y = P.height * 0.045;
  p.font = `400 ${Math.round(fs)}px "Gowun Batang"`;
  for (const ch of chars) {
    if (ch === ' ') { y += fs * 0.5; continue; }
    y += fs * gap / 2;
    p.fillText(ch, P.width / 2, y);
    y += fs * gap / 2;
  }
  y += 56;
  p.globalAlpha = 0.66;
  p.font = `400 ${Math.round(fs * 0.56)}px "Noto Sans KR"`;
  for (const ch of authorChars) {
    if (ch === ' ') { y += fs * 0.3; continue; }
    y += fs * 0.62;
    p.fillText(ch, P.width / 2, y);
  }
  p.globalAlpha = 0.5;
  p.font = `400 ${Math.round(Math.min(H * 0.3, 26))}px "IBM Plex Mono"`;
  p.fillText('ΔT', P.width / 2, P.height - 52);

  // 세로 레이아웃을 면 좌표로 90° 회전 — 면→화면 매핑을 거치면 정립으로 보인다
  x.save();
  x.setTransform(0, -1, 1, 0, 0, H);
  x.drawImage(P, 0, 0);
  x.restore();

  const light = x.createLinearGradient(0, 0, 0, H);
  light.addColorStop(0, 'rgba(255,255,255,.13)');
  light.addColorStop(0.4, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,.15)');
  x.fillStyle = light;
  x.fillRect(0, 0, W, H);

  x.strokeStyle = 'rgba(0,0,0,.15)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, W - 2, H - 2);
  grain(x, W, H, 0.05);
  return toTex(c);
}

// 소스 표지(~1200px)보다 크게 구워 다운샘플 모아레를 막고, 축소는 GPU 밉맵에 맡긴다.
export function coverFaceTex(img, b, quarter) {
  const W = FACE_W, H = Math.round(W * 284 / 436);
  const [c, x] = canvas(W, H);

  x.fillStyle = b.spine;
  x.fillRect(0, 0, W, H);

  if (img) {
    x.save();
    x.imageSmoothingQuality = 'high';
    x.translate(W / 2, H / 2);
    x.rotate(quarter * Math.PI / 2);
    if (quarter % 2) x.drawImage(img, -H / 2, -W / 2, H, W);
    else x.drawImage(img, -W / 2, -H / 2, W, H);
    x.restore();
  }

  const sheen = x.createLinearGradient(0, 0, W, H * 0.6);
  sheen.addColorStop(0, 'rgba(255,255,255,.08)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
  x.fillStyle = sheen;
  x.fillRect(0, 0, W, H);

  x.strokeStyle = 'rgba(0,0,0,.16)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, W - 2, H - 2);
  grain(x, W, H, 0.03);
  return toTex(c);
}

export function pagesTex(repX, repY) {
  const [c, x] = canvas(64, 64);
  x.fillStyle = '#FBFAF5';
  x.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 3) {
    x.fillStyle = y % 6 ? '#E8E5DA' : '#DFDCD0';
    x.fillRect(0, y, 64, 1);
  }
  grain(x, 64, 64, 0.06);
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  return t;
}

// 실제 뒷표지 — 표지면과 같은 면 좌표계, 뒤집었을 때 바로 서는 방향
export function coverBackTex(img, b) {
  const W = FACE_W, H = Math.round(W * 284 / 436);
  const [c, x] = canvas(W, H);
  x.fillStyle = b.spine;
  x.fillRect(0, 0, W, H);
  x.save();
  x.imageSmoothingQuality = 'high';
  x.translate(W / 2, H / 2);
  x.rotate(-Math.PI / 2);
  x.drawImage(img, -H / 2, -W / 2, H, W);
  x.restore();
  x.strokeStyle = 'rgba(0,0,0,.16)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, W - 2, H - 2);
  grain(x, W, H, 0.03);
  return toTex(c);
}

export function backTex() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#F6F4EE';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(0,0,0,.12)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, 254, 254);
  grain(x, 256, 256, 0.05);
  return toTex(c);
}

export function shadowTex() {
  const [c, x] = canvas(256, 256);
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 126);
  g.addColorStop(0, 'rgba(0,0,0,.42)');
  g.addColorStop(0.55, 'rgba(0,0,0,.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return toTex(c);
}

import * as THREE from 'three';
import { BOOKS, bookW, spineH, coverSrc } from '../data.js';
import { spineTex, coverFaceTex, pagesTex, backTex, shadowTex } from './textures.js';

const DEPTH_RATIO = 284 / 436;
const FOV = 15;
const STACK_TILT = THREE.MathUtils.degToRad(9.5);
const COVER_TINT = 0.84;
const HOVER_LIFT = 12;
const FLIGHT = { open: 950, close: 850, swap: 420, openArc: 160, closeArc: 140 };
const DRAG = { yaw: 0.0072, pitch: 0.005, pitchMax: 0.55, spring: 9, damping: 3.2 };

const easeInOut = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

function standQuaternion() {
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-1, 0, 0),
  );
  const q = new THREE.Quaternion().setFromRotationMatrix(basis);
  const tilt = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(4), THREE.MathUtils.degToRad(-26), THREE.MathUtils.degToRad(-5)),
  );
  return tilt.multiply(q);
}

export async function initGL() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }

  await Promise.allSettled([
    document.fonts.load('400 40px "Gowun Batang"'),
    document.fonts.load('400 24px "IBM Plex Mono"'),
    document.fonts.ready,
  ]);

  const imgs = await Promise.all(BOOKS.map(b => new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = '/' + coverSrc(b);
  })));

  const cv = renderer.domElement;
  cv.id = 'glcanvas';
  document.body.appendChild(cv);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 50, 40000);
  // 램버트는 조도/π — 정면 합이 1.0 근처가 되는 값
  scene.add(new THREE.AmbientLight(0xffffff, 2.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-350, 900, 1000);
  scene.add(key);

  const sharedShadowTex = shadowTex();
  const sharedBackTex = backTex();

  const books = BOOKS.map((b, i) => {
    const w = bookW(b), th = spineH(b), d = Math.round(w * DEPTH_RATIO);
    const material = map => new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0 });
    const mats = [
      material(pagesTex(d / 90, th / 30)),
      material(pagesTex(d / 90, th / 30)),
      material(coverFaceTex(imgs[i], b, 3)), // 표지 머리가 왼쪽으로 눕는다 — 세우면 바로 선다
      material(sharedBackTex),
      material(spineTex(b, w, th)),
      material(pagesTex(w / 90, th / 30)),
    ];
    mats[2].color.setScalar(COVER_TINT);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), mats);
    mesh.rotation.x = STACK_TILT;

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: sharedShadowTex, transparent: true, opacity: 0, depthWrite: false }),
    );

    const group = new THREE.Group();
    group.add(mesh, shadow);
    group.visible = false;
    scene.add(group);

    return {
      b, i, w, th, d, group, mesh, mats, shadow,
      top: 0, x: 0,
      intro: 0, introT: 0, fade: 1, fadeT: 1, lift: 0, liftT: 0,
      detached: false,
    };
  });

  function shadowToStack(st) {
    st.shadow.position.set(0, -st.th / 2 - 40, -st.d / 2 - 40);
    st.shadow.scale.set(st.w * 1.12, Math.max(120, st.th * 2.6), 1);
  }
  function shadowToDetail(st) {
    st.shadow.position.set(0, -st.w / 2 - 70, -st.th / 2 - 40);
    st.shadow.scale.set(st.d * 1.1, 130, 1);
  }
  books.forEach(shadowToStack);

  let vw = 0, vh = 0;

  function cacheTops() {
    document.querySelectorAll('.pbook').forEach(btn => {
      const st = books[+btn.dataset.i];
      const r = btn.getBoundingClientRect();
      st.top = r.top + scrollY;
      st.x = r.left + r.width / 2 - vw / 2;
    });
  }

  function resize() {
    vw = innerWidth;
    vh = innerHeight;
    renderer.setSize(vw, vh);
    camera.aspect = vw / vh;
    camera.position.set(0, 0, (vh / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    camera.updateProjectionMatrix();
    cacheTops();
  }
  resize();
  addEventListener('resize', resize);

  document.querySelectorAll('.pbook').forEach(btn => {
    const st = books[+btn.dataset.i];
    const on = () => { if (!st.detached) st.liftT = HOVER_LIFT; };
    const off = () => { st.liftT = 0; };
    btn.addEventListener('mouseenter', on);
    btn.addEventListener('mouseleave', off);
    btn.addEventListener('focus', on);
    btn.addEventListener('blur', off);
  });

  const qStand = standQuaternion();
  const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(STACK_TILT, 0, 0));

  let mode = 'stack';
  let active = null;
  let flying = false;
  let bobT = 0;
  const drag = { x: 0, y: 0, vx: 0, vy: 0, on: false, px: 0, py: 0 };

  const tweens = new Set();
  function tween(o) {
    o.t0 = performance.now();
    tweens.add(o);
  }

  function stackPos(st) {
    const cy = st.top - scrollY + st.th / 2;
    return new THREE.Vector3(st.x, vh / 2 - cy, 0);
  }

  function detailAnchor() {
    const r = document.querySelector('.detail .stage').getBoundingClientRect();
    return { x: r.left + r.width / 2 - vw / 2, y: vh / 2 - (r.top + r.height / 2), rect: r };
  }

  function detailScale(st, anchor) {
    return Math.min(460, anchor.rect.height * 0.92, vh * 0.62) / st.w;
  }

  function resetDrag() {
    drag.x = drag.y = drag.vx = drag.vy = 0;
  }

  function open(i, done) {
    const st = books[i];
    mode = 'detail';
    active = st;
    flying = true;
    st.detached = true;
    st.intro = st.introT = 1;
    st.group.position.copy(stackPos(st));
    books.forEach(o => { if (o !== st) o.fadeT = 0; });

    const a = detailAnchor();
    const s = detailScale(st, a);
    const q0 = st.mesh.quaternion.clone();
    const p0 = st.group.position.clone();
    const s0 = st.group.scale.x;
    shadowToDetail(st);

    tween({
      dur: FLIGHT.open,
      ease: easeInOut,
      update: e => {
        st.group.position.set(lerp(p0.x, a.x, e), lerp(p0.y, a.y, e), Math.sin(e * Math.PI) * FLIGHT.openArc);
        st.mesh.quaternion.slerpQuaternions(q0, qStand, e);
        st.group.scale.setScalar(lerp(s0, s, e));
        st.mats[2].color.setScalar(lerp(COVER_TINT, 1, e));
      },
      done: () => {
        flying = false;
        bobT = 0;
        resetDrag();
        done?.();
      },
    });
  }

  function close(i, done) {
    const st = books[i];
    flying = true;
    const q0 = st.mesh.quaternion.clone();
    const p0 = st.group.position.clone();
    const s0 = st.group.scale.x;

    tween({
      dur: FLIGHT.close,
      ease: easeInOut,
      update: e => {
        const pt = stackPos(st);
        st.group.position.set(lerp(p0.x, pt.x, e), lerp(p0.y, pt.y, e), Math.sin(e * Math.PI) * FLIGHT.closeArc);
        st.mesh.quaternion.slerpQuaternions(q0, qFlat, e);
        st.group.scale.setScalar(lerp(s0, 1, e));
        st.mats[2].color.setScalar(lerp(1, COVER_TINT, e));
      },
      done: () => {
        st.detached = false;
        flying = false;
        shadowToStack(st);
        books.forEach(o => { o.fadeT = 1; });
        mode = 'stack';
        active = null;
        done?.();
      },
    });
  }

  function swap(i, done) {
    const prev = active;
    const st = books[i];
    if (prev === st) {
      done?.();
      return;
    }
    if (prev) {
      prev.detached = false;
      prev.fadeT = prev.fade = 0;
      prev.mats[2].color.setScalar(COVER_TINT);
      prev.mesh.quaternion.copy(qFlat);
      prev.group.scale.setScalar(1);
      shadowToStack(prev);
    }
    active = st;
    flying = true;
    st.detached = true;
    st.intro = st.introT = 1;
    st.fade = 0;
    st.fadeT = 1;
    st.mats[2].color.setScalar(1);

    const a = detailAnchor();
    st.mesh.quaternion.copy(qStand);
    st.group.scale.setScalar(detailScale(st, a));
    shadowToDetail(st);

    tween({
      dur: FLIGHT.swap,
      ease: easeInOut,
      update: e => { st.group.position.set(a.x, a.y - 26 * (1 - e), 0); },
      done: () => {
        flying = false;
        bobT = 0;
        resetDrag();
        done?.();
      },
    });
  }

  const inStage = e => {
    if (mode !== 'detail' || flying || !active) return false;
    const r = document.querySelector('.detail .stage').getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };

  addEventListener('pointerdown', e => {
    if (!inStage(e)) return;
    drag.on = true;
    drag.px = e.clientX;
    drag.py = e.clientY;
    drag.vx = drag.vy = 0;
    document.body.style.cursor = 'grabbing';
    e.preventDefault();
  });
  addEventListener('pointermove', e => {
    if (drag.on) {
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      drag.px = e.clientX;
      drag.py = e.clientY;
      drag.x += dx * DRAG.yaw;
      drag.y = THREE.MathUtils.clamp(drag.y + dy * DRAG.pitch, -DRAG.pitchMax, DRAG.pitchMax);
      drag.vx = dx * DRAG.yaw * 60;
      drag.vy = dy * DRAG.pitch * 60;
    } else {
      document.body.style.cursor = inStage(e) ? 'grab' : '';
    }
  });
  addEventListener('pointerup', () => {
    if (!drag.on) return;
    drag.on = false;
    document.body.style.cursor = '';
  });

  let last = performance.now();
  const qDrag = new THREE.Quaternion();
  const eDrag = new THREE.Euler();

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;

    for (const o of tweens) {
      const k = Math.min(1, (t - o.t0) / o.dur);
      o.update(o.ease(k));
      if (k >= 1) {
        tweens.delete(o);
        o.done?.();
      }
    }

    const sy = scrollY;
    for (const st of books) {
      const cy = st.top - sy + st.th / 2;
      if (cy < vh * 0.92) st.introT = 1;

      st.intro += (st.introT - st.intro) * Math.min(1, dt * 4.2);
      st.fade += (st.fadeT - st.fade) * Math.min(1, dt * 9);
      st.lift += (st.liftT - st.lift) * Math.min(1, dt * 11);

      if (!st.detached) {
        st.group.position.set(st.x, vh / 2 - cy + st.lift - (1 - st.intro) * 44, 0);
      }

      const op = st.intro * st.fade;
      for (const m of st.mats) m.opacity = op;
      st.shadow.material.opacity = 0.55 * op * (st.detached ? 0.8 : 1 - st.lift / 40);
      st.group.visible = op > 0.01 && (st.detached || (cy > -700 && cy < vh + 900));
    }

    if (mode === 'detail' && active && !flying) {
      bobT += dt;
      const a = detailAnchor();
      active.group.position.set(a.x, a.y + Math.sin(bobT * 0.85) * 7, 0);
      if (!drag.on) {
        drag.vx += -drag.x * DRAG.spring * dt;
        drag.vy += -drag.y * DRAG.spring * dt;
        drag.vx *= Math.exp(-dt * DRAG.damping);
        drag.vy *= Math.exp(-dt * DRAG.damping);
        drag.x += drag.vx * dt;
        drag.y += drag.vy * dt;
      }
      qDrag.setFromEuler(eDrag.set(drag.y, drag.x, Math.sin(bobT * 0.6) * 0.008));
      active.mesh.quaternion.copy(qDrag).multiply(qStand);
    }

    renderer.render(scene, camera);
  }

  function tick(t) {
    try {
      frame(t);
    } catch (e) {
      console.error('[glapp] frame loop died:', e);
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  if (import.meta.env.DEV) window.__gl = { renderer, scene, camera, books, frame };

  return { open, close, swap };
}

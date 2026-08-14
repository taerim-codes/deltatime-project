import * as THREE from 'three';
import { BOOKS, CATS, MODE_BY_CAT, STAND_SCALE, bookW, spineH, coverSrc } from '../data.js';
import { siteTime } from '../timedial.js';
import { spineTex, spineVTex, coverFaceTex, coverBackTex, pagesTex, backTex, shadowTex, setMaxAnisotropy } from './textures.js';

const DEPTH_RATIO = 284 / 436;
const FOV = 15;
const STACK_TILT = THREE.MathUtils.degToRad(9.5);
const COVER_TINT = 0.84;
const HOVER_LIFT = 12;
const FLIGHT = { open: 950, close: 850, swap: 420, openArc: 160, closeArc: 140 };
const DRAG = { yaw: 0.0072, pitch: 0.005, pitchMax: 0.55, spring: 9, damping: 3.2 };

const BASE_AMBIENT = 2.35;
const BASE_KEY = 1.1;
const BASE_BG = '#14110E';
const MOOD_BLEND_PX = 280;

// 서가별 공기: 색은 그 서가 책등에서 나오고, 여기서는 조명의 성격만 정한다
const SHELF_MOODS = {
  flow:  { amb: 1.0,  key: 1.0,  bgMix: 0.10 },
  poem:  { amb: 1.05, key: 0.8,  bgMix: 0.10 }, // 새벽 — 평평하고 차가운 빛
  fict:  { amb: 0.95, key: 1.05, bgMix: 0.10 },
  sound: { amb: 0.7,  key: 1.6,  bgMix: 0.14 }, // 재즈바 — 어둡고 극적인 키라이트
  cafe:  { amb: 1.1,  key: 0.9,  bgMix: 0.2 },  // 오후의 카페 — 밝고 부드러운 웜톤
  essay: { amb: 1.0,  key: 1.0,  bgMix: 0.08 },
};

const easeInOut = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// 배경은 sRGB에서 직접 섞는다 — THREE.Color(리니어 작업공간)로 섞으면 감각보다 밝아진다
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixRgb = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const cssRgb = c => `rgb(${c.map(Math.round).join(' ')})`;

// 하루의 빛 — 앵커가 일출·일몰에 붙어 있어 계절 따라 새벽·석양이 이동한다
function dayAt(hour, rise, set) {
  const keys = [
    { h: rise - 2.5, amb: 0.76, key: 0.90, tint: [8, 12, 24],  amt: 0.34 },
    { h: rise + 0.4, amb: 0.92, key: 0.80, tint: [70, 78, 92], amt: 0.22 },
    { h: rise + 2.8, amb: 1.05, key: 1.00, tint: [0, 0, 0],    amt: 0 },
    { h: set - 2.5,  amb: 1.05, key: 1.00, tint: [0, 0, 0],    amt: 0 },
    { h: set - 0.2,  amb: 0.98, key: 1.12, tint: [66, 42, 18], amt: 0.24 },
    { h: set + 1.8,  amb: 0.88, key: 1.00, tint: [16, 16, 30], amt: 0.24 },
    { h: set + 4.0,  amb: 0.80, key: 0.95, tint: [10, 14, 26], amt: 0.30 },
  ];
  let h = hour;
  while (h < keys[0].h) h += 24;
  let a = keys[keys.length - 1], b = { ...keys[0], h: keys[0].h + 24 };
  for (let i = 0; i < keys.length - 1; i++) {
    if (h >= keys[i].h && h <= keys[i + 1].h) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const t = b.h === a.h ? 0 : Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
  return {
    amb: lerp(a.amb, b.amb, t),
    key: lerp(a.key, b.key, t),
    tint: mixRgb(a.tint, b.tint, t),
    amt: lerp(a.amt, b.amt, t),
  };
}

function shelfMoodTargets() {
  const white = new THREE.Color('#ffffff');
  const baseBg = hexToRgb(BASE_BG);
  return CATS.map(cat => {
    const spines = BOOKS.filter(b => b.cat === cat.id).map(b => b.spine);
    const avgRgb = spines.map(hexToRgb)
      .reduce((acc, c) => acc.map((v, i) => v + c[i] / spines.length), [0, 0, 0]);
    const avgLinear = new THREE.Color(`rgb(${avgRgb.map(Math.round).join(',')})`);
    const m = SHELF_MOODS[cat.id];
    return {
      bg: mixRgb(baseBg, avgRgb, m.bgMix),
      keyColor: white.clone().lerp(avgLinear, 0.18),
      ambColor: white.clone().lerp(avgLinear, 0.08),
      amb: BASE_AMBIENT * m.amb,
      key: BASE_KEY * m.key,
    };
  });
}

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

  // 서브패스 배포(GitHub Pages) 대응
  const loadImg = path => new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = import.meta.env.BASE_URL + path;
  });
  const imgs = await Promise.all(BOOKS.map(b => loadImg(coverSrc(b))));

  const cv = renderer.domElement;
  cv.id = 'glcanvas';
  document.body.appendChild(cv);
  // 3배 화면(아이폰)을 2배로 캡하면 WebGL만 흐려진다 — DOM 이미지와 나란히 두면 바로 보인다
  renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 50, 40000);
  // 램버트는 조도/π — 정면 합이 1.0 근처가 되는 값
  const ambient = new THREE.AmbientLight(0xffffff, BASE_AMBIENT);
  const key = new THREE.DirectionalLight(0xffffff, BASE_KEY);
  key.position.set(-350, 900, 1000);
  scene.add(ambient, key);

  const sky = document.createElement('div');
  sky.className = 'sky';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = '<i class="sun"></i><i class="moon"></i>';
  document.body.appendChild(sky);
  const sun = sky.querySelector('.sun');
  const moon = sky.querySelector('.moon');

  // t: 궤도 진행률(0~1) → 좌하단에서 떠서 정점 찍고 우하단으로.
  // 지평선 근처에서는 커 보인다 (달오름 착시)
  function placeBody(el, t, peak) {
    if (t <= 0 || t >= 1) {
      el.style.opacity = '0';
      return;
    }
    const arc = Math.sin(Math.PI * t);
    const x = lerp(0.1, 0.9, t) * vw;
    const y = vh * 0.78 - arc * vh * (0.78 - peak);
    const scale = 1 + (1 - arc) * 0.22;
    el.style.opacity = (arc ** 0.6 * 0.9).toFixed(3);
    el.style.transform =
      `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
  }

  function updateSky(hour) {
    const { rise, set } = siteTime;
    const dayLen = set - rise;
    const sunPeak = lerp(0.24, 0.12, (dayLen - 9.5) / 5.3); // 여름 해는 높고 겨울 해는 낮다
    placeBody(sun, (hour - rise) / dayLen, sunPeak);
    placeBody(moon, ((hour - set + 24) % 24) / (24 - dayLen), 0.14);
  }

  const moods = shelfMoodTargets();
  const mood = {
    bg: hexToRgb(BASE_BG),
    keyColor: new THREE.Color('#ffffff'),
    ambColor: new THREE.Color('#ffffff'),
    amb: BASE_AMBIENT,
    key: BASE_KEY,
  };
  let moodStops = [];

  const sharedShadowTex = shadowTex();
  const sharedBackTex = backTex();

  // 모드별 안착 자세: 눕기 / 책등 정면으로 세우기(머리 위) / 표지 정면으로 똑바로 세우기
  const qStackRest = new THREE.Quaternion().setFromEuler(new THREE.Euler(STACK_TILT, 0, 0));
  const qShelfRest = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
  const qDisplayRest = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-1, 0, 0),
  ));

  const books = BOOKS.map((b, i) => {
    const w = bookW(b), th = spineH(b), d = Math.round(w * DEPTH_RATIO);
    const mode = MODE_BY_CAT[b.cat];
    const material = map => new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0 });
    // 표지 머리가 왼쪽으로 눕는다 — 세우면 바로 선다.
    // 진열대는 표지가 정면이라 고해상, 나머지는 얇게 보이므로 낮게
    const shelfCover = coverFaceTex(imgs[i], b, 3, mode === 'display' ? 1024 : undefined);
    const shelfSpine = mode === 'shelf' ? spineVTex(b, w, th) : spineTex(b, w, th);
    const mats = [
      material(pagesTex(d / 90, th / 30)),
      material(pagesTex(d / 90, th / 30)),
      material(shelfCover),
      material(sharedBackTex), // 실제 뒷표지는 책을 열 때 고해상으로 로드
      material(shelfSpine),
      material(pagesTex(w / 90, th / 30)),
    ];
    mats[2].color.setScalar(mode === 'display' ? 1 : COVER_TINT);

    const restQuat = mode === 'shelf' ? qShelfRest : mode === 'display' ? qDisplayRest : qStackRest;
    const restScale = STAND_SCALE[mode] ?? 1;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), mats);
    mesh.quaternion.copy(restQuat);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: sharedShadowTex, transparent: true, opacity: 0, depthWrite: false }),
    );

    const group = new THREE.Group();
    group.scale.setScalar(restScale);
    group.add(mesh, shadow);
    group.visible = false;
    scene.add(group);

    return {
      b, i, w, th, d, mode, restQuat, restScale, group, mesh, mats, shadow,
      shelfCover, shelfSpine,
      cy: 0, x: 0,
      intro: 0, introT: 0, fade: 1, fadeT: 1, lift: 0, liftT: 0,
      detached: false,
    };
  });

  // GPU 업로드 후 캔버스 백업 스토어를 반환한다. iOS Safari는 GPU 예산과 별개로
  // 캔버스 메모리 한계가 있어, 캔버스를 붙들고 있으면 텍스처를 강등시켜 버린다.
  function uploadAndFreeCanvas(tx) {
    renderer.initTexture(tx);
    const img = tx.image;
    if (img instanceof HTMLCanvasElement) {
      img.width = 1;
      img.height = 1;
    }
  }

  // 첫 렌더에서 전체 텍스처가 한꺼번에 올라가며 얼어붙는 것도 방지 — 몇 장씩 나눠 올린다
  async function warmupTextures() {
    const maps = new Set();
    for (const st of books) for (const m of st.mats) if (m.map) maps.add(m.map);
    const list = [...maps];
    for (let i = 0; i < list.length; i += 4) {
      list.slice(i, i + 4).forEach(uploadAndFreeCanvas);
      // 숨김 탭은 타이머가 분 단위로 스로틀되므로 대기 없이 동기 업로드
      if (!document.hidden) await new Promise(r => setTimeout(r, 16));
    }
    renderer.compile(scene, camera);
  }
  await warmupTextures();

  // 그림자는 그룹 스케일을 같이 타므로 로컬 좌표로 배치
  function shadowToRest(st) {
    if (st.mode === 'shelf') {
      st.shadow.position.set(0, -st.w / 2 - 30, -st.th / 2 - 30);
      st.shadow.scale.set(st.th * 2.2, 110, 1);
    } else if (st.mode === 'display') {
      st.shadow.position.set(0, -st.w / 2 - 40, -st.th / 2 - 30);
      st.shadow.scale.set(st.d * 1.05, 120, 1);
    } else {
      st.shadow.position.set(0, -st.th / 2 - 40, -st.d / 2 - 40);
      st.shadow.scale.set(st.w * 1.12, Math.max(120, st.th * 2.6), 1);
    }
  }
  function shadowToDetail(st) {
    st.shadow.position.set(0, -st.w / 2 - 70, -st.th / 2 - 40);
    st.shadow.scale.set(st.d * 1.1, 130, 1);
  }
  books.forEach(shadowToRest);

  let vw = 0, vh = 0;

  function cacheTops() {
    document.querySelectorAll('.pbook').forEach(btn => {
      const st = books[+btn.dataset.i];
      const r = btn.getBoundingClientRect();
      // offsetTop: transform(리빌 트랜지션) 영향 없는 레이아웃 좌표.
      // srow 안의 버튼은 offsetParent가 다를 수 있어 문서 기준으로 누적한다
      let top = 0;
      for (let el = btn; el; el = el.offsetParent) top += el.offsetTop;
      st.cy = top + r.height / 2;
      st.x = r.left + r.width / 2 - vw / 2;
    });
    moodStops = [...document.querySelectorAll('#stack .grp')].map((g, i) => ({
      y: g.getBoundingClientRect().top + scrollY,
      target: moods[i],
    }));
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

  function restPos(st) {
    return new THREE.Vector3(st.x, vh / 2 - (st.cy - scrollY), 0);
  }

  function detailAnchor() {
    const r = document.querySelector('.detail .stage').getBoundingClientRect();
    return { x: r.left + r.width / 2 - vw / 2, y: vh / 2 - (r.top + r.height / 2), rect: r };
  }

  function detailScale(st, anchor) {
    // vw 캡: 좁은 화면에서 상세 책이 화면을 삼키지 않게 (표지 폭 ≈ 높이의 0.65)
    return Math.min(460, anchor.rect.height * 0.92, vh * 0.62, vw * 0.85) / st.w;
  }

  function resetDrag() {
    drag.x = drag.y = drag.vx = drag.vy = 0;
  }

  // 서가는 저해상으로 유지하고, 열린 한 권만 고해상으로 승격한다.
  // (32권 전부 고해상이면 iOS가 GPU 메모리 압박으로 텍스처를 강제 다운스케일한다)
  let hires = null;

  function releaseHires() {
    if (!hires) return;
    const { st, cover, back, spine } = hires;
    st.mats[2].map = st.shelfCover;
    st.mats[3].map = sharedBackTex;
    st.mats[4].map = st.shelfSpine;
    st.mats.forEach(m => { m.needsUpdate = true; });
    cover?.dispose();
    back?.dispose();
    spine?.dispose();
    hires = null;
  }

  function upgradeToHires(st) {
    if (hires?.st === st) return;
    releaseHires();
    const entry = { st, cover: null, back: null, spine: null };
    hires = entry;

    entry.cover = coverFaceTex(imgs[st.i], st.b, 3, 1600);
    st.mats[2].map = entry.cover;
    st.mats[2].needsUpdate = true;
    uploadAndFreeCanvas(entry.cover);

    entry.spine = st.mode === 'shelf'
      ? spineVTex(st.b, st.w, st.th, 1600)
      : spineTex(st.b, st.w, st.th, 1600);
    st.mats[4].map = entry.spine;
    st.mats[4].needsUpdate = true;
    uploadAndFreeCanvas(entry.spine);

    if (st.b.coverBack) {
      loadImg(st.b.coverBack).then(img => {
        if (!img || hires !== entry) return;
        entry.back = coverBackTex(img, st.b);
        st.mats[3].map = entry.back;
        st.mats[3].needsUpdate = true;
        uploadAndFreeCanvas(entry.back);
      });
    }
  }

  function open(i, done) {
    const st = books[i];
    upgradeToHires(st);
    mode = 'detail';
    active = st;
    flying = true;
    st.detached = true;
    st.intro = st.introT = 1;
    st.group.position.copy(restPos(st));
    books.forEach(o => { if (o !== st) o.fadeT = 0; });

    const a = detailAnchor();
    const s = detailScale(st, a);
    const q0 = st.mesh.quaternion.clone();
    const p0 = st.group.position.clone();
    const s0 = st.group.scale.x;
    const c0 = st.mats[2].color.r;
    shadowToDetail(st);

    tween({
      dur: FLIGHT.open,
      ease: easeInOut,
      update: e => {
        st.group.position.set(lerp(p0.x, a.x, e), lerp(p0.y, a.y, e), Math.sin(e * Math.PI) * FLIGHT.openArc);
        st.mesh.quaternion.slerpQuaternions(q0, qStand, e);
        st.group.scale.setScalar(lerp(s0, s, e));
        st.mats[2].color.setScalar(lerp(c0, 1, e));
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
    const cEnd = st.mode === 'display' ? 1 : COVER_TINT;

    tween({
      dur: FLIGHT.close,
      ease: easeInOut,
      update: e => {
        const pt = restPos(st);
        st.group.position.set(lerp(p0.x, pt.x, e), lerp(p0.y, pt.y, e), Math.sin(e * Math.PI) * FLIGHT.closeArc);
        st.mesh.quaternion.slerpQuaternions(q0, st.restQuat, e);
        st.group.scale.setScalar(lerp(s0, st.restScale, e));
        st.mats[2].color.setScalar(lerp(1, cEnd, e));
      },
      done: () => {
        st.detached = false;
        flying = false;
        shadowToRest(st);
        releaseHires();
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
      prev.mats[2].color.setScalar(prev.mode === 'display' ? 1 : COVER_TINT);
      prev.mesh.quaternion.copy(prev.restQuat);
      prev.group.scale.setScalar(prev.restScale);
      shadowToRest(prev);
    }
    active = st;
    upgradeToHires(st);
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

  const moodMix = { bg: [0, 0, 0], keyColor: new THREE.Color(), ambColor: new THREE.Color(), amb: 0, key: 0 };

  function moodTargetAt(centerY) {
    if (!moodStops.length || centerY < moodStops[0].y) return moods[0];
    let a = moods[0], b = moods[0], t = 0;
    for (let i = 0; i < moodStops.length; i++) {
      if (centerY < moodStops[i].y) break;
      a = moodStops[i].target;
      const next = moodStops[i + 1];
      b = next ? next.target : a;
      t = next ? THREE.MathUtils.smoothstep(centerY, next.y - MOOD_BLEND_PX, next.y) : 0;
    }
    moodMix.bg = mixRgb(a.bg, b.bg, t);
    moodMix.keyColor.lerpColors(a.keyColor, b.keyColor, t);
    moodMix.ambColor.lerpColors(a.ambColor, b.ambColor, t);
    moodMix.amb = lerp(a.amb, b.amb, t);
    moodMix.key = lerp(a.key, b.key, t);
    return moodMix;
  }

  function updateMood(dt) {
    const target = moodTargetAt(scrollY + vh / 2);
    const day = dayAt(siteTime.hour, siteTime.rise, siteTime.set);
    updateSky(siteTime.hour);
    const k = Math.min(1, dt * 3.5);
    mood.bg = mixRgb(mood.bg, mixRgb(target.bg, day.tint, day.amt), k);
    mood.keyColor.lerp(target.keyColor, k);
    mood.ambColor.lerp(target.ambColor, k);
    mood.amb = lerp(mood.amb, target.amb * day.amb, k);
    mood.key = lerp(mood.key, target.key * day.key, k);
    ambient.color.copy(mood.ambColor);
    ambient.intensity = mood.amb;
    key.color.copy(mood.keyColor);
    key.intensity = mood.key;
    document.documentElement.style.setProperty('--bg', cssRgb(mood.bg));
  }

  let last = performance.now();
  const qDrag = new THREE.Quaternion();
  const eDrag = new THREE.Euler();
  const qTip = new THREE.Quaternion();
  const eTip = new THREE.Euler();

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

    updateMood(dt);

    const sy = scrollY;
    for (const st of books) {
      const cy = st.cy - sy;
      if (cy < vh * 0.92) st.introT = 1;

      st.intro += (st.introT - st.intro) * Math.min(1, dt * 4.2);
      st.fade += (st.fadeT - st.fade) * Math.min(1, dt * 9);
      st.lift += (st.liftT - st.lift) * Math.min(1, dt * 11);

      if (!st.detached) {
        // 호버: 눕힌 책은 떠오르고, 꽂힌 책은 밑단을 축으로 앞으로 빼꼼 기운다
        let liftY = st.lift, liftZ = 0;
        if (st.mode === 'shelf') {
          const tip = (st.lift / HOVER_LIFT) * 0.3;
          const half = (st.w / 2) * st.restScale;
          liftY = -(1 - Math.cos(tip)) * half;
          liftZ = Math.sin(tip) * half;
          qTip.setFromEuler(eTip.set(tip, 0, 0));
          st.mesh.quaternion.copy(qTip).multiply(st.restQuat);
        }
        st.group.position.set(st.x, vh / 2 - cy + liftY - (1 - st.intro) * 44, liftZ);
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

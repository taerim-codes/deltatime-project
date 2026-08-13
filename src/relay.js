import { BOOKS, spineH } from './data.js';

const easeInOut = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

// 끝말잇기 릴레이: 두 책 사이를 지나는 동안 공유 단어가 이전 제목에서 떠올라
// 시선 높이에 머물다 다음 제목으로 내려앉는다. 실 한 줄이 행선지를 잇는다.
export function initRelay() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const flow = BOOKS.map((b, i) => ({ b, i })).filter(x => x.b.cat === 'flow');
  const links = [];
  for (let n = 0; n < flow.length - 1; n++) {
    const word = flow[n].b.t.split(/[와과] /)[1];
    if (word && flow[n + 1].b.t.startsWith(word)) {
      links.push({ src: flow[n].i, dst: flow[n + 1].i, word });
    }
  }
  if (!links.length) return;

  const layer = document.createElement('div');
  layer.className = 'relay-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const items = links.map(l => {
    const word = document.createElement('span');
    word.className = 'relay';
    word.textContent = l.word;
    const thread = document.createElement('i');
    thread.className = 'relay-thread';
    layer.append(thread, word);
    return { ...l, word, thread, y: 0, op: 0, live: false };
  });

  function cache() {
    // offsetTop: 리빌 트랜지션의 transform에 오염되지 않는 레이아웃 좌표
    for (const it of items) {
      it.srcY = document.querySelector(`.pbook[data-i="${it.src}"]`).offsetTop + spineH(BOOKS[it.src]) / 2;
      it.dstY = document.querySelector(`.pbook[data-i="${it.dst}"]`).offsetTop + spineH(BOOKS[it.dst]) / 2;
    }
  }
  cache();
  addEventListener('resize', cache);
  new ResizeObserver(cache).observe(document.body);

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const eye = scrollY + innerHeight / 2;

    for (const it of items) {
      const t = (eye - it.srcY) / (it.dstY - it.srcY);
      const inside = t > 0.02 && t < 0.98;
      const targetY = lerp(it.srcY, it.dstY, easeInOut(Math.min(1, Math.max(0, t)))) - scrollY;
      const targetOp = inside ? smooth(0.04, 0.2, t) * (1 - smooth(0.8, 0.96, t)) * 0.95 : 0;

      if (!it.live) it.y = targetY; // 화면 밖에서 들어올 때 점프 방지
      it.live = inside || it.op > 0.01;
      if (!it.live) {
        it.word.style.opacity = it.thread.style.opacity = '0';
        continue;
      }

      // 반 박자 늦게 따라오는 관성 — 스크롤이 멈추면 단어가 제자리를 찾아간다
      it.y += (targetY - it.y) * Math.min(1, dt * 7);
      it.op += (targetOp - it.op) * Math.min(1, dt * 6);

      const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      it.word.style.opacity = it.op.toFixed(3);
      it.word.style.transform =
        `translate(-50%, ${it.y.toFixed(1)}px) translateY(-50%) scale(${(0.92 + arc * 0.08).toFixed(3)})`;

      // 실: 진행 방향의 제목까지 헤어라인 — 단어의 행선지가 보인다
      const anchor = (t < 0.5 ? it.srcY : it.dstY) - scrollY;
      const top = Math.min(it.y, anchor) + 18;
      const height = Math.max(0, Math.abs(anchor - it.y) - 36);
      it.thread.style.opacity = (it.op * 0.35).toFixed(3);
      it.thread.style.transform = `translateY(${top.toFixed(1)}px)`;
      it.thread.style.height = `${height.toFixed(1)}px`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (import.meta.env.DEV) window.__relayFrame = frame;
}

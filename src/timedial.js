// 시간 다이얼: 24시간 시계와 일력(日曆). 사이트의 시각과 계절을 조작한다.
// 서울 근사 일출·일몰 — 계절이 해의 길이와 궤적을 정한다.
const SUN_TABLE = [
  [7.75, 17.58], [7.42, 18.08], [6.83, 18.58], [6.08, 19.00],
  [5.50, 19.50], [5.17, 19.92], [5.33, 19.92], [5.83, 19.42],
  [6.25, 18.67], [6.67, 17.92], [7.17, 17.33], [7.67, 17.25],
];

export const siteTime = { hour: 12, month: 8, rise: 5.83, set: 19.42, live: true };

function applyMonth() {
  const [rise, set] = SUN_TABLE[siteTime.month - 1];
  siteTime.rise = rise;
  siteTime.set = set;
}

function syncToNow() {
  const now = new Date();
  siteTime.hour = now.getHours() + now.getMinutes() / 60;
  siteTime.month = now.getMonth() + 1;
  applyMonth();
}

const fmt = h => {
  const hh = Math.floor(((h % 24) + 24) % 24);
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// 출판사의 시계는 숫자보다 말로 말한다
const SEASON_WORDS = [
  '한겨울', '늦겨울', '이른 봄', '봄', '늦봄', '초여름',
  '한여름', '늦여름', '초가을', '가을', '늦가을', '초겨울',
];

function timeWord(h, rise, set) {
  if (h < rise - 1.5 || h >= 23) return '깊은 밤';
  if (h < rise + 0.7) return '새벽';
  if (h < 11) return '아침';
  if (h < 14) return '한낮';
  if (h < set - 1.2) return '오후';
  if (h < set + 0.7) return '해질녘';
  if (h < 21.5) return '저녁';
  return '밤';
}

export function initTimeDial() {
  syncToNow();

  const root = document.getElementById('timedial');
  if (!root) return;
  root.innerHTML = `
    <div class="td-col">
      <div class="dial clock" title="드래그해서 시간을 돌려보세요 · 더블클릭하면 지금으로">
        <span class="t t0"></span><span class="t t6"></span><span class="t t12"></span><span class="t t18"></span>
        <i class="hand"></i><i class="pin"></i>
      </div>
      <b class="tread"></b>
    </div>
    <div class="td-col">
      <div class="calleaf" title="위아래로 넘겨서 계절을 바꿔보세요">
        <span class="holes"><i></i><i></i></span>
        <b class="mnum"></b><span class="mword">월</span>
      </div>
    </div>
    <p class="tword"></p>
    <p class="sunread"></p>`;

  const clock = root.querySelector('.clock');
  const leaf = root.querySelector('.calleaf');
  const clockHand = clock.querySelector('.hand');
  const tread = root.querySelector('.tread');
  const mnum = root.querySelector('.mnum');
  const tword = root.querySelector('.tword');
  const sunread = root.querySelector('.sunread');

  function render() {
    clockHand.style.transform = `translateX(-50%) rotate(${(siteTime.hour / 24 * 360 + 180).toFixed(1)}deg)`;
    tread.textContent = fmt(siteTime.hour);
    mnum.textContent = siteTime.month;
    tword.textContent = `${SEASON_WORDS[siteTime.month - 1]}의 ${timeWord(siteTime.hour, siteTime.rise, siteTime.set)}`;
    sunread.textContent = `일출 ${fmt(siteTime.rise)} · 일몰 ${fmt(siteTime.set)}`;
  }

  // 손을 뗀 지 3분이 지나면 실제 시간으로 조용히 돌아온다
  let lastTouch = 0;
  let reverting = false;
  const touch = () => {
    siteTime.live = false;
    lastTouch = Date.now();
  };

  function revertToNow() {
    reverting = true;
    const now = new Date();
    const from = siteTime.hour;
    let to = now.getHours() + now.getMinutes() / 60;
    if (to - from > 12) to -= 24;
    if (from - to > 12) to += 24;
    siteTime.month = now.getMonth() + 1;
    applyMonth();
    const t0 = performance.now();
    const dur = 1800;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      siteTime.hour = ((from + (to - from) * e) % 24 + 24) % 24;
      render();
      if (k < 1) requestAnimationFrame(step);
      else {
        reverting = false;
        siteTime.live = true;
      }
    })(t0);
  }

  clock.addEventListener('pointerdown', e => {
    e.preventDefault();
    clock.setPointerCapture(e.pointerId);
    touch();
    const setFrom = ev => {
      const r = clock.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      const deg = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
      siteTime.hour = ((deg + 180) % 360) / 360 * 24;
      lastTouch = Date.now();
      render();
    };
    setFrom(e);
    const up = () => {
      clock.removeEventListener('pointermove', setFrom);
      clock.removeEventListener('pointerup', up);
    };
    clock.addEventListener('pointermove', setFrom);
    clock.addEventListener('pointerup', up);
  });

  // 일력 넘기기: 위로 끌면 다음 달, 아래로 끌면 이전 달
  leaf.addEventListener('pointerdown', e => {
    e.preventDefault();
    leaf.setPointerCapture(e.pointerId);
    touch();
    let lastY = e.clientY, acc = 0;
    const move = ev => {
      acc += lastY - ev.clientY;
      lastY = ev.clientY;
      lastTouch = Date.now();
      while (Math.abs(acc) >= 26) {
        siteTime.month = ((siteTime.month - 1 + Math.sign(acc) + 12) % 12) + 1;
        acc -= Math.sign(acc) * 26;
        applyMonth();
        render();
      }
    };
    const up = () => {
      leaf.removeEventListener('pointermove', move);
      leaf.removeEventListener('pointerup', up);
    };
    leaf.addEventListener('pointermove', move);
    leaf.addEventListener('pointerup', up);
  });

  root.addEventListener('dblclick', () => {
    siteTime.live = true;
    syncToNow();
    render();
  });

  setInterval(() => {
    if (siteTime.live) {
      syncToNow();
      render();
    } else if (!reverting && Date.now() - lastTouch > 180000) {
      revertToNow();
    }
  }, 5000);
  render();
}

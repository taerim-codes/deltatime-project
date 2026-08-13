import { BOOKS, CATS, STAND_SCALE, spineH, bookW, coverSrc, spineAuthor } from './data.js';

const DEPTH_RATIO = 284 / 436;

function stackButton(b, i) {
  const el = document.createElement('button');
  el.className = 'pbook';
  el.dataset.i = i;
  el.style.setProperty('--bw', bookW(b) + 'px');
  el.setAttribute('aria-label', b.t + ' 자세히 보기');
  el.innerHTML = `
    <span class="pwrap">
      <span class="ptop"><img src="${coverSrc(b)}" alt="" loading="lazy"></span>
      <span class="pspine" style="--sh:${spineH(b)}px;background:${b.spine};color:${b.fg}">
        <i class="pa">${spineAuthor(b)}</i>
        <b class="pt">${b.t}</b>
        <i class="pl">ΔT</i>
      </span>
      <span class="pedge"></span>
    </span>`;
  return el;
}

// 꽂힌 책: 버튼 = 책등 단면 (두께 × 키)
function shelfButton(b, i) {
  const s = STAND_SCALE.shelf;
  const el = document.createElement('button');
  el.className = 'pbook shelf';
  el.dataset.i = i;
  el.style.width = Math.round(spineH(b) * s) + 'px';
  el.style.height = Math.round(bookW(b) * s) + 'px';
  el.setAttribute('aria-label', b.t + ' 자세히 보기');
  el.innerHTML = `<span class="vsp" style="background:${b.spine};color:${b.fg}"><b>${b.t}</b></span>`;
  return el;
}

// 진열된 책: 버튼 = 정면 표지
function displayButton(b, i) {
  const s = STAND_SCALE.display;
  const el = document.createElement('button');
  el.className = 'pbook display';
  el.dataset.i = i;
  el.style.width = Math.round(bookW(b) * DEPTH_RATIO * s) + 'px';
  el.style.height = Math.round(bookW(b) * s) + 'px';
  el.setAttribute('aria-label', b.t + ' 자세히 보기');
  el.innerHTML = `<span class="vcv"><img src="${coverSrc(b)}" alt="" loading="lazy"></span>`;
  return el;
}

export function renderStack(onOpen) {
  const stack = document.getElementById('stack');

  CATS.forEach(cat => {
    const grp = document.createElement('p');
    grp.className = 'grp';
    grp.innerHTML = `${cat.no}<em>${cat.name}</em>`;
    stack.appendChild(grp);

    const row = cat.mode === 'stack' ? stack : document.createElement('div');
    if (row !== stack) {
      row.className = `srow ${cat.mode}`;
      stack.appendChild(row);
    }

    BOOKS.forEach((b, i) => {
      if (b.cat !== cat.id) return;
      const btn = cat.mode === 'shelf' ? shelfButton(b, i)
        : cat.mode === 'display' ? displayButton(b, i)
        : stackButton(b, i);
      row.appendChild(btn);
    });
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.18 });
  stack.querySelectorAll('.pbook').forEach(b => io.observe(b));

  stack.addEventListener('click', e => {
    const btn = e.target.closest('.pbook');
    if (btn) onOpen(+btn.dataset.i);
  });
}

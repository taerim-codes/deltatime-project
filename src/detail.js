import { BOOKS, STORES, pageBg } from './data.js';

let current = 0;
const el = id => document.getElementById(id);

export function openBook(i) {
  current = (i + BOOKS.length) % BOOKS.length;
  const b = BOOKS[current];
  const d = el('detail');
  d.style.setProperty('--dbg', pageBg(b.spine));
  d.style.setProperty('--dfg', b.fg);
  el('dTitle').textContent = b.t;
  el('dAuthor').textContent = b.a;
  el('dBlurb').innerHTML = (b.long ? b.long : [b.desc]).map(p => `<p>${p}</p>`).join('');
  el('dMeta').textContent =
    `${b.s} · 시간의흐름 · ${b.d} · ${b.fm} · ${b.extra ? b.extra + ' · ' : ''}정가 ${b.p}`;
  el('dBuy').innerHTML = STORES.map(s =>
    `<a href="#">${s} <span class="pr">${b.p}</span> <span class="ar">↗</span></a>`).join('');
  el('dImg').src = b.cover;
  el('dImg').alt = b.t + ' 표지';
  el('dSp').style.background = b.spine;
  el('dSp').style.color = b.fg;
  el('dSpT').textContent = b.t;
  if (b.bio) { el('dAsec').hidden = false; el('dBio').textContent = b.bio; }
  else { el('dAsec').hidden = true; }
  const fw = document.querySelector('.fwrap');
  fw.style.animation = 'none'; void fw.offsetWidth; fw.style.animation = '';
  document.body.classList.add('detail-mode');
  d.scrollTop = 0;
  el('backBtn').focus();
}

function closeBook() {
  document.body.classList.remove('detail-mode');
  const s = document.querySelector(`.pbook[data-i="${current}"]`);
  if (s) s.focus();
}

export function initDetail() {
  el('backBtn').addEventListener('click', closeBook);
  el('prevBtn').addEventListener('click', () => openBook(current - 1));
  el('nextBtn').addEventListener('click', () => openBook(current + 1));
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('detail-mode')) return;
    if (e.key === 'Escape') closeBook();
    if (e.key === 'ArrowLeft') openBook(current - 1);
    if (e.key === 'ArrowRight') openBook(current + 1);
  });
}

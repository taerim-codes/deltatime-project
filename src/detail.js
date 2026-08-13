import { BOOKS, STORES, SMARTSTORE, pageBg, coverSrc } from './data.js';

let current = 0;
let presenter = null;
let busy = false;

const el = id => document.getElementById(id);

export function setPresenter(p) {
  presenter = p;
}

function fillSection(wrapId, bodyId, html) {
  el(wrapId).hidden = !html;
  if (html) el(bodyId).innerHTML = html;
}

function fillDOM(b) {
  const d = el('detail');
  d.style.setProperty('--dbg', pageBg(b.spine));
  d.style.setProperty('--dfg', b.fg);
  el('dTitle').textContent = b.t;
  el('dAuthor').textContent = b.a;
  el('dBlurb').innerHTML = (b.long ?? [b.desc]).map(p => `<p>${p}</p>`).join('');
  el('dMeta').textContent =
    `${b.s} · 시간의흐름 · ${b.d} · ${b.fm} · ${b.extra ? b.extra + ' · ' : ''}정가 ${b.p}`;
  el('dBuy').innerHTML = STORES.map(s => {
    const url = s.key === 'store' ? (b.store || SMARTSTORE) : b[s.key];
    return `<a href="${url || '#'}"${url ? ' target="_blank" rel="noopener"' : ''}>${s.label} <span class="pr">${b.p}</span> <span class="ar">↗</span></a>`;
  }).join('');

  fillSection('dToc', 'dTocList', b.toc?.length
    ? b.toc.map(line => /^(\d+[장부]|부록)/.test(line) ? `<p class="tgrp">${line}</p>` : `<p>${line}</p>`).join('')
    : '');
  fillSection('dQuotes', 'dQuotesList', b.quotes?.length
    ? b.quotes.map(q => `<blockquote><p>${q.q}</p>${q.src ? `<cite>— ${q.src}</cite>` : ''}</blockquote>`).join('')
    : '');
  fillSection('dReview', 'dReviewList', b.review?.length
    ? b.review.map(p => `<p>${p}</p>`).join('')
    : '');
  fillSection('dListen', 'dListenList', b.listen?.length
    ? b.listen.map(l =>
      `<p><a href="${l.url}" target="_blank" rel="noopener">${l.label} <span class="ar">↗</span></a></p>`).join('')
    : '');

  el('dAsec').hidden = !b.bio;
  if (b.bio) el('dBio').textContent = b.bio;
}

// CSS 폴백에서만 쓰는 3D 책 DOM
function fillCSSBook(b) {
  el('dImg').src = coverSrc(b);
  el('dImg').alt = b.t + ' 표지';
  el('dSp').style.background = b.spine;
  el('dSp').style.color = b.fg;
  el('dSpT').textContent = b.t;
  const fw = document.querySelector('.fwrap');
  fw.style.animation = 'none';
  void fw.offsetWidth;
  fw.style.animation = '';
}

const bookKey = b => b.isbn || String(BOOKS.indexOf(b));
const bookIndexByKey = key => BOOKS.findIndex(b => bookKey(b) === String(key));

export function openBook(i, viaHistory = false) {
  if (busy) return;
  const wasOpen = document.body.classList.contains('detail-mode');
  current = (i + BOOKS.length) % BOOKS.length;
  const b = BOOKS[current];
  const d = el('detail');
  d.classList.remove('closing');
  fillDOM(b);
  document.body.classList.add('detail-mode');
  d.scrollTop = 0;
  if (!viaHistory) {
    const url = `#b-${bookKey(b)}`;
    if (wasOpen) history.replaceState({ book: bookKey(b) }, '', url);
    else history.pushState({ book: bookKey(b) }, '', url);
  }
  if (presenter) {
    busy = true;
    (wasOpen ? presenter.swap : presenter.open)(current, () => { busy = false; });
  } else {
    fillCSSBook(b);
  }
  el('backBtn').focus();
}

function performClose() {
  if (busy) return;
  const d = el('detail');
  const refocus = () => {
    document.querySelector(`.pbook[data-i="${current}"]`)?.focus({ preventScroll: true });
  };
  document.body.classList.remove('detail-mode');
  if (presenter) {
    busy = true;
    d.classList.add('closing');
    presenter.close(current, () => {
      d.classList.remove('closing');
      busy = false;
      refocus();
    });
  } else {
    refocus();
  }
}

// 닫기는 항상 히스토리를 거친다 — 버튼과 브라우저 뒤로가기가 같은 길
function requestClose() {
  if (busy) return;
  if (history.state?.book != null) history.back();
  else performClose();
}

export function initDetail() {
  el('backBtn').addEventListener('click', requestClose);
  el('prevBtn').addEventListener('click', () => openBook(current - 1));
  el('nextBtn').addEventListener('click', () => openBook(current + 1));
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('detail-mode')) return;
    if (e.key === 'Escape') requestClose();
    if (e.key === 'ArrowLeft') openBook(current - 1);
    if (e.key === 'ArrowRight') openBook(current + 1);
  });

  addEventListener('popstate', e => {
    const key = e.state?.book;
    if (key != null) {
      const i = bookIndexByKey(key);
      if (i >= 0) openBook(i, true);
    } else if (document.body.classList.contains('detail-mode')) {
      performClose();
    }
  });

  // 딥링크: #b-<isbn>으로 들어오면 그 책을 바로 펼친다
  const m = location.hash.match(/^#b-(.+)$/);
  if (m) {
    const i = bookIndexByKey(m[1]);
    if (i >= 0) {
      history.replaceState({ book: m[1] }, '', location.hash);
      openBook(i, true);
    }
  }
}

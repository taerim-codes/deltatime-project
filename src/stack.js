import { BOOKS, CATS, spineH } from './data.js';

export function renderStack(onOpen) {
  const stack = document.getElementById('stack');

  CATS.forEach(cat => {
    const grp = document.createElement('p');
    grp.className = 'grp';
    grp.innerHTML = `${cat.no}<em>${cat.name}</em>`;
    stack.appendChild(grp);

    BOOKS.forEach((b, i) => {
      if (b.cat !== cat.id) return;
      const el = document.createElement('button');
      el.className = 'pbook';
      el.dataset.i = i;
      el.setAttribute('aria-label', b.t + ' 자세히 보기');
      el.innerHTML = `
        <span class="pwrap">
          <span class="ptop"><img src="${b.cover}" alt="" loading="lazy"></span>
          <span class="pspine" style="--sh:${spineH(b)}px;background:${b.spine};color:${b.fg}">
            <i class="pa">${b.a.split('·')[0].trim()}</i>
            <b class="pt">${b.t}</b>
            <i class="pl">ΔT</i>
          </span>
          <span class="pedge"></span>
        </span>`;
      stack.appendChild(el);
    });
  });

  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.18 });
  stack.querySelectorAll('.pbook').forEach(b => io.observe(b));

  stack.addEventListener('click', e => {
    const s = e.target.closest('.pbook');
    if (s) onOpen(+s.dataset.i);
  });
}

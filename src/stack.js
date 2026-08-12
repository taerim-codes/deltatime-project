import { BOOKS, CATS, spineH, bookW, coverSrc, spineAuthor } from './data.js';

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
      stack.appendChild(el);
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

import NEWS from '../news.json';

export function renderNews() {
  const ul = document.getElementById('newsList');
  if (!ul || !NEWS.length) return;
  ul.innerHTML = NEWS.map(n => {
    const body = n.url
      ? `<a href="${n.url}" target="_blank" rel="noopener">${n.t} <span class="ar">↗</span></a>`
      : `<span>${n.t}</span>`;
    return `<li><i>${n.d}</i>${body}</li>`;
  }).join('');
}

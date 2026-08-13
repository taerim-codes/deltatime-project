import BOOKS from '../books.json';

export { BOOKS };

// mode — 서가마다 다른 가구: stack(눕힌 더미) / display(표지 정면 진열) / shelf(꽂힌 책꽂이)
export const CATS = [
  { id: 'flow',  no: 'SHELF 01', name: '말들의 흐름',       mode: 'stack' },
  { id: 'poem',  no: 'SHELF 02', name: '시간의 흐름 시인선', mode: 'display' },
  { id: 'fict',  no: 'SHELF 03', name: '소설',              mode: 'display' },
  { id: 'sound', no: 'SHELF 04', name: '소리와 음악',        mode: 'shelf' },
  { id: 'cafe',  no: 'SHELF 05', name: '카페',              mode: 'shelf' },
  { id: 'essay', no: 'SHELF 06', name: '산문',              mode: 'shelf' },
];

export const MODE_BY_CAT = Object.fromEntries(CATS.map(c => [c.id, c.mode]));

// 서 있는 책의 화면 스케일 (책 길이 680px 기준) — 눕힌 책과 존재감을 맞춘다
export const STAND_SCALE = { shelf: 0.88, display: 0.66 };

export const SMARTSTORE = 'https://smartstore.naver.com/denker251';

export const STORES = [
  { label: '스마트스토어에서 구매', key: 'store' }, // 출판사 직영이 첫 줄
  { label: '알라딘에서 구매', key: 'aladin' },
  { label: '교보문고에서 구매', key: 'kyobo' },
  { label: '예스24에서 구매', key: 'yes24' },
];

export const coverSrc = b => b.coverXl || b.coverHd || b.cover;

// 작은 화면에선 책 자체가 뷰포트에 맞게 줄어든다 (레이아웃과 GL이 같은 값을 공유)
const FIT = Math.min(1, (typeof window === 'undefined' ? 1200 : window.innerWidth) * 0.88 / 680);

export function bookW() {
  return Math.round(680 * FIT);
}

// 680px = 책 높이 200mm 기준 3.4px/mm
export function spineH(b) {
  const pages = parseInt(b.pages);
  let px;
  if (pages) {
    const boardsMm = b.fm === '양장본' ? 5 : 3;
    px = Math.max(44, Math.min(124, Math.round((boardsMm + pages * 0.062) * 3.4)));
  } else {
    px = b.t.includes('키스 자렛') ? 96 : b.cat === 'poem' ? 48 : b.fm === '양장본' ? 78 : 62;
  }
  return Math.round(px * FIT);
}

// 공저는 "첫 저자 외", 역서는 원저자만
export function spineAuthor(b) {
  const parts = b.a.split('·').map(s => s.trim());
  if (parts.length > 1 && !parts[parts.length - 1].endsWith('옮김')) return parts[0] + ' 외';
  return parts[0];
}

// 순백 표지는 상세 배경을 종이색으로 치환
export function pageBg(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.93 ? '#F3F0E9' : hex;
}

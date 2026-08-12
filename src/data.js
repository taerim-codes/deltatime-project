import BOOKS from '../books.json';

export { BOOKS };

export const CATS = [
  { id: 'flow',  no: 'SHELF 01', name: '말들의 흐름' },
  { id: 'poem',  no: 'SHELF 02', name: '시간의 흐름 시인선' },
  { id: 'fict',  no: 'SHELF 03', name: '소설' },
  { id: 'sound', no: 'SHELF 04', name: '소리와 음악' },
  { id: 'cafe',  no: 'SHELF 05', name: '카페' },
  { id: 'essay', no: 'SHELF 06', name: '그 밖의 산문' },
];

export const STORES = [
  { label: '알라딘에서 구매', key: 'aladin' },
  { label: '교보문고에서 구매', key: 'kyobo' },
  { label: '예스24에서 구매', key: 'yes24' },
];

export const coverSrc = b => b.coverHd || b.cover;

export function bookW() {
  return 680;
}

// 680px = 책 높이 200mm 기준 3.4px/mm
export function spineH(b) {
  const pages = parseInt(b.pages);
  if (pages) {
    const boardsMm = b.fm === '양장본' ? 5 : 3;
    const mm = boardsMm + pages * 0.062;
    return Math.max(44, Math.min(124, Math.round(mm * 3.4)));
  }
  if (b.t.includes('키스 자렛')) return 96;
  if (b.cat === 'poem') return 48;
  if (b.fm === '양장본') return 78;
  return 62;
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

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

export const STORES = ['알라딘에서 구매', '교보문고에서 구매', '예스24에서 구매'];

// 두께 = 물성. 키스 자렛 대형본 > 양장 > 반양장 > 시집
export function spineH(b) {
  if (b.t.includes('키스 자렛')) return 104;
  if (b.cat === 'poem') return 58;
  if (b.fm === '양장본') return 82;
  return 70;
}

// 흰 표지는 순백 대신 종이색 배경으로
export function pageBg(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.93 ? '#F3F0E9' : hex;
}

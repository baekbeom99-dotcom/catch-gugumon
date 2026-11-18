/** 속성 아이콘 — 색 동그라미 안에 모양 하나 (풀 잎·독 방울·빛 별·물 방울·번개·땅 바위·불꽃). 글자 없이 모양과 색으로 알아본다 */
import { ELEMENT_NAMES, type Element } from '../domain/field/elements';

/** 속성 색 (동그라미 바탕) — 한 곳 */
export const ELEMENT_COLORS: Record<Element, string> = {
  grass: '#5cb85c',
  poison: '#9b59b6',
  light: '#f5c518',
  water: '#4aa3e8',
  thunder: '#f2a900',
  earth: '#a47148',
  fire: '#ee5a3c',
};

/** 모양 (24×24 안, 흰색) */
const SHAPES: Record<Element, string> = {
  grass: 'M6 18C6 9 11 6 18 6c0 7-3 12-10 12M6 18l7-7',
  poison: 'M12 5c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.500 2-5 5-9z',
  light: 'M12 4l2.200 5.200L20 10l-4.200 3.800L17 19.500 12 16.500 7 19.500l1.200-5.700L4 10l5.800-.800z',
  water: 'M12 4c3.500 4.500 6 7.500 6 10.500a6 6 0 0 1-12 0C6 11.500 8.500 8.500 12 4z',
  thunder: 'M13 3L6 13h5l-1 8 8-11h-5z',
  earth: 'M3 19l6-11 3.500 6 2.500-4 6 9z',
  fire: 'M12 3c1 4 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
};

interface Props {
  element: Element;
  size?: number;
  /** 주속성이면 true, 부속성은 조금 작고 테두리가 얇다 */
  sub?: boolean;
}

export function ElementIcon({ element, size = 22, sub = false }: Props) {
  const name = ELEMENT_NAMES[element];
  return (
    <svg
      className={`element-icon element-icon--${element}${sub ? ' element-icon--sub' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={`${name}${sub ? ' 부속성' : ' 속성'}`}
    >
      <title>{name}</title>
      <circle cx="12" cy="12" r="11" fill={ELEMENT_COLORS[element]} stroke="#222" strokeWidth={sub ? 1 : 1.600} />
      <path d={SHAPES[element]} fill={element === 'grass' ? 'none' : '#fff'} stroke="#fff" strokeWidth={element === 'grass' ? 2.200 : 0.600} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

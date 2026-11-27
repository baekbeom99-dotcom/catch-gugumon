/** 상점 팝업 글 — 문구를 바꿀 때는 여기만. 조사(이/가, 을/를)는 josa가 붙인다 */
import { josa } from '../../domain/korean';

export const shopText = {
  title: '상점',
  close: '닫기',
  quit: '그만하기',
  ok: '확인',
  /** 꾸미기 */
  costumeOff: '별점수가 꺼져 있어요',
  costumeGroupBasic: '처음 옷',
  costumeGroupFlag: '나라',
  costumeGroupConcept: '캐릭터 느낌',
  costumeStarsLabel: (n: string) => `모은 별 ${n}개`,
  costumeBuy: (price: number) => `사기 ★${price}`,
  costumeBuyLabel: '사기',
  costumeWear: '입기',
  costumeWorn: '입는 중',
  costumeShort: '별이 모자라요',
  /** 캡슐 줄: 맞는 캡슐 이름 옆 */
  get: '얻기',
  /** 황금 캡슐(13단)은 도전 단이 열려야 */
  lockedLegend: '13단 도전이 열리면 황금 캡슐을 얻을 수 있어요',
  practiceHeader: (capsule: string, n: number, total: number) => `${capsule} 얻기 (${n}/${total})`,
  choose: '정답을 골라요',
  hintGuide: '빛나는 보기를 눌러 보세요',
  gotCapsules: (name: string, n: number) => `${name} ${n}개를 받았어요!`,
  /** 회복약 */
  allHealthy: '모두 건강해요!',
  fainted: '쓰러짐',
  wounds: (n: number) => `상처 ${n}개`,
  healHeader: (name: string, round: number, rounds: number, n: number, total: number) => `${name} 회복 중 · ${round}/${rounds}바퀴 (${n}/${total})`,
  healed: (name: string) => `${josa(name, '이', '가')} 다 나았어요!`,
  healPick: '상처 문제를 풀어서 낫게 해 줘요',
} as const;

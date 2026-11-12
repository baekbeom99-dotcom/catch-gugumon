/** 기술 선택창·기술 관리 화면 글 — 모두 기술 표(SkillDef)에서 계산하므로 표가 바뀌어도 따라간다 */
import { ELEMENT_NAMES } from '../domain/field/elements';
import { speciesDef, type SpeciesId } from '../domain/field/creatures';
import { M2_EFFECT_OF_SPECIES, seatOf, seatedDef, skillDef, type Seat, type SkillDef, type SpecialKind } from '../domain/field/skills';
import { TIER_RULES } from '../domain/field/tuning';
import { josa } from '../domain/korean';
import type { SkillOffer } from '../store/fieldData';
import { skillLines } from './battle/skillUse';

const SPECIAL_INFO: Record<SpecialKind, string> = {
  heal: '체력이 조금 회복돼요',
  guard: '다음 적 공격이 약해져요',
  clue: '틀린 보기가 하나 사라져요',
  calm: '다음 문제 시간이 늘어요',
  charge: '다음 기술이 더 세져요',
  stun: '다음 적 공격을 한 번 막아요',
};

/** 카드의 시간 글을 세는 기준 문제 시간 (보통 단계) */
const CARD_TIME_MS = TIER_RULES.normal.timeMs;

export const skillText = {
  /** 위력 별. owner를 주면 그 구구몬의 자리 위력 (복사한 속성 기술은 부속성 자리 위력) */
  power: (def: SkillDef, owner?: SpeciesId) => '★'.repeat(Math.max(1, (owner ? seatedDef(def, owner) : def).basePower)),
  /** "풀 · 주속성" / "빛 · 부속성" / "특수". owner를 주면 그 구구몬의 자리로 본다 */
  kind: (def: SkillDef, owner?: SpeciesId) => {
    const seat: Seat = owner ? seatOf(def, owner) : def.kind;
    return seat === 'special' || !def.element ? '특수' : `${ELEMENT_NAMES[def.element]} · ${seat === 'main' ? '주속성' : '부속성'}`;
  },
  /** 특수 기술이 하는 일 (속성 기술은 null) */
  special: (def: SkillDef): string | null => (def.special ? SPECIAL_INFO[def.special] : null),
  /**
   * 카드에 보일 효과 한 줄: 특수 기술은 하는 일, 자기 종 주속성 2번은 빨리 풀면 붙는 효과(스턴·회복·방어), 그 밖은 null.
   * 복사해 부속성 자리에 앉은 주속성 2번에는 효과가 없다 (pickFired와 같은 규칙)
   */
  effect: (def: SkillDef, owner: SpeciesId): string | null => {
    if (def.special) return SPECIAL_INFO[def.special];
    if (seatOf(def, owner) === 'main' && def.slot === 2) return `빨리 풀면: ${SPECIAL_INFO[M2_EFFECT_OF_SPECIES[def.species]]}`;
    return null;
  },
  /** 단계별 시간 조건 글 (보통 단계 문제 시간 기준) — 고르기 버튼과 같은 함수 */
  lines: (def: SkillDef, owner: SpeciesId, timeMs: number = CARD_TIME_MS) => skillLines(def, owner, timeMs),
  /** 시간 글을 센 기준 */
  timeNote: `보통 문제(${CARD_TIME_MS / 1000}초) 기준이에요`,
  /** 자리 이름 */
  seatName: (seat: Seat) => (seat === 'main' ? '주속성 사슬' : seat === 'sub' ? '부속성 자리' : '특수 자리'),
  /** 제안 카드의 출처 */
  source: (offer: SkillOffer) => {
    if (offer.source === 'copy') {
      const from = offer.fromSpecies ?? skillDef(offer.skillId).species;
      return `${speciesDef(from).name}에게서 따라 배울 수 있어요`;
    }
    return `Lv${skillDef(offer.skillId).learnLevel}에 배우는 기술이에요`;
  },
  offerTitle: (offer: SkillOffer) => (offer.source === 'copy' ? '기술을 따라 배울까?' : '새 기술을 배울 수 있어!'),
  offerHint: (offer: SkillOffer) => {
    const seat = offer.seat === 'special' ? '특수 자리' : '부속성 자리';
    return offer.source === 'copy'
      ? `${seat}가 차 있어요. 지금 기술을 잊으면 배워요. (포기하면 사라져요)`
      : `${seat}가 차 있어요. 지금 기술을 잊으면 배워요.`;
  },
  newBadge: '새 기술',
  forgetAndLearn: '이 기술을 잊고 배우기',
  skip: (offer: SkillOffer) => (offer.source === 'copy' ? '포기' : '배우지 않기'),
  skipNote: (offer: SkillOffer) => (offer.source === 'copy' ? '' : '안 배워도 도감에서 나중에 배울 수 있어요'),
  /** 관리 화면 */
  manageTitle: '기술',
  mainNote: '레벨이 오르면 저절로 배워요. 바꿀 수는 없어요',
  subNote: '다른 기술로 바꿀 수만 있어요',
  specialNote: '다른 기술로 바꿀 수만 있어요',
  nowHeld: '지금 쓰는 기술',
  emptySeat: '아직 비어 있어요',
  learn: '배우기',
  swap: '이 기술로 바꾸기',
  learnLevel: (def: SkillDef) => `Lv${def.learnLevel}에 배워요`,
  confirmSwap: (now: string, next: string) => `「${now}」${josa(now, '을', '를').slice(now.length)} 잊고 「${next}」${josa(next, '을', '를').slice(next.length)} 배울까요? 잊은 기술은 다시 못 배울 수도 있어요`,
  cancel: '그만두기',
} as const;

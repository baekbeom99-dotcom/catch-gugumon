/** 기술 선택창·기술 관리 화면 글 — 모두 기술 표(SkillDef)에서 계산하므로 표가 바뀌어도 따라간다 */
import { ELEMENT_NAMES } from '../domain/field/elements';
import { speciesDef } from '../domain/field/creatures';
import { skillDef, type SkillDef, type SpecialKind } from '../domain/field/skills';
import { josa } from '../domain/korean';
import type { SkillOffer } from '../store/fieldData';

const SPECIAL_INFO: Record<SpecialKind, string> = {
  heal: '체력이 조금 회복돼요',
  guard: '다음 적 공격이 약해져요',
  clue: '틀린 보기가 하나 사라져요',
  calm: '다음 문제 시간이 늘어요',
  charge: '다음 기술이 더 세져요',
  stun: '다음 적 공격을 한 번 막아요',
};

const SPECIAL_WORD: Record<SpecialKind, string> = { heal: '회복', guard: '방어', clue: '힌트', calm: '여유', charge: '충전', stun: '스턴' };

export const skillText = {
  /** 위력 별 */
  power: (def: SkillDef) => '★'.repeat(Math.max(1, def.basePower)),
  /** "풀 · 주속성" / "빛 · 부속성" / "특수" */
  kind: (def: SkillDef) =>
    def.kind === 'special' || !def.element ? '특수' : `${ELEMENT_NAMES[def.element]} · ${def.kind === 'main' ? '주속성' : '부속성'}`,
  /** 특수 기술이 하는 일 (속성 기술은 null) */
  special: (def: SkillDef): string | null => (def.special ? SPECIAL_INFO[def.special] : null),
  /** 발동 조건: 문제 시간의 몇 % 안에 풀면 */
  condition: (def: SkillDef) => {
    const pct = Math.round(def.fastRatio * 100);
    return def.special
      ? `문제 시간의 ${pct}% 안에 풀면 ${SPECIAL_WORD[def.special]}! 못 풀면 약한 기술이 나가요`
      : `문제 시간의 ${pct}% 안에 풀면 강력!`;
  },
  /** 아직 못 익힌 기술 */
  learnLevel: (def: SkillDef) => `Lv${def.learnLevel}에 배워요`,
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
  forgetAndLearn: '이 기술을 잊고 배우기',
  skip: (offer: SkillOffer) => (offer.source === 'copy' ? '포기' : '배우지 않기'),
  skipNote: (offer: SkillOffer) => (offer.source === 'copy' ? '' : '안 배워도 도감에서 나중에 배울 수 있어요'),
  /** 관리 화면 */
  manageTitle: '기술',
  heldTitle: (n: number, max: number) => `가진 기술 ${n}/${max}`,
  learnableTitle: '배울 수 있는 기술',
  learn: '배우기',
  pickToReplace: (name: string) => `「${name}」${josa(name, '을', '를').slice(name.length)} 배우려면 어떤 기술을 잊을까요?`,
  forgetThis: '이 기술을 잊기',
  cancel: '그만두기',
} as const;

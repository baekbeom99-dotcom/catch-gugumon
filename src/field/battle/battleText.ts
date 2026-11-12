/** 야생 전투 화면 아래 글 — 문구를 바꿀 때는 여기만. 조사(이/가, 을/를)는 josa가 붙인다 */
import type { SpecialKind } from '../../domain/field/skills';
import type { Tier } from '../../domain/field/strength';
import { CALM_BONUS_MS, SPECIAL_HEAL } from '../../domain/field/tuning';
import { josa } from '../../domain/korean';

/** 낱말 뒤에 붙을 조사만 (「」로 감쌀 때) */
const particle = (word: string, withFinal: string, withoutFinal: string) => josa(word, withFinal, withoutFinal).slice(word.length);

const TIER_WORD: Record<Tier, string> = { weak: '약한 ', normal: '', strong: '강한 ', mighty: '강력한 ', legend: '' };

/** 특수 기술 한 낱말 (고르기 버튼의 발동 조건·내 구구몬 상태 표시) */
const SPECIAL_WORD: Record<SpecialKind, string> = { heal: '회복', guard: '방어', clue: '힌트', calm: '여유', charge: '충전', stun: '스턴' };

/** 특수 기술이 발동했을 때 글 */
const SPECIAL_DONE: Record<SpecialKind, string> = {
  heal: `체력을 ${SPECIAL_HEAL} 되찾았어요!`, // 화면은 실제로 늘어난 만큼을 쓰는 healed를 쓴다
  guard: '다음 공격은 반만 아파요!',
  clue: '다음 문제에서 틀린 답 하나가 사라져요!',
  calm: `다음 문제 시간이 ${CALM_BONUS_MS / 1000}초 늘어나요!`,
  charge: '다음 기술이 더 세져요!',
  stun: '기절해서 다음 공격을 못 해요!', // 글은 Task 12에서 다듬는다
};

export const battleText = {
  /** 단계 말을 붙인 이름 ("약한 ○○"·"○○"·"강한 ○○"·"강력한 ○○", 황금은 이름 그대로) */
  tierName: (name: string, tier: Tier) => `${TIER_WORD[tier]}${name}`,
  appear: (name: string, legend: boolean) => `${legend ? '전설의' : '야생'} ${josa(name, '이', '가')} 나타났다!`,
  choose: '어떤 기술을 쓸까?',
  /** 기술을 고른 뒤(또는 기술이 하나라 바로) 문제가 뜰 때 */
  ready: (move: string, sec: number, special?: SpecialKind) => `${move} 준비! ${battleText.condition(sec, special)}`,
  /** 짧은 발동 조건 ("4초 안에 풀면 강력!" / "4초 안에 풀면 회복!") */
  condition: (sec: number, special?: SpecialKind): string => `${sec}초 안에 풀면 ${special ? SPECIAL_WORD[special] : '강력'}!`,
  hit: (move: string) => `${move}! 명중!`,
  /** 빠르게 풀어 강력이 발동 */
  strong: (move: string) => `${move}! 강력!`,
  /** 특수 기술 발동 */
  special: (move: string, kind: SpecialKind) => `${move}! ${SPECIAL_DONE[kind]}`,
  /** 회복 특수: 실제로 늘어난 체력 (0이면 이미 가득) */
  healSkill: (move: string, amount: number) => `${move}! ${amount > 0 ? `체력을 ${amount} 되찾았어요!` : '체력이 이미 가득해요!'}`,
  /** 특수 기술을 늦게 풀어 약한 기술이 대신 나감 */
  fallback: (move: string) => `시간이 지나서 약한 기술이 나갔어요. ${move}!`,
  /** 상성 (색에만 기대지 않게 ▲▼ 글자도) */
  matchup: (m: -1 | 0 | 1) => (m > 0 ? '효과가 커요! ▲' : m < 0 ? '별로예요… ▼' : '보통이에요'),
  /** 고르기 버튼의 발동 조건 */
  fastCondition: (sec: number) => `${sec}초 안에 풀면 강력!`,
  specialCondition: (sec: number, kind: SpecialKind) => `${sec}초 안에 풀면 ${SPECIAL_WORD[kind]}! 못 풀면 약한 기술이 나가요`,
  /** 특수 기술 이름표 (속성 대신) */
  specialTag: '특수',
  /** 내 구구몬에 남아 있는 특수 효과 표시 */
  buff: SPECIAL_WORD,
  /** 위력 별 */
  power: (n: number) => '★'.repeat(Math.max(1, n)),
  hintInstruction: '빛나는 답을 눌러 보세요',
  miss: (move: string) => `${move}! …빗나갔다. 힌트를 보자!`,
  timeUp: '시간이 지났어!',
  foeAttack: (name: string, move: string) => `${name}의 ${move}!`,
  fainted: (name: string) => `${josa(name, '이', '가')} 쓰러졌다… 태초마을로 돌아가자`,
  dizzy: (name: string) => `${josa(name, '이', '가')} 어지러워한다! 지금이야!`,
  retry: '좋아, 다시 해 보자!',
  throwCapsule: '캡슐을 던졌다!',
  caught: (name: string, newSpecies = false) => `${josa(name, '을', '를')} 잡았다!${newSpecies ? ' 새로 만났어!' : ''}`,
  /** 캡슐에서 빠져나옴: 체력을 조금 되찾고 다시 싸운다 */
  healed: '앗! 캡슐에서 빠져나왔어요! 힘을 조금 되찾았어요!',
  escaped: (name: string) => `${josa(name, '이', '가')} 도망갔다…`,
  angry: (name: string) => `${josa(name, '이', '가')} 화가 났다! 강력해졌다!`,
  /** 던지기 버튼: 맞는 캡슐의 남은 수 */
  throwButton: (left: number) => `캡슐 던지기 (${left})`,
  /** 맞는 캡슐이 없어 돌려보냄 (R18) */
  noCapsule: '캡슐이 없어서 돌려보냈어! 상점에서 캡슐을 구해 오자',
  quit: '무사히 도망쳤다!',
  /** 필드: 동행이 쓰러져 있을 때 */
  faintedField: '구구몬이 쓰러졌어요. 상점에서 회복시켜요',
  /** 필드 알림: 쓰러지면서 도감의 다른 구구몬이 대신 함께 다니게 됐을 때 */
  replacedField: (name: string) => `${josa(name, '이', '가')} 대신 함께 다녀요`,
  /** 필드 알림: 레벨이 올라 새 기술을 가짐 */
  skillLearnedTitle: '새 기술을 배웠어!',
  skillLearned: (mon: string, skill: string) => `${josa(mon, '이', '가')} 「${skill}」${particle(skill, '을', '를')} 배웠어요!`,
  /** 필드 알림: 야생 구구몬에게서 기술을 따라 배움 */
  skillCopiedTitle: '기술을 따라 배웠어!',
  skillCopied: (mon: string, from: string, skill: string) =>
    `${josa(mon, '이', '가')} ${from}에게서 「${skill}」${particle(skill, '을', '를')} 따라 배웠어요!`,
} as const;

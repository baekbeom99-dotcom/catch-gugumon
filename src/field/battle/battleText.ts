/** 야생 전투 화면 아래 글 — 문구를 바꿀 때는 여기만. 조사(이/가, 을/를)는 josa가 붙인다 */
import type { SpecialKind } from '../../domain/field/skills';
import type { Tier } from '../../domain/field/strength';
import { CALM_BONUS_MS, SPECIAL_HEAL } from '../../domain/field/tuning';
import { josa } from '../../domain/korean';

/** 낱말 뒤에 붙을 조사만 (「」로 감쌀 때) */
const particle = (word: string, withFinal: string, withoutFinal: string) => josa(word, withFinal, withoutFinal).slice(word.length);

const TIER_WORD: Record<Tier, string> = { weak: '약한 ', normal: '', strong: '강한 ', mighty: '강력한 ', legend: '' };

/** 특수 효과 한 낱말 (고르기 버튼의 발동 조건·남은 효과 표시). 스턴은 어린이가 알기 쉽게 "기절" */
const SPECIAL_WORD: Record<SpecialKind, string> = { heal: '회복', guard: '방어', clue: '힌트', calm: '여유', charge: '충전', stun: '기절' };

/** 특수 기술이 발동했을 때 글 */
const SPECIAL_DONE: Record<SpecialKind, string> = {
  heal: `체력을 ${SPECIAL_HEAL} 되찾았어요!`, // 화면은 실제로 늘어난 만큼을 쓰는 healed를 쓴다
  guard: '다음 공격은 반만 아파요!',
  clue: '다음 문제에서 틀린 답 하나가 사라져요!',
  calm: `다음 문제 시간이 ${CALM_BONUS_MS / 1000}초 늘어나요!`,
  charge: '다음 기술이 더 세져요!',
  stun: '적이 기절해서 다음 공격을 못 해요!', // 특수 자리에는 스턴이 없지만 표는 빠짐없이
};

/** 주②가 나가며 붙은 효과 글 (회복은 실제로 늘어난 양 healed) */
function stageEffectText(kind: SpecialKind, healed: number): string {
  switch (kind) {
    case 'stun':
      return '적이 기절했어요! 다음 공격을 한 번 못 해요';
    case 'heal':
      return healed > 0 ? `체력이 ${healed} 회복됐어요` : '체력이 이미 가득해요';
    case 'guard':
      return '다음 공격이 약해져요';
    default:
      return SPECIAL_DONE[kind];
  }
}

const stars = (n: number) => '★'.repeat(Math.max(1, n));

export const battleText = {
  /** 단계 말을 붙인 이름 ("약한 ○○"·"○○"·"강한 ○○"·"강력한 ○○", 황금은 이름 그대로) */
  tierName: (name: string, tier: Tier) => `${TIER_WORD[tier]}${name}`,
  appear: (name: string, legend: boolean) => `${legend ? '전설의' : '야생'} ${josa(name, '이', '가')} 나타났다!`,
  choose: '어떤 기술을 쓸까?',
  /** 문제가 뜰 때 ("잎사귀 톡 준비!", 특수 버튼은 "새싹 쑥쑥 준비! 빨리 풀면 회복!") — 몇 초 안인지는 시간 막대가 보여 준다 */
  ready: (move: string, special?: SpecialKind) => (special ? `${move} 준비! ${battleText.quickFor(special)}!` : `${move} 준비!`),
  /** 특수 버튼의 짧은 조건 ("빨리 풀면 회복") */
  quickFor: (special: SpecialKind) => `빨리 풀면 ${SPECIAL_WORD[special]}`,
  /** 특수 버튼의 발동 조건 ("4초 안에 풀면 회복!") — 화면 읽기 도구용 숨김 글 */
  condition: (sec: number, special?: SpecialKind): string => `${sec}초 안에 풀면 ${special ? SPECIAL_WORD[special] : '센 기술'}!`,
  /** 지금 쓰는 기술 숨김 글: 주속성 단계 ("4초 안 2번"), 부속성 ("4초 안에 풀어요") */
  nowStage: (sec: number, n: 2 | 3) => `${sec}초 안 ${n}번`,
  nowSub: (sec: number) => `${sec}초 안에 풀어요`,
  hit: (move: string) => `${move}! 명중!`,
  /** 빠르게 풀어 윗단계가 나감: 번호 나열 없이 "빠르다!" 느낌만 (개정: UI 간결화) */
  quick: '⚡ 빠르다!',
  upper: (move: string) => `${move}! ${battleText.quick}`,
  /** 고르기 단계 한 줄 안내 (버튼이 2개 이상일 때만) */
  chooseHint: '빨리 풀면 더 세져요 ⚡',
  /** 주②의 효과 (스턴·회복·방어) */
  stageEffect: stageEffectText,
  /** 스턴으로 적이 공격하지 못함 */
  stunBlocked: (name: string) => `${josa(name, '이', '가')} 기절해서 움직이지 못했어요!`,
  /** 특수 기술 발동 */
  special: (move: string, kind: SpecialKind) => `${move}! ${SPECIAL_DONE[kind]}`,
  /** 회복 특수: 실제로 늘어난 체력 (0이면 이미 가득) */
  healSkill: (move: string, amount: number) => `${move}! ${amount > 0 ? `체력을 ${amount} 되찾았어요!` : '체력이 이미 가득해요!'}`,
  /** 특수 기술을 늦게 풀어 약한 기술이 대신 나감 */
  fallback: (move: string) => `시간이 지나서 약한 기술이 나갔어요. ${move}!`,
  /** 상성 (색에만 기대지 않게 ▲▼ 글자도) */
  matchup: (m: -1 | 0 | 1) => (m > 0 ? '효과가 커요! ▲' : m < 0 ? '별로예요… ▼' : '보통이에요'),
  /** 고르기 버튼의 단계별 시간 조건 — 주속성: "1번 ○○" / "4초 안: 2번 ○○ +기절" */
  stageFirst: (move: string) => `1번 ${move}`,
  stageUpper: (sec: number, n: 2 | 3, move: string, effect?: SpecialKind) =>
    `${sec}초 안: ${n}번 ${move}${effect ? ` +${SPECIAL_WORD[effect]}` : ''}`,
  /** 부속성: 빠르면 그 기술, 느리면 주속성 1번 */
  subLines: (sec: number, move: string, first: string) => [`${sec}초 안: ${move}(부속성)`, `그보다 느리면 1번 ${first}`],
  /** 특수: 시간 안이면 효과, 못 풀면 약한 기술 */
  specialLines: (sec: number, kind: SpecialKind) => [`${sec}초 안: ${SPECIAL_WORD[kind]} 효과`, '못 풀면 약한 기술'],
  /** 특수 버튼 아래 한 줄 설명 (속성 버튼·주②의 효과에는 없음) */
  specialBrief: { heal: '체력 회복', guard: '방어', clue: '힌트', calm: '여유 시간', charge: '충전', stun: '적 기절' } as Record<SpecialKind, string>,
  /** 특수 기술 이름표 (속성 대신) */
  specialTag: '특수',
  /** 내 구구몬에 남아 있는 특수 효과 표시 */
  buff: SPECIAL_WORD,
  /** 위력 별 */
  power: stars,
  /** 위력 범위 (주속성 버튼: 가진 단계 중 가장 약한 것 ~ 가장 센 것) */
  powerRange: (min: number, max: number) => (min === max ? stars(min) : `${stars(min)}~${stars(max)}`),
  hintInstruction: '빛나는 답을 눌러 보세요',
  /** 틀렸을 때 (적의 공격 뒤) — 회피 "빗나갔어요"와 헷갈리지 않게 */
  miss: '아쉬워! 힌트를 보자!',
  /** 크리티컬 (크게) */
  crit: '💥 크리티컬!',
  /** 공격이 빗나감 (회피) */
  dodge: '빗나갔어요!',
  /** 내 기술이 빗나감 */
  dodgedHit: (move: string) => `${move}! …빗나갔어요!`,
  /** 특수효과가 확률에 져서 실패함 (공격 칸은 그대로 들어감) */
  effectFailed: '효과가 실패했어요…',
  /** 캡슐 버튼 (문제를 푸는 동안, 남은 수) */
  capsuleButton: (left: number) => `캡슐 (${left})`,
  /** 캡슐 버튼이 꺼져 있을 때 한 줄 */
  capsuleLocked: '체력이 1/4 이하일 때 던질 수 있어요',
  timeUp: '시간이 지났어!',
  foeAttack: (name: string, move: string) => `${name}의 ${move}!`,
  fainted: (name: string) => `${josa(name, '이', '가')} 쓰러졌다… 태초마을로 돌아가자`,
  dizzy: (name: string) => `${josa(name, '이', '가')} 어지러워한다! 지금이야!`,
  /** 힌트의 빛나는 답을 누른 뒤 (다른 문제로 넘어감, 틀린 문제는 몇 문제 뒤에 다시) */
  retry: '좋아, 다음 문제!',
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

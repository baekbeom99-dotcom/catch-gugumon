/**
 * 체육관에서 NPC·동상에게 말을 걸었을 때 할 일 — React 없이 순수 계산만.
 */
import type { GymNpc } from '../../field/world/maps/gym';
import { isClockOpen, type ClockLevel } from './clock';
import { isTrainingOpen, type TrainingData } from './training';
import { TRAINING_DANS } from './tuning';

export type TalkAction = { type: 'enter'; to: string } | { type: 'locked'; text: string } | { type: 'none' };

/** 잠긴 단 트레이너 글: 바로 앞 단 트레이너를 먼저 이기라고 알려 준다 */
export function lockedText(dan: number): string {
  const i = (TRAINING_DANS as readonly number[]).indexOf(dan);
  const prev = i > 0 ? TRAINING_DANS[i - 1] : null;
  return prev === null ? '아직 열리지 않았어요' : `${prev}단 트레이너를 먼저 이겨요`;
}

/** 잠긴 시계 트레이너 글: 바로 앞 단계 시계 트레이너를 먼저 마스터하라고 알려 준다 */
export function clockLockedText(level: ClockLevel): string {
  return level === 'one' ? '5분 시계를 먼저 마스터해요' : '정각을 먼저 마스터해요';
}

/** 단 트레이너는 열렸을 때만, 시계 트레이너는 앞 단계를 마스터했을 때만, 셈연습 트레이너는 늘, 동상은 별점수가 켜져 있을 때만 말이 통한다 */
export function talkAction(npc: GymNpc | 'statue', training: TrainingData, starsEnabled: boolean): TalkAction {
  if (npc === 'statue') return starsEnabled ? { type: 'enter', to: '/field/statue' } : { type: 'none' };
  if (npc.kind === 'arith') return { type: 'enter', to: `/field/training/arith/${npc.level}` };
  if (npc.kind === 'clock')
    return isClockOpen(training, npc.level) ? { type: 'enter', to: `/field/training/clock/${npc.level}` } : { type: 'locked', text: clockLockedText(npc.level) };
  return isTrainingOpen(training, npc.dan) ? { type: 'enter', to: `/field/training/${npc.dan}` } : { type: 'locked', text: lockedText(npc.dan) };
}

/** 이 트레이너를 마스터했는가 (머리색 노랑) */
export function isNpcMastered(npc: GymNpc, training: TrainingData): boolean {
  if (npc.kind === 'dan') return training.mastered[npc.dan] !== undefined;
  if (npc.kind === 'clock') return training.clock?.[npc.level] !== undefined;
  return training.arith[npc.level] !== undefined;
}

/** E2E 표식용 이름: dan2·dan13·arithBasic·arithHard·arithComp·clockHour·clockFive·clockOne */
export function npcKey(npc: GymNpc): string {
  if (npc.kind === 'dan') return `dan${npc.dan}`;
  return `${npc.kind}${npc.level[0].toUpperCase()}${npc.level.slice(1)}`;
}

/**
 * 마을 건물 문에 부딪혔을 때 할 일 — 상점 팝업 / 들어가기 / 잠김 안내. React 없이 순수 계산만.
 */
import type { FieldDoor, FieldMap, Pos } from './movement';
import { isStairsOpen, isTrainingOpen, type TrainingData } from './training';
import { STAIRS_OPEN_AFTER_DAN, TRAINING_DANS } from './tuning';

export type DoorAction = { type: 'shop' } | { type: 'enter'; to: string } | { type: 'locked'; text: string };

/** 잠긴 훈련 건물 글: 바로 앞 단을 먼저 마스터하라고 알려 준다 */
export function lockedText(dan: number): string {
  const i = (TRAINING_DANS as readonly number[]).indexOf(dan);
  const prev = i > 0 ? TRAINING_DANS[i - 1] : dan;
  return `${prev}단을 먼저 마스터해요`;
}

export function doorAction(door: FieldDoor, training: TrainingData): DoorAction {
  if (door.kind === 'shop') return { type: 'shop' };
  if (door.kind === 'stairs') {
    if (isStairsOpen(training)) return { type: 'enter', to: '/stairs' };
    return { type: 'locked', text: `${STAIRS_OPEN_AFTER_DAN}단을 마스터하면 열려요` };
  }
  const dan = door.dan;
  if (dan === undefined) return { type: 'shop' };
  if (isTrainingOpen(training, dan)) return { type: 'enter', to: `/field/training/${dan}` };
  return { type: 'locked', text: lockedText(dan) };
}

/** 문 앞 길 칸 (문 바로 아래) — 건물에서 돌아오면 여기에 선다 */
export function doorFront(_map: FieldMap, door: FieldDoor): Pos {
  return { x: door.pos.x, y: door.pos.y + 1 };
}

/**
 * 마을 건물 문에 부딪혔을 때 할 일 — 상점 팝업 / 체육관 지도로 / 계단 화면 / 잠김 안내. React 없이 순수 계산만.
 */
import type { FieldDoor, FieldMap, Pos } from './movement';
import { isStairsOpen, type TrainingData } from './training';
import { STAIRS_OPEN_AFTER_DAN } from './tuning';

export type DoorAction = { type: 'shop' } | { type: 'gym' } | { type: 'enter'; to: string } | { type: 'locked'; text: string };

export function doorAction(door: FieldDoor, training: TrainingData): DoorAction {
  if (door.kind === 'shop') return { type: 'shop' };
  // 체육관은 늘 열려 있다: 마을 지도에서 체육관 지도로 걸어 들어간다 (travelTo)
  if (door.kind === 'gym') return { type: 'gym' };
  if (isStairsOpen(training)) return { type: 'enter', to: '/stairs' };
  return { type: 'locked', text: `${STAIRS_OPEN_AFTER_DAN}단을 마스터하면 열려요` };
}

/** 문 앞 길 칸 (문 바로 아래) — 건물에서 돌아오면 여기에 선다 */
export function doorFront(_map: FieldMap, door: FieldDoor): Pos {
  return { x: door.pos.x, y: door.pos.y + 1 };
}

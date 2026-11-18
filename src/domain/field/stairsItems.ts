/**
 * 무한의 계단 아이템 — 계단 위에 놓인 아이템을 밟으면 바로 얻는다 (캡슐 1개 또는 별점수 3개).
 * 아이템 사이는 4~10칸(평균 7칸). 순수 로직 — 화면이 계단을 이어 붙일 때마다 stairsItemSlots로 이어서 놓는다.
 * 수치는 tuning.ts의 STAIRS_ITEM_*.
 */
import { pickOne, randomInt, type Rng } from '../random';
import type { CapsuleType } from './capsules';
import {
  STAIRS_ITEM_GAP_MAX,
  STAIRS_ITEM_GAP_MIN,
  STAIRS_ITEM_LEGEND_CHANCE,
  STAIRS_ITEM_STARS,
  STAIRS_ITEM_STAR_SHARE,
} from './tuning';

export type StairsItem = { kind: 'capsule'; capsule: CapsuleType } | { kind: 'stars'; amount: number };

/** 평범한 캡슐 아이템은 이 셋 중 하나 (황금은 따로 STAIRS_ITEM_LEGEND_CHANCE) */
const PLAIN_CAPSULES: readonly CapsuleType[] = ['meadow', 'waterside', 'desert'];

/** 다음 아이템까지의 계단 수 (4~10 중 무작위) */
export function nextItemGap(rng: Rng): number {
  return randomInt(rng, STAIRS_ITEM_GAP_MIN, STAIRS_ITEM_GAP_MAX);
}

/** 아이템 하나 고르기. 별점수가 꺼져 있으면 늘 캡슐 (별 아이템은 안 나온다) */
export function pickStairsItem(rng: Rng, starsEnabled: boolean): StairsItem {
  if (starsEnabled && rng() < STAIRS_ITEM_STAR_SHARE) return { kind: 'stars', amount: STAIRS_ITEM_STARS };
  if (rng() < STAIRS_ITEM_LEGEND_CHANCE) return { kind: 'capsule', capsule: 'legend' };
  return { kind: 'capsule', capsule: pickOne(rng, PLAIN_CAPSULES) };
}

/**
 * fromIndex 칸부터 count칸 안에 아이템을 놓는다. 첫 아이템은 fromIndex + startGap 칸, 그 뒤로 nextItemGap씩 떨어뜨린다.
 * 돌려주는 nextAt은 범위 밖(fromIndex + count 이상)의 다음 아이템 칸 — 이어 붙일 때 startGap = nextAt - 새 fromIndex 로 넘기면 간격이 끊기지 않는다.
 * 처음에는 fromIndex 0, startGap = nextItemGap(rng) 이라 첫 아이템은 4칸 이후다.
 */
export function stairsItemSlots(
  fromIndex: number,
  count: number,
  startGap: number,
  rng: Rng,
  starsEnabled: boolean,
): { items: Record<number, StairsItem>; nextAt: number } {
  const items: Record<number, StairsItem> = {};
  const end = fromIndex + count;
  let at = fromIndex + startGap;
  while (at < end) {
    items[at] = pickStairsItem(rng, starsEnabled);
    at += nextItemGap(rng);
  }
  return { items, nextAt: at };
}

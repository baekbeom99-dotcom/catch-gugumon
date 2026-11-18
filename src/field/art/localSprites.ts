/**
 * 이 PC에서만 쓰는 테스트 그림 (SpriteCollab 등). 이미지는 저장소에 넣지 않는다(.gitignore) —
 * src/field/art/creatures/pmd/ 에 파일이 있을 때만 등록되고, 없으면 LOCAL_SPRITES는 빈 객체라 기존 SVG 그림 그대로다.
 * 파일 만들기: node scripts/cut-sprites.mjs  (<번호>-front/back/idle/walk/hurt/sleep.png, manifest.json)
 * manifest.json이 없으면 시트 없이 정지 그림(front/back)만 쓴다.
 */
import type { SpeciesId } from '../../domain/field/creatures';
import { bodyFill } from './spriteSheet';
import type { AttackAnim, ImageArtEntry, SheetAnim, StageArt, StageSheets } from './creatureArt';

/**
 * 종 → SpriteCollab 번호 (진화 1·2·3단계). 번호가 모자라는 계열은 마지막 번호를 되풀이한다.
 * 한 종의 어느 번호든 그림 파일이 없으면 그 종은 SVG 그림으로 돌아간다.
 * 이 표만 바꾸면 다른 번호도 쓴다 (자르는 법: node scripts/cut-sprites.mjs, 기본 46개 — 0010~0012·0016~0018·0023·0024·0050~0059·0132는 잘라만 둠).
 * 몸 크기는 종마다 달라 fill을 쓰지 않아도 단계마다 manifest의 몸 높이로 자동 맞춘다 (spriteSheet.bodyFill). fill·foot은 종 전체에 덧붙이는 선택 보정.
 */
export const LOCAL_SPRITE_MAP: Partial<Record<SpeciesId, { ids: string[]; fill?: number; foot?: number }>> = {
  // 49종으로 바꾸며 비워 둠 — 새 그림(C:\Antigravity\sprite\sprites\<번호>)은 다음 작업에서 연결한다
};

type Files = Record<string, string>;

/** manifest.json 한 번호의 모양 (cut-sprites.mjs 출력) */
export interface SheetManifestEntry {
  side: number;
  baseSide: number;
  foot: number;
  /** Idle 앞·뒤 첫 프레임의 몸 높이·너비(원본 픽셀) — 몸 크기 맞춤에 쓴다 */
  bodyH?: number;
  bodyW?: number;
  idle?: { ms: number[]; rows: number };
  walk?: { ms: number[]; rows: number };
  hurt?: { ms: number[]; rows: number };
  sleep?: { ms: number[]; rows: number };
  attack?: { ms: number[]; rows: number; side: number; ax: number; ay: number; ix: number; iy: number };
}
export type SheetManifest = Record<string, SheetManifestEntry>;

/** 정지 그림(앞·뒤)의 발끝 높이: 발끝이 아래 여백 1픽셀 위 */
function stillFoot(m?: SheetManifestEntry): number | undefined {
  return m && m.baseSide > 1 ? (m.baseSide - 1) / m.baseSide : undefined;
}

/** 파일 주소 표(경로 → url)로 종별 등록을 만든다. 앞모습이 없는 번호는 건너뛰어, 파일이 없으면 빈 객체 */
export function buildLocalSprites(files: Files, map = LOCAL_SPRITE_MAP, manifest: SheetManifest = {}): Partial<Record<SpeciesId, ImageArtEntry>> {
  const find = (id: string, view: 'front' | 'back' | 'idle' | 'walk' | 'hurt' | 'sleep' | 'attack') => {
    const key = Object.keys(files).find((k) => k.endsWith(`/${id}-${view}.png`));
    return key ? files[key] : undefined;
  };
  const sheetsOf = (id: string): StageSheets | undefined => {
    const m = manifest[id];
    if (!m || !m.baseSide || !m.side) return undefined;
    const anim = (k: 'idle' | 'walk' | 'hurt' | 'sleep'): SheetAnim | undefined => {
      const url = find(id, k);
      const a = m[k];
      return url && a && a.ms.length > 0 ? { url, ms: a.ms, rows: a.rows } : undefined;
    };
    const attackOf = (): AttackAnim | undefined => {
      const url = find(id, 'attack');
      const a = m.attack;
      return url && a && a.ms.length > 0 && a.side > 0 ? { url, ms: a.ms, rows: a.rows, side: a.side, ax: a.ax, ay: a.ay, ix: a.ix, iy: a.iy } : undefined;
    };
    const idle = anim('idle');
    const walk = anim('walk');
    if (!idle || !walk) return undefined;
    return { side: m.side, scale: m.side / m.baseSide, foot: m.foot, fill: bodyFill(m), idle, walk, hurt: anim('hurt'), sleep: anim('sleep'), attack: attackOf() };
  };
  const out: Partial<Record<SpeciesId, ImageArtEntry>> = {};
  for (const [species, cfg] of Object.entries(map) as [SpeciesId, NonNullable<(typeof map)[SpeciesId]>][]) {
    const arts: StageArt[] = [];
    for (const id of cfg.ids) {
      const front = find(id, 'front');
      if (!front) break;
      const sheets = sheetsOf(id);
      arts.push({ front, back: find(id, 'back'), fill: bodyFill(manifest[id] ?? {}), ...(sheets ? { sheets } : {}) });
    }
    if (arts.length === 0 || arts.length < cfg.ids.length) continue;
    const at = (i: number) => arts[Math.min(i, arts.length - 1)];
    out[species] = { front: arts[0].front, back: arts[0].back, stages: [at(0), at(1), at(2)], fill: cfg.fill, foot: cfg.foot ?? stillFoot(manifest[cfg.ids[0]]) };
  }
  return out;
}

const FILES = import.meta.glob('./creatures/pmd/*.png', { eager: true, query: '?url', import: 'default' }) as Files;

const MANIFEST_FILES = import.meta.glob('./creatures/pmd/manifest.json', { eager: true, import: 'default' }) as Record<string, SheetManifest>;
const MANIFEST: SheetManifest = Object.values(MANIFEST_FILES)[0] ?? {};

export const LOCAL_SPRITES = buildLocalSprites(FILES, LOCAL_SPRITE_MAP, MANIFEST);

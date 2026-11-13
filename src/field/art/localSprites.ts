/**
 * 이 PC에서만 쓰는 테스트 그림 (SpriteCollab 등). 이미지는 저장소에 넣지 않는다(.gitignore) —
 * src/field/art/creatures/pmd/ 에 파일이 있을 때만 등록되고, 없으면 LOCAL_SPRITES는 빈 객체라 기존 SVG 그림 그대로다.
 * 파일 만들기: node scripts/cut-sprites.mjs  (<번호>-front.png, <번호>-back.png)
 */
import type { SpeciesId } from '../../domain/field/creatures';
import type { ImageArtEntry, StageArt } from './creatureArt';

/** 종 → 번호 (진화 1·2·3단계). 단계가 부족하면 마지막 번호를 되풀이 */
export const LOCAL_SPRITE_MAP: Partial<Record<SpeciesId, { ids: string[]; fill?: number; foot?: number }>> = {
  cloud: { ids: ['0001', '0002', '0003'], fill: 1.0, foot: 0.98 },
  ghost: { ids: ['0004'], fill: 1.1, foot: 0.98 },
};

type Files = Record<string, string>;

/** 파일 주소 표(경로 → url)로 종별 등록을 만든다. 앞모습이 없는 번호는 건너뛰어, 파일이 없으면 빈 객체 */
export function buildLocalSprites(files: Files, map = LOCAL_SPRITE_MAP): Partial<Record<SpeciesId, ImageArtEntry>> {
  const find = (id: string, view: 'front' | 'back') => {
    const key = Object.keys(files).find((k) => k.endsWith(`/${id}-${view}.png`));
    return key ? files[key] : undefined;
  };
  const out: Partial<Record<SpeciesId, ImageArtEntry>> = {};
  for (const [species, cfg] of Object.entries(map) as [SpeciesId, NonNullable<(typeof map)[SpeciesId]>][]) {
    const arts: StageArt[] = [];
    for (const id of cfg.ids) {
      const front = find(id, 'front');
      if (!front) break;
      arts.push({ front, back: find(id, 'back') });
    }
    if (arts.length === 0 || arts.length < cfg.ids.length) continue;
    const at = (i: number) => arts[Math.min(i, arts.length - 1)];
    out[species] = { front: arts[0].front, back: arts[0].back, stages: [at(0), at(1), at(2)], fill: cfg.fill, foot: cfg.foot };
  }
  return out;
}

const FILES = import.meta.glob('./creatures/pmd/*.png', { eager: true, query: '?url', import: 'default' }) as Files;

export const LOCAL_SPRITES = buildLocalSprites(FILES);

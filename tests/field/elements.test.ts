import { describe, expect, it } from 'vitest';
import * as core from 'pixelfx';
import { ELEMENT_FX, ELEMENT_NAMES, MAIN_ELEMENT, SPECIAL_FX, STRONG_AGAINST, STRONG_FX, SUB_ELEMENT, elementOf, matchup, subElementOf, type Element } from '../../src/domain/field/elements';
import { SKILLS, seatedDef } from '../../src/domain/field/skills';
import { skillFxName } from '../../src/field/battle/skillUse';
import { SPECIES } from '../../src/domain/field/creatures';
import { EFFECTS, FX_NAMES, FX_TOTAL_MAX_MS, TRAVEL_MS_MAX, TRAVEL_MS_MIN, goldPalette, paletteLength, type FxSpec } from '../../src/field/fx/effects';
import { WILD_HIT_ANIM_MS } from '../../src/domain/field/tuning';

describe('속성 표', () => {
  it('종 11개 모두 속성이 있고 레전드는 기본 종과 같다', () => {
    expect(SPECIES).toHaveLength(11);
    for (const s of SPECIES) expect(ELEMENT_NAMES[elementOf(s.id)]).toBeTruthy();
    expect(elementOf('legend-horn')).toBe(elementOf('horn'));
    expect(elementOf('legend-fluff')).toBe('light');
    expect(elementOf('ghost')).toBe('fire');
  });

  it('설계서 11절: 종마다 속성', () => {
    expect(
      Object.fromEntries((['cloud', 'mushroom', 'fluff', 'jelly', 'horn', 'antenna', 'pebble', 'ghost'] as const).map((k) => [k, elementOf(k)])),
    ).toEqual({ cloud: 'grass', mushroom: 'poison', fluff: 'light', jelly: 'water', horn: 'water', antenna: 'thunder', pebble: 'earth', ghost: 'fire' });
    expect(Object.values(ELEMENT_NAMES)).toEqual(['풀', '독', '빛', '물', '번개', '땅', '불']);
  });

  it('속성마다 평소 효과 4칸(주 3 + 부 1)과 강력 효과 4칸, 모두 EFFECTS에 있다', () => {
    for (const table of [ELEMENT_FX, STRONG_FX]) {
      for (const fx of Object.values(table)) {
        expect(fx).toHaveLength(4);
        for (const n of fx) expect(FX_NAMES).toContain(n);
      }
    }
    expect(ELEMENT_FX.fire.slice(0, 3)).toEqual(['fireball', 'fire-breath', 'flame-pillar']);
  });

  it('주 3칸은 예전 효과 그대로', () => {
    const main = Object.fromEntries(Object.entries(ELEMENT_FX).map(([k, v]) => [k, v.slice(0, 3)]));
    expect(main).toEqual({
      grass: ['vine-whip', 'thorns', 'leaf-storm'],
      poison: ['acid-splash', 'spore-burst', 'poison-cloud'],
      light: ['feather-burst', 'smite', 'sunburst'],
      water: ['splash', 'water-jet', 'wave-crash'],
      thunder: ['zap-hit', 'chain-lightning', 'lightning-strike'],
      earth: ['earth-spike', 'boulder', 'quake'],
      fire: ['fireball', 'fire-breath', 'flame-pillar'],
    });
  });

  it('특수 기술 효과 5종이 모두 EFFECTS에 있다', () => {
    expect(Object.keys(SPECIAL_FX).sort()).toEqual(['calm', 'charge', 'clue', 'guard', 'heal', 'stun']);
    for (const n of Object.values(SPECIAL_FX)) expect(FX_NAMES).toContain(n);
  });

  it('skillFxName: 55개 기술(복사해 부속성 자리에 앉은 모습 포함) 모두 ELEMENT_FX의 4칸 안 — 윗단계여도 강력 효과(STRONG_FX)는 안 쓴다', () => {
    expect(SKILLS).toHaveLength(55);
    const strong = new Set(Object.values(STRONG_FX).flat());
    for (const def of SKILLS) {
      // 복사: 다른 종(구름몬·버섯몬)에게 앉힌 모습도 원래 종의 속성·fxIndex 그대로
      const views = [def, seatedDef(def, def.species === 'cloud' ? 'mushroom' : 'cloud')];
      for (const view of views) {
        for (const upper of [false, true]) {
          const name = skillFxName(view, upper);
          expect(FX_NAMES).toContain(name);
          expect(strong.has(name)).toBe(false);
          if (def.special) expect(name).toBe(SPECIAL_FX[def.special]);
          else {
            expect(def.fxIndex).toBeGreaterThanOrEqual(0);
            expect(def.fxIndex).toBeLessThanOrEqual(3);
            expect(name).toBe(ELEMENT_FX[def.element!][def.fxIndex!]);
          }
        }
      }
    }
  });
});

// 강력 28개(STRONG_FX)는 지금 안 쓰지만 보관하므로 같은 규칙을 지킨다
const ELEMENT_EFFECTS = [...Object.values(ELEMENT_FX).flat(), ...Object.values(STRONG_FX).flat(), ...Object.values(SPECIAL_FX)];

describe('기술 효과 62개', () => {
  it('평소 28 + 강력(보관) 28 + 특수 6(스턴 포함) = 62개, 서로 겹치지 않고 기존 3개와 합쳐 65개', () => {
    expect(ELEMENT_EFFECTS).toHaveLength(62);
    expect(new Set(ELEMENT_EFFECTS).size).toBe(62);
    expect(FX_NAMES).toHaveLength(65);
    expect(SPECIAL_FX.stun).toBe('stunned');
  });

  it.each(ELEMENT_EFFECTS)('%s: 실제 트는 시간이 명중 연출(0.6초) 안이다', async (name) => {
    const spec: FxSpec = EFFECTS[name];
    expect(spec.screen).toBe(false);
    expect(spec.hold).toBe(false);
    expect(spec.note.length).toBeGreaterThan(0);
    // 같은 효과를 내 공격(명중 0.6초)과 적 공격(0.7초)에 쓰므로 짧은 쪽에 맞춘다
    const mod = await spec.load();
    const real = Math.min(spec.until ?? Infinity, mod.meta?.duration ?? Infinity) / spec.speed;
    // 날아가는 효과는 날아가는 시간까지 합쳐서 0.6초 안이다
    expect(real + (spec.travelMs ?? 0) / 1000).toBeLessThanOrEqual(WILD_HIT_ANIM_MS / 1000 + 0.001);
  });

  it.each(ELEMENT_EFFECTS)('%s: playFx처럼 끝까지 돌려도 던지지 않고, 도중에 그림이 나온다', async (name) => {
    const spec: FxSpec = EFFECTS[name];
    const mod = await spec.load();
    const W = 120;
    const H = 100;
    const fx = core.createFx(mod, { ...spec.options, x: 40, y: 80 });
    const frame = core.createFrame(W, H);
    const until = spec.until ?? Infinity;
    const dt = Math.min(0.05, 1 / 60) * spec.speed; // playFx와 같은 한 걸음
    const CAP = 120;
    let drawn = 0;
    let frames = 0;
    let finished = false;
    while (frames < CAP) {
      fx.update(dt);
      core.clearFrame(frame);
      fx.draw(frame);
      for (const c of frame.color) if (c >>> 24) { drawn++; break; }
      frames++;
      if (fx.t >= until || fx.done()) { finished = true; break; }
    }
    expect(finished).toBe(true); // 상한 프레임 안에 끝난다
    expect(fx.t).toBeGreaterThanOrEqual(Math.min(until, mod.meta?.duration ?? Infinity) - 1e-9);
    expect(drawn).toBeGreaterThan(0); // 끝날 때까지 한 번은 화소가 그려진다
    // 중간 시점(절반)에서도 비어 있지 않다
    const half = core.createFx(mod, { ...spec.options, x: 40, y: 80 });
    const target = Math.min(until, mod.meta?.duration ?? Infinity) / 2;
    while (half.t < target) half.update(dt);
    core.clearFrame(frame);
    half.draw(frame);
    let px = 0;
    for (const c of frame.color) if (c >>> 24) px++;
    expect(px).toBeGreaterThan(0);
  });
});

describe('황금 팔레트', () => {
  it.each(ELEMENT_EFFECTS)('%s: 금색 팔레트 길이가 효과의 기본 팔레트와 같다', async (name) => {
    const mod = await EFFECTS[name].load();
    const len = paletteLength(mod);
    expect(len).toBeGreaterThanOrEqual(6);
    expect(len).toBeLessThanOrEqual(9);
    // 팔레트 옵션이 실제로 있어야 황금 색이 입혀진다
    expect(Array.isArray((mod.meta?.options as { palette?: unknown } | undefined)?.palette)).toBe(true);
    const gold = goldPalette(len);
    expect(gold).toHaveLength(len);
    // 어두운 금에서 흰빛으로, 색 값은 모두 #rrggbb
    for (const c of gold) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(gold[len - 1]).toBe('#ffffff');
    // 금색 팔레트로 만들어도 던지지 않고 그려진다
    const fx = core.createFx(mod, { ...(EFFECTS[name] as FxSpec).options, palette: gold, x: 40, y: 80 });
    const frame = core.createFrame(120, 100);
    fx.update(0.1);
    fx.draw(frame);
  });
});


describe('주·부 속성과 상성', () => {
  it('11종의 주·부 속성 (설계서 2-1 표)', () => {
    expect(MAIN_ELEMENT).toEqual({
      cloud: 'grass', mushroom: 'poison', fluff: 'light', jelly: 'water', horn: 'water', antenna: 'thunder',
      pebble: 'earth', ghost: 'fire', 'legend-fluff': 'light', 'legend-horn': 'water', 'legend-ghost': 'fire',
    });
    expect(SUB_ELEMENT).toEqual({
      cloud: 'light', mushroom: 'grass', fluff: 'earth', jelly: 'poison', horn: 'earth', antenna: 'water',
      pebble: 'fire', ghost: 'thunder', 'legend-fluff': 'fire', 'legend-horn': 'thunder', 'legend-ghost': 'light',
    });
    for (const s of SPECIES) {
      expect(elementOf(s.id)).toBe(MAIN_ELEMENT[s.id]);
      expect(subElementOf(s.id)).toBe(SUB_ELEMENT[s.id]);
      expect(subElementOf(s.id)).not.toBe(elementOf(s.id));
    }
  });

  it('matchup 49쌍 전수', () => {
    const els = Object.keys(ELEMENT_NAMES) as Element[];
    for (const a of els) {
      for (const d of els) {
        const up = STRONG_AGAINST[a].includes(d);
        const down = STRONG_AGAINST[d].includes(a);
        expect(matchup(a, d)).toBe(up && !down ? 1 : down && !up ? -1 : 0);
      }
    }
    expect(matchup('poison', 'light')).toBe(0);
    expect(matchup('light', 'poison')).toBe(0);
    expect(matchup('fire', 'fire')).toBe(0);
    expect(matchup('fire', 'grass')).toBe(1);
    expect(matchup('grass', 'fire')).toBe(-1);
  });

  it('상성표 고정', () => {
    expect(STRONG_AGAINST).toEqual({
      fire: ['grass', 'poison'], water: ['fire', 'earth'], grass: ['water', 'earth'], thunder: ['water', 'poison'],
      earth: ['thunder', 'fire'], poison: ['grass', 'light'], light: ['poison', 'thunder'],
    });
  });
});

// 발사체 모양 효과는 공격하는 구구몬에서 맞는 구구몬까지 날아간다 (Task 20)
// 눈으로 확인해 정한 날아가는 효과 (물줄기·이어지는 번개는 화면을 가로지르는 줄, 보라 구슬은 받침대째 서는 그림, 운석은 스스로 떨어져서 날아가기가 어색해 burst로 둠)
const TRAVELERS = ['fireball', 'ball-lightning', 'boulder', 'vine-whip'];

describe('날아가는 효과(motion·travelMs)', () => {
  it('날아가는 효과는 정해 둔 네 개뿐이다', () => {
    const now = FX_NAMES.filter((n) => (EFFECTS as Record<string, FxSpec>)[n].motion === 'travel');
    expect([...now].sort()).toEqual([...TRAVELERS].sort());
  });

  it.each(FX_NAMES)('%s: travel이면 travelMs·구슬 색이 있고 이동+터짐이 0.6초 이하, burst면 travelMs가 없다', async (name) => {
    const spec: FxSpec = EFFECTS[name];
    if (spec.motion === 'travel') {
      expect(spec.travelMs).toBeGreaterThanOrEqual(TRAVEL_MS_MIN);
      expect(spec.travelMs).toBeLessThanOrEqual(TRAVEL_MS_MAX);
      expect(spec.orb).toHaveLength(2);
      const mod = await spec.load();
      const burst = (Math.min(spec.until ?? Infinity, mod.meta?.duration ?? Infinity) / spec.speed) * 1000;
      expect(burst + spec.travelMs!).toBeLessThanOrEqual(FX_TOTAL_MAX_MS + 1);
    } else if (spec.motion === 'beam') {
      expect(spec.travelMs).toBeGreaterThan(0);
      expect(spec.beam!.reach).toBeGreaterThan(40);
      const mod = await spec.load();
      const real = (Math.min(spec.until ?? Infinity, mod.meta?.duration ?? Infinity) / spec.speed) * 1000;
      expect(real + spec.travelMs!).toBeLessThanOrEqual(FX_TOTAL_MAX_MS + 1);
    } else {
      expect(spec.travelMs).toBeUndefined();
      expect(spec.orb).toBeUndefined();
      expect(spec.beam).toBeUndefined();
    }
  });

  it('줄기 효과(입에서 뻗는 물줄기·번개줄기·불 뿜기)는 정해 둔 네 개뿐이다', () => {
    const now = FX_NAMES.filter((n) => (EFFECTS as Record<string, FxSpec>)[n].motion === 'beam');
    expect([...now].sort()).toEqual(['chain-lightning', 'fire-breath', 'flamethrower', 'water-jet']);
  });

  it('특수 기술·전환·명중·잡기, 바닥에서 솟는 효과는 날아가지 않는다', () => {
    const still = [...Object.values(SPECIAL_FX), 'enter', 'hit', 'catch', 'thorns', 'earth-spike', 'quake', 'splash', 'wave-crash', 'lightning-strike', 'flame-pillar', 'smite'] as const;
    for (const n of still) expect((EFFECTS as Record<string, FxSpec>)[n].motion ?? 'burst').toBe('burst');
  });
});

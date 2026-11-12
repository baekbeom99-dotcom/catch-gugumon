/**
 * 전투·필드 효과 목록 — 효과를 더하거나 바꿀 때는 여기만 고친다.
 *
 * 효과 하나 더하기:
 *   1. 아래 EFFECTS에 이름: { load, speed, hold, screen, ... } 한 줄 (pixelfx 효과 경로는 node_modules/pixelfx/fx/ 아래)
 *   2. 틀 곳에서 playFx(canvas, '이름', 자리) — 미리 받으려면 preloadFx('이름')
 *   3. #/dev/field 화면(개발 서버)에서 버튼을 눌러 바로 볼 수 있다
 * 효과는 보기만 하는 것이라 게임 시간·규칙에 손대지 않는다.
 */
import type { FxModule } from 'pixelfx';

/** 전환 효과의 그림 크기 (pixelfx 전환 효과는 320×180 화면 기준) */
export const TRANSITION_W = 320;
export const TRANSITION_H = 180;

export interface FxSpec {
  /** 효과 코드 (처음 쓸 때 따로 내려받는다 — 첫 화면 묶음에 넣지 않음) */
  load: () => Promise<FxModule>;
  /** 효과 시간 중 여기까지만 튼다 (초). 없으면 끝까지 */
  until?: number;
  /** 빠르기 배율 */
  speed: number;
  /** 다 틀고 마지막 장면을 남겨 둘지 (화면을 덮은 채로 넘어갈 때) */
  hold: boolean;
  /** 전환 효과는 화면 전체 크기 그림 */
  screen: boolean;
  /** pixelfx 효과에 넘기는 옵션 (색·뒤집기 등) */
  options?: Record<string, unknown>;
  /**
   * 효과가 그려 낸 화소의 무게중심 (효과 원점 기준, 효과 화소 단위, 안 뒤집었을 때).
   * playFx의 자리 `at`이 이 중심을 놓을 화면 좌표다 — 원점 = at − center × FX_PIXEL (mirror면 dx를 뒤집음). 없으면 원점이 곧 중심.
   * 값은 tests/field/fxMeasure.ts로 잰다(효과를 바꾸면 다시 재서 적는다). 몬스터 밖에 걸리면 손으로 조정한다.
   */
  center?: { dx: number; dy: number };
  /** true면 뒤집어 틀지 않는다 (글자가 들어 있는 효과 — 뒤집으면 글자가 거꾸로 보인다) */
  noMirror?: boolean;
  /** 개발 화면에 보이는 설명 */
  note: string;
}

/** 황금 구구몬이 쏠 때의 금색 팔레트 — 효과마다 기본 색 개수(6·8·9)가 달라 그 길이에 맞춰 만든다 (어두운 금 → 흰빛) */
const GOLD_RAMP = ['#3a1d05', '#6b3a0c', '#a8620f', '#e0961c', '#ffcf3a', '#ffe680', '#fff6cf', '#ffffff'];
export function goldPalette(length: number): string[] {
  if (length <= 1) return [GOLD_RAMP[4]];
  return Array.from({ length }, (_, i) => GOLD_RAMP[Math.round((i / (length - 1)) * (GOLD_RAMP.length - 1))]);
}

/** 효과 모듈의 기본 팔레트 색 개수 (없으면 8) */
export function paletteLength(mod: FxModule): number {
  const p = (mod.meta?.options as { palette?: unknown[] } | undefined)?.palette;
  return Array.isArray(p) && p.length > 0 ? p.length : 8;
}

export const EFFECTS = {
  // 별 모양 조리개가 돌며 닫힌다: 닫히는 데까지(약 1초)를 만남 번쩍임 시간(0.8초)에 맞춰 조금 빨리
  enter: {
    load: () => import('pixelfx/fx/transitions/star-iris'),
    until: 1.0,
    speed: 1.25,
    hold: true,
    screen: true,
    options: { focus: [TRANSITION_W / 2, TRANSITION_H / 2], color: '#1b1030' },
    note: '풀숲에서 만났을 때 전투로 넘어가는 별 조리개',
  },
  // 정답 기술이 맞는 순간의 불꽃 (0.5초, 기술 연출 0.6초 안에 끝남). 야생 구구몬이 오른쪽 끝에 있어 불꽃을 왼쪽으로 뒤집는다
  hit: {
    load: () => import('pixelfx/fx/impacts/hit-spark'),
    speed: 1,
    hold: false,
    screen: false,
    options: { flip: true },
    note: '정답 기술이 야생 구구몬에 맞을 때',
  },
  // 캡슐에 잡혔을 때 반짝 터지는 별 (1.35초, 잡았다 글 1.5초 안에 끝남)
  catch: {
    load: () => import('pixelfx/fx/pickups/collect-burst'),
    speed: 1,
    hold: false,
    screen: false,
    options: { palette: ['#3a1d05', '#6b3a0c', '#a8620f', '#e0961c', '#ffcf3a', '#ffe680', '#fff6cf', '#ffffff'] },
    note: '캡슐로 잡았을 때',
  },
  // ---- 속성별 기술 효과 21개 (설계서 11절, 속성·순서는 domain/field/elements.ts의 ELEMENT_FX 앞 3칸) ----
  // 전부 캔버스 한 칸 크기 효과. 전투 연출 시간(내 공격 명중 0.6초·적 공격 0.7초 — 같은 효과를 양쪽에 쓰므로 짧은 0.6초에 맞춤) 안에 끝나도록
  // 긴 효과는 until로 앞부분만 자르고 speed로 빠르게 튼다 (실제로 트는 시간 = until ÷ speed ≤ 0.6초).
  // 자리 `at`은 효과의 무게중심(center)을 놓을 곳이라, 맞는 쪽 몬스터 그림 한가운데를 주면 효과 중심에 몬스터 몸이 온다. 방향 있는 효과는 왼쪽에서 오른쪽으로 날아간다.
  'vine-whip': {
    center: { dx: 13.0, dy: -33.7 },
    load: () => import('pixelfx/fx/nature/vine-whip'),
    until: 0.9,
    speed: 1.6,
    hold: false,
    screen: false,
    note: '풀 1번 — 덩굴 휘두르기 (왼쪽에서 오른쪽으로 뻗음, 1.4초 중 0.9초까지 빠르게)',
  },
  thorns: {
    center: { dx: 72.5, dy: -14.9 },
    load: () => import('pixelfx/fx/nature/thorns'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '풀 2번 — 바닥에서 솟는 가시 (2.4초 중 1.2초까지 빠르게, 땅에 붙는 효과)',
  },
  'leaf-storm': {
    center: { dx: -0.5, dy: -38.8 },
    load: () => import('pixelfx/fx/nature/leaf-storm'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '풀 3번 — 잎사귀 회오리 (반복 효과라 1.2초까지만 빠르게)',
  },
  'acid-splash': {
    center: { dx: -1.6, dy: -10.9 },
    load: () => import('pixelfx/fx/nature/acid-splash'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '독 1번 — 산성 방울 튀김 (2.8초 중 1.2초까지 빠르게, 땅에 붙는 효과)',
  },
  'spore-burst': {
    center: { dx: 0.4, dy: -38.5 },
    load: () => import('pixelfx/fx/nature/spore-burst'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '독 2번 — 버섯 포자 터짐 (3.2초 중 1.8초까지 3배속, 땅에 붙는 효과)',
  },
  'poison-cloud': {
    center: { dx: -0.4, dy: -12.7 },
    load: () => import('pixelfx/fx/nature/poison-cloud'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '독 3번 — 독구름 (반복 효과라 1.5초까지 2.5배속, 땅에 붙는 효과)',
  },
  'feather-burst': {
    center: { dx: -1.2, dy: 7.2 },
    load: () => import('pixelfx/fx/holy/feather-burst'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '빛 1번 — 깃털 터짐 (3초 중 1.5초까지 2.5배속)',
  },
  smite: {
    center: { dx: -2.7, dy: -17.9 },
    load: () => import('pixelfx/fx/holy/smite'),
    until: 1.3,
    speed: 2.3,
    hold: false,
    screen: false,
    note: '빛 2번 — 하늘에서 내리치는 빛 (2.8초 중 1.3초까지 빠르게, 땅에 붙는 효과)',
  },
  sunburst: {
    center: { dx: -0.8, dy: -0.4 },
    load: () => import('pixelfx/fx/holy/sunburst'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '빛 3번 — 햇살 폭발 (반복 효과라 1.5초까지 2.5배속)',
  },
  splash: {
    center: { dx: -3.9, dy: -14.1 },
    load: () => import('pixelfx/fx/water/splash'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '물 1번 — 물 튀김 (2.5초 중 1.2초까지 빠르게, 땅에 붙는 효과)',
  },
  'water-jet': {
    center: { dx: 88.3, dy: 8.7 },
    load: () => import('pixelfx/fx/water/water-jet'),
    until: 0.6,
    speed: 1,
    hold: false,
    screen: false,
    note: '물 2번 — 물줄기 쏘기 (왼쪽에서 오른쪽으로, 반복 효과라 0.6초까지만)',
  },
  'wave-crash': {
    center: { dx: -10.5, dy: -17.2 },
    load: () => import('pixelfx/fx/water/wave-crash'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '물 3번 — 큰 파도 (3.2초 중 1.5초까지 2.5배속, 땅에 붙는 효과)',
  },
  'zap-hit': {
    center: { dx: 18.7, dy: -5.6 },
    load: () => import('pixelfx/fx/lightning/zap-hit'),
    speed: 1.5,
    hold: false,
    screen: false,
    options: { flip: true },
    note: '번개 1번 — 찌릿 전기 (0.9초 전부 1.5배속, 맞는 쪽 방향으로 뒤집음)',
  },
  'chain-lightning': {
    center: { dx: 92.5, dy: -21.7 },
    load: () => import('pixelfx/fx/lightning/chain-lightning'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '번개 2번 — 이어지는 번개 (1.8초 중 1.2초까지 빠르게, 왼쪽에서 오른쪽으로)',
  },
  'lightning-strike': {
    center: { dx: 0.0, dy: -90.8 },
    load: () => import('pixelfx/fx/lightning/lightning-strike'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '번개 3번 — 벼락 (3초 중 1.5초까지 2.5배속, 땅에 붙는 효과)',
  },
  'earth-spike': {
    center: { dx: -4.7, dy: -19.6 },
    load: () => import('pixelfx/fx/nature/earth-spike'),
    until: 1.5,
    speed: 2.6,
    hold: false,
    screen: false,
    note: '땅 1번 — 솟는 바위 가시 (3.4초 중 1.5초까지 빠르게, 땅에 붙는 효과)',
  },
  boulder: {
    center: { dx: 100.5, dy: -25.3 },
    load: () => import('pixelfx/fx/nature/boulder'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '땅 2번 — 굴러가는 큰 바위 (2.3초 중 1.5초까지 2.5배속, 왼쪽에서 오른쪽으로)',
  },
  quake: {
    center: { dx: 0.3, dy: -18.7 },
    load: () => import('pixelfx/fx/nature/quake'),
    until: 1.5,
    speed: 2.6,
    hold: false,
    screen: false,
    note: '땅 3번 — 땅 흔들림 (3.1초 중 1.5초까지 빠르게, 땅에 붙는 효과)',
  },
  fireball: {
    center: { dx: -43.1, dy: -4.4 },
    load: () => import('pixelfx/fx/fire/fireball'),
    until: 0.6,
    speed: 1,
    hold: false,
    screen: false,
    note: '불 1번 — 불덩이 (왼쪽에서 오른쪽으로, 반복 효과라 0.6초까지만)',
  },
  'fire-breath': {
    center: { dx: 79.3, dy: -20.6 },
    load: () => import('pixelfx/fx/fire/fire-breath'),
    until: 0.7,
    speed: 1.2,
    hold: false,
    screen: false,
    note: '불 2번 — 불 뿜기 (왼쪽에서 오른쪽으로, 반복 효과라 0.7초까지 1.2배속)',
  },
  'flame-pillar': {
    center: { dx: -1.8, dy: -54.3 },
    load: () => import('pixelfx/fx/fire/flame-pillar'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '불 3번 — 불기둥 (5초 중 1.5초까지 2.5배속, 땅에 붙는 효과)',
  },
  // ---- 부속성 평소 효과 7개 (ELEMENT_FX 4번째 칸) ----
  frog: {
    center: { dx: 0.1, dy: -15.6 },
    load: () => import('pixelfx/fx/critters/frog'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '풀 부속성 — 개구리가 폴짝 (땅에 붙는 작은 효과)',
  },
  slime: {
    center: { dx: -1.2, dy: -20.0 },
    load: () => import('pixelfx/fx/critters/slime'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '독 부속성 — 초록 슬라임이 출렁 (땅에 붙는 작은 효과)',
  },
  halo: {
    center: { dx: 0.5, dy: -45.0 },
    load: () => import('pixelfx/fx/holy/halo'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '빛 부속성 — 천사 고리가 반짝',
  },
  'water-orb': {
    center: { dx: -0.4, dy: -48.8 },
    load: () => import('pixelfx/fx/water/water-orb'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '물 부속성 — 물방울 구슬',
  },
  'ball-lightning': {
    center: { dx: 23.0, dy: -38.3 },
    load: () => import('pixelfx/fx/lightning/ball-lightning'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '번개 부속성 — 번개 공이 지직',
  },
  'heavy-landing': {
    center: { dx: -1.7, dy: -3.7 },
    load: () => import('pixelfx/fx/impacts/heavy-landing'),
    until: 0.9,
    speed: 1.5,
    hold: false,
    screen: false,
    note: '땅 부속성 — 쿵 내려앉는 먼지 고리',
  },
  campfire: {
    center: { dx: -0.1, dy: -35.4 },
    load: () => import('pixelfx/fx/fire/campfire'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '불 부속성 — 모닥불이 활활',
  },
  // ---- 기술마다 전용 강력 효과 28개 (STRONG_FX — 평소보다 크고 화려한 효과, 기술 연출 0.6초 안) ----
  butterfly: {
    center: { dx: 17.4, dy: 0.2 },
    load: () => import('pixelfx/fx/critters/butterfly'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '풀 강력 1 — 파란 나비가 날개짓',
  },
  'healing-bloom': {
    center: { dx: 3.2, dy: -29.3 },
    load: () => import('pixelfx/fx/nature/healing-bloom'),
    until: 2.4,
    speed: 4,
    hold: false,
    screen: false,
    note: '풀 강력 2 — 꽃이 활짝 피며 빛남 (3.3초 중 2.4초까지 4배속)',
  },
  'root-snare': {
    center: { dx: -0.4, dy: -8.3 },
    load: () => import('pixelfx/fx/nature/root-snare'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '풀 강력 3 — 뿌리가 땅에서 감싸 올라옴',
  },
  tornado: {
    center: { dx: -1.5, dy: -72.7 },
    load: () => import('pixelfx/fx/nature/tornado'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '풀 강력 4 — 큰 회오리 (반복 효과라 1.2초까지)',
  },
  'toxic-puddle': {
    center: { dx: -1.0, dy: -13.7 },
    load: () => import('pixelfx/fx/nature/toxic-puddle'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '독 강력 1 — 독 웅덩이 (반복 효과)',
  },
  'shadow-tendrils': {
    center: { dx: 1.9, dy: -22.4 },
    load: () => import('pixelfx/fx/shadow/shadow-tendrils'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '독 강력 2 — 어둠 덩굴이 솟음',
  },
  'grasping-hands': {
    center: { dx: 1.4, dy: -25.5 },
    load: () => import('pixelfx/fx/shadow/grasping-hands'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '독 강력 3 — 땅에서 손들이 뻗어 나옴',
  },
  'void-orb': {
    center: { dx: -1.6, dy: -58.5 },
    load: () => import('pixelfx/fx/shadow/void-orb'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '독 강력 4 — 어둠 구슬이 빙글 (반복 효과)',
  },
  blessing: {
    center: { dx: -0.5, dy: -42.9 },
    load: () => import('pixelfx/fx/holy/blessing'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '빛 강력 1 — 반짝이는 축복 빛기둥 (반복 효과)',
  },
  'star-fall': {
    center: { dx: -17.2, dy: -44.1 },
    load: () => import('pixelfx/fx/arcane/star-fall'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '빛 강력 2 — 별똥별이 쏟아짐',
  },
  'holy-pillar': {
    center: { dx: 1.7, dy: -128.9 },
    load: () => import('pixelfx/fx/holy/holy-pillar'),
    until: 2.4,
    speed: 4,
    hold: false,
    screen: false,
    note: '빛 강력 3 — 하늘에서 쏟아지는 빛줄기 (3.5초 중 2.4초까지 4배속)',
  },
  'crit-hit': {
    center: { dx: 9.2, dy: -29.5 },
    load: () => import('pixelfx/fx/impacts/crit-hit'),
    until: 0.6,
    speed: 1,
    hold: false,
    screen: false,
    options: { palette: goldPalette(8) },
    note: '빛 강력 4 — 금빛으로 번쩍 큰 한 방 (금색 팔레트)',
  },
  bubbles: {
    center: { dx: -0.4, dy: -47.9 },
    load: () => import('pixelfx/fx/water/bubbles'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '물 강력 1 — 물방울이 보글보글 솟음 (반복 효과)',
  },
  waterfall: {
    center: { dx: -3.1, dy: -26.4 },
    load: () => import('pixelfx/fx/water/waterfall'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    options: { ledge: false },
    note: '물 강력 2 — 쏟아지는 폭포 (반복 효과)',
  },
  whirlpool: {
    center: { dx: -0.5, dy: -0.5 },
    load: () => import('pixelfx/fx/water/whirlpool'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '물 강력 3 — 소용돌이 (반복 효과)',
  },
  geyser: {
    center: { dx: 0.2, dy: -44.9 },
    load: () => import('pixelfx/fx/water/geyser'),
    until: 3.6,
    speed: 6,
    hold: false,
    screen: false,
    note: '물 강력 4 — 물기둥이 솟음 (5초 중 3.6초까지 6배속)',
  },
  'plasma-ball': {
    center: { dx: -0.5, dy: -44.3 },
    load: () => import('pixelfx/fx/lightning/plasma-ball'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '번개 강력 1 — 보라 번개 구슬 (반복 효과)',
  },
  'tesla-coil': {
    center: { dx: 10.5, dy: -46.9 },
    load: () => import('pixelfx/fx/lightning/tesla-coil'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '번개 강력 2 — 번개 탑이 지직 (반복 효과)',
  },
  'storm-cloud': {
    center: { dx: -4.0, dy: -87.3 },
    load: () => import('pixelfx/fx/lightning/storm-cloud'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '번개 강력 3 — 먹구름에서 벼락',
  },
  thunderclap: {
    center: { dx: 0.2, dy: -17.6 },
    load: () => import('pixelfx/fx/lightning/thunderclap'),
    until: 0.6,
    speed: 1,
    hold: false,
    screen: false,
    note: '번개 강력 4 — 우르릉 쾅 큰 번개 (1.9초 중 0.6초까지)',
  },
  'smoke-bomb': {
    center: { dx: -18.4, dy: -31.0 },
    load: () => import('pixelfx/fx/explosions/smoke-bomb'),
    until: 2.4,
    speed: 4,
    hold: false,
    screen: false,
    note: '땅 강력 1 — 연막탄이 날아가 흙먼지 구름이 펑 (왼쪽에서 오른쪽으로)',
  },
  'dirt-explosion': {
    center: { dx: -3.5, dy: -45.3 },
    load: () => import('pixelfx/fx/explosions/dirt-explosion'),
    until: 0.9,
    speed: 1.5,
    hold: false,
    screen: false,
    note: '땅 강력 2 — 흙덩이가 펑 터짐',
  },
  'ground-slam': {
    center: { dx: -2.1, dy: -23.0 },
    load: () => import('pixelfx/fx/impacts/ground-slam'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '땅 강력 3 — 땅을 쾅 내려쳐 퍼지는 충격',
  },
  'cartoon-pow': {
    center: { dx: -0.2, dy: -0.5 },
    load: () => import('pixelfx/fx/explosions/cartoon-pow'),
    until: 0.6,
    speed: 1,
    hold: false,
    screen: false,
    noMirror: true,
    note: '땅 강력 4 — 만화 속 "쾅!" 글자가 번쩍',
  },
  flamethrower: {
    center: { dx: 86.3, dy: -11.6 },
    load: () => import('pixelfx/fx/fire/flamethrower'),
    until: 0.9,
    speed: 1.5,
    hold: false,
    screen: false,
    note: '불 강력 1 — 길게 뿜는 불줄기 (왼쪽에서 오른쪽으로, 반복 효과)',
  },
  'fire-ring': {
    center: { dx: 1.1, dy: -6.2 },
    load: () => import('pixelfx/fx/fire/fire-ring'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '불 강력 2 — 불꽃 고리가 퍼져 나감',
  },
  'fire-tornado': {
    center: { dx: -0.7, dy: -70.2 },
    load: () => import('pixelfx/fx/fire/fire-tornado'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '불 강력 3 — 불 회오리 (반복 효과)',
  },
  meteor: {
    center: { dx: -19.7, dy: -57.2 },
    load: () => import('pixelfx/fx/fire/meteor'),
    until: 2,
    speed: 3.4,
    hold: false,
    screen: false,
    note: '불 강력 4 — 불덩이 운석이 떨어져 쾅 (5초 중 2초까지)',
  },
  // ---- 특수 기술 효과 5개 (SPECIAL_FX) ----
  'heal-aoe': {
    center: { dx: -1.2, dy: -5.1 },
    load: () => import('pixelfx/fx/holy/heal-aoe'),
    until: 1.8,
    speed: 3,
    hold: false,
    screen: false,
    note: '특수 회복 — 초록 십자가가 퍼지는 치유',
  },
  'divine-shield': {
    center: { dx: -0.5, dy: -22.5 },
    load: () => import('pixelfx/fx/holy/divine-shield'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '특수 방어 — 반짝이는 보호막 (반복 효과)',
  },
  'rune-circle': {
    center: { dx: -0.1, dy: -6.5 },
    load: () => import('pixelfx/fx/arcane/rune-circle'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '특수 힌트 — 마법 문양이 빙글 (반복 효과)',
  },
  'time-stop': {
    center: { dx: -0.4, dy: -42.5 },
    load: () => import('pixelfx/fx/arcane/time-stop'),
    until: 1.5,
    speed: 2.5,
    hold: false,
    screen: false,
    note: '특수 여유 — 시계가 멈춤',
  },
  'power-star': {
    center: { dx: -1.2, dy: -26.4 },
    load: () => import('pixelfx/fx/pickups/power-star'),
    until: 1.2,
    speed: 2,
    hold: false,
    screen: false,
    note: '특수 충전 — 반짝이는 힘의 별 (반복 효과)',
  },
} satisfies Record<string, FxSpec>;

export type FxName = keyof typeof EFFECTS;
export const FX_NAMES = Object.keys(EFFECTS) as FxName[];

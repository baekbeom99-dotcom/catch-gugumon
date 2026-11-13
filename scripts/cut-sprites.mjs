// SpriteCollab(PMD) 시트에서 구구몬 대체용 그림을 잘라 낸다 (로컬 테스트용, 결과 이미지는 커밋하지 않는다).
// 사용: node scripts/cut-sprites.mjs [번호 또는 범위...]   예) 1-18,23-28 0129 0130   (인자가 없으면 기본 46개)
//   애니메이션이 없거나(AnimData에 없음·시트 파일 없음) CopyOf인 번호도 견딘다: Sleep·Hurt·Attack은 없으면 결과·manifest에서 빠지고(로더가 건너뜀),
//   Idle이 Walk의 CopyOf이면 Walk 시트를 Idle로 쓴다. 하위 폼 폴더(0000 등)는 쓰지 않고 번호 폴더의 기본 폼 파일만 쓴다.
//   SPRITE_SRC=원본 sprite 폴더 (기본 C:/claude_code/poke/SpriteCollab/sprite)
//   SPRITE_OUT=저장 폴더 (기본 src/field/art/creatures/pmd)
// 결과(번호마다):
//   <번호>-front.png / -back.png  정지 앞·뒷모습 (Idle 첫 프레임: 폴백·도감용)
//   <번호>-walk.png               가로=프레임, 세로 4줄 = 아래(앞)·오른쪽·위(뒤)·왼쪽 (필드 걷기)
//   <번호>-idle.png               세로 6줄 = 아래·오른쪽·위·왼쪽 + 오른쪽위(3)·왼쪽아래(7)  (뒤 둘은 전투용)
//   <번호>-hurt.png               세로 2줄 = 오른쪽위(내 구구몬)·왼쪽아래(야생)
//   <번호>-attack.png             세로 2줄 = 오른쪽위·왼쪽아래, 칸은 attackSide(Idle보다 큼), 1원본픽셀=1칸픽셀
//   <번호>-sleep.png              세로 1줄
// (줄 번호 표는 src/field/art/spriteSheet.ts 의 BATTLE_ROW·SOURCE_ROWS 와 같아야 한다 — tests/field/spriteSheet.test.ts 가 확인)
//   manifest.json                 칸 크기(side), 애니별 프레임 수·프레임별 ms, 정지 그림 크기(baseSide)
// 시트 방향 행: 0 아래, 1 아래오른, 2 오른, 3 위오른, 4 위, 5 위왼, 6 왼, 7 아래왼
// 한 종의 모든 칸은 같은 정사각형(side)이고, 발끝을 아래 여백(PAD) 위에, 가로는 가운데에 맞춘다.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.env.SPRITE_SRC ?? 'C:/claude_code/poke/SpriteCollab/sprite';
const OUT = process.env.SPRITE_OUT ?? 'src/field/art/creatures/pmd';
const DEFAULT_IDS = '1-18,23-28,35-40,50-62,129,130,132';
/** "1-18,23 0129" → ['0001', ..., '0018', '0023', '0129'] */
function parseIds(args) {
  const out = [];
  for (const tok of args.join(',').split(',').map((t) => t.trim()).filter(Boolean)) {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`번호 형식이 이상함: ${tok}`);
    const a = +m[1];
    const b = m[2] ? +m[2] : a;
    for (let n = a; n <= b; n++) out.push(String(n).padStart(4, '0'));
  }
  return [...new Set(out)];
}
const ids = parseIds(process.argv.slice(2).length ? process.argv.slice(2) : [DEFAULT_IDS]);
const PAD = 1;
const MS_PER_TICK = 1000 / 60;
/** 애니 이름 → 쓰는 시트 줄(행 번호). 앞=0, 오른=2, 뒤=4, 왼=6 */
const ANIMS = {
  idle: { name: 'Idle', rows: [0, 2, 4, 6, 3, 7] },
  walk: { name: 'Walk', rows: [0, 2, 4, 6] },
  hurt: { name: 'Hurt', rows: [3, 7] },
  sleep: { name: 'Sleep', rows: [0] },
};

/** AnimData.xml을 <Anim> 블록별로 읽는다: 이름 → { fw, fh, ticks } 또는 { copyOf } */
function parseAnims(xml) {
  const out = {};
  for (const block of xml.split('<Anim>').slice(1)) {
    const name = block.match(/<Name>([^<]+)<\/Name>/)?.[1];
    if (!name) continue;
    const copy = block.match(/<CopyOf>([^<]+)<\/CopyOf>/)?.[1];
    if (copy) { out[name] = { copyOf: copy }; continue; }
    const fw = block.match(/<FrameWidth>(\d+)<\/FrameWidth>/)?.[1];
    const fh = block.match(/<FrameHeight>(\d+)<\/FrameHeight>/)?.[1];
    const ticks = [...(block.match(/<Durations>([\s\S]*?)<\/Durations>/)?.[1] ?? '').matchAll(/<Duration>(\d+)<\/Duration>/g)].map((d) => +d[1]);
    if (fw && fh && ticks.length) out[name] = { fw: +fw, fh: +fh, ticks };
  }
  return out;
}

/** 애니 하나의 시트·칸 정보. CopyOf를 따라가고, 정보나 시트 파일이 없으면 null */
function animInfo(dir, table, name, depth = 0) {
  const a = table[name];
  if (!a || depth > 4) return null;
  if (a.copyOf) return animInfo(dir, table, a.copyOf, depth + 1);
  const file = path.join(dir, `${name}-Anim.png`);
  if (!fs.existsSync(file)) return null;
  return { fw: a.fw, fh: a.fh, ms: a.ticks.map((t) => Math.round(t * MS_PER_TICK)), sheet: fs.readFileSync(file).toString('base64') };
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.SPRITE_CHANNEL ?? 'msedge' });
const page = await browser.newPage();
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
for (const id of ids) {
  const dir = path.join(SRC, id);
  const table = parseAnims(fs.readFileSync(path.join(dir, 'AnimData.xml'), 'utf8'));
  const anims = {};
  for (const [key, a] of Object.entries(ANIMS)) {
    const info = animInfo(dir, table, a.name);
    if (info) anims[key] = { ...a, ...info };
  }
  // Idle·Walk 중 하나만 있으면 그걸로 둘 다 쓴다 (예: Idle이 Walk의 CopyOf)
  if (!anims.idle && anims.walk) anims.idle = { ...anims.walk, rows: ANIMS.idle.rows };
  if (!anims.walk && anims.idle) anims.walk = { ...anims.idle, rows: ANIMS.walk.rows };
  if (!anims.idle) { console.warn(id, 'Idle·Walk 시트가 없어 건너뜀'); continue; }
  const atkInfo = animInfo(dir, table, 'Attack');
  const atk = atkInfo ? { name: 'Attack', rows: [3, 7], ...atkInfo } : null;
  const res = await page.evaluate(async ({ anims, atk, pad }) => {
    const load = async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); return img; };
    const imgs = {};
    for (const k of Object.keys(anims)) imgs[k] = await load(anims[k].sheet);
    const atkImg = atk ? await load(atk.sheet) : null;
    /** 칸 하나의 몸 영역 [x0,y0,x1,y1) 또는 null */
    const boxOf = (img, fw, fh, col, row) => {
      const c = document.createElement('canvas'); c.width = fw; c.height = fh;
      const g = c.getContext('2d'); g.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
      const d = g.getImageData(0, 0, fw, fh).data;
      let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
    };
    // 정지 그림(앞·뒤) 옛 방식 크기
    const idle = anims.idle;
    const fb = [0, 4].map((r) => boxOf(imgs.idle, idle.fw, idle.fh, 0, r));
    const bw = Math.max(...fb.map((b) => b[2] - b[0]));
    const bh = Math.max(...fb.map((b) => b[3] - b[1]));
    const baseSide = Math.max(bw, bh) + pad * 2;
    // 애니별 합친 몸 영역 (모든 프레임·쓰는 줄)
    const union = {};
    let side = 0;
    for (const [k, a] of Object.entries(anims)) {
      let u = null;
      for (let col = 0; col < a.ms.length; col++) for (const row of a.rows) {
        const b = boxOf(imgs[k], a.fw, a.fh, col, row);
        if (!b) continue;
        u = u ? [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])] : b;
      }
      if (!u) { delete anims[k]; continue; }
      union[k] = u;
      side = Math.max(side, u[2] - u[0], u[3] - u[1]);
    }
    side += pad * 2;
    const draw = (k, col, row, g, dx, dy) => {
      const a = anims[k]; const u = union[k];
      const ox = Math.floor((side - (u[2] - u[0])) / 2) - u[0];
      const oy = side - pad - u[3];
      g.drawImage(imgs[k], col * a.fw, row * a.fh, a.fw, a.fh, dx + ox, dy + oy, a.fw, a.fh);
    };
    const out = {};
    for (const [k, a] of Object.entries(anims)) {
      const c = document.createElement('canvas'); c.width = side * a.ms.length; c.height = side * a.rows.length;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      for (let col = 0; col < a.ms.length; col++) a.rows.forEach((row, i) => draw(k, col, row, g, col * side, i * side));
      out[k] = c.toDataURL('image/png').split(',')[1];
    }
    // 정지 앞·뒤 (옛 방식 그대로)
    const still = [0, 4].map((row, i) => {
      const [x0, y0, x1, y1] = fb[i];
      const c = document.createElement('canvas'); c.width = baseSide; c.height = baseSide;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const w = x1 - x0, h = y1 - y0;
      g.drawImage(imgs.idle, x0, row * idle.fh + y0, w, h, Math.floor((baseSide - w) / 2), baseSide - pad - h, w, h);
      return c.toDataURL('image/png').split(',')[1];
    });
    // Idle 칸 안의 기준점 = 원본 프레임 가운데(그림자 자리)가 놓인 곳
    const ui = union.idle;
    const idleOx = Math.floor((side - (ui[2] - ui[0])) / 2) - ui[0];
    const idleOy = side - pad - ui[3];
    const ix = idle.fw / 2 + idleOx;
    const iy = idle.fh / 2 + idleOy;
    // Attack: 1원본픽셀=1칸픽셀, 칸은 정사각형, 프레임 가운데가 칸 가운데
    let attack = null;
    if (atk) {
    const sa = Math.max(atk.fw, atk.fh);
    const ac = document.createElement('canvas'); ac.width = sa * atk.ms.length; ac.height = sa * atk.rows.length;
    const ag = ac.getContext('2d'); ag.imageSmoothingEnabled = false;
    for (let col = 0; col < atk.ms.length; col++) atk.rows.forEach((row, i) => {
      ag.drawImage(atkImg, col * atk.fw, row * atk.fh, atk.fw, atk.fh, col * sa + Math.floor((sa - atk.fw) / 2), i * sa + Math.floor((sa - atk.fh) / 2), atk.fw, atk.fh);
    });
    attack = { png: ac.toDataURL('image/png').split(',')[1], side: sa, ax: sa / 2, ay: sa / 2, ix, iy };
    }
    return { out, still, side, baseSide, bh, bw, attack };
  }, { anims, atk, pad: PAD });
  fs.writeFileSync(path.join(OUT, `${id}-front.png`), Buffer.from(res.still[0], 'base64'));
  fs.writeFileSync(path.join(OUT, `${id}-back.png`), Buffer.from(res.still[1], 'base64'));
  const entry = { side: res.side, baseSide: res.baseSide, foot: +((res.side - PAD) / res.side).toFixed(3), bodyH: res.bh, bodyW: res.bw };
  for (const [k, a] of Object.entries(anims)) {
    fs.writeFileSync(path.join(OUT, `${id}-${k}.png`), Buffer.from(res.out[k], 'base64'));
    entry[k] = { frames: a.ms.length, ms: a.ms, rows: a.rows.length };
  }
  if (res.attack) {
    fs.writeFileSync(path.join(OUT, `${id}-attack.png`), Buffer.from(res.attack.png, 'base64'));
    const { side: aside, ax, ay, ix, iy } = res.attack;
    entry.attack = { frames: atk.ms.length, ms: atk.ms, rows: atk.rows.length, side: aside, ax, ay, ix, iy };
  }
  manifest[id] = entry;
  console.log(id, JSON.stringify(entry));
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
await browser.close();

// SpriteCollab(PMD) 시트에서 구구몬 대체용 앞·뒷모습 PNG를 잘라 낸다 (로컬 테스트용, 결과 이미지는 커밋하지 않는다).
// 사용: node scripts/cut-sprites.mjs [번호...]   (기본 0001 0002 0003 0004)
//   SPRITE_SRC=원본 sprite 폴더 (기본 C:/claude_code/poke/SpriteCollab/sprite)
//   SPRITE_OUT=저장 폴더 (기본 src/field/art/creatures/pmd)
// 결과: <번호>-front.png(Idle 아래 방향 첫 프레임), <번호>-back.png(위 방향 첫 프레임), manifest.json(크기·발끝)
// 방향 행 순서: 0 아래, 1 아래오른, 2 오른, 3 위오른, 4 위, 5 위왼, 6 왼, 7 아래왼
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.env.SPRITE_SRC ?? 'C:/claude_code/poke/SpriteCollab/sprite';
const OUT = process.env.SPRITE_OUT ?? 'src/field/art/creatures/pmd';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['0001', '0002', '0003', '0004'];
const FRONT_ROW = 0;
const BACK_ROW = 4;
const PAD = 1;

function idleInfo(xml) {
  const m = xml.match(/<Name>Idle<\/Name>[\s\S]*?<FrameWidth>(\d+)<\/FrameWidth>\s*<FrameHeight>(\d+)<\/FrameHeight>\s*<Durations>([\s\S]*?)<\/Durations>/);
  if (!m) throw new Error('Idle 정보를 못 찾음');
  return { fw: +m[1], fh: +m[2], frames: (m[3].match(/<Duration>/g) ?? []).length };
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.SPRITE_CHANNEL ?? 'msedge' });
const page = await browser.newPage();
const manifest = {};
for (const id of ids) {
  const dir = path.join(SRC, id);
  const { fw, fh, frames } = idleInfo(fs.readFileSync(path.join(dir, 'AnimData.xml'), 'utf8'));
  const sheet = fs.readFileSync(path.join(dir, 'Idle-Anim.png')).toString('base64');
  const res = await page.evaluate(async ({ sheet, fw, fh, rows }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + sheet;
    await img.decode();
    const grab = (row) => {
      const c = document.createElement('canvas');
      c.width = fw; c.height = fh;
      const g = c.getContext('2d');
      g.drawImage(img, 0, row * fh, fw, fh, 0, 0, fw, fh);
      const d = g.getImageData(0, 0, fw, fh).data;
      let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return { c, box: [x0, y0, x1 + 1, y1 + 1] };
    };
    const a = grab(rows[0]);
    const b = grab(rows[1]);
    const bw = Math.max(a.box[2] - a.box[0], b.box[2] - b.box[0]);
    const bh = Math.max(a.box[3] - a.box[1], b.box[3] - b.box[1]);
    return { sheetW: img.width, sheetH: img.height, bw, bh, boxes: [a.box, b.box] };
  }, { sheet, fw, fh, rows: [FRONT_ROW, BACK_ROW] });
  const side = Math.max(res.bw, res.bh) + PAD * 2;
  const outs = await page.evaluate(async ({ sheet, fw, fh, rows, side, pad, boxes }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + sheet;
    await img.decode();
    return rows.map((row, i) => {
      const [x0, y0, x1, y1] = boxes[i];
      const c = document.createElement('canvas');
      c.width = side; c.height = side;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const w = x1 - x0, h = y1 - y0;
      // 가로 가운데, 발끝(아래)을 바닥 여백 위에 맞춘다
      g.drawImage(img, x0, row * fh + y0, w, h, Math.floor((side - w) / 2), side - pad - h, w, h);
      return c.toDataURL('image/png').split(',')[1];
    });
  }, { sheet, fw, fh, rows: [FRONT_ROW, BACK_ROW], side, pad: PAD, boxes: res.boxes });
  fs.writeFileSync(path.join(OUT, `${id}-front.png`), Buffer.from(outs[0], 'base64'));
  fs.writeFileSync(path.join(OUT, `${id}-back.png`), Buffer.from(outs[1], 'base64'));
  manifest[id] = { frame: [fw, fh], idleFrames: frames, side, foot: +((side - PAD) / side).toFixed(3), bodyH: res.bh, bodyW: res.bw };
  console.log(id, manifest[id]);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();

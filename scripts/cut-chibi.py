"""
치비 그림(C:\\Antigravity\\sprite\\sprites\\<번호>\\idle·walk·attack.png, 4열×4행)을 앱용으로 잘라 만든다.
행 순서: 아래(앞모습)·위(뒷모습)·오른쪽·왼쪽, 열 4칸이 한 번 도는 프레임.
출력: src/field/art/creatures/chibi/<번호>-front·back·idle·walk·attack.png + manifest.json (.gitignore — 저장소·배포에 넣지 않는다)
사용: python scripts/cut-chibi.py [번호 ...]   (없으면 001~050 전부, 주인공 017 포함)
모든 칸은 캐릭터마다 같은 크기로 맞추고(가로 가운데·발 아래 기준), 모든 프레임의 투명 여백 공통분을 잘라 낸다.
"""
import json
import os
import sys
from PIL import Image

SRC = os.environ.get('CHIBI_SRC', r'C:\Antigravity\sprite\sprites')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'field', 'art', 'creatures', 'chibi')
SCALE = 0.5  # 화면에서 작게 쓰므로 반으로 줄여 용량을 아낀다
ANIMS = {'idle': 300, 'walk': 150, 'attack': 110}  # 프레임 하나당 ms
COLS = ROWS = 4


def cells(path):
    im = Image.open(path).convert('RGBA')
    cw, ch = im.width // COLS, im.height // ROWS
    return [[im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for c in range(COLS)] for r in range(ROWS)], cw, ch


def process(num):
    sheets = {}
    for a in ANIMS:
        p = os.path.join(SRC, num, f'{a}.png')
        if os.path.exists(p):
            sheets[a] = cells(p)
    if 'idle' not in sheets or 'walk' not in sheets:
        return None
    cw = max(s[1] for s in sheets.values())
    ch = max(s[2] for s in sheets.values())
    # 칸마다 큰 틀에 가로 가운데·아래 맞춤으로 옮기고, 전체 알파 범위를 모은다
    big = {}
    union = None
    for a, (grid, w, h) in sheets.items():
        g = []
        for r in range(ROWS):
            row = []
            for c in range(COLS):
                canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
                canvas.paste(grid[r][c], ((cw - w) // 2, ch - h))
                bb = canvas.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
                if bb:
                    union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
                row.append(canvas)
            g.append(row)
        big[a] = g
    pad = 2
    box = (max(0, union[0] - pad), max(0, union[1] - pad), min(cw, union[2] + pad), min(ch, union[3] + pad))
    sw, sh = box[2] - box[0], box[3] - box[1]
    side_w, side_h = round(sw * SCALE), round(sh * SCALE)

    def fin(im):
        return im.crop(box).resize((side_w, side_h), Image.LANCZOS)

    entry = {'cw': side_w, 'ch': side_h, 'cols': COLS, 'rows': ROWS}
    for a, g in big.items():
        out = Image.new('RGBA', (side_w * COLS, side_h * ROWS), (0, 0, 0, 0))
        for r in range(ROWS):
            for c in range(COLS):
                out.paste(fin(g[r][c]), (c * side_w, r * side_h))
        out.save(os.path.join(OUT, f'{num}-{a}.png'))
        entry[a] = {'ms': [ANIMS[a]] * COLS}
    # 정지 그림: idle 0번 열의 앞(0행)·뒤(1행)
    fin(big['idle'][0][0]).save(os.path.join(OUT, f'{num}-front.png'))
    fin(big['idle'][1][0]).save(os.path.join(OUT, f'{num}-back.png'))
    # 몸 높이·너비(앞모습 첫 프레임 알파 범위) — 몸 크기 맞춤에 쓴다
    f = fin(big['idle'][0][0])
    bb = f.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:
        entry['bodyH'] = bb[3] - bb[1]
        entry['bodyW'] = bb[2] - bb[0]
    return entry


def main():
    os.makedirs(OUT, exist_ok=True)
    nums = sys.argv[1:] or [f'{i:03d}' for i in range(1, 51)]
    mp = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else {}
    for n in nums:
        n = n.zfill(3)
        e = process(n)
        if e is None:
            print('건너뜀(파일 없음):', n)
            continue
        manifest[n] = e
        print(n, e['cw'], 'x', e['ch'], 'bodyH', e.get('bodyH'))
    json.dump(manifest, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()

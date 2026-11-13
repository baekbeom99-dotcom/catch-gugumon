/**
 * 개발 전용 필드 모험 검수 화면 (#/dev/field) — 배포 빌드에는 라우트가 없다.
 * 그림 교체·효과 추가·수치 조정을 한 뒤 여기서 바로 본다: 구구몬 그림(앞·뒤·진화·동행·걷기 시트), 캡슐, 효과, 디버그 스위치.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DAN_COLORS } from '../art/colors';
import type { MonsterMood } from '../art/MonsterSprite';
import { SPECIES } from '../domain/field/creatures';
import { displayName } from '../domain/field/growth';
import { companionImage } from './art/companionImage';
import { creatureArt, stageFill, stageSheets } from './art/creatureArt';
import { SheetSprite, creatureSprite, speciesColor } from './art/creatureSprite';
import { BATTLE_ROW, DIR_ROW, type SheetDir } from './art/spriteSheet';
import { CapsuleBall } from './art/CapsuleBall';
import { CAPSULE_NAMES, CAPSULE_TYPES } from '../domain/field/capsules';
import { debugFlags, setDebugFlag } from './debugFlags';
import { ELEMENT_FX, ELEMENT_NAMES, SPECIAL_FX, STRONG_FX, type Element } from '../domain/field/elements';
import { EFFECTS, type FxName, type FxSpec } from './fx/effects';
import { playFx } from './fx/playFx';

const MOODS: MonsterMood[] = ['idle', 'hit', 'happy', 'sleep'];
const STAGES = [1, 2, 3] as const;
const row = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' } as const;
const box = { background: '#f3f0e8', borderRadius: 8, padding: 8 } as const;

/** 전투 그림(내 구구몬 오른쪽 위·야생 왼쪽 아래)을 1.6초마다 공격 한 번씩 틀어 본다 */
function BattleReplay({ id, stage, side }: { id: (typeof SPECIES)[number]['id']; stage: 1 | 2 | 3; side: 'ally' | 'foe' }) {
  const [at, setAt] = useState<number | undefined>(undefined);
  useEffect(() => {
    const t = window.setInterval(() => setAt(Date.now()), 1600);
    return () => window.clearInterval(t);
  }, []);
  return (
    <figure style={{ margin: 0 }} data-testid={`dev-battle-${side}`}>
      <div style={{ width: 96, height: 96, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {creatureSprite(id, { view: side, stage, attackAt: at, color: DAN_COLORS[5], size: 96 })}
      </div>
      <small style={{ display: 'block', textAlign: 'center' }}>{side === 'ally' ? '공격 내 구구몬(행3)' : '공격 야생(행7)'}</small>
    </figure>
  );
}

const DIR_NAMES: Record<SheetDir, string> = { down: '앞', right: '오른쪽', up: '뒤', left: '왼쪽' };

/** 시트(걷기·가만히·맞음·잠)가 있는 종만: 단계별로 움직임을 재생해 본다 */
function SheetPreview({ id }: { id: (typeof SPECIES)[number]['id'] }) {
  const art = creatureArt(id);
  return (
    <>
      {STAGES.map((st) => {
        const sh = stageSheets(art, st);
        if (!sh) return null;
        const cap = (t: string) => <small style={{ display: 'block', textAlign: 'center' }}>{t}</small>;
        return (
          <div key={st} style={{ ...row, marginTop: 6 }} data-testid={`dev-sheet-${id}-${st}`}>
            <strong style={{ width: '100%' }}>
              시트 {displayName(id, st)} (칸 {sh.side}px)
            </strong>
            {(['down', 'up'] as const).map((d) => (
              <figure key={'i' + d} style={{ margin: 0 }}>
                <SheetSprite sheets={sh} anim={sh.idle} row={DIR_ROW[d]} px={72} />
                {cap(`가만히 ${DIR_NAMES[d]}`)}
              </figure>
            ))}
            {(['down', 'right', 'up', 'left'] as const).map((d) => (
              <figure key={'w' + d} style={{ margin: 0 }}>
                <SheetSprite sheets={sh} anim={sh.walk} row={DIR_ROW[d]} px={72} />
                {cap(`걷기 ${DIR_NAMES[d]}`)}
              </figure>
            ))}
            {sh.hurt &&
              (['ally', 'foe'] as const).map((v) => (
                <figure key={'h' + v} style={{ margin: 0 }}>
                  <SheetSprite sheets={sh} anim={sh.hurt!} row={BATTLE_ROW.hurt[v]} px={72} />
                  {cap(v === 'ally' ? '맞음 오른쪽위' : '맞음 왼쪽아래')}
                </figure>
              ))}
            {(['ally', 'foe'] as const).map((v) => (
              <figure key={'bi' + v} style={{ margin: 0 }}>
                <SheetSprite sheets={sh} anim={sh.idle} row={BATTLE_ROW.idle[v]} px={72} />
                {cap(v === 'ally' ? '가만히 오른쪽위' : '가만히 왼쪽아래')}
              </figure>
            ))}
            {sh.attack && (['ally', 'foe'] as const).map((v) => <BattleReplay key={'ba' + v} id={id} stage={st} side={v} />)}
            {sh.sleep && (
              <figure style={{ margin: 0 }}>
                <SheetSprite sheets={sh} anim={sh.sleep} row={0} px={72} />
                {cap('잠')}
              </figure>
            )}
          </div>
        );
      })}
    </>
  );
}

function DebugSwitches() {
  const [flags, setFlags] = useState(debugFlags);
  const toggle = (name: 'encounter' | 'path' | 'legend') => {
    setDebugFlag(name, !flags[name]);
    setFlags(debugFlags());
  };
  return (
    <section>
      <h2>디버그 스위치 (새로고침하면 꺼짐)</h2>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={flags.encounter} onChange={() => toggle('encounter')} /> 풀숲 걸음마다 만남 · 캡슐 100%
      </label>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={flags.path} onChange={() => toggle('path')} /> 길 걸음마다 만남 100%
      </label>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={flags.legend} onChange={() => toggle('legend')} /> 만남이 레전드 (12단이 열려 있을 때)
      </label>
      <p>
        <Link to="/field">필드로 가기</Link> · <Link to="/">처음 화면</Link>
      </p>
    </section>
  );
}

function EffectButtons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gold, setGold] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [fly, setFly] = useState(true);
  const play = (name: FxName) => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    const r = c.getBoundingClientRect();
    // 상자 한가운데가 곧 효과 중심 (전투와 같은 규칙)
    // 날아가는 효과: 내 공격은 왼쪽 아래 구구몬에서, 뒤집기(적 공격)는 오른쪽 위 구구몬에서 한가운데로 날아온다
    const from = fly ? (mirror ? { x: r.width - 30, y: r.height * 0.3 } : { x: 30, y: r.height * 0.8 }) : undefined;
    void playFx(c, name, { x: r.width / 2, y: r.height / 2 }, { gold, mirror, ...(from ? { from } : {}) });
  };
  const button = (n: FxName) => (
    <button key={n} type="button" className="btn btn--ghost" onClick={() => play(n)} title={EFFECTS[n].note}>
      {n}
      {(EFFECTS[n] as FxSpec).motion === 'travel' ? ' ➤' : (EFFECTS[n] as FxSpec).motion === 'beam' ? ' ═▶' : ''}
    </button>
  );
  return (
    <section>
      <h2>효과 (fx/effects.ts) — 동작 줄이기를 켠 기기에서는 안 보임</h2>
      <div style={row}>
        {(['enter', 'hit', 'catch'] as const).map(button)}
      </div>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={gold} onChange={() => setGold(!gold)} /> 금색 (황금 구구몬)
      </label>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={mirror} onChange={() => setMirror(!mirror)} /> 뒤집기 (적이 쏠 때)
      </label>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={fly} onChange={() => setFly(!fly)} /> 날아가기 (➤ 표시 효과: 쏘는 쪽에서 가운데로 구슬이 날아간 뒤 터짐)
      </label>
      {(Object.keys(ELEMENT_FX) as Element[]).map((el) => (
        <div key={el} style={{ marginTop: 4 }}>
          <strong>{ELEMENT_NAMES[el]}</strong>
          <div style={row}>
            <small>평소 (주 1·2·3, 부)</small>
            {ELEMENT_FX[el].map(button)}
          </div>
          <div style={row}>
            <small>강력 (주 1·2·3, 부)</small>
            {STRONG_FX[el].map(button)}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4 }}>
        <strong>특수 기술</strong>
        <div style={row}>
          {(Object.entries(SPECIAL_FX) as [string, FxName][]).map(([kind, n]) => (
            <button key={kind} type="button" className="btn btn--ghost" onClick={() => play(n)} title={`${kind}: ${EFFECTS[n].note}`}>
              {kind} · {n}
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...box, position: 'relative', width: 320, height: 180, marginTop: 8, background: '#7cc06b' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />
      </div>
    </section>
  );
}

function CompanionPreview({ id }: { id: (typeof SPECIES)[number]['id'] }) {
  // companionImage는 React를 따로 그려 굽기 때문에 React가 그리는 중(렌더·effect)에는 부르면 안 된다 → 다음 차례로 미룬다 (필드에서는 rAF 안)
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setImg(companionImage(id)));
    return () => clearTimeout(t);
  }, [id]);
  const art = creatureArt(id);
  const tile = 48;
  const size = Math.round(tile * art.fill * stageFill(art, 1));
  return (
    <div style={{ position: 'relative', width: tile, height: tile, background: '#d9b382', outline: '1px dashed #8d5a2b' }} title="필드 동행: 점선이 한 칸">
      {img && <img src={img.src} alt="" width={size} height={size} style={{ position: 'absolute', left: (tile - size) / 2, top: tile - size * art.foot }} />}
    </div>
  );
}

type CompareMode = 'front' | 'back' | 'walk' | 'hit' | 'attack';
const COMPARE_MODES: [CompareMode, string][] = [['front', '앞'], ['back', '뒤'], ['walk', '걷기'], ['hit', '맞음'], ['attack', '공격']];

/** 모든 종·단계의 몸 크기를 한 화면에서 비교 (점선 = 자리 한 칸). 몸 높이 기준은 spriteSheet.BODY_H_TARGET */
function SizeCompare() {
  const [mode, setMode] = useState<CompareMode>('front');
  const [at, setAt] = useState<number | undefined>(undefined);
  useEffect(() => {
    const t = window.setInterval(() => setAt(Date.now()), 1600);
    return () => window.clearInterval(t);
  }, []);
  const px = 44;
  const one = (id: (typeof SPECIES)[number]['id'], st: 1 | 2 | 3) => {
    const art = creatureArt(id);
    const sh = stageSheets(art, st);
    let el: JSX.Element;
    if (mode === 'walk' && sh) el = <SheetSprite sheets={sh} anim={sh.walk} row={DIR_ROW.down} px={Math.round(px * (st === 1 ? 1 : st === 2 ? 1.15 : 1.3))} />;
    else if (mode === 'hit') el = creatureSprite(id, { view: 'foe', stage: st, mood: 'hit', color: DAN_COLORS[5], size: px });
    else if (mode === 'attack') el = creatureSprite(id, { view: 'ally', stage: st, attackAt: at, color: DAN_COLORS[5], size: px });
    else el = creatureSprite(id, { view: mode === 'back' ? 'back' : 'front', stage: st, color: DAN_COLORS[5], size: px });
    return (
      <span key={st} style={{ position: 'relative', width: px, height: px, display: 'inline-flex', alignItems: 'flex-end', justifyContent: 'center', outline: '1px dashed #c9b58f' }} title={displayName(id, st)}>
        {el}
      </span>
    );
  };
  return (
    <section data-testid="dev-size-compare">
      <h2>크기 비교 (점선 = 한 칸)</h2>
      <div style={{ ...row, marginBottom: 6 }}>
        {COMPARE_MODES.map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{ fontWeight: mode === m ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>
      {SPECIES.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
          <small style={{ width: 64 }}>{s.name}</small>
          {STAGES.map((st) => one(s.id, st))}
        </div>
      ))}
    </section>
  );
}

export function DevFieldGallery() {
  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      <h1>필드 모험 검수</h1>
      <DebugSwitches />
      <EffectButtons />
      <SizeCompare />

      <section>
        <h2>캡슐</h2>
        <div style={row}>
          {CAPSULE_TYPES.map((t) => (
            <figure key={t} style={{ ...box, margin: 0, textAlign: 'center' }}>
              <CapsuleBall type={t} size={64} />
              <figcaption>{CAPSULE_NAMES[t]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2>구구몬 (art/creatureArt.ts)</h2>
        {SPECIES.map((s) => (
          <div key={s.id} style={{ ...box, marginBottom: 8 }}>
            <strong>
              {s.name} <small>({s.id} · {creatureArt(s.id).type === 'image' ? '이미지' : '몬스터 SVG'} · 기술: {s.moves.join(' / ')})</small>
            </strong>
            <div style={row}>
              {MOODS.map((m) => (
                <span key={m} title={`앞모습 ${m}`}>
                  {creatureSprite(s.id, { view: 'front', mood: m, color: DAN_COLORS[7], size: 72 })}
                </span>
              ))}
              {creatureArt(s.id).type === 'image' &&
                STAGES.map((st) => (
                  <span key={'f' + st} title={`앞모습 ${displayName(s.id, st)}`}>
                    {creatureSprite(s.id, { view: 'front', stage: st, color: DAN_COLORS[7], size: 72 })}
                  </span>
                ))}
              {STAGES.map((st) => (
                <span key={st} title={displayName(s.id, st)}>
                  {creatureSprite(s.id, { view: 'back', stage: st, color: DAN_COLORS[5], size: 72 })}
                </span>
              ))}
              {creatureSprite(s.id, { view: 'mini', color: speciesColor(s.id), size: 40 })}
              <CompanionPreview id={s.id} />
            </div>
            <SheetPreview id={s.id} />
          </div>
        ))}
      </section>
    </div>
  );
}

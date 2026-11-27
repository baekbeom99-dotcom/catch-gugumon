import { describe, expect, it } from 'vitest';
import { FACTS, factId } from '../../src/domain/facts';
import { battleQuestion } from '../../src/domain/field/reverse';
import { emptyTraining, masteredDanSet, planStudy } from '../../src/domain/field/training';
import { seededRng } from '../../src/domain/random';
import { fromTraining, fromTrainingReversed, spokenLabel, studyBoard } from '../../src/field/training/boardQuestion';

const fact = FACTS.find((f) => f.id === factId(7, 8))!;

describe('masteredDanSet', () => {
  it('마스터한 단들을 돌려준다', () => {
    const t = emptyTraining();
    expect(masteredDanSet(t).size).toBe(0);
    t.mastered = { 2: { bestMs: 1, at: 1 }, 5: { bestMs: 1, at: 1 } };
    expect([...masteredDanSet(t)].sort()).toEqual([2, 5]);
  });
});

describe('전투 문제 만들기', () => {
  it('마스터한 단만 나눗셈이 된다', () => {
    const rng = seededRng(3);
    const a = battleQuestion(rng, fact, 'product', 3, new Set([7]), 1);
    expect(a.display.kind === 'equation' && a.display.op).toBe('÷');
    expect(a.factId).toBe('7x8');
    const b = battleQuestion(rng, fact, 'product', 3, new Set([2]), 1);
    expect(b.display.kind === 'equation' && b.display.op).not.toBe('÷');
  });
  it('고정 문제는 바꾸지 않는다', () => {
    const q = battleQuestion(seededRng(3), fact, 'product', 3, new Set([7]), 1, true);
    expect(q.display.kind === 'equation' && q.display.op).not.toBe('÷');
  });
});

describe('학습 문제 거꾸로', () => {
  const q = planStudy(7)[7]; // 7 × 8
  it('나눗셈 모양: 라벨·답·읽는 글', () => {
    const r = fromTrainingReversed(q, seededRng(1));
    expect(r.label).toMatch(/^56 ÷ (7|8)$/);
    expect(r.answer).toBe(r.label === '56 ÷ 7' ? 8 : 7);
    expect(r.choices).toContain(r.answer);
    expect(r.multiplier).toBe(8);
    expect(spokenLabel(r)).toBe(`${r.label.replace(' ÷ ', ' 나누기 ')}은?`);
  });
  it('studyBoard: 마스터 안 한 단이나 확률 0이면 곱셈 그대로', () => {
    const plain = planStudy(7).map(fromTraining);
    expect(studyBoard(planStudy(7), new Set(), () => 0, 1)).toEqual(plain);
    expect(studyBoard(planStudy(7), new Set([7]), () => 0.5, 0)).toEqual(plain);
  });
  it('studyBoard: 마스터한 단이고 확률 1이면 아홉 문제 모두 ÷', () => {
    const board = studyBoard(planStudy(7), new Set([7]), seededRng(2), 1);
    expect(board).toHaveLength(9);
    expect(board.every((b) => b.label.includes('÷'))).toBe(true);
    expect(board.map((b) => b.multiplier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

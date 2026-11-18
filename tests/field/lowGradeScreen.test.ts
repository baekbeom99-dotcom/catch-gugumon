import { describe, expect, it } from 'vitest';
import { seededRng } from '../../src/domain/random';
import {
  checkLowGradePassword,
  lowGradeDisplay,
  lowGradeFieldOf,
  lowGradeQuestion,
  lowGradeText,
  type LowGradeProblem,
} from '../../src/domain/field/lowGrade';
import {
  answerLowGradeRun,
  createLowGradeRun,
  insertLowGradeRetry,
  leaveLowGradeHint,
  lowGradeRunItem,
} from '../../src/domain/field/lowGradeRun';

const p = (a: number, op: '+' | '−', b: number): LowGradeProblem => ({ a, op, b, result: op === '+' ? a + b : a - b });
const same = (x: LowGradeProblem | null, y: LowGradeProblem) => x !== null && x.a === y.a && x.op === y.op && x.b === y.b;

describe('저학년 문제 표시', () => {
  it('글로는 "a + b = ?" / "a − b = ?" (곱하기 표시 없음)', () => {
    expect(lowGradeText(p(3, '+', 4))).toBe('3 + 4 = ?');
    expect(lowGradeText(p(52, '−', 7))).toBe('52 − 7 = ?');
    expect(lowGradeText(p(3, '+', 4))).not.toContain('×');
  });

  it('카드 모양은 arith (답 칸만 빈칸)', () => {
    expect(lowGradeDisplay(p(8, '−', 3))).toEqual({ kind: 'arith', op: '−', a: 8, b: 3, result: null });
  });

  it('문제 하나: 정답은 결과, 보기는 3개이고 정답이 들어 있다', () => {
    const q = lowGradeQuestion(seededRng(1), p(47, '+', 6));
    expect(q.answer).toBe(53);
    expect(q.choices.length).toBe(3);
    expect(q.choices).toContain(53);
    expect(q.display.result).toBeNull();
  });

  it('황금은 세 필드 중 하나, 필드는 그대로', () => {
    expect(lowGradeFieldOf(seededRng(1), 'desert')).toBe('desert');
    const seen = new Set<string>();
    const rng = seededRng(2);
    for (let i = 0; i < 100; i++) seen.add(lowGradeFieldOf(rng, 'legend'));
    expect([...seen].sort()).toEqual(['desert', 'meadow', 'waterside']);
  });
});

describe('비밀번호', () => {
  it('1234만 맞다', () => {
    expect(checkLowGradePassword('1234')).toBe(true);
    for (const bad of ['', '0000', '12345', '123', '4321', ' 1234']) expect(checkLowGradePassword(bad)).toBe(false);
  });
});

describe('저학년 연습 진행 (캡슐 1바퀴·회복 여러 바퀴)', () => {
  const plan = [p(1, '+', 2), p(5, '−', 3), p(4, '+', 4), p(9, '−', 1), p(6, '+', 2)];

  it('처음 바퀴는 받은 차례 그대로, 맞히면 다음 문제, 다 맞히면 끝', () => {
    let run = createLowGradeRun(plan, 1);
    for (const q of plan) {
      expect(same(lowGradeRunItem(run), q)).toBe(true);
      run = answerLowGradeRun(run, true, seededRng(1));
    }
    expect(run.done).toBe(true);
    expect(lowGradeRunItem(run)).toBeNull();
  });

  it('틀리면 힌트(자리 그대로), 힌트를 닫으면 다음 문제로 가고 틀린 문제는 뒤에서 다시 나온다', () => {
    let run = createLowGradeRun(plan, 1);
    run = answerLowGradeRun(run, false, seededRng(1));
    expect(run.hint).toBe(true);
    expect(answerLowGradeRun(run, true, seededRng(1))).toBe(run); // 힌트 중 연타는 그대로
    run = leaveLowGradeHint(run, seededRng(1));
    expect(run.hint).toBe(false);
    expect(run.order.length).toBe(5);
    expect(same(lowGradeRunItem(run), plan[1])).toBe(true);
    expect(run.order.findIndex((q) => same(q, plan[0]))).toBeGreaterThanOrEqual(2);
    let solved = 0;
    while (!run.done && solved < 20) {
      run = answerLowGradeRun(run, true, seededRng(2));
      solved++;
    }
    expect(solved).toBe(5);
  });

  it('여러 바퀴: 바퀴가 끝나면 섞고, 모든 바퀴를 마치면 끝', () => {
    let run = createLowGradeRun(plan, 3);
    for (let i = 0; i < 15; i++) {
      expect(run.done).toBe(false);
      run = answerLowGradeRun(run, true, seededRng(i));
    }
    expect(run.done).toBe(true);
    expect(run.round).toBe(3);
  });

  it('문제가 없으면 처음부터 끝', () => {
    expect(createLowGradeRun([], 3).done).toBe(true);
  });
});

describe('전투 재출제', () => {
  it('틀린 문제를 2~3칸 뒤에 한 번 더 끼워 넣는다 (원래 자리는 그대로)', () => {
    const plan = [p(1, '+', 1), p(2, '+', 2), p(3, '+', 3), p(4, '+', 4), p(5, '+', 5)];
    for (let seed = 1; seed < 20; seed++) {
      const out = insertLowGradeRetry(plan, 1, seededRng(seed));
      expect(out.length).toBe(6);
      expect(same(out[1], plan[1])).toBe(true);
      const at = out.findIndex((q, i) => i > 1 && same(q, plan[1]));
      expect([4, 5]).toContain(at);
    }
  });

  it('목록 끝 가까이면 맨 뒤에 붙는다', () => {
    const plan = [p(1, '+', 1), p(2, '+', 2)];
    const out = insertLowGradeRetry(plan, 1, seededRng(1));
    expect(out.length).toBe(3);
    expect(same(out[2], plan[1])).toBe(true);
  });
});

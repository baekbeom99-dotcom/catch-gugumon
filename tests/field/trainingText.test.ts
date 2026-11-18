import { describe, expect, it } from 'vitest';
import { TRAINING_CAPSULES } from '../../src/domain/field/tuning';
import type { TrainingOutcome } from '../../src/store/useGameStore';
import { trainingText } from '../../src/field/training/trainingText';

const base: TrainingOutcome = { ok: true, capsuleType: 'meadow', capsules: TRAINING_CAPSULES, mastered: false, newBest: false, bestMs: null, legend: null };

describe('trainingText', () => {
  it('간판은 단 번호를 담는다', () => {
    expect(trainingText.title(7)).toBe('7단 트레이닝센터');
    expect(trainingText.title(13)).toContain('13단');
  });

  it('도전 잠금 글', () => {
    expect(trainingText.challengeLocked).toContain('학습을 먼저');
  });

  it('캡슐 글은 개수를 담는다', () => {
    expect(trainingText.capsuleGain(TRAINING_CAPSULES)).toBe('캡슐 5개 얻었어요');
  });

  it('초 글', () => {
    expect(trainingText.seconds(12345)).toBe('12.3초');
  });

  it('학습 결과: 단 번호와 캡슐 5개', () => {
    const r = trainingText.result(3, 'study', 'complete', base);
    expect(r.title).toContain('3단');
    expect(r.lines.join(' ')).toContain('캡슐 5개');
    expect(r.lines.join(' ')).toContain('마스터 도전');
  });

  it('도전 합격: 마스터·지붕·시간, 새 기록', () => {
    const r = trainingText.result(3, 'challenge', 'pass', { ...base, mastered: true, newBest: true, bestMs: 20400 }, 20400);
    expect(r.title).toContain('마스터');
    const all = r.lines.join(' ');
    expect(all).toContain('지붕에 숫자가 켜졌어요');
    expect(all).toContain('20.4초');
    expect(all).toContain('새 기록');
    expect(all).toContain('캡슐 5개');
  });

  it('도전 합격이지만 새 기록이 아니면 새 기록 글 없음', () => {
    const r = trainingText.result(3, 'challenge', 'pass', { ...base, mastered: true, newBest: false, bestMs: 15000 }, 20400);
    expect(r.lines.join(' ')).not.toContain('새 기록');
  });

  it('도전 실패: 틀림·느림 모두 다시 도전하자는 말', () => {
    for (const res of ['wrong', 'slow'] as const) {
      const r = trainingText.result(4, 'challenge', res, base);
      expect(r.title).not.toContain('마스터!');
      expect(r.lines.join(' ')).toContain('다시');
      expect(r.lines.join(' ')).not.toContain('지붕');
    }
  });

  it('레전드: 새 구구몬과 다시 만난 구구몬 글', () => {
    const fresh = trainingText.legendLine('빛나는 이름', false);
    const dup = trainingText.legendLine('빛나는 이름', true);
    expect(fresh).toContain('빛나는 이름');
    expect(dup).toContain('빛나는 이름');
    expect(fresh).not.toBe(dup);
  });

  it('거부된 결과(ok=false)는 캡슐 글이 없다', () => {
    const r = trainingText.result(3, 'study', 'complete', { ...base, ok: false, capsules: 0 });
    expect(r.lines.join(' ')).not.toContain('캡슐');
  });

  it('틀림 표시·정답 알림 글', () => {
    expect(trainingText.tryAgain).toBeTruthy();
    expect(trainingText.showAnswer(21)).toContain('21');
  });
});

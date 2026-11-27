import { describe, expect, it } from 'vitest';
import { isNpcMastered, lockedText, npcKey, talkAction } from '../../src/domain/field/gymTalk';
import { emptyTraining } from '../../src/domain/field/training';
import { GYM_NPCS } from '../../src/field/world/maps/gym';

const npc = (id: string) => GYM_NPCS.find((n) => n.id === id)!;
const mastered = (dans: number[]) => {
  const t = emptyTraining();
  for (const d of dans) t.mastered[d as 2] = { bestMs: 1000, at: 1 };
  return t;
};

describe('체육관 말 걸기', () => {
  it('2단 트레이너는 늘 열려 있다', () => {
    expect(talkAction(npc('dan2'), emptyTraining(), false)).toEqual({ type: 'enter', to: '/field/training/2' });
  });

  it('앞 단을 마스터하기 전에는 잠김 글, 한 뒤에는 입장', () => {
    expect(talkAction(npc('dan3'), emptyTraining(), false)).toEqual({ type: 'locked', text: '2단 트레이너를 먼저 이겨요' });
    expect(talkAction(npc('dan3'), mastered([2]), false)).toEqual({ type: 'enter', to: '/field/training/3' });
    expect(talkAction(npc('dan4'), mastered([2]), false)).toEqual({ type: 'locked', text: '3단 트레이너를 먼저 이겨요' });
  });

  it('잠김 글은 훈련 단 순서의 바로 앞 단 (9단 다음 12단)', () => {
    expect(lockedText(12)).toBe('9단 트레이너를 먼저 이겨요');
    expect(lockedText(13)).toBe('12단 트레이너를 먼저 이겨요');
  });

  it('셈연습 트레이너는 늘 열려 있다', () => {
    for (const lv of ['basic', 'hard', 'comp'] as const)
      expect(talkAction(npc(`arith-${lv}`), emptyTraining(), false)).toEqual({ type: 'enter', to: `/field/training/arith/${lv}` });
  });

  it('시계 트레이너: 정각은 늘 열림, 5분은 정각 마스터 뒤, 1분은 5분 마스터 뒤 (잠김 글)', () => {
    const t = emptyTraining();
    expect(talkAction(npc('clock-hour'), t, false)).toEqual({ type: 'enter', to: '/field/training/clock/hour' });
    expect(talkAction(npc('clock-five'), t, false)).toEqual({ type: 'locked', text: '정각을 먼저 마스터해요' });
    expect(talkAction(npc('clock-one'), t, false)).toEqual({ type: 'locked', text: '5분 시계를 먼저 마스터해요' });
    t.clock.hour = { bestMs: 1, at: 1 };
    expect(talkAction(npc('clock-five'), t, false)).toEqual({ type: 'enter', to: '/field/training/clock/five' });
    expect(talkAction(npc('clock-one'), t, false)).toEqual({ type: 'locked', text: '5분 시계를 먼저 마스터해요' });
    t.clock.five = { bestMs: 1, at: 1 };
    expect(talkAction(npc('clock-one'), t, false)).toEqual({ type: 'enter', to: '/field/training/clock/one' });
  });

  it('시계 트레이너 마스터 표식은 그 단계 기록이 있을 때', () => {
    const t = emptyTraining();
    expect(isNpcMastered(npc('clock-hour'), t)).toBe(false);
    t.clock.hour = { bestMs: 1, at: 1 };
    expect(isNpcMastered(npc('clock-hour'), t)).toBe(true);
    expect(isNpcMastered(npc('clock-five'), t)).toBe(false);
  });

  it('동상은 별점수가 꺼져 있으면 아무 반응 없음, 켜져 있으면 동상 화면', () => {
    expect(talkAction('statue', emptyTraining(), false)).toEqual({ type: 'none' });
    expect(talkAction('statue', emptyTraining(), true)).toEqual({ type: 'enter', to: '/field/statue' });
  });

  it('마스터 표식과 이름', () => {
    const t = mastered([2]);
    t.arith.basic = { bestMs: 1, at: 1 };
    expect(isNpcMastered(npc('dan2'), t)).toBe(true);
    expect(isNpcMastered(npc('dan3'), t)).toBe(false);
    expect(isNpcMastered(npc('arith-basic'), t)).toBe(true);
    expect(isNpcMastered(npc('arith-hard'), t)).toBe(false);
    expect(GYM_NPCS.map(npcKey)).toEqual(['dan2', 'dan3', 'dan4', 'dan5', 'dan6', 'dan7', 'dan8', 'dan9', 'dan12', 'dan13', 'arithBasic', 'arithHard', 'arithComp', 'clockHour', 'clockFive', 'clockOne']);
  });
});

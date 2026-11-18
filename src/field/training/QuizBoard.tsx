/**
 * 트레이닝 문제 화면 틀 — 위에 문제 카드, 가운데 무대(내 구구몬 왼쪽 아래 → 표적 오른쪽 위), 아래 큰 보기 셋.
 * 그리기만 한다: 규칙·시계·저장은 StudyMode·ChallengeMode가 맡는다.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { creatureSprite, speciesColor } from '../art/creatureSprite';
import type { SpeciesId } from '../../domain/field/creatures';
import type { TrainingQuestion } from '../../domain/field/training';
import { useGameStore } from '../../store/useGameStore';
import { TRAINING_QUESTION_COUNT } from './flow';
import { trainingText } from './trainingText';
import type { TrainingFx } from './useTrainingFx';

interface Props {
  dan: number;
  species: SpeciesId;
  question: TrainingQuestion;
  /** 지금까지 맞힌 문제 수 (진행 점) */
  solved: number;
  fx: TrainingFx;
  /** 위쪽 오른쪽: 시계·진행 */
  badge: ReactNode;
  message: string;
  /** 틀릴 때마다 올라가는 번호 (구구몬 흔들림) */
  wrongKey: number;
  /** 이 문제에서 이미 틀린 보기 (눌러도 안 된다) */
  wrongPicks: readonly number[];
  /** 정답 보기를 빛나게 (학습에서 틀린 뒤) */
  glowAnswer: boolean;
  disabled: boolean;
  onPick: (value: number) => void;
  onQuit: () => void;
  testId: string;
}

export function QuizBoard({ dan, species, question, solved, fx, badge, message, wrongKey, wrongPicks, glowAnswer, disabled, onPick, onQuit, testId }: Props) {
  const stage = useGameStore((s) => s.field.species[species]?.stage ?? 1);
  // 무대 크기를 재서 구구몬 그림 크기를 정한다 (휴대폰·넓은 화면 모두 겹치지 않게)
  const [size, setSize] = useState({ w: 351, h: 220 });
  useEffect(() => {
    const el = fx.stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w > 0 && h > 0) setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fx.stageRef]);
  const ally = Math.max(64, Math.round(Math.min(size.w * 0.44, size.h * 0.95)));
  const target = Math.max(56, Math.round(Math.min(size.w * 0.3, size.h * 0.62)));

  return (
    <div className="training training--play" data-testid={testId}>
      <header className="training__top">
        <button type="button" className="btn btn--ghost training__quit" onClick={onQuit}>
          {trainingText.quit}
        </button>
        <div className="training__dan">{dan}단</div>
        {badge}
      </header>

      <div className="training__question" data-multiplier={question.multiplier} aria-label={`${question.dan} 곱하기 ${question.multiplier}은?`}>
        <span>{question.dan}</span>
        <span className="training__op">×</span>
        <span>{question.multiplier}</span>
        <span className="training__op">=</span>
        <span className="training__blank">?</span>
      </div>
      <div className="training__pips" aria-hidden>
        {Array.from({ length: TRAINING_QUESTION_COUNT }, (_, i) => (
          <span key={i} className={`training__pip ${i < solved ? 'training__pip--done' : i === solved ? 'training__pip--now' : ''}`} />
        ))}
      </div>

      <div ref={fx.stageRef} className="training__stage" style={{ '--ally': `${ally}px`, '--target': `${target}px` } as CSSProperties}>
        <span className="training__base training__base--ally" aria-hidden />
        <div ref={fx.targetRef} className="training__target-wrap" aria-hidden>
          <div key={`t${fx.hitKey}`} className={`training__target ${fx.hitKey > 0 ? 'training__target--hit' : ''}`}>
            <span className="training__board" />
            <span className="training__post" />
          </div>
        </div>
        <div ref={fx.allyRef} className="training__ally-wrap">
          <div key={`a${wrongKey}`} className={`training__ally ${wrongKey > 0 ? 'training__ally--shake' : ''}`}>
            {creatureSprite(species, { view: 'ally', attackAt: fx.attackAt, stage, color: speciesColor(species), size: ally })}
          </div>
        </div>
        <canvas ref={fx.canvasRef} className="training__fx" aria-hidden />
      </div>

      <p className="training__message" role="status">
        {message}
      </p>

      <div className="training__choices">
        {question.choices.map((num) => {
          const wrongPicked = wrongPicks.includes(num);
          const glow = glowAnswer && num === question.answer;
          return (
            <button
              key={num}
              type="button"
              data-testid="training-choice"
              data-answer={num === question.answer ? 'true' : undefined}
              className={`training-choice ${wrongPicked ? 'training-choice--wrong' : ''} ${glow ? 'training-choice--glow' : ''}`}
              aria-label={`답 ${num}`}
              disabled={disabled || wrongPicked}
              onClick={() => onPick(num)}
            >
              {wrongPicked ? <span className="training-choice__x">✕</span> : num}
            </button>
          );
        })}
      </div>
    </div>
  );
}

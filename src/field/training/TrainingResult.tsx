/** 훈련 결과 — 캡슐·마스터·새 기록·레전드 구구몬. 버튼은 다시 하기 / 체육관으로 */
import { speciesDef } from '../../domain/field/creatures';
import { CAPSULE_NAMES } from '../../domain/field/capsules';
import type { ArithOutcome, TrainingOutcome } from '../../store/useGameStore';
import { CapsuleBall } from '../art/CapsuleBall';
import { creatureSprite, speciesColor } from '../art/creatureSprite';
import type { FlowMode, FlowResult } from './flow';
import { trainingText, type ResultText } from './trainingText';

interface Props {
  /** 단 트레이닝일 때만 (글을 단으로 만든다). 셈연습은 text를 직접 넘긴다 */
  dan?: number;
  mode: FlowMode;
  result: FlowResult;
  outcome: TrainingOutcome | ArithOutcome;
  /** 넘기면 이 글을 쓴다 (셈연습 결과) */
  text?: ResultText;
  /** 나가는 버튼 글 (기본 "체육관으로") */
  backLabel?: string;
  timeMs: number;
  /** 학습을 마쳤으니 바로 마스터 도전으로 갈 수 있다 */
  onChallenge?: () => void;
  onAgain: () => void;
  onTown: () => void;
}

export function TrainingResult({ dan = 0, mode, result, outcome, text: given, backLabel = trainingText.backToGym, timeMs, onChallenge, onAgain, onTown }: Props) {
  const text = given ?? trainingText.result(dan, mode, result, outcome as TrainingOutcome, timeMs);
  const pass = result === 'pass';
  const legend = outcome.legend;
  return (
    <div className="training training--result" data-testid="training-result" data-result={result}>
      <div className={`training__result-card ${pass ? 'training__result-card--pass' : ''}`}>
        <h1 className="training__result-title">{text.title}</h1>
        <div className="training__result-lines">
          {text.lines.map((l, i) => (
            <p key={l} className={i === text.newBestIndex ? 'training__new-best' : undefined}>
              {l}
            </p>
          ))}
        </div>
        {outcome.ok && outcome.capsules > 0 && (
          <div className="training__capsules" data-testid="training-capsules" data-capsules={outcome.capsules}>
            {outcome.capsuleType && <CapsuleBall type={outcome.capsuleType} size={72} />}
            <span className="training__capsule-count">× {outcome.capsules}</span>
            {outcome.capsuleType && <small className="training__capsule-name">{CAPSULE_NAMES[outcome.capsuleType]}</small>}
          </div>
        )}
        {legend && (
          <div className="training__legend" data-testid="training-legend" data-species={legend.species}>
            {creatureSprite(legend.species, { view: 'front', stage: 1, color: speciesColor(legend.species), size: 120 })}
            <p>{trainingText.legendLine(speciesDef(legend.species).name, legend.duplicate)}</p>
          </div>
        )}
      </div>
      <div className="training__result-actions">
        {onChallenge && (
          <button type="button" className="btn btn--primary training__btn" onClick={onChallenge}>
            {trainingText.challengeButton}
          </button>
        )}
        <button type="button" className={`btn training__btn ${onChallenge ? '' : 'btn--primary'}`} onClick={onAgain}>
          {trainingText.again}
        </button>
        <button type="button" className="btn btn--ghost training__btn" onClick={onTown}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}

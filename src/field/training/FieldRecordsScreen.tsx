/** 필드에서 보는 학습 기록: 기존 기록 화면을 전체 화면에 담고 위쪽에 마을로 버튼, 아래에 시계 읽기 기록 */
import { useNavigate } from 'react-router-dom';
import { CLOCK_LEVELS, CLOCK_LEVEL_LABELS } from '../../domain/field/clock';
import { RecordsScreen } from '../../screens/RecordsScreen';
import { useGameStore } from '../../store/useGameStore';
import { trainingText } from './trainingText';
import './training.css';

export function FieldRecordsScreen() {
  const navigate = useNavigate();
  const clock = useGameStore((s) => s.field.training.clock);
  return (
    <div className="field-records">
      <div className="field-records__bar">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/field')}>
          ← 돌아가기
        </button>
      </div>
      <div className="field-records__body">
        <RecordsScreen />
        <section className="clock-records" data-testid="clock-records">
          <h2>시계 읽기 최고 기록</h2>
          <ul>
            {CLOCK_LEVELS.map((lv) => (
              <li key={lv} data-level={lv}>
                {CLOCK_LEVEL_LABELS[lv]}: {clock[lv] ? `⭐ ${trainingText.seconds(clock[lv]!.bestMs)}` : '아직 도전 전'}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

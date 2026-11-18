/** 필드에서 보는 학습 기록: 기존 기록 화면을 전체 화면에 담고 위쪽에 마을로 버튼 */
import { useNavigate } from 'react-router-dom';
import { RecordsScreen } from '../../screens/RecordsScreen';
import './training.css';

export function FieldRecordsScreen() {
  const navigate = useNavigate();
  return (
    <div className="field-records">
      <div className="field-records__bar">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/field')}>
          ← 돌아가기
        </button>
      </div>
      <div className="field-records__body">
        <RecordsScreen />
      </div>
    </div>
  );
}

/** 주소 이사 화면 두 개: 옛 주소에서 보내기(MigrateOutScreen), 새 주소에서 받기(MigrateInScreen) */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MIGRATE_TO } from '../config/migration';
import { type BackupSummary, exportBackup } from '../domain/shareCode';
import { encodeMigration, migrationUrl, readMigration } from '../domain/migration';
import { useGameStore } from '../store/useGameStore';
import { currentSave } from './admin/DataSecurityPanels';
import { dateStamp, downloadText } from './admin/fields';
import './migrate.css';

/** 기록이 하나라도 있나 (구구몬·별·탐험) */
function hasProgress(save: ReturnType<typeof currentSave>): boolean {
  return Object.keys(save.field?.species ?? {}).length > 0 || save.economy.stars > 0 || save.learning.totalExplorations > 0 || !!save.pet.species;
}

/** 옛 주소용 빌드가 게임 대신 보여 주는 화면. 눌러야 넘어가고, 옛 기기의 기록은 지우지 않는다 */
export function MigrateOutScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    setBusy(true);
    setError('');
    try {
      const save = currentSave();
      const payload = hasProgress(save) ? await encodeMigration(save, Date.now()) : '';
      window.location.href = payload ? migrationUrl(MIGRATE_TO, payload) : `${MIGRATE_TO}/`;
    } catch {
      setError('데이터를 옮기지 못했어요. 아래 「백업 파일 저장」으로 옮겨 주세요.');
      setBusy(false);
    }
  };

  return (
    <main className="migrate">
      <div className="migrate__card">
        <h1 className="migrate__title">새 집으로 이사했어요!</h1>
        <p className="migrate__text">
          구구단 몬스터가 새 주소로 이사했어요.
          <br />
          아래 버튼을 누르면 지금까지 모은 구구몬과 기록을 가지고 새 주소로 가요.
        </p>
        <button type="button" className="migrate__btn" disabled={busy} onClick={go}>
          {busy ? '옮기는 중…' : '기록 가지고 새 주소로 가기'}
        </button>
        {error && <p className="migrate__error" role="alert">{error}</p>}
        <p className="migrate__small">이 기기의 기록은 지워지지 않아요. 새 주소에서 잘 이어지는지 확인한 뒤에 정리해도 돼요.</p>
        <button
          type="button"
          className="migrate__link"
          onClick={() => downloadText(`catch-gugumon-backup-${dateStamp(Date.now())}.json`, exportBackup(currentSave(), Date.now()))}
        >
          백업 파일 저장 (옮기기가 안 될 때)
        </button>
      </div>
    </main>
  );
}

type Incoming = { save: Record<string, unknown>; summary: BackupSummary };

/** 새 주소의 받는 화면: 넘어온 기록을 보여 주고, 확인하면 이 기기의 기록으로 바꾼다 */
export function MigrateInScreen() {
  const { payload = '' } = useParams();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [error, setError] = useState('');
  const [hadLocal] = useState(() => hasProgress(currentSave()));

  useEffect(() => {
    let alive = true;
    void readMigration(payload).then((r) => {
      if (!alive) return;
      if (r.ok) setIncoming({ save: r.save, summary: r.summary });
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [payload]);

  const apply = () => {
    if (!incoming) return;
    useGameStore.getState().replaceSave(incoming.save);
    navigate('/field', { replace: true });
  };

  return (
    <main className="migrate">
      <div className="migrate__card">
        <h1 className="migrate__title">이사 온 기록</h1>
        {error && (
          <>
            <p className="migrate__error" role="alert">{error}</p>
            <button type="button" className="migrate__btn" onClick={() => navigate('/', { replace: true })}>
              처음 화면으로
            </button>
          </>
        )}
        {!error && !incoming && <p className="migrate__text">기록을 읽는 중…</p>}
        {incoming && (
          <>
            <ul className="migrate__list">
              <li>펫: {incoming.summary.petName}</li>
              <li>별: ★ {incoming.summary.stars}</li>
              <li>탐험: {incoming.summary.explorations}번 · 공부한 날 {incoming.summary.studyDays}일</li>
            </ul>
            <p className="migrate__text">
              {hadLocal ? '이 기기에 이미 있는 기록은 이 기록으로 바뀌어요.' : '이 기록으로 이어서 해요.'}
              <br />
              (관리자 비밀번호는 옮겨지지 않아요)
            </p>
            <button type="button" className="migrate__btn" onClick={apply}>
              이 기록으로 이어서 하기
            </button>
            <button type="button" className="migrate__link" onClick={() => navigate('/', { replace: true })}>
              옮기지 않고 시작하기
            </button>
          </>
        )}
      </div>
    </main>
  );
}

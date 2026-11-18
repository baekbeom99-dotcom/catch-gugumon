/** 저학년 모드를 켜고 끌 때 묻는 비밀번호 창 — 숫자 4개 (부모용). 틀려도 잠기지 않고 다시 누를 수 있다 */
import { useEffect, useState } from 'react';
import { checkLowGradePassword } from '../../domain/field/lowGrade';
import { PinPad } from '../../screens/admin/PinPad';
import '../../screens/admin/admin.css';
import '../../screens/battle.css';
import './lowgrade.css';

interface Props {
  /** 지금 모드가 꺼져 있어서 켜려는 중인가 (글만 다르다) */
  turningOn: boolean;
  /** 비밀번호가 맞았다 */
  onSuccess: () => void;
  /** 닫기: 아무것도 바꾸지 않는다 */
  onCancel: () => void;
}

export const PASSWORD_WRONG = '비밀번호가 맞지 않아요';

export function PasswordDialog({ turningOn, onSuccess, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const onComplete = (pin: string) => {
    if (checkLowGradePassword(pin)) onSuccess();
    else setError(PASSWORD_WRONG);
  };

  return (
    <div className="modal lowgrade-modal" role="dialog" aria-modal="true" aria-label="저학년 모드 비밀번호">
      <div className="modal__card lowgrade-modal__card">
        <PinPad
          title={turningOn ? '저학년 모드 켜기' : '저학년 모드 끄기'}
          subtitle="비밀번호 숫자 4개를 눌러요"
          error={error}
          onComplete={onComplete}
        />
        <button type="button" className="btn btn--ghost lowgrade-modal__cancel" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

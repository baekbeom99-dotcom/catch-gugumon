/** 처음 화면: 그림 한 장 위에 [시작하기]를 가운데 두고, 오른쪽 위에 저학년 모드 스위치를 둔다 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpriteCredit } from '../field/art/SpriteCredit';
import { isQuizEnabled } from '../config/featureFlags';
import { PasswordDialog } from '../field/lowgrade/PasswordDialog';
import { useGameStore } from '../store/useGameStore';
import title3x4 from '../assets/title/title-3x4.webp';
import titleTall from '../assets/title/title-tall.webp';
import '../field/lowgrade/lowgrade.css';
import './title.css';

export function TitleScreen() {
  const navigate = useNavigate();
  const lowGrade = useGameStore((s) => s.settings.lowGrade);
  const [asking, setAsking] = useState(false);
  return (
    <section className="title">
      {/* 화면이 세로로 아주 길면(가로÷세로 < 3:5) 긴 그림, 아니면 3:4 그림. 늘리지 않고 비율 그대로 덮는다 */}
      <picture className="title__art">
        <source media="(min-aspect-ratio: 3/5)" srcSet={title3x4} />
        <img src={titleTall} alt="" decoding="async" fetchPriority="high" draggable={false} />
      </picture>
      {/* 제목 글자는 그림 안에 있다. 화면 읽기용으로만 둔다 */}
      <h1 className="title__sr">잡아라! 구구단 몬스터</h1>

      <div className="title__center">
        <button type="button" className="title__start" aria-label="시작하기" onClick={() => navigate('/field')}>
          <span className="title__start-star" aria-hidden />
          <span>시작하기</span>
        </button>
        {isQuizEnabled() && (
          <button type="button" className="title__quiz" onClick={() => navigate('/pet')}>
            퀴즈 모험
          </button>
        )}
      </div>

      {/* 저학년 모드(덧셈·뺄셈): 오른쪽 위. 켜고 끌 때 모두 비밀번호를 묻는다 */}
      <button type="button" role="switch" aria-checked={lowGrade} aria-label="저학년 모드" className="title__lowgrade" onClick={() => setAsking(true)}>
        <span>저학년 모드</span>
        <span className="title__sr">{lowGrade ? '켜짐' : '꺼짐'}</span>
        <span className="title__lowgrade-track" aria-hidden />
      </button>
      {/* 부모용 길: 아이 눈에 덜 띄게 작게. 눌러도 PIN이 있어야 열린다 */}
      <button type="button" className="title__admin" onClick={() => navigate('/admin')}>
        관리
      </button>
      {asking && (
        <PasswordDialog
          turningOn={!lowGrade}
          onCancel={() => setAsking(false)}
          onSuccess={() => {
            useGameStore.getState().setLowGrade(!lowGrade);
            setAsking(false);
          }}
        />
      )}
      <SpriteCredit />
    </section>
  );
}

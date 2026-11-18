/** 처음 화면: 퀴즈 모험과 필드 모험 중에서 고른다. 뒤에는 작은 필드 그림 */
import { useNavigate } from 'react-router-dom';
import { DAN_COLORS } from '../art/colors';
import { MonsterSprite } from '../art/MonsterSprite';
import { SpriteCredit } from '../field/art/SpriteCredit';
import { PixelSprite } from '../field/art/PixelSprite';
import { HERO_SPRITES } from '../field/art/hero';
import { HERO_ART } from '../field/art/localSprites';
import { isQuizEnabled } from '../config/featureFlags';
import './title.css';

export function TitleScreen() {
  const navigate = useNavigate();
  return (
    <section className="title">
      <div className="title__scene" aria-hidden>
        <span className="title__sun" />
        <span className="title__cloud title__cloud--a" />
        <span className="title__cloud title__cloud--b" />
        <span className="title__hill title__hill--back" />
        <span className="title__hill title__hill--front" />
        <span className="title__path" />
        <div className="title__cast">
          <MonsterSprite kind="cloud" color={DAN_COLORS[5]} mood="happy" size={112} className="title__mon title__mon--a" />
          {/* 주인공: 이 PC에 치비 그림(017)이 있으면 그 앞모습, 없으면 픽셀 주인공 */}
          {HERO_ART ? (
            <img src={HERO_ART.front} alt="" height={80} className="title__mon title__mon--c title__hero-img" draggable={false} />
          ) : (
            <PixelSprite art={HERO_SPRITES.down[0]} size={64} className="title__mon title__mon--c title__hero" />
          )}
          <MonsterSprite kind="jelly" color={DAN_COLORS[8]} mood="idle" size={100} className="title__mon title__mon--b" />
        </div>
      </div>
      <h1 className="title__name">구구단 몬스터 탐험대</h1>
      <div className="title__buttons">
        {isQuizEnabled() && (
          <button type="button" className="btn btn--primary title__btn" onClick={() => navigate('/pet')}>
            퀴즈 모험
          </button>
        )}
        <button type="button" className={`btn title__btn ${isQuizEnabled() ? 'btn--ghost' : 'btn--primary'}`} onClick={() => navigate('/field')}>
          필드 모험
        </button>
      </div>
      {/* 부모용 길: 아이 눈에 덜 띄게 작게. 눌러도 PIN이 있어야 열린다 */}
      <button type="button" className="title__admin" onClick={() => navigate('/admin')}>
        관리
      </button>
      <SpriteCredit />
    </section>
  );
}

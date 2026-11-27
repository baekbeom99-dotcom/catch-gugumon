/** [꾸미기] 탭: 보유 별 + 색 세트 카드(미리보기·색 세 칸·이름·사기/입기/입는 중). 별점수가 꺼져 있으면 안내만 */
import { isStarPointsEnabled } from '../../config/featureFlags';
import { canBuyCostume, COSTUME_SETS, type CostumeSet, type HsvTarget } from '../../domain/field/costumes';
import { formatStars } from '../../domain/field/starPoints';
import { useGameStore } from '../../store/useGameStore';
import { useHeroFront } from '../art/heroCostume';
import { HERO_ART } from '../art/localSprites';
import { shopText } from './shopText';

const GROUPS: { group: CostumeSet['group']; title: string }[] = [
  { group: 'basic', title: shopText.costumeGroupBasic },
  { group: 'flag', title: shopText.costumeGroupFlag },
  { group: 'concept', title: shopText.costumeGroupConcept },
];

/** 색 한 칸을 화면에 보일 색으로 (곱하는 값을 고정 채도·밝기에 곱해 근사) */
export function swatchColor(t: HsvTarget): string {
  const s = Math.min(1, 0.75 * (t.sat ?? 1));
  const v = Math.min(1, 0.85 * (t.val ?? 1));
  const h = (((t.hue % 360) + 360) % 360) / 60;
  const f = (n: number) => {
    const k = (n + h) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(5))}${hex(f(3))}${hex(f(1))}`;
}

function CostumeCard({ set, owned, worn, stars }: { set: CostumeSet; owned: boolean; worn: boolean; stars: number }) {
  const front = useHeroFront(set.id);
  const costume = useGameStore((s) => s.field.costume);
  const buy = useGameStore((s) => s.buyCostume);
  const equip = useGameStore((s) => s.equipCostume);
  const affordable = canBuyCostume(costume, stars, set.id);
  const basic = set.group === 'basic';

  let action;
  if (worn) {
    action = (
      <button type="button" className="btn btn--ghost fshop-btn fshop-btn--small" disabled aria-label={`${set.name} ${shopText.costumeWorn}`}>
        {shopText.costumeWorn}
      </button>
    );
  } else if (owned) {
    action = (
      <button type="button" className="btn btn--primary fshop-btn fshop-btn--small" aria-label={`${set.name} ${shopText.costumeWear}`} onClick={() => equip(set.id)}>
        {shopText.costumeWear}
      </button>
    );
  } else {
    action = (
      <>
        <button
          type="button"
          className="btn btn--primary fshop-btn fshop-btn--small"
          aria-label={`${set.name} ${shopText.costumeBuyLabel}`}
          disabled={!affordable}
          onClick={() => buy(set.id)}
        >
          {shopText.costumeBuy(set.price)}
        </button>
        {!affordable && <span className="costume-card__why">{shopText.costumeShort}</span>}
      </>
    );
  }

  return (
    <li className={`costume-card ${worn ? 'costume-card--worn' : ''}`} data-testid={`costume-${set.id}`}>
      <span className="costume-card__view" aria-hidden="true">
        {HERO_ART && front ? <img className="costume-card__img" src={front} alt="" draggable={false} /> : <span className="costume-card__ph" />}
      </span>
      {!basic && (
        <span className="costume-card__colors" aria-hidden="true">
          {[set.hair, set.shirt, set.pants].map((c, i) => (
            <span key={i} className="costume-card__dot" style={{ background: swatchColor(c) }} />
          ))}
        </span>
      )}
      <span className="costume-card__name">{set.name}</span>
      {action}
    </li>
  );
}

export function CostumeTab() {
  const stars = useGameStore((s) => s.field.starPoints);
  const costume = useGameStore((s) => s.field.costume);
  if (!isStarPointsEnabled()) return <p className="fshop-note">{shopText.costumeOff}</p>;
  return (
    <div className="fshop-section">
      <p className="fshop-note fshop-note--good" data-testid="costume-stars" aria-label={shopText.costumeStarsLabel(formatStars(stars))}>
        ⭐ {formatStars(stars)}
      </p>
      {GROUPS.map(({ group, title }) => (
        <section key={group} className="fshop-section">
          <h3 className="costume-group">{title}</h3>
          <ul className="costume-grid">
            {COSTUME_SETS.filter((s) => s.group === group).map((s) => (
              <CostumeCard key={s.id} set={s} owned={costume.owned.includes(s.id)} worn={costume.equipped === s.id} stars={stars} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

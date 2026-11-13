/** 쓰러졌을 때 도감에서 함께 갈 구구몬을 고르는 창 (닫기 없음 — 골라야 다시 걷는다) */
import { healthyCompanions } from '../../domain/field/companion';
import type { SpeciesId } from '../../domain/field/creatures';
import { displayName } from '../../domain/field/growth';
import { useGameStore } from '../../store/useGameStore';
import { HpBar } from '../HpBar';
import { battleText } from '../battle/battleText';
import { creatureSprite, speciesColor } from '../art/creatureSprite';

export function CompanionPickDialog({ fainted, onPicked }: { fainted: SpeciesId; onPicked: (id: SpeciesId) => void }) {
  const species = useGameStore((s) => s.field.species);
  const list = healthyCompanions(species, fainted);
  const down = species[fainted];
  return (
    <div className="fpick" role="dialog" aria-modal="true" aria-label="구구몬 고르기">
      <div className="fpick__box">
        <div className="fpick__title">{battleText.pickTitle}</div>
        {down && <div className="fpick__body">{battleText.pickBody(displayName(fainted, down.stage))}</div>}
        <div className="fpick__list">
          {list.map((id) => {
            const e = species[id]!;
            const name = displayName(id, e.stage);
            return (
              <button
                key={id}
                type="button"
                className="fpick__item"
                aria-label={`${name} 고르기`}
                onClick={() => {
                  if (useGameStore.getState().setCompanion(id)) onPicked(id);
                }}
              >
                <span className="fpick__pic">{creatureSprite(id, { view: 'front', stage: e.stage, color: speciesColor(id), size: 48 })}</span>
                <span className="fpick__name">{name}</span>
                <span className="fpick__meta">
                  Lv{e.level} · 체력 {e.hp}
                </span>
                <HpBar hp={e.hp} label={`체력 ${e.hp}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

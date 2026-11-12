/** 기술 카드 한 장 — 이름·종류·위력 ★·특수 설명·발동 조건. 선택창과 관리 화면이 같이 쓴다 */
import type { ReactNode } from 'react';
import type { SkillDef } from '../domain/field/skills';
import { skillText } from './skillText';
import './skills.css';

export function SkillCard({ def, note, children }: { def: SkillDef; note?: string; children?: ReactNode }) {
  const special = skillText.special(def);
  return (
    <div className={`skill-card skill-card--${def.kind}`} data-skill={def.id}>
      <div className="skill-card__head">
        <span className="skill-card__name">{def.name}</span>
        <span className={`skill-card__tag skill-card__tag--${def.element ?? 'special'}`}>{skillText.kind(def)}</span>
        <span className="skill-card__power" aria-label={`위력 ${def.basePower}`}>
          {skillText.power(def)}
        </span>
      </div>
      {special && <p className="skill-card__line skill-card__line--special">{special}</p>}
      <p className="skill-card__line">{skillText.condition(def)}</p>
      {note && <p className="skill-card__line skill-card__line--note">{note}</p>}
      {children}
    </div>
  );
}

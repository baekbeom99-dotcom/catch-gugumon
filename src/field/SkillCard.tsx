/** 기술 카드 한 장 — 이름·종류·위력 ★·효과·단계별 시간 조건. 선택창과 관리 화면이 같이 쓴다 */
import type { ReactNode } from 'react';
import { seatedDef, type SkillDef } from '../domain/field/skills';
import type { SpeciesId } from '../store/fieldData';
import { skillText } from './skillText';
import './skills.css';

interface Props {
  def: SkillDef;
  /** 이 기술을 쓰는 구구몬 — 자리 위력·종류·시간 조건을 그 구구몬 기준으로 센다 */
  owner: SpeciesId;
  /** 카드 맨 위 작은 꼬리표 ("지금 쓰는 기술" 등) */
  badge?: string;
  note?: string;
  locked?: boolean;
  children?: ReactNode;
}

export function SkillCard({ def, owner, badge, note, locked = false, children }: Props) {
  const effect = skillText.effect(def, owner);
  const power = seatedDef(def, owner).basePower;
  return (
    <div className={`skill-card skill-card--${def.kind} ${locked ? 'skill-card--locked' : ''}`} data-skill={def.id}>
      {badge && <p className="skill-card__badge">{badge}</p>}
      <div className="skill-card__head">
        <span className="skill-card__name">{def.name}</span>
        <span className={`skill-card__tag skill-card__tag--${def.element ?? 'special'}`}>{skillText.kind(def, owner)}</span>
        <span className="skill-card__power" role="img" aria-label={`위력 ${power}`}>
          {skillText.power(def, owner)}
        </span>
      </div>
      {effect && <p className="skill-card__line skill-card__line--special">{effect}</p>}
      {skillText.lines(def, owner).map((line) => (
        <p key={line} className="skill-card__line skill-card__line--time">
          {line}
        </p>
      ))}
      {note && <p className="skill-card__line skill-card__line--note">{note}</p>}
      {children}
    </div>
  );
}

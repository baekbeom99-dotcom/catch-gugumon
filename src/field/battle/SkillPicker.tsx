/**
 * 기술 고르기 — 문제가 뜨기 전에 가진 기술(최대 5개) 중 하나를 고른다 (필드 모험 3차 2-6·5절).
 * 버튼마다 이름·속성·위력 ★·발동 조건·상성 글. 375px에서 잘리지 않게 두 줄 격자(위 3칸·아래 2칸).
 * 고르는 동안은 문제 시계가 멈춰 있다(도메인 'pick' 단계).
 */
import { ELEMENT_NAMES, type Element } from '../../domain/field/elements';
import { fastSeconds, type SkillDef } from '../../domain/field/skills';
import { battleText } from './battleText';
import { skillMatchup } from './skillUse';

interface Props {
  skills: readonly SkillDef[];
  /** 그 단계 문제 제한 시간 (TIER_RULES[tier].timeMs) — 발동 조건 초를 여기서 센다 */
  timeMs: number;
  /** 야생 구구몬 주속성 (상성) */
  wildMain: Element;
  disabled?: boolean;
  onPick: (def: SkillDef) => void;
}

export function SkillPicker({ skills, timeMs, wildMain, disabled = false, onPick }: Props) {
  return (
    <div className="skill-picker" role="group" aria-label="기술 고르기">
      <p className="skill-picker__title">{battleText.choose}</p>
      <div className={`skill-picker__grid skill-picker__grid--n${skills.length}`}>
        {skills.map((def) => {
          const sec = fastSeconds(def, timeMs);
          const m = skillMatchup(def, wildMain);
          const tag = def.element ? ELEMENT_NAMES[def.element] : battleText.specialTag;
          const cond = def.special ? battleText.specialCondition(sec, def.special) : battleText.fastCondition(sec);
          const match = m === null ? '' : m > 0 ? 'up' : m < 0 ? 'down' : 'even';
          return (
            <button
              key={def.id}
              type="button"
              className={`skill-pick skill-pick--${def.kind}`}
              data-skill={def.id}
              disabled={disabled}
              onClick={() => onPick(def)}
            >
              <span className="skill-pick__name">{def.name}</span>
              <span className="skill-pick__meta">
                <span className={`skill-pick__tag skill-pick__tag--${def.element ?? 'special'}`}>{tag}</span>
                <span className="skill-pick__power" aria-label={`위력 ${def.basePower}`}>
                  {battleText.power(def.basePower)}
                </span>
              </span>
              <span className="skill-pick__cond">{cond}</span>
              {m !== null && <span className={`skill-pick__match skill-pick__match--${match}`}>{battleText.matchup(m)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

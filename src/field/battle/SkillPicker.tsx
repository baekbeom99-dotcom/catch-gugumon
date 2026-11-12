/**
 * 기술 고르기 — 문제가 뜨기 전에 기술 버튼(최대 3개: 주속성·부속성·특수) 중 하나를 고른다 (설계서 0-1절).
 * 개정(UI 간결화): 버튼 3개를 한 줄에 나란히, 화면에는 속성 색 표시·짧은 이름·상성 ▲▼만 보인다.
 * 위력 별·단계별 시간 조건은 화면에서 빼고 읽기 도구용 숨김 글(sr-only)과 aria-label에만 둔다 (판정·값은 그대로).
 * 고르는 동안은 문제 시계가 멈춰 있다(도메인 'pick' 단계).
 */
import { ELEMENT_NAMES, type Element } from '../../domain/field/elements';
import { buttonFace, type SkillButton } from '../../domain/field/skills';
import { battleText } from './battleText';
import { buttonBrief, buttonHiddenText, buttonShortName, skillMatchup } from './skillUse';

interface Props {
  buttons: readonly SkillButton[];
  /** 그 단계 문제 제한 시간 (TIER_RULES[tier].timeMs) — 숨김 글의 초를 여기서 센다 */
  timeMs: number;
  /** 야생 구구몬 주속성 (상성) */
  wildMain: Element;
  disabled?: boolean;
  onPick: (button: SkillButton) => void;
}

export function SkillPicker({ buttons, timeMs, wildMain, disabled = false, onPick }: Props) {
  return (
    <div className="skill-picker" role="group" aria-label="기술 고르기">
      <p className="skill-picker__title">{battleText.choose}</p>
      {buttons.length >= 2 && <p className="skill-picker__hint">{battleText.chooseHint}</p>}
      <div className={`skill-picker__grid skill-picker__grid--b${buttons.length}`}>
        {buttons.map((b) => {
          const face = buttonFace(b);
          // 상성: 주속성 버튼은 모든 단계가 같은 속성이라 한 번, 부속성은 그 기술 속성, 특수는 없음
          const m = b.kind === 'special' ? null : skillMatchup(face, wildMain);
          const tag = face.element ? ELEMENT_NAMES[face.element] : battleText.specialTag;
          const brief = buttonBrief(b);
          return (
            <button
              key={b.kind}
              type="button"
              className={`skill-pick skill-pick--${b.kind}`}
              data-skill={face.id}
              data-button={b.kind}
              disabled={disabled}
              onClick={() => onPick(b)}
            >
              <span className={`skill-pick__tag skill-pick__tag--${face.element ?? 'special'}`} aria-hidden>
                {tag}
              </span>
              <span className="skill-pick__name">{buttonShortName(b)}</span>
              {brief && <span className="skill-pick__brief">{brief}</span>}
              {m !== null && m !== 0 && (
                <span className={`skill-pick__match skill-pick__match--${m > 0 ? 'up' : 'down'}`} aria-hidden>
                  {m > 0 ? '▲ 효과가 커요' : '▼ 별로예요'}
                </span>
              )}
              <span className="skill-pick__sr">
                {buttonHiddenText(b, timeMs)}
                {m !== null ? `. ${battleText.matchup(m)}` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

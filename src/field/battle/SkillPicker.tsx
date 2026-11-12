/**
 * 기술 고르기 — 문제가 뜨기 전에 기술 버튼(최대 3개: 주속성·부속성·특수) 중 하나를 고른다 (설계서 0-1절).
 * 버튼마다 이름·속성·위력 ★·단계별 시간 조건(fastSeconds — 판정·시간 막대와 같은 값)·상성 글, 그리고 시간 막대 미리보기.
 * 375px에서 잘리지 않게 주속성 버튼은 한 줄을 다 쓰고, 부속성·특수는 아래 줄에 나란히.
 * 고르는 동안은 문제 시계가 멈춰 있다(도메인 'pick' 단계).
 */
import { ELEMENT_NAMES, type Element } from '../../domain/field/elements';
import { buttonFace, type SkillButton } from '../../domain/field/skills';
import { TimerBar } from './BattleBars';
import { battleText } from './battleText';
import { buttonLines, buttonPower, gaugeStops, skillMatchup } from './skillUse';

interface Props {
  buttons: readonly SkillButton[];
  /** 그 단계 문제 제한 시간 (TIER_RULES[tier].timeMs) — 시간 조건 초를 여기서 센다 */
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
      <div className={`skill-picker__grid skill-picker__grid--b${buttons.length}`}>
        {buttons.map((b) => {
          const face = buttonFace(b);
          // 상성: 주속성 버튼은 모든 단계가 같은 속성이라 한 번, 부속성은 그 기술 속성, 특수는 없음
          const m = b.kind === 'special' ? null : skillMatchup(face, wildMain);
          const tag = face.element ? ELEMENT_NAMES[face.element] : battleText.specialTag;
          const match = m === null ? '' : m > 0 ? 'up' : m < 0 ? 'down' : 'even';
          const stops = gaugeStops(b, timeMs);
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
              <span className="skill-pick__head">
                <span className="skill-pick__name">{face.name}</span>
                <span className={`skill-pick__tag skill-pick__tag--${face.element ?? 'special'}`}>{tag}</span>
                <span className="skill-pick__power">{buttonPower(b)}</span>
              </span>
              <span className="skill-pick__lines">
                {buttonLines(b, timeMs).map((line) => (
                  <span key={line} className="skill-pick__cond">
                    {line}
                  </span>
                ))}
              </span>
              {stops.length > 0 && (
                <span className="skill-pick__gauge">
                  <TimerBar ms={timeMs} totalMs={timeMs} stops={stops} preview />
                </span>
              )}
              {m !== null && <span className={`skill-pick__match skill-pick__match--${match}`}>{battleText.matchup(m)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

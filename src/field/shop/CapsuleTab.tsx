/** [캡슐] 탭: 네 종류 줄(그림·이름·보유 수·[얻기]) → 얻기를 누르면 바로 연습 (단 고르기 없음) */
import {
  CAPSULE_NAMES,
  CAPSULE_TYPES,
  type CapsuleType,
} from "../../domain/field/capsules";
import { capsulePracticeOpen } from "../../domain/field/shopQuiz";
import { useGameStore } from "../../store/useGameStore";
import { CapsuleBall } from "../art/CapsuleBall";
import { shopText } from "./shopText";

export function CapsuleTab({
  onPractice,
}: {
  onPractice: (type: CapsuleType) => void;
}) {
  const capsules = useGameStore((s) => s.field.capsules);
  const challengeUnlocked = useGameStore((s) => s.learning.challengeUnlocked);

  const locked = CAPSULE_TYPES.some(
    (t) => !capsulePracticeOpen(t, challengeUnlocked),
  );
  return (
    <>
      <ul className="fshop-list">
        {CAPSULE_TYPES.map((t) => (
          <li key={t} className="fshop-row" data-capsule={t}>
            <CapsuleBall type={t} size={44} />
            <span className="fshop-row__name">{CAPSULE_NAMES[t]}</span>
            <span
              className="fshop-row__count"
              aria-label={`${CAPSULE_NAMES[t]} ${capsules[t]}개`}
            >
              {capsules[t]}
            </span>
            <button
              type="button"
              className="btn btn--primary fshop-btn fshop-btn--small"
              aria-label={`${CAPSULE_NAMES[t]} ${shopText.get}`}
              disabled={!capsulePracticeOpen(t, challengeUnlocked)}
              onClick={() => onPractice(t)}
            >
              {shopText.get}
              {capsulePracticeOpen(t, challengeUnlocked) ? "" : " 🔒"}
            </button>
          </li>
        ))}
      </ul>
      {locked && (
        <p className="fshop-note fshop-note--small">{shopText.lockedLegend}</p>
      )}
    </>
  );
}

/**
 * 기술 선택창 — 새 기술이 들어갈 자리(부속성·특수)가 차 있을 때 제안이 오면 한 번에 하나씩 뜬다 (3차 설계 2-5, 개정 3 0-1절).
 * 같은 자리끼리만 바꿀 수 있으므로 잊을 기술은 그 자리의 지금 기술 하나다. 잊고 배우거나, 둘째 버튼(레벨 제안 "배우지 않기" / 복사 제안 "포기")으로 넘긴다.
 * 어떻게 끝내든 제안은 하나 처리되고 다음 제안으로 간다. Esc는 둘째 버튼과 같다. 처음 포커스는 되돌릴 수 있는 둘째 버튼.
 */
import { useEffect } from 'react';
import { speciesDef } from '../domain/field/creatures';
import { skillDef } from '../domain/field/skills';
import { useGameStore } from '../store/useGameStore';
import { useSessionStore } from '../store/useSessionStore';
import { SkillCard } from './SkillCard';
import { holdUpdateBusy, offerStatus, seatOccupant } from './skillOfferState';
import { skillText } from './skillText';
import './skills.css';

const skip = () => useSessionStore.getState().shiftSkillOffer();

export function SkillOfferDialog() {
  const offer = useSessionStore((s) => s.skillOffers[0] ?? null);
  const held = useGameStore((s) => (offer ? (s.field.species[offer.species]?.skills ?? null) : null));

  // 떠 있는 동안 자동 새로고침을 막는다
  useEffect(holdUpdateBusy, []);

  // 이미 가진 기술이거나 그 종이 없으면 건너뛴다 (같은 전투에서 같은 기술이 두 번 올 수 있다)
  const status = offerStatus(offer, held);
  const stale = status === 'skip';
  useEffect(() => {
    if (stale) skip();
  }, [stale, offer]);

  // 그 자리가 비어 있으면 그냥 가진다 (앞 제안을 받아 자리가 비었을 때 등)
  const roomy = status === 'take';
  useEffect(() => {
    if (!roomy || !offer) return;
    useGameStore.getState().addSkill(offer.species, offer.skillId);
    skip();
  }, [roomy, offer]);

  useEffect(() => {
    if (!offer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offer]);

  if (!offer || !held || stale || roomy) return null;
  const def = skillDef(offer.skillId);
  // 잊을 기술: 그 자리의 지금 기술 하나 (ask일 때는 늘 있다)
  const occupant = seatOccupant(offer, held);

  return (
    <div className="skill-offer" role="dialog" aria-modal="true" aria-label="기술 선택창" data-offer-source={offer.source} data-offer-seat={offer.seat}>
      <div className="skill-offer__card">
        <h2 className="skill-offer__title">{skillText.offerTitle(offer)}</h2>
        <p className="skill-offer__who">{speciesDef(offer.species).name}</p>
        <SkillCard def={def} owner={offer.species} badge={skillText.newBadge} note={skillText.source(offer)} />
        <p className="skill-offer__hint">{skillText.offerHint(offer)}</p>
        {occupant && (
          <SkillCard def={skillDef(occupant)} owner={offer.species} badge={skillText.nowHeld}>
            <button
              type="button"
              className="btn btn--primary skill-offer__forget"
              data-skill={occupant}
              onClick={() => {
                useGameStore.getState().acceptSkillOffer(offer, occupant);
                skip();
              }}
            >
              {skillText.forgetAndLearn}
            </button>
          </SkillCard>
        )}
        {/* 되돌릴 수 없는 "잊고 배우기"가 아니라 이 버튼에 처음 포커스 (Enter를 눌러도 기술을 잃지 않게) */}
        <button type="button" autoFocus className="btn btn--ghost skill-offer__skip" onClick={skip}>
          {skillText.skip(offer)}
        </button>
        {skillText.skipNote(offer) && <p className="skill-offer__note">{skillText.skipNote(offer)}</p>}
        <p className="skill-offer__note">{skillText.timeNote}</p>
      </div>
    </div>
  );
}

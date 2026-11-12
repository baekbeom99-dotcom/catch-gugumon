/**
 * 기술 선택창 — 가진 기술이 가득일 때 새 기술 제안이 오면 한 번에 하나씩 뜬다 (3차 설계 2-5).
 * 가진 기술 하나를 잊고 배우거나, 둘째 버튼(레벨 제안 "배우지 않기" / 복사 제안 "포기")으로 넘긴다.
 * 어떻게 끝내든 제안은 하나 처리되고 다음 제안으로 간다. Esc는 둘째 버튼과 같다.
 */
import { useEffect } from 'react';
import { speciesDef } from '../domain/field/creatures';
import { ELEMENT_NAMES } from '../domain/field/elements';
import { skillDef } from '../domain/field/skills';
import { MAX_SKILLS } from '../domain/field/tuning';
import { setUpdateBusy } from '../pwa/autoUpdate';
import { useGameStore } from '../store/useGameStore';
import { useSessionStore } from '../store/useSessionStore';
import { SkillCard } from './SkillCard';
import { skillText } from './skillText';
import './skills.css';

const skip = () => useSessionStore.getState().shiftSkillOffer();

export function SkillOfferDialog() {
  const offer = useSessionStore((s) => s.skillOffers[0] ?? null);
  const held = useGameStore((s) => (offer ? (s.field.species[offer.species]?.skills ?? null) : null));

  // 떠 있는 동안 자동 새로고침을 막는다
  useEffect(() => {
    setUpdateBusy(true);
    return () => setUpdateBusy(false);
  }, []);

  // 이미 가진 기술이거나 그 종이 없으면 건너뛴다 (같은 전투에서 같은 기술이 두 번 올 수 있다)
  const stale = !!offer && (!held || held.includes(offer.skillId));
  useEffect(() => {
    if (stale) skip();
  }, [stale, offer]);

  // 빈 자리가 있으면 그냥 가진다 (보통은 일어나지 않는다)
  const roomy = !!offer && !!held && !stale && held.length < MAX_SKILLS;
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

  return (
    <div className="skill-offer" role="dialog" aria-modal="true" aria-label="기술 선택창" data-offer-source={offer.source}>
      <div className="skill-offer__card">
        <h2 className="skill-offer__title">{skillText.offerTitle(offer)}</h2>
        <p className="skill-offer__who">{speciesDef(offer.species).name}</p>
        <SkillCard def={def} note={skillText.source(offer)} />
        <p className="skill-offer__hint">{skillText.offerHint(offer)}</p>
        <div className="skill-offer__grid" role="group" aria-label="잊을 기술 고르기">
          {held.map((id) => {
            const k = skillDef(id);
            return (
              <button
                key={id}
                type="button"
                className="skill-offer__pick"
                data-skill={id}
                aria-label={`${k.name} ${skillText.forgetAndLearn}`}
                onClick={() => {
                  useGameStore.getState().acceptSkillOffer(offer, id);
                  skip();
                }}
              >
                <span className="skill-offer__pick-name">{k.name}</span>
                <span className="skill-offer__pick-meta">
                  {k.element ? ELEMENT_NAMES[k.element] : '특수'} {skillText.power(k)}
                </span>
                <span className="skill-offer__pick-do">잊고 배우기</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn--ghost skill-offer__skip" onClick={skip}>
          {skillText.skip(offer)}
        </button>
        {skillText.skipNote(offer) && <p className="skill-offer__note">{skillText.skipNote(offer)}</p>}
      </div>
    </div>
  );
}

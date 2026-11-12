/**
 * 기술 관리 화면 — 도감 상세의 "기술" 구역 (3차 설계 2-7).
 * 가진 기술 카드(최대 5개) + 배울 수 있는 기술. 기술은 바꾸기만 한다(줄이지 않는다):
 * 5개 미만이면 바로 배우고, 5개면 잊을 기술을 고른다. 못 익힌 기술은 "Lv N에 배워요" 잠금.
 */
import { useEffect, useState } from 'react';
import { displayName } from '../domain/field/growth';
import { skillDef, speciesSkills, type SkillId } from '../domain/field/skills';
import { MAX_SKILLS } from '../domain/field/tuning';
import { isAllowedSkill, type SpeciesId } from '../store/fieldData';
import { useGameStore } from '../store/useGameStore';
import { SkillCard } from './SkillCard';
import { skillText } from './skillText';
import './skills.css';

export function SkillManager({ species, onClose }: { species: SpeciesId; onClose(): void }) {
  const entry = useGameStore((s) => s.field.species[species]);
  const [pending, setPending] = useState<SkillId | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      if (pending) setPending(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, onClose]);

  if (!entry) return null;
  const held = entry.skills;
  const others = speciesSkills(species).filter((k) => !held.includes(k.id));

  const learn = (id: SkillId) => {
    if (held.length < MAX_SKILLS) {
      useGameStore.getState().setSkills(species, [...held, id]);
      setPending(null);
    } else setPending(id);
  };
  const replace = (removeId: SkillId) => {
    if (!pending) return;
    useGameStore.getState().replaceSkill(species, removeId, pending);
    setPending(null);
  };

  return (
    <div className="skill-manage" role="dialog" aria-modal="true" aria-label="기술 관리">
      <div className="skill-manage__card">
        <header className="skill-manage__top">
          <h2 className="skill-manage__title">
            {displayName(species, entry.stage)} {skillText.manageTitle}
          </h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </header>

        {pending && (
          <div className="skill-manage__replace" role="group" aria-label="잊을 기술 고르기">
            <p className="skill-manage__ask">{skillText.pickToReplace(skillDef(pending).name)}</p>
            {held.map((id) => (
              <SkillCard key={id} def={skillDef(id)}>
                <button type="button" className="btn btn--primary skill-manage__btn" onClick={() => replace(id)}>
                  {skillText.forgetThis}
                </button>
              </SkillCard>
            ))}
            <button type="button" className="btn btn--ghost skill-manage__btn" onClick={() => setPending(null)}>
              {skillText.cancel}
            </button>
          </div>
        )}

        {!pending && (
          <>
            <h3 className="skill-manage__sub">{skillText.heldTitle(held.length, MAX_SKILLS)}</h3>
            <div className="skill-manage__list" data-testid="held-skills">
              {held.map((id) => (
                <SkillCard key={id} def={skillDef(id)} />
              ))}
            </div>
            {others.length > 0 && (
              <>
                <h3 className="skill-manage__sub">{skillText.learnableTitle}</h3>
                <div className="skill-manage__list" data-testid="other-skills">
                  {others.map((k) => {
                    const ok = isAllowedSkill(species, entry.level, k.id);
                    return (
                      <SkillCard key={k.id} def={k}>
                        {ok ? (
                          <button type="button" className="btn btn--primary skill-manage__btn" onClick={() => learn(k.id)}>
                            {skillText.learn}
                          </button>
                        ) : (
                          <button type="button" className="btn btn--ghost skill-manage__btn" disabled>
                            {skillText.learnLevel(k)}
                          </button>
                        )}
                      </SkillCard>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

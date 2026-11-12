/**
 * 기술 관리 화면 — 도감 상세의 "기술" 구역 (3차 설계 2-7, 개정 3 0-1절). 세 구역:
 *  ① 주속성 사슬 — 읽기 전용. 가진 단계와 못 배운 단계("Lv N에 배워요" 잠금)
 *  ② 부속성 자리 — 지금 기술 하나 + 바꿀 수 있는 기술 (자기 종 4번)
 *  ③ 특수 자리 — 같은 방식 (자기 종 3번)
 * 바꾸기만 하고 줄이지 않는다: 같은 자리끼리만 바꾸고, 비어 있으면 아는 기술을 바로 배운다. 복사한 기술을 잊을 때는 한 번 더 묻는다.
 */
import { useEffect, useState } from 'react';
import { speciesDef } from '../domain/field/creatures';
import { skillDef, speciesSkills, type Seat, type SkillDef, type SkillId } from '../domain/field/skills';
import type { SpeciesId } from '../store/fieldData';
import { useGameStore } from '../store/useGameStore';
import { SkillCard } from './SkillCard';
import { skillText } from './skillText';
import './skills.css';

type Pending = { seat: Seat; id: SkillId };

export function SkillManager({ species, onClose }: { species: SpeciesId; onClose(): void }) {
  const entry = useGameStore((s) => s.field.species[species]);
  const [pending, setPending] = useState<Pending | null>(null);

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
  const own = speciesSkills(species);
  const has = (def: SkillDef) => held.includes(def.id);
  const ready = (def: SkillDef) => def.learnLevel <= entry.level;
  /** 그 자리에 앉아 있는 기술 (부속성·특수는 하나) */
  const holder = (seat: Seat): SkillDef | null => {
    const id = held.find((h) => {
      const d = skillDef(h);
      return seat === 'special' ? d.kind === 'special' : seat === 'sub' ? d.kind !== 'special' && !(d.species === species && d.kind === 'main') : false;
    });
    return id ? skillDef(id) : null;
  };

  const learn = (def: SkillDef) => {
    useGameStore.getState().addSkill(species, def.id);
    setPending(null);
  };
  const swap = (now: SkillDef, next: SkillDef) => {
    useGameStore.getState().replaceSkill(species, now.id, next.id);
    setPending(null);
  };

  /** 부속성·특수 자리 한 구역 */
  const seatSection = (seat: 'sub' | 'special', note: string) => {
    const now = holder(seat);
    const cand = own.find((d) => (seat === 'sub' ? d.kind === 'sub' : d.kind === 'special'));
    const showCand = cand && cand.id !== now?.id;
    return (
      <section className="skill-manage__seat" data-testid={`seat-${seat}`} aria-label={skillText.seatName(seat)}>
        <h3 className="skill-manage__sub">{skillText.seatName(seat)}</h3>
        <p className="skill-manage__note">{note}</p>
        <div className="skill-manage__list">
          {now ? (
            <SkillCard def={now} owner={species} badge={skillText.nowHeld} />
          ) : (
            <p className="skill-manage__empty">{skillText.emptySeat}</p>
          )}
          {showCand &&
            (ready(cand) ? (
              <SkillCard def={cand} owner={species}>
                {pending?.id === cand.id && now ? (
                  <div className="skill-manage__confirm" role="group" aria-label="바꾸기 확인">
                    <p className="skill-manage__ask">{skillText.confirmSwap(now.name, cand.name)}</p>
                    <button type="button" className="btn btn--ghost skill-manage__btn" autoFocus onClick={() => setPending(null)}>
                      {skillText.cancel}
                    </button>
                    <button type="button" className="btn btn--primary skill-manage__btn" data-action="confirm" onClick={() => swap(now, cand)}>
                      {skillText.swap}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary skill-manage__btn"
                    onClick={() => {
                      if (!now) learn(cand);
                      // 복사한 기술을 잊을 때만 한 번 더 묻는다 (자기 종 기술은 언제든 다시 배운다)
                      else if (now.species !== species) setPending({ seat, id: cand.id });
                      else swap(now, cand);
                    }}
                  >
                    {now ? skillText.swap : skillText.learn}
                  </button>
                )}
              </SkillCard>
            ) : (
              <SkillCard def={cand} owner={species} locked>
                <button type="button" className="btn btn--ghost skill-manage__btn" disabled>
                  {skillText.learnLevel(cand)}
                </button>
              </SkillCard>
            ))}
        </div>
      </section>
    );
  };

  return (
    <div className="skill-manage" role="dialog" aria-modal="true" aria-label="기술 관리">
      <div className="skill-manage__card">
        <header className="skill-manage__top">
          <h2 className="skill-manage__title">
            {speciesDef(species).name} {skillText.manageTitle}
          </h2>
          <button type="button" className="btn btn--ghost" autoFocus onClick={onClose}>
            닫기
          </button>
        </header>
        <p className="skill-manage__note">{skillText.timeNote}</p>

        <section className="skill-manage__seat" data-testid="seat-main" aria-label={skillText.seatName('main')}>
          <h3 className="skill-manage__sub">{skillText.seatName('main')}</h3>
          <p className="skill-manage__note">{skillText.mainNote}</p>
          <div className="skill-manage__list">
            {own
              .filter((d) => d.kind === 'main')
              .map((d) =>
                has(d) ? (
                  <SkillCard key={d.id} def={d} owner={species} />
                ) : (
                  <SkillCard key={d.id} def={d} owner={species} locked>
                    {ready(d) ? (
                      // 레벨은 됐는데 못 가진 옛 저장 — 막히지 않게 바로 배운다
                      <button type="button" className="btn btn--primary skill-manage__btn" onClick={() => learn(d)}>
                        {skillText.learn}
                      </button>
                    ) : (
                      <button type="button" className="btn btn--ghost skill-manage__btn" disabled>
                        {skillText.learnLevel(d)}
                      </button>
                    )}
                  </SkillCard>
                ),
              )}
          </div>
        </section>

        {seatSection('sub', skillText.subNote)}
        {seatSection('special', skillText.specialNote)}
      </div>
    </div>
  );
}

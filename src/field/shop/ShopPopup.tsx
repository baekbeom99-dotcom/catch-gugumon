/** 태초마을 상점 팝업 — 필드 위에 겹쳐 뜬다. 탭: 캡슐·회복약·꾸미기. 닫기 버튼과 Escape로 닫힌다 */
import { useEffect, useState } from 'react';
import type { CapsuleType } from '../../domain/field/capsules';
import { setUpdateBusy } from '../../pwa/autoUpdate';
import type { SpeciesId } from '../../store/fieldData';
import { CapsuleTab } from './CapsuleTab';
import { CapsulePractice } from './CapsulePractice';
import { CostumeTab } from './CostumeTab';
import { HealPractice } from './HealPractice';
import { PotionTab } from './PotionTab';
import { shopText } from './shopText';
import './shop.css';

export type ShopTabId = 'capsule' | 'potion' | 'costume';

export const SHOP_TABS: { id: ShopTabId; label: string; ready: boolean }[] = [
  { id: 'capsule', label: '캡슐', ready: true },
  { id: 'potion', label: '회복약', ready: true },
  { id: 'costume', label: '꾸미기', ready: true },
];

type View = { kind: 'tabs' } | { kind: 'capsule'; type: CapsuleType } | { kind: 'heal'; species: SpeciesId };

export function ShopPopup({ onClose }: { onClose(): void }) {
  const [tab, setTab] = useState<ShopTabId>('capsule');
  const [view, setView] = useState<View>({ kind: 'tabs' });
  const toTabs = () => setView({ kind: 'tabs' });
  const practicing = view.kind !== 'tabs';

  // 열려 있는 동안 자동 새로고침을 막는다 (닫히거나 사라질 때 반드시 풀기)
  useEffect(() => {
    setUpdateBusy(true);
    return () => setUpdateBusy(false);
  }, []);

  // Escape: 연습 중이면 연습만 그만두고 탭 화면으로, 아니면 상점을 닫는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      if (practicing) setView({ kind: 'tabs' });
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [practicing, onClose]);

  return (
    <div className="fshop" role="dialog" aria-modal="true" aria-label={shopText.title}>
      <div className="fshop__card">
        <header className="fshop__top">
          <h2 className="fshop__title">{shopText.title}</h2>
          <button type="button" className="btn btn--ghost fshop-btn fshop-btn--small" onClick={onClose}>
            {shopText.close}
          </button>
        </header>
        {view.kind === 'capsule' && <CapsulePractice type={view.type} onDone={toTabs} onQuit={toTabs} />}
        {view.kind === 'heal' && <HealPractice species={view.species} onDone={toTabs} onQuit={toTabs} />}
        {view.kind === 'tabs' && (
          <>
            <div className="fshop__tabs" role="tablist">
              {SHOP_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`fshop__tab ${tab === t.id ? 'fshop__tab--on' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'costume' && <CostumeTab />}
            {tab === 'capsule' && <CapsuleTab onPractice={(type) => setView({ kind: 'capsule', type })} />}
            {tab === 'potion' && <PotionTab onPractice={(species) => setView({ kind: 'heal', species })} />}
          </>
        )}
      </div>
    </div>
  );
}

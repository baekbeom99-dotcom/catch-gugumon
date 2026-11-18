import { useEffect } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { TopBar } from './components/TopBar';
import { BattleScreen } from './screens/BattleScreen';
import { DevGallery } from './screens/DevGallery';
import { DevFieldGallery } from './field/DevFieldGallery';
import { DexScreen } from './screens/DexScreen';
import { FieldScreen } from './field/world/FieldScreen';
import { FieldDexScreen } from './field/FieldDexScreen';
import { StarterScreen } from './field/StarterScreen';
import { WildBattleScreen } from './field/battle/WildBattleScreen';
import { FieldRecordsScreen } from './field/training/FieldRecordsScreen';
import { isQuizEnabled } from './config/featureFlags';
import { TrainingScreen } from './field/training/TrainingScreen';
import { TitleScreen } from './screens/TitleScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { HatchScreen } from './screens/HatchScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PetScreen } from './screens/PetScreen';
import { StairsScreen } from './screens/StairsScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { AdminScreen } from './screens/admin/AdminScreen';
import { ShopScreen } from './screens/ShopScreen';
import { needsHatch } from './domain/pet';
import { useGameStore } from './store/useGameStore';
import { useSessionStore } from './store/useSessionStore';

/** 알을 고르기 전이면 온보딩으로, 첫 탐험을 마친 알은 부화 화면으로 보낸다. */
function OnboardingGuard() {
  const pet = useGameStore((s) => s.pet);
  const species = pet.species;
  const explorations = useGameStore((s) => s.learning.totalExplorations);
  if (!species) return <Navigate to="/welcome" replace />;
  if (needsHatch(pet, explorations)) return <Navigate to="/hatch" replace />;
  return <Outlet />;
}

function TabLayout() {
  return (
    <div className="app">
      <TopBar />
      <main className="screen">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

const QUIZ_PATHS = ['/pet', '/explore', '/shop', '/records', '/dex', '/battle', '/practice', '/hatch', '/welcome'];
const toField = <Navigate to="/field" replace />;

const fullScreen = (el: JSX.Element) => <div className="app app--full">{el}</div>;

export function App() {
  const quizEnabled = isQuizEnabled();
  useEffect(() => {
    const { welcomeBack } = useGameStore.getState().openApp(Date.now());
    if (welcomeBack) useSessionStore.getState().set({ welcomeBack: true });
  }, []);

  return (
    // 정적 호스팅(서버 설정 없음)에서도 새로고침이 되도록 해시 라우터를 쓴다.
    <HashRouter>
      <Routes>
        {/* 퀴즈 모험이 꺼져 있으면 퀴즈 경로는 모두 필드로 보낸다(화면·데이터는 그대로, 플래그만 켜면 되살아남) */}
        {quizEnabled ? (
          <Route element={<OnboardingGuard />}>
            <Route element={<TabLayout />}>
              <Route path="/pet" element={<PetScreen />} />
              <Route path="/explore" element={<ExploreScreen />} />
              <Route path="/shop" element={<ShopScreen />} />
              <Route path="/records" element={<RecordsScreen />} />
              <Route path="/admin" element={<AdminScreen />} />
            </Route>
          </Route>
        ) : (
          QUIZ_PATHS.map((p) => <Route key={p} path={`${p}/*`} element={toField} />)
        )}
        {quizEnabled ? (
          <Route element={<TabLayout />}>
            <Route path="/dex" element={<DexScreen />} />
          </Route>
        ) : (
          <Route element={<TabLayout />}>
            <Route path="/admin" element={<AdminScreen />} />
          </Route>
        )}
        <Route path="/" element={fullScreen(<TitleScreen />)} />
        <Route path="/field" element={fullScreen(<FieldScreen />)} />
        <Route path="/field/starter" element={fullScreen(<StarterScreen />)} />
        <Route path="/field/dex" element={fullScreen(<FieldDexScreen />)} />
        <Route path="/field/battle" element={fullScreen(<WildBattleScreen />)} />
        <Route path="/field/training/:dan" element={fullScreen(<TrainingScreen />)} />
        <Route path="/field/records" element={fullScreen(<FieldRecordsScreen />)} />
        {quizEnabled && <Route path="/welcome" element={fullScreen(<OnboardingScreen />)} />}
        {quizEnabled && <Route path="/hatch" element={fullScreen(<HatchScreen />)} />}
        {/* 전투는 탭 없이 화면 전체를 쓴다 */}
        {quizEnabled && <Route path="/battle" element={fullScreen(<BattleScreen />)} />}
        {quizEnabled && <Route path="/practice" element={fullScreen(<PracticeScreen />)} />}
        <Route path="/stairs" element={fullScreen(<StairsScreen />)} />
        {import.meta.env.DEV && <Route path="/dev/gallery" element={<DevGallery />} />}
        {import.meta.env.DEV && <Route path="/dev/field" element={<DevFieldGallery />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

# 별점수 오픈 · 주인공 색 꾸미기 · 시계 읽기 · 거꾸로 묻기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마스터한 단을 나눗셈으로도 묻고, 별점수를 켜 주인공 색 세트를 별로 사 입게 하고, 체육관에 시계 읽기 트레이너 3명을 더한다.

**Architecture:** 모두 기존 구조 위에 얹는다. 문제 쪽은 `QuestionDisplay.equation`에 `op`를 더하고 전투·학습 문제를 한 번 변환한다. 꾸미기는 순수 표(`costumes.ts`) + 저장 칸 `field.costume` + 017 시트 색 바꾸기(순수 함수 + 캔버스 굽기). 시계는 셈연습 트레이너 틀(QuizBoard·`finishArithTraining`)을 따라 `finishClockTraining`을 만든다.

**Tech Stack:** React 18, TypeScript, Vite, Zustand(persist), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-stars-costume-clock-reverse-design.md`

## Global Constraints

- 화면 글자·주석·커밋 메시지는 한국어(어린이가 읽기 쉬운 말). 커밋 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- 운영 수치는 `src/domain/field/tuning.ts` 한 곳, 세트 표는 `src/domain/field/costumes.ts` 한 곳. 값은 테스트로 고정한다.
- `SaveData` 새 칸은 네 곳을 함께 고친다: `createInitialSave`, `mergeSave`(깊게 채우기), `useGameStore`의 `partialize`, `src/screens/admin/DataSecurityPanels.tsx`의 `currentSave()`. `SCHEMA_VERSION`은 그대로.
- 캐릭터·작품 **상표 이름을 코드·화면·문서·테스트에 쓰지 않는다**(국기 세트는 나라 이름 그대로 OK).
- 별점수는 `isStarPointsEnabled()`가 켜진 때만 쌓이고 쓰인다. E2E 기본은 별 꺼짐(`__GUGU_E2E_STARS__` false)을 유지한다.
- 마스터 도전(구구단 27초, `TRAINING_MASTER_MS`) 문제 모양·판정은 바꾸지 않는다. 야생 전투 흐름(타이머·단계 전환·도망)은 건드리지 않는다.
- 저장 데이터를 건드리는 Task(4·7)는 `opus-expert`, 마친 뒤 전체는 `opus-reviewer`. 나머지는 일반 에이전트(`model: sonnet`).
- 명령: `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5181 npx playwright test <파일>`(5181이 쓰이면 5191), `npm run build`.

## Review Focus

- **옛 저장본**(`field.costume`·`training.clock`이 없음)을 열어도 별·구구몬·기록이 그대로이고 기본 세트가 입혀진다 → Task 4·7 `mergeField` 테스트.
- **모르는 세트 id**(표에서 빠진 세트)가 저장에 있으면 기본 세트로 돌아가고 별은 환불하지 않아도 앱이 죽지 않는다 → Task 4 테스트.
- **별점수 꺼진 채** `buyCostume`이 실패하고 별이 줄지 않는다; 별이 49일 때 50 세트는 못 산다; 이미 가진 세트를 다시 사도 별이 줄지 않는다 → Task 4.
- **거꾸로 묻기에서 0단·곱하는 수 0·정답이 보기에 두 번 나오는 경우**가 없다; 마스터 안 한 단에는 절대 안 섞인다 → Task 1.
- **시계 보기에 정답이 중복**되거나 시침·분침을 바꿔 읽은 값이 정답과 같아지는 경우(예: 6:30 ↔ 6:30) 없다 → Task 7.
- **색 바꾸기가 피부·윤곽선·곡괭이를 건드리지 않는다**, 투명 화소(알파 0)는 그대로 → Task 5.
- **저학년 모드**에서 시계 NPC가 정상 동작한다(구구단 문제 변환과 무관) → Task 8.

---

### Task 1: 거꾸로 묻기 — 순수 규칙

**Files:**
- Create: `src/domain/field/reverse.ts`
- Modify: `src/domain/questionGen.ts` (`QuestionDisplay`의 `equation`에 `op?: '×' | '÷'`), `src/domain/field/tuning.ts` (`REVERSE_CHANCE`)
- Test: `tests/field/reverse.test.ts`, `tests/field/tuning.test.ts`(값 고정)

**Interfaces:**
- Produces:
  - `REVERSE_CHANCE = 0.25` (tuning.ts)
  - `QuestionDisplay` equation: `{ kind: 'equation'; op?: '×' | '÷'; a: number | null; b: number | null; result: number | null }` — `op === '÷'`이면 `a`=나뉘는 수(곱), `b`=나누는 수, `result`=몫(빈칸이면 null).
  - `reverseQuestion(rng: Rng, fact: Fact, choiceCount?: number): Question` — 같은 사실을 나눗셈으로. `fact.a`·`fact.b`는 1~13, `b === 0`이면 throw. 두 모양 중 무작위: `P ÷ a = □`(답 b) / `P ÷ b = □`(답 a). `factId`는 원래 사실 id, `type: 'product'`로 둔다(기록·숙련도 규칙을 안 바꾸려고).
  - `maybeReverse(rng: Rng, q: Question, fact: Fact, mastered: ReadonlySet<number>, chance?: number): Question` — `mastered.has(fact.a)`이고 `rng() < chance`이고 `fact.b >= 1`일 때만 `reverseQuestion`, 아니면 `q` 그대로(같은 객체).

- [ ] **Step 1: 실패하는 테스트** — `reverse.test.ts`에 다음을 쓴다: (a) `reverseQuestion`의 모든 사실(2~13단 × 1~9)에서 `display.op === '÷'`이고 `a * ?` 관계가 맞고(`a`는 나뉘는 수 = `fact.product`), 정답이 `fact.a` 또는 `fact.b`이며, 보기(3개)에 정답이 정확히 한 번 있고 서로 다르다. (b) `maybeReverse`에 `mastered`가 비어 있으면 `chance=1`이어도 원본 그대로. (c) `mastered={7}`, `chance=1`, 7단 사실이면 `op === '÷'`. (d) `chance=0`이면 원본 그대로. (e) `fact.b === 0`이면 변환하지 않고 원본.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/field/reverse.test.ts` → FAIL(모듈 없음).
- [ ] **Step 3: 구현** — `reverse.ts`, `questionGen.ts` 타입 확장, `tuning.ts`에 `REVERSE_CHANCE`(주석: 마스터한 단의 문제를 나눗셈으로 바꿔 내는 확률). 오답 보기는 정답 ±1·±2와 같은 단의 이웃 값(`nearbyDistractors`가 있으면 재사용, 범위 1~13).
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS, 그리고 `npx tsc --noEmit -p .`가 새 타입 때문에 깨지는 곳(없어야 함, `op`는 선택)을 확인.
- [ ] **Step 5: 커밋** — `git add src/domain tests/field && git commit -m "거꾸로 묻기: 마스터한 단을 나눗셈으로 바꾸는 순수 규칙"`

### Task 2: 거꾸로 묻기 — 전투·학습·화면 연결

**Files:**
- Modify: `src/field/battle/useQuestionFeed.ts`(전투 문제 받는 곳), `src/field/training/StudyMode.tsx`·`src/field/training/TrainingScreen.tsx`·`src/field/training/boardQuestion.ts`(학습 문제를 `BoardQuestion`으로), 문제 그리는 곳 `src/components/QuestionView.tsx`·`src/field/battle/WildBattleScreen.tsx`·`src/field/shop/PracticeCard.tsx`·`src/components/ArithHintPanel.tsx`(필요한 곳만), `src/field/training/boardQuestion.ts`의 `spokenLabel`
- Test: `tests/field/reverseWiring.test.ts`, `tests/field/boardQuestion.test.ts`(있으면 확장), E2E `e2e/reverse.spec.ts`

**Interfaces:**
- Consumes: Task 1의 `maybeReverse`, `REVERSE_CHANCE`; `useGameStore.getState().field.training.mastered`(키는 단)
- Produces: `masteredDanSet(training: TrainingData): Set<number>` (`src/domain/field/training.ts`에 더함); `BoardQuestion.label`이 ÷일 때 `"56 ÷ 7"`(카드가 뒤에 `= ?`를 붙임), `spokenLabel`이 `"56 나누기 7은?"`.

- [ ] **Step 1: 실패하는 테스트** — (a) `masteredDanSet`이 `mastered`의 단들을 돌려준다. (b) 학습용 `fromTraining`에 ÷ 모양(곱·나누는 수·몫)을 주면 `label === '56 ÷ 7'`, `answer === 8`. (c) `spokenLabel`이 `56 ÷ 7`에 `"56 나누기 7은?"`. (d) 전투 문제 받는 함수(분리해 둔 순수 부분)에 `mastered`와 `rng`를 주면 마스터한 단만 바뀐다. 전투 흐름(문제 개수·타이머·재출제) 자체는 건드리지 않는다는 것을 기존 테스트가 통과하는 것으로 확인.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 전투 문제는 `useQuestionFeed`가 계획 항목을 `generateQuestion`으로 문제로 만든 직후 `maybeReverse(rng, q, fact, masteredDanSet(training), REVERSE_CHANCE)`를 한 번 거친다(`__GUGU_E2E_QUESTION__` 고정 문제는 변환하지 않음). 학습 모드는 문제 목록을 만들 때 마스터한 단이면 각 문제를 같은 확률로 `reverseQuestion`으로 바꾼 `BoardQuestion`으로 낸다(학습 끝 판정·`studied` 기록은 그대로). 화면 컴포넌트는 `display.op === '÷'`이면 `×` 대신 `÷`를 그린다. 답 기록 함수는 `factId`를 받으므로 변경 없음.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/field`와 `npx tsc --noEmit -p .`.
- [ ] **Step 5: E2E** — `__GUGU_E2E_QUESTION__` 쓰지 않고, 2단을 마스터한 저장을 시드(`helpers`의 필드 시드 패턴 참고)하고 `Math.random`을 고정하는 스위치가 있으면 그것으로, 없으면 `window.__GUGU_E2E_REVERSE__`(true면 확률 1, false면 0, 없으면 `REVERSE_CHANCE`)를 `src/field/debugFlags.ts`에 더해 전투에서 `÷` 문제가 보이고 맞혀지는 것을 확인. 같은 스위치를 `e2e/fixtures.ts` 기본 false로.
- [ ] **Step 6: 커밋** — `git commit -m "마스터한 단은 야생 전투·체육관 학습에서 거꾸로(나눗셈) 묻기도 섞음"`

### Task 3: 별점수 오픈

**Files:**
- Modify: `src/config/featureFlags.ts`(`STAR_POINTS_ENABLED = true`, 주석 갱신), `src/field/world/FieldHud.tsx`(별 개수), `e2e/fixtures.ts`(`__GUGU_E2E_STARS__` 기본 false), `src/field/world/fieldHud.css`(있으면)
- Test: `tests/field/starPointsFlag.test.ts`(있는 기존 테스트 수정), `e2e/stars.spec.ts`(새)

**Interfaces:**
- Consumes: `useGameStore((s) => s.field.starPoints)`, `isStarPointsEnabled()`
- Produces: HUD에 `⭐ N` (`data-testid="hud-stars"`), 별점수가 꺼져 있으면 안 그림.

- [ ] **Step 1: 실패하는 테스트** — HUD 단위(가능하면 순수 포매터 `formatStars(n)` — 큰 수도 줄바꿈 없이)와 `e2e/stars.spec.ts`: `__GUGU_E2E_STARS__=true`로 필드를 열면 `hud-stars`가 보이고, 구구몬을 발견·포획하면 숫자가 오른다. 꺼진 채(기본)에는 `hud-stars`가 없다.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 플래그를 true로. 기존 테스트 중 "기본은 꺼짐"을 가정한 것은 `__GUGU_E2E_STARS__=false`를 명시하거나 `isStarPointsEnabled` 호출로 바꾼다(`tests/field/*`의 `STAR_POINTS_ENABLED` 직접 비교를 찾아 고친다).
- [ ] **Step 4: 통과 확인** — `npx vitest run`(전체) + `E2E_PORT=5181 npx playwright test e2e/stars.spec.ts e2e/gym.spec.ts e2e/stairs-items.spec.ts`(동상·계단 별이 기본 꺼짐 기준으로 그대로 통과).
- [ ] **Step 5: 커밋** — `git commit -m "별점수 켜기: 필드 화면에 별 개수 표시 (E2E 기본은 꺼짐 유지)"`

### Task 4: 꾸미기 — 세트 표·저장·스토어 (opus-expert)

**Files:**
- Create: `src/domain/field/costumes.ts`
- Modify: `src/store/fieldData.ts`(`FieldData.costume`, `initialField`, `mergeField`), `src/store/saveData.ts`(필요 시), `src/store/useGameStore.ts`(`partialize`·액션), `src/screens/admin/DataSecurityPanels.tsx`(`currentSave()`는 `field` 통째라 확인만), `src/domain/field/tuning.ts`(`COSTUME_PRICE = 50`)
- Test: `tests/field/costumes.test.ts`, `tests/field/fieldStore.test.ts`(확장), `tests/field/tuning.test.ts`

**Interfaces:**
- Produces:
  - `type CostumeId = string`, `type CostumeSet = { id: CostumeId; name: string; group: 'basic' | 'flag' | 'concept'; price: number; hair: HsvTarget; shirt: HsvTarget; pants: HsvTarget }`, `type HsvTarget = { hue: number; sat?: number; val?: number }` (`HairLook`과 같은 뜻: 색상 도, 채도·밝기 곱)
  - `COSTUME_SETS: readonly CostumeSet[]` — 첫 줄 `basic`(가격 0, 그림 그대로라 색 값은 쓰이지 않음). 국기 8~10, 캐릭터 느낌 6~8. `id`는 `flag-kr`처럼 소문자·하이픈, 유일.
  - `getCostume(id: string): CostumeSet` — 모르는 id면 `basic`.
  - `type CostumeData = { owned: CostumeId[]; equipped: CostumeId }`, `emptyCostume(): CostumeData` → `{ owned: ['basic'], equipped: 'basic' }`
  - `canBuyCostume(c: CostumeData, stars: number, id: string): boolean` (표에 있음 + 안 가짐 + `stars >= price` + 가격 > 0), `buyCostume(c, stars, id): { costume: CostumeData; stars: number } | null`, `equipCostume(c, id): CostumeData | null`(가진 것만)
  - 스토어: `buyCostume(id: string): { ok: boolean }`, `equipCostume(id: string): { ok: boolean }` — `isStarPointsEnabled()`가 꺼졌으면 `buyCostume`은 `{ ok: false }`이고 아무것도 안 바뀐다. 별 차감은 `field.starPoints`에서만.
  - `mergeCostume(raw: unknown): CostumeData` — `owned`에서 표에 없는 id를 버리고 `basic`을 항상 넣음, `equipped`가 안 가진 것이면 `basic`.
- Consumes: `isStarPointsEnabled()`, `addStarPoints`(starPoints.ts)

- [ ] **Step 1: 실패하는 테스트** — `costumes.test.ts`: 표 id 유일·`basic` 첫 줄·가격 0 이상 정수·색상 0~360·이름에 금지어 목록(`포켓몬`·`스펀지`·`마인크래프트` 등 상표 이름 몇 개)이 없음; `buy`: 별 49/50 경계, 이미 가짐, 모르는 id; `equip`: 안 가진 것은 null. `fieldStore.test.ts`: 옛 저장(`costume` 없음)이 `emptyCostume`으로 채워짐, 모르는 id가 버려지고 `equipped='basic'`, `buyCostume`이 별점수를 가격만큼만 줄임, 별점수 꺼짐 시 변화 없음(`__GUGU_E2E_STARS__` 스위치로).
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 위 시그니처대로. 네 곳(`createInitialSave`는 `initialField`를 쓰므로 `initialField`에 기본값, `mergeField`에서 `mergeCostume`, `partialize`는 `field` 통째인지 확인, `currentSave()`는 `field` 통째인지 확인)을 확인하고 필요한 곳만 고친다.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/field`, `npx tsc --noEmit -p .`.
- [ ] **Step 5: 커밋** — `git commit -m "꾸미기: 색 세트 표와 저장(field.costume)·사기·입기"`

### Task 5: 꾸미기 — 주인공 그림 색 바꾸기

**Files:**
- Create: `src/field/art/heroTint.ts`(순수), `src/field/art/heroCostume.ts`(굽기·캐시)
- Modify: `src/field/world/FieldScreen.tsx`(`heroSheet` 만드는 곳, 줄 ~560), `src/screens/StairsScreen.tsx`(`HERO_ART.front` 쓰는 곳), `src/field/DevFieldGallery.tsx`(세트 고르기), 필요 시 `src/field/art/companionImage.ts`(시트 로더가 URL을 받는지 확인)
- Test: `tests/field/heroTint.test.ts`

**Interfaces:**
- Consumes: `CostumeSet`·`getCostume`(Task 4), `HERO_ART`(localSprites.ts), `StageSheets`·`SheetAnim`(creatureArt.ts), `rgbToHsv`·`hsvToRgb` 등(npcTint.ts에 있는 순수 함수 재사용)
- Produces:
  - 순수: `tintHeroPixel(px: Rgba, set: CostumeSet): Rgba` — 머리·윗옷·바지 범위의 화소만 세트 색으로, 알파 0과 나머지(피부·윤곽선·곡괭이·신발)는 그대로. `HERO_HAIR`·`HERO_SHIRT`·`HERO_PANTS`: 각 범위 `{ hueMin, hueMax, satMin, valMin, valMax? }` 상수(실제 화소를 읽어 정한다).
  - 굽기: `heroArtFor(id: CostumeId): Promise<ImageArtEntry | undefined>` 와 동기 캐시 읽기 `heroArtCached(id): ImageArtEntry | undefined` (`basic`이면 `HERO_ART` 그대로). 세트별로 한 번만 굽는다(캐시).
  - React 훅: `useHeroArt(): ImageArtEntry | undefined` — 장착 세트에 맞는 그림(굽는 동안은 이전 그림).

- [ ] **Step 1: 화소 조사(테스트 전에)** — `017-front.png`·`017-walk.png`를 `canvas`로 읽거나(Playwright·브라우저) 노드 스크립트로 화소를 뽑아 머리(갈색)·윗옷(청록-하늘)·바지(파랑)·곡괭이(청록)·피부(크림·갈색 팔)의 HSV 분포를 표로 만들어 `heroTint.ts` 주석과 테스트 기대값에 적는다. 곡괭이와 윗옷이 겹치면 **윗옷만** 바꾸고 곡괭이는 지킨다(색상/채도/밝기 어느 한 축으로 가르거나, 겹치면 곡괭이 위치를 공간 마스크로 제외).
- [ ] **Step 2: 실패하는 테스트** — `heroTint.test.ts`: 조사에서 뽑은 대표 화소(머리·윗옷·바지·피부·윤곽선·곡괭이 각 하나, 알파 0)를 하드코딩해 `tintHeroPixel(px, 한국세트)`가 머리·윗옷·바지는 세트 색상에 가깝게(색상 ±8도), 피부·윤곽선·곡괭이·알파 0은 **바이트 그대로**. `basic`이면 모든 화소 그대로.
- [ ] **Step 3: 실패 확인.**
- [ ] **Step 4: 구현** — 순수 함수, 굽기(시트마다 `OffscreenCanvas` 또는 `canvas`로 읽어 `tintHeroPixel`을 적용해 `toDataURL`/`blob URL`, 시트 6종: idle·walk·attack·front·back과 `StageSheets`의 `url`만 교체해 같은 `ms`·`cell`·`fill`·`foot`를 유지). `useHeroArt`는 스토어의 `field.costume.equipped`를 보고 굽기를 시작해 끝나면 갱신(굽는 동안 `basic`/이전 그림). 필드·계단·갤러리가 `HERO_ART` 대신 이 그림을 쓰게 한다. 그림 파일이 없으면(`HERO_ART` undefined) 아무 것도 안 한다.
- [ ] **Step 5: 통과 확인** — `npx vitest run tests/field/heroTint.test.ts`, `tsc`. 브라우저(`npx vite --port 5181`)에서 `#/dev/field`로 세트 몇 개를 골라 주인공 네 방향·걷기 프레임 색을 눈으로 확인(피부·곡괭이 그대로).
- [ ] **Step 6: 커밋** — `git commit -m "꾸미기: 주인공 그림의 머리·윗옷·바지 색을 세트대로 바꿔 굽기"`

### Task 6: 꾸미기 — 상점 「꾸미기」 탭

**Files:**
- Create: `src/field/shop/CostumeTab.tsx`
- Modify: `src/field/shop/ShopPopup.tsx`(`SHOP_TABS`: `'soon'` 자리를 `'costume'`으로), `src/field/shop/shopText.ts`(글), `src/field/shop/shop.css`
- Test: `tests/field/shopTabs.test.ts`(있으면 수정), `e2e/costume.spec.ts`

**Interfaces:**
- Consumes: `COSTUME_SETS`, `canBuyCostume`, 스토어 `buyCostume`·`equipCostume`·`field.starPoints`·`field.costume`, `useHeroArt`/`heroArtFor`(미리보기 앞모습)
- Produces: `ShopTabId = 'capsule' | 'potion' | 'costume'`, 카드 `data-testid="costume-<id>"`, 버튼 문구 「사기 ★50」/「입기」/「입는 중」.

- [ ] **Step 1: 실패하는 테스트** — 단위: `SHOP_TABS`에 `costume`이 있고 `ready: true`, `soon`이 없다. E2E: `__GUGU_E2E_STARS__=true`와 별 100개 시드로 상점→꾸미기→`flag-kr` 사기 → 별 50 줄고 「입기」로 바뀜 → 입으면 「입는 중」, 필드에서 저장값 `equipped`가 `flag-kr`. 별이 모자라면 「사기」가 눌리지 않고 이유 글(「별이 모자라요」)이 보임.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 위에 보유 별 `⭐ N`, 그룹 제목(나라 / 캐릭터), 세트 카드(미리보기 앞모습 + 색 세 칸 + 이름 + 가격/상태). 별점수 꺼짐이면 탭에 「별점수가 꺼져 있어요」 안내만(사기 버튼 없음).
- [ ] **Step 4: 통과 확인** — `npx vitest run`, `E2E_PORT=5181 npx playwright test e2e/costume.spec.ts e2e/field.spec.ts -g "상점"`, 375px 브라우저 확인.
- [ ] **Step 5: 커밋** — `git commit -m "상점 꾸미기 탭: 별로 주인공 색 세트를 사고 입기"`

### Task 7: 시계 읽기 — 순수 규칙·저장·스토어 (opus-expert)

**Files:**
- Create: `src/domain/field/clock.ts`
- Modify: `src/domain/field/tuning.ts`(`CLOCK_TRAINER_*`), `src/domain/field/training.ts`(`TrainingData.clock`, `emptyTraining`, `LegendRewardKey`에 `'clockOne'`), `src/store/fieldData.ts`(`mergeTraining`), `src/store/useGameStore.ts`(`finishClockTraining`)
- Test: `tests/field/clock.test.ts`, `tests/field/clockStore.test.ts`, `tests/field/tuning.test.ts`

**Interfaces:**
- Produces:
  - `type ClockLevel = 'hour' | 'five' | 'one'`, `CLOCK_LEVELS = ['hour','five','one'] as const`, `CLOCK_LEVEL_LABELS: Record<ClockLevel,string>` = {hour:'정각', five:'5분', one:'1분'}
  - tuning: `CLOCK_TRAINER_QUESTIONS = 9`, `CLOCK_TRAINER_MASTER_MS: Record<ClockLevel, number>` = {hour 30_000, five 45_000, one 60_000}
  - `type ClockQuestion = { h: number; m: number; answer: number; choices: number[] }` — `h` 1~12, `m` 0~59, `answer = h*60 + m`(분 단위 숫자), `choices` 정답 포함 3개(겹치지 않음, 섞임)
  - `planClockTrainer(rng: Rng, level: ClockLevel): ClockQuestion[]` — 9문제, 같은 시각 겹치지 않게(가짓수가 모자라면 겹쳐도 채움). hour: `m = 0`; five: `m ∈ {0,5,…,55}`; one: `m ∈ 0..59`(5의 배수만 몰리지 않게 1분 단위가 절반 이상).
  - `clockChoices(rng, h, m, level): number[]` — 오답: 시침·분침을 바꿔 읽은 값(`h'=m/5`(0이면 12), `m'=h*5%60`; 정답과 같으면 제외), 시 ±1, 분 ±(level이 one이면 1, 아니면 5). 세 개를 못 채우면 다른 시각으로 채움. 단위 분 값은 `0 < v <= 12*60+59`.
  - `formatClockChoice(minutes: number): string` — `"3:30"`꼴(시 1~12, 분 두 자리).
  - `judgeClockTrainer(a: { mistakes: number; timeMs: number }, level): 'pass' | 'wrong' | 'slow'` (`judgeArithTrainer`와 같은 규칙)
  - `isClockOpen(t: TrainingData, level: ClockLevel): boolean` — hour 항상, five는 `t.clock.hour` 있을 때, one은 `t.clock.five` 있을 때.
  - `TrainingData.clock: Partial<Record<ClockLevel, { bestMs: number; at: number }>>`, `legendGranted.clockOne?: SpeciesId`
  - 스토어: `finishClockTraining(input: { level: ClockLevel; timeMs: number; mistakes: number; now: number }): ArithOutcome`와 같은 모양의 결과(캡슐 필드·개수, 첫 마스터 여부, 레전드, 별 — `finishArithTraining`을 참고해 같은 구조로). 합격이 아니면 아무것도 지급하지 않는다. 첫 마스터는 `TRAINING_FIRST_MASTER_CAPSULES`, 그 밖의 합격은 `TRAINING_CAPSULES`(무작위 필드 캡슐), `one` 첫 마스터는 레전드(`pickLegendReward(rng, owned, 'clockOne', training.legendGranted)`), 별점수는 `STAR_TRAINING`(기존 `starGain` 한 곳 경유).
- Consumes: `shuffle`·`Rng`(random.ts), `finishArithTraining`·`pickLegendReward`(참고·재사용)

- [ ] **Step 1: 실패하는 테스트** — `clock.test.ts`: 레벨마다 9문제, 정각은 모두 `m=0`, 5분은 모두 5의 배수, 모든 문제에서 보기 3개·정답 포함·중복 없음, 보기 값이 범위 안, 시계 전체(12시~11시 59분)를 1000번 돌려도 던지지 않음; `isClockOpen` 3단계; `judgeClockTrainer`(틀림/느림/합격, NaN·음수 시간은 느림); `formatClockChoice(12*60)==='12:00'`, `(3*60+5)==='3:05'`. `clockStore.test.ts`: 합격 → 기록(`bestMs`)·캡슐 지급·첫 마스터 20개; 재도전 합격 → 5개; 실패 → 변화 없음; `one` 첫 마스터 → 레전드 한 번만(`legendGranted.clockOne`); 옛 저장(`clock` 없음)이 `{}`로 채워짐.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 위 시그니처. 네 곳 확인(`training`은 `field` 안이라 `mergeTraining`에서 `clock`·`clockOne` 깊게 채우기, 모르는 값은 버림).
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/field`, `tsc`.
- [ ] **Step 5: 커밋** — `git commit -m "시계 읽기: 문제 규칙·단계 열림·합격 판정·보상 저장"`

### Task 8: 시계 읽기 — 화면·체육관 NPC

**Files:**
- Create: `src/field/training/ClockFace.tsx`(시계 SVG), `src/field/training/ClockTrainerScreen.tsx`
- Modify: `src/field/training/boardQuestion.ts`(`BoardQuestion.clock?`·`choiceText?`, `fromClock`), `src/field/training/QuizBoard.tsx`(문제 카드에 시계·보기 글), `src/App.tsx`(`/field/training/clock/:level`), `src/field/world/maps/gym.ts`(`GymNpc` `kind: 'clock'` + `GYM_NPCS` 3명), `src/domain/field/gymTalk.ts`(`talkAction`·`lockedText`·`isNpcMastered`·`npcKey`), `src/field/art/npcTint.ts`·`npcSprite.ts`(필요 시 색 표), `src/field/training/FieldRecordsScreen.tsx`(시계 줄), `src/domain/field/doorEntry.ts`(바뀔 게 없으면 건드리지 않음), `src/field/world/FieldScreen.tsx`(NPC 말 걸기 이동)
- Test: `tests/field/gymMap.test.ts`, `tests/field/gymTalk.test.ts`, `tests/field/boardQuestion.test.ts`, `e2e/clock.spec.ts`

**Interfaces:**
- Consumes: Task 7의 `ClockLevel`·`planClockTrainer`·`isClockOpen`·`judgeClockTrainer`·`formatClockChoice`·스토어 `finishClockTraining`; 기존 `QuizBoard`·`useRun`·`createRunner`·`TrainingResult`(캡슐·마스터 결과 화면)·`ArithTrainerScreen`(구조 참고, 복붙하지 말고 공통화 가능한 부분은 공통화)
- Produces: `BoardQuestion`에 `clock?: { h: number; m: number }`, `choiceText?: (n: number) => string`; `fromClock(q: ClockQuestion): BoardQuestion` (`key: 'c<h>:<m>'`, `label: ''`, `answer`, `choices`, `clock`, `choiceText: formatClockChoice`); `GymNpc` clock 변형 `{ id: 'clock-hour' | 'clock-five' | 'clock-one'; kind: 'clock'; level: ClockLevel; pos; tint; hair; facing }`; `ClockFace({ h, m, size })`: 숫자 1~12·시침·분침(시침은 `m` 비율만큼 이동)이 있는 SVG(`role="img"`, `aria-label="몇 시 몇 분일까요?"` — 정답을 읽어 주지 않는다)

- [ ] **Step 1: 실패하는 테스트** — `gymMap`: 새 NPC 3명이 막힘 칸·다른 NPC·동상·입구와 겹치지 않고 입구에서 걸어 NPC 곁 칸에 닿는다(기존 테스트 일반화). `gymTalk`: 5분 NPC는 정각 미마스터이면 `locked`(글에 「정각을 먼저」), 열렸으면 `enter` → `/field/training/clock/five`. `boardQuestion`: `fromClock`이 `answer`·`choices`·`clock`을 그대로 실음. E2E(`clock.spec.ts`): 정각 NPC에게 말 걸어 들어가 `__GUGU_E2E_NO_TIMER__`로 시계를 멈춘 채 화면 시계 SVG의 `data-h`·`data-m`(테스트 보조 속성)에서 정답을 계산해 9문제를 맞히면 결과 화면에 「합격」과 캡슐, 체육관으로 돌아오면 5분 NPC가 열림.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — NPC 자리: 오른쪽 셈 트레이너 열(x 11~12, y 14·10·6)을 피해 `(12,12)`·`(11,8)`·`(12,4)` 같은 빈 칸을 시작값으로 하고 `gymMap` 테스트로 확정. 색(옷 곱셈·머리색)은 기존 NPC와 구별되게(`npcTint` 머리 노랑 범위 밖; 표 테스트가 지킨다). 화면은 도전만(9문제, 보기 3개, 틀리면 끝/계속은 `ArithTrainerScreen`과 같은 규칙), 끝에서 `finishClockTraining` 한 번. 결과는 기존 `TrainingResult` 재사용. 기록 화면에 `정각/5분/1분` 최고 기록 줄. `ClockFace`는 접근성(보기 버튼이 글로 읽힘)·375px에서 잘리지 않게.
- [ ] **Step 4: 통과 확인** — `npx vitest run`, `E2E_PORT=5181 npx playwright test e2e/clock.spec.ts e2e/gym.spec.ts e2e/arith.spec.ts e2e/training.spec.ts`, 375px 브라우저에서 시계 문제 화면·체육관 배치 확인(스크린샷).
- [ ] **Step 5: 저학년 모드 확인** — `settings.lowGrade = true`로 시계 NPC가 똑같이 열리고 동작하는지 E2E 한 줄 추가.
- [ ] **Step 6: 커밋** — `git commit -m "체육관에 시계 읽기 트레이너 3명(정각·5분·1분)과 시계 문제 화면"`

### Task 9: 문서·전체 확인

**Files:**
- Modify: `MVP_DESIGN.md`(변경 이력 v1.77: 거꾸로 묻기·별점수 오픈·꾸미기·시계), `CLAUDE.md`(폴더 표·"어디를 고치나"·E2E 스위치 `__GUGU_E2E_REVERSE__`), `NOTICE.md`(바뀔 게 없으면 생략)
- Test: 전체

- [ ] **Step 1: 문서 갱신** — 이력 한 줄에 네 가지와 저장 새 칸(`field.costume`, `training.clock`, `legendGranted.clockOne`), 수치 위치(`REVERSE_CHANCE`·`COSTUME_PRICE`·`CLOCK_TRAINER_*`·`COSTUME_SETS`) 적기.
- [ ] **Step 2: 전체 검사** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5181 npx playwright test`(전체, 시간 문제로 가끔 실패하는 알려진 테스트는 따로 다시 돌려 확인), `npm run build`.
- [ ] **Step 3: 상표 이름 검사** — `grep -rniE "포켓몬|스펀지|마인크래프트|pokemon|spongebob|minecraft" src docs/superpowers` 결과가 이 설계서·계획서의 "쓰지 않는다" 설명 말고는 없어야 한다.
- [ ] **Step 4: 커밋** — `git commit -m "문서: 별점수·꾸미기·시계·거꾸로 묻기 이력"`

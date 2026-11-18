# 트레이닝센터 + 무한의 계단 건물 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 태초마을 위쪽에 2~9·11·12·13단 트레이닝센터 11채와 무한의 계단 건물을 짓고, 차례대로 학습 → 마스터 도전(3지선다, 27초 전체) → 지붕 숫자 → 캡슐·레전드 보상까지 걸어서 즐기게 하며, 퀴즈모험은 화면에서 감춘다.

**Architecture:** 규칙·수치는 순수 도메인(`src/domain/field/training.ts`)과 `tuning.ts` 한 곳, 저장은 `SaveData.field.training`(+`mergeField`)과 스토어 액션 하나(`finishTraining`), 마을은 지도 글자·문 표를 `town.ts`에서 정하고 `FieldScreen`이 문 종류에 따라 분기한다. 문제 화면은 `src/field/training/`의 새 컴포넌트로 만들며 `BattleScreen`(퀴즈모험)은 손대지 않는다.

**Tech Stack:** React 18 + TypeScript + Vite + Zustand(persist) + 캔버스 필드 렌더러 + Vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-training-center-design.md` (CLAUDE.md도 함께 읽을 것)

## Global Constraints

- 화면 글·주석·커밋 메시지는 **한국어**(어린이가 읽기 쉬운 말). 커밋 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- 센터 단 목록·순서: `TRAINING_DANS = [2,3,4,5,6,7,8,9,11,12,13]` (**10단 없음**). 첫 단(2단)은 항상 열림, 나머지는 바로 앞 단을 마스터해야 열림(11단은 9단 마스터 후).
- 마스터 도전은 그 단의 **차례대로 학습을 끝까지 마친 뒤**에만 열림. 3지선다(`choiceCount = 3`), 문제 9개(×1~×9) 순서 섞음, **제한 시간 전체 27초**(`TRAINING_MASTER_MS = 27_000`, 문제당 3초×9), **하나도 안 틀려야** 통과.
- 훈련 한 번 마칠 때마다 **캡슐 5개**(`TRAINING_CAPSULES = 5`): 2~9단은 그 단이 있는 필드 캡슐(초원 2·4·8, 물가 3·6·9, 사막 5·7), **11·12·13단은 황금 캡슐**. 마스터 여부 무관. 학습은 ×1~×9 끝까지, 도전은 성공·실패 모두 끝까지 간 때만 지급, 중간 이탈은 없음.
- **12단·13단 첫 마스터** 때 레전드 구구몬 1마리 무작위 지급(이미 받은 단은 다시 안 줌, `legendGranted`). 11단은 레전드 없음.
- **`Dan` 타입(`facts.ts`)은 2~9·12·13뿐이고 11단 사실(Fact)이 없다.** 트레이닝은 자기 타입 `TrainingDan = (typeof TRAINING_DANS)[number]`(2~9·11·12·13)를 쓰고 `Fact`·`FactId`·`questionGen.generateQuestion`에 의존하지 않는다(`ALL_DANS`·`FACTS`·퀴즈모험 데이터는 수정 금지). 문제는 자체 형식 `TrainingQuestion = { dan: TrainingDan; multiplier: number; answer: number; choices: number[] }`, 오답 보기는 `training.ts`의 자체 함수(예: 곱 ±단, ±1×단, 1의 자리가 같은 수 ±10; 정답 제외·중복 없음·음수 아님). 학습 기록(`recordTrainingAnswer`)은 `ALL_DANS`에 있는 단(2~9·12·13)일 때만 `learning.facts`에 반영하고 11단은 건너뛴다.
- 수치·표(`TRAINING_*`, 무한의 계단 열림 `STAIRS_OPEN_AFTER_DAN`)는 모두 `src/domain/field/tuning.ts` 한 곳(+고정값 `tests/field/tuning.test.ts`).
- 저장 키·`SAVE_VERSION` 그대로. `SaveData`에 필드를 더하면 **네 곳**(`createInitialSave`, `mergeSave`(깊게), `useGameStore` `partialize`, `admin/DataSecurityPanels.tsx` `currentSave()`)을 함께 고친다. 예전 저장이 안 깨져야 함.
- 퀴즈모험 코드(`BattleScreen`·`ExploreScreen`·`PetScreen` 등)·저장 데이터는 **지우지 않는다**. 셈 연습 연결·별 보상·상점 "주인공 꾸미기"는 **이번 범위 아님**.
- 효과 시간 ≤ 0.6초(기존 규칙), 375px 폭 휴대폰에서 겹침·가로 스크롤 없음.
- 모델 분배(CLAUDE.md): 저장 데이터 Task 2는 `opus-expert`, 마지막 검토는 `opus-reviewer`, 값만 정해진 수정은 `haiku-worker`, 나머지는 Sonnet.
- push·merge·배포는 지휘자만.

## Review Focus

1. 예전 저장(`field.training` 없음)에서 열어도 2단만 열리고 마을 위치가 건물 줄 아래로 밀려도 벽·건물 안에 서지 않음 → Task 2 `mergeField` 위치 이동 테스트.
2. 마스터 도전 도중 이탈·새로고침: 캡슐·마스터가 지급되지 않고 학습 완료도 바뀌지 않음 → Task 2 `finishTraining` + Task 6 화면 테스트.
3. 12·13단 마스터를 다시 해도 레전드가 두 번 나오지 않고, 레전드를 전부 가졌을 때(중복)도 터지지 않음 → Task 1 `pickLegendReward`, Task 2.
4. 잠긴 건물 문·열린 건물 문 부딪힘: 팝업·잘못된 입장 없음, 상점 문은 그대로 상점 → Task 5.
5. 퀴즈모험 경로(`/pet`·`/explore`·`/shop`·`/records`·`/dex`)로 직접 들어가도 필드로 돌아오고 `/admin`·`/dev/*`는 그대로 → Task 8.

---

## 파일 구조

| 파일 | 일 |
|---|---|
| `src/domain/field/tuning.ts` (수정) | `TRAINING_DANS`, `TRAINING_MASTER_MS`, `TRAINING_CAPSULES`, `TRAINING_CAPSULE_OF_DAN`, `STAIRS_OPEN_AFTER_DAN`, `TOWN_ROWS_ADDED` |
| `src/domain/field/training.ts` (신규) | 열림 규칙, 학습·도전 문제 계획, 도전 판정, 레전드 뽑기 — React 없음 |
| `src/store/fieldData.ts` (수정) | `TrainingData` 형식·기본값·`mergeField` 채우기·마을 위치 이동 |
| `src/store/useGameStore.ts` (수정) | `finishTraining`, `recordTrainingAnswer` 액션, `partialize` |
| `src/store/saveData.ts`, `src/screens/admin/DataSecurityPanels.tsx` (수정) | 백업·기본값 연결 |
| `src/domain/field/movement.ts` (수정) | `FieldMap.doors`를 `{pos,kind,dan?}`로 |
| `src/field/world/maps/town.ts`, `townTiles.ts` (수정) | 훈련 거리 줄, 문 표, 건물 타일 |
| `src/field/world/fieldRenderer.ts` (수정) | 마스터한 건물 지붕 빛나는 숫자 |
| `src/field/world/FieldScreen.tsx` (수정) | 문 종류별 분기, 잠긴 문 글, 이동, 돌아올 때 문 앞 위치 |
| `src/field/training/` (신규) | `TrainingScreen`, `StudyMode`, `ChallengeMode`, `TrainingResult`, `training.css`, `trainingText` |
| `src/App.tsx`, `src/screens/TitleScreen.tsx`, `src/screens/StairsScreen.tsx` (수정) | 경로·퀴즈모험 끔·계단 복귀 |
| `src/config/featureFlags.ts` (신규) | `QUIZ_ADVENTURE_ENABLED = false` |

---

### Task 1: 훈련 규칙·수치 (순수 도메인)

**Files:**
- Modify: `src/domain/field/tuning.ts`
- Create: `src/domain/field/training.ts`
- Test: `tests/field/training.test.ts`, `tests/field/tuning.test.ts`(고정값 추가)

**Interfaces:**
- Produces (`tuning.ts`): `TRAINING_DANS = [2,3,4,5,6,7,8,9,11,12,13] as const`, `type TrainingDan`, `TRAINING_MASTER_MS = 27_000`, `TRAINING_CAPSULES = 5`, `TRAINING_CAPSULE_OF_DAN: Record<TrainingDan, CapsuleType>`, `STAIRS_OPEN_AFTER_DAN: Dan | null = null`(null = 항상 열림).
- Produces (`training.ts`):
  - `type TrainingData = { studied: Partial<Record<TrainingDan, true>>; mastered: Partial<Record<TrainingDan, { bestMs: number; at: number }>>; legendGranted: Partial<Record<12 | 13, SpeciesId>> }`
  - `emptyTraining(): TrainingData`
  - `isTrainingOpen(t: TrainingData, dan: number): boolean`, `isChallengeOpen(t: TrainingData, dan: number): boolean`, `isStairsOpen(t: TrainingData): boolean`
  - `planStudy(dan: TrainingDan): TrainingQuestion[]` (×1~×9 순서, 보기 3개), `planChallenge(rng: Rng, dan: TrainingDan): TrainingQuestion[]` (9개 섞음, 3지선다)
  - `judgeChallenge(a: { mistakes: number; timeMs: number }): 'pass' | 'wrong' | 'slow'`
  - `pickLegendReward(rng: Rng, owned: readonly SpeciesId[], dan: 12 | 13, granted: TrainingData['legendGranted']): { species: SpeciesId; duplicate: boolean } | null` (이미 받은 단이면 null)

- [ ] **Step 1: 실패하는 테스트** — `tests/field/training.test.ts`: `isTrainingOpen`(2단 항상 true, 3단은 2단 마스터 전 false·후 true, 11단은 9단 마스터 후에만 true, 10 같은 목록에 없는 단 false), `isChallengeOpen`(학습 안 한 단 false, `studied[dan]` 있으면 true, 단 자체가 잠겨 있으면 false), `planStudy(7)`이 ×1~×9 아홉 개 순서대로(`multiplier` 1..9, `answer`=7×multiplier), `planStudy(11)`도 동일(11단 지원), `planChallenge`가 아홉 개·multiplier 중복 없음·각 보기 3개에 정답 포함·정답 외 보기가 서로 다르고 음수 아님·시드가 다르면 순서가 달라짐, `judgeChallenge({mistakes:0,timeMs:27000})==='pass'`, `{0,27001}==='slow'`, `{1,1000}==='wrong'`, `pickLegendReward`(`granted[12]` 있으면 null, 가진 종 제외하고 뽑기, 레전드를 전부 가졌으면 `duplicate:true`로 아무 레전드, 시드 고정 시 같은 결과).
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/training.test.ts` → FAIL(모듈 없음).
- [ ] **Step 3: 구현** — `tuning.ts`에 상수 6개 추가(위 값 그대로, `TRAINING_CAPSULE_OF_DAN`: 2→meadow,3→waterside,4→meadow,5→desert,6→waterside,7→desert,8→meadow,9→waterside,11→legend,12→legend,13→legend). `training.ts`는 `random.ts`의 `Rng`·`shuffle`, `capsules.ts`·`creatures.ts`의 레전드 목록(`LEGEND_SPECIES`)을 사용.
- [ ] **Step 4: 실행해 통과 확인** — `npx vitest run tests/field/training.test.ts tests/field/tuning.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `git add src/domain/field tests/field && git commit -m "트레이닝센터 규칙·수치 추가"`

---

### Task 2: 저장 데이터와 `finishTraining` (opus-expert 담당)

**Files:**
- Modify: `src/store/fieldData.ts`, `src/store/saveData.ts`, `src/store/useGameStore.ts`, `src/screens/admin/DataSecurityPanels.tsx`
- Test: `tests/field/trainingSave.test.ts`, `tests/field/fieldSave.test.ts`(기존 형식 확인), `tests/saveMigration.test.ts`

**Interfaces:**
- Consumes: Task 1의 `TrainingData`, `emptyTraining`, `isChallengeOpen`, `judgeChallenge`, `pickLegendReward`, `TRAINING_CAPSULES`, `TRAINING_CAPSULE_OF_DAN`.
- Produces (`FieldData`): `training: TrainingData`.
- Produces (store): `finishTraining(input: { dan: TrainingDan; mode: 'study' | 'challenge'; mistakes: number; timeMs: number; now: number }): TrainingOutcome` where `TrainingOutcome = { capsuleType: CapsuleType; capsules: 5; mastered: boolean; newBest: boolean; bestMs: number | null; legend: { species: SpeciesId; duplicate: boolean } | null }`; `recordTrainingAnswer(dan: number, multiplier: number, correct: boolean, speedMs: number, now: number): void`(펫 별·경험치 없이 `learning.facts`만 갱신, 틀린 문제 기록).

- [ ] **Step 1: 실패하는 테스트** — `trainingSave.test.ts`: (a) 옛 저장(`field.training` 없음) `mergeSave` 후 `training`이 빈 값, (b) 옛 마을 위치 `{map:'town', y}`는 `y + TOWN_ROWS_ADDED`로 옮겨지고 다른 지도 위치는 그대로, 이미 한 번 옮긴 저장을 다시 합쳐도 두 번 옮기지 않음(`training` 키가 있으면 옮기지 않는 식 등 한 번만 되는 표시를 쓸 것), (c) `finishTraining` 학습 완료 → `studied[dan]` 켜짐·캡슐 5개(`TRAINING_CAPSULE_OF_DAN[dan]`) 증가·`mastered` 없음, (d) 도전 성공 → `mastered[dan]`·`bestMs`(더 빠를 때만 갱신, `newBest`)·캡슐 5, (e) 도전 실패(틀림/느림) → 캡슐 5개는 주되 마스터 없음, (f) 12단 첫 마스터 → `legendGranted[12]`·`field.species`에 그 종 추가(중복이면 기존 중복 보상 규칙), 두 번째 마스터에서는 `legend:null`, (g) 도전이 학습 전에 호출되면 거부(상태 불변), (h) `recordTrainingAnswer`는 `economy.stars`·펫을 바꾸지 않고, 11단은 아무것도 바꾸지 않음(2~9·12·13단은 `learning.facts` 갱신).
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/trainingSave.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `FieldData`에 `training`을 더하고 `createInitialSave`·`mergeField`(깊게 채움, 잘못된 값은 기본값)·`partialize`·`currentSave()`를 연결. 위치 이동 상수 `TOWN_ROWS_ADDED`는 Task 3에서 정해지므로 `tuning.ts`에 먼저 `TOWN_ROWS_ADDED = 0`으로 두고 Task 3이 값을 확정한다(테스트는 상수로 계산). 도전 호출 시 `isChallengeOpen`이 거짓이면 액션이 아무것도 바꾸지 않고 반환. 레전드는 `pickLegendReward`의 결과를 `finishWildBattle`의 포획 처리와 같은 `species` 맵 규칙(새 종이면 레벨 `LEGEND_LEVEL`, 이미 있으면 `DUPLICATE_EXP`)으로 저장.
- [ ] **Step 4: 실행해 통과 확인** — `npx vitest run tests/field/trainingSave.test.ts tests/field/fieldSave.test.ts tests/saveMigration.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `git add src/store src/screens/admin tests && git commit -m "트레이닝 저장 데이터와 훈련 끝내기 액션 추가"`

---

### Task 3: 마을 지도 — 훈련 거리 줄과 문 표

**Files:**
- Modify: `src/field/world/maps/town.ts`, `src/domain/field/movement.ts`, `src/domain/field/tuning.ts`(`TOWN_ROWS_ADDED`), `src/field/world/loadField.ts`
- Test: `tests/field/maps.test.ts`(`SIZE.town` 갱신 포함), `tests/field/movement.test.ts`

**Interfaces:**
- Consumes: Task 1 `TRAINING_DANS`.
- Produces: `FieldMap.doors: { pos: Pos; kind: 'shop' | 'training' | 'stairs'; dan?: TrainingDan }[]`; `town.ts`의 `TOWN_DOORS`(문 글자 → `{kind, dan?}` 표, `D`=shop, 건물 문 글자 11개 + 계단 1개), `TOWN_SIGNS`에 훈련 거리 표지판 글 추가.

- [ ] **Step 1: 실패하는 테스트** — `maps.test.ts`: 마을 크기가 `[20, 40 + TOWN_ROWS_ADDED]`, 문이 정확히 상점 1개·훈련 11개(단이 `TRAINING_DANS`와 같음)·계단 1개, 모든 문이 걸어서 닿는 칸 앞에 있음(기존 도달 가능성 테스트 확장), 출구 3개가 여전히 서로 닿음. `movement.test.ts`: `parseMap`이 문 글자 표를 받아 `kind`·`dan`을 채움, 옛 `D`는 `shop`.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/maps.test.ts tests/field/movement.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `ParseOpts`에 `doorChars?: Record<string, {kind; dan?}>` 추가(기본은 `D`→shop), `town.ts` 맨 위에 훈련 거리 줄(첫 줄 건물 6채: 2~7단, 둘째 줄 5채: 8·9·11·12·13단, 가운데 한 칸 길)과 계단 건물 한 채를 추가하고 `TOWN_ROWS_ADDED`를 확정(건물 문이 길과 이어지게). 기존 서식지·광장·출구 위치는 y만 밀림. 문 글자는 대문자 중 다른 글자(`G`,`H`… 정확한 글자는 구현자 선택)로 하되 `CHAR_TILE`에 모두 `door`로 등록. `FieldScreen`이 못 쓰는 상태에서도 빌드가 깨지지 않게 `doors` 사용처(`FieldScreen.tsx`)는 Task 5 전까지 `doors.some(...)` 호환 수정만.
- [ ] **Step 4: 실행해 통과 확인** — 위 두 테스트 + `npx tsc --noEmit -p .` → PASS.
- [ ] **Step 5: 커밋** — `git add src tests && git commit -m "태초마을 위에 훈련 거리 줄과 건물 문 표 추가"`

---

### Task 4: 건물 그림과 지붕의 빛나는 숫자

**Files:**
- Modify: `src/field/world/maps/townTiles.ts`, `src/field/world/fieldRenderer.ts`, `src/field/world/field.css`
- Test: `tests/field/pixelArt.test.ts`(타일 이름·크기 규칙), `tests/field/roofNumbers.test.ts`

**Interfaces:**
- Consumes: Task 3의 문·건물 위치(`map.doors` 중 `kind:'training'|'stairs'`), Task 2의 `field.training.mastered`.
- Produces: `roofNumberRects(map: FieldMap, mastered: Partial<Record<TrainingDan, unknown>>): { dan: TrainingDan; x: number; y: number }[]`(`fieldRenderer.ts`, 순수: 마스터한 건물 지붕 가운데 타일 좌표), `drawField(...)`에 `mastered` 인자와 `time`을 받아 숫자를 천천히 깜빡이는 빛 번짐으로 덧그림.

- [ ] **Step 1: 실패하는 테스트** — `roofNumbers.test.ts`: 단 2·3만 마스터면 두 건물 좌표만, 마스터 없으면 빈 배열, 10 같은 목록 밖 단이 들어와도 무시. `pixelArt.test.ts`: 새 타일 이름이 등록표에 있고 크기 규칙을 지킴.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/roofNumbers.test.ts tests/field/pixelArt.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 건물 본체(지붕·벽·문 3칸 폭)와 계단 건물 타일을 `townTiles.ts`에 추가(기존 픽셀 그림 틀 사용, 잠긴 건물은 같은 그림에 어두운 지붕). `drawField`가 마스터한 건물 지붕 위에 숫자를 그리고(글자 색 노랑, 느린 빛 번짐 `sin(time)`) 마스터 안 된 지붕에는 아무것도 안 그림. 호출하는 `FieldScreen`은 스토어의 `training.mastered`를 넘김(Task 5와 한 흐름이므로 값을 읽는 한 줄만).
- [ ] **Step 4: 실행해 통과 확인** — 위 테스트 + `npx tsc --noEmit -p .`, 그리고 `npx vite --port 5181`로 `#/field` 마을을 375px에서 열어 건물 줄·지붕 숫자가 보이는지 스크린샷으로 확인(저장 데이터에 `mastered`를 직접 넣어 확인).
- [ ] **Step 5: 커밋** — `git add src tests && git commit -m "건물 그림과 마스터한 지붕의 빛나는 숫자 추가"`

---

### Task 5: 건물 문 부딪힘 — 입장·잠금 글·돌아오는 위치

**Files:**
- Modify: `src/field/world/FieldScreen.tsx`, `src/domain/field/movement.ts`(문 앞 칸 계산 함수), `src/field/world/field.css`
- Test: `tests/field/doorEntry.test.ts`, `e2e/training.spec.ts`(일부, Task 9에서 마무리)

**Interfaces:**
- Consumes: Task 3 `FieldMap.doors`, Task 1 `isTrainingOpen`·`isStairsOpen`·`TRAINING_DANS`.
- Produces: `doorAction(door: FieldMap['doors'][number], training: TrainingData): { type: 'shop' } | { type: 'enter'; to: string } | { type: 'locked'; text: string }`(`src/domain/field/doorEntry.ts`, 순수, `to`는 `/field/training/7`·`/stairs` 형태), `doorFront(map: FieldMap, door): Pos`(문 앞 길 칸).

- [ ] **Step 1: 실패하는 테스트** — `doorEntry.test.ts`: 상점 문은 `shop`, 열린 단의 문은 `enter` + `/field/training/<단>`, 잠긴 단은 `locked` + `"○단을 먼저 마스터해요"`(바로 앞 단 이름이 글에 들어감), 계단 문은 `isStairsOpen`이 참일 때 `enter` + `/stairs`, `doorFront`가 문 아래 칸.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/doorEntry.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `FieldScreen`의 문 처리(기존: 문이면 무조건 `shopOpen`)를 `doorAction`으로 분기: `shop`은 기존 팝업, `locked`는 기존 표지판 팝업(`signOpen`/`setSignText`) 재사용, `enter`는 `setFieldPosition`으로 문 앞 칸을 저장한 뒤 `navigate`. 돌아왔을 때 위치는 저장된 문 앞 칸에서 시작.
- [ ] **Step 4: 실행해 통과 확인** — `npx vitest run tests/field/doorEntry.test.ts` + 브라우저에서 잠긴 문 글·상점 문 확인 → PASS.
- [ ] **Step 5: 커밋** — `git add src tests && git commit -m "건물 문에서 입장·잠금 안내·상점을 나눠 처리"`

---

### Task 6: 트레이닝 화면 — 모드 선택·학습·마스터 도전·결과·효과

**Files:**
- Create: `src/field/training/TrainingScreen.tsx`, `StudyMode.tsx`, `ChallengeMode.tsx`, `TrainingResult.tsx`, `trainingText.ts`, `training.css`, `useTrainingFx.ts`
- Modify: `src/App.tsx`(경로 `/field/training/:dan`)
- Test: `tests/field/trainingText.test.ts`, `tests/field/trainingFlow.test.ts`(순수 상태기계), `e2e/training.spec.ts`

**Interfaces:**
- Consumes: Task 1 `planStudy`·`planChallenge`·`judgeChallenge`·`isChallengeOpen`·`TRAINING_MASTER_MS`, Task 2 `finishTraining`·`recordTrainingAnswer`, 기존 `playFx`·`preloadFx`·`ELEMENT_FX`·`SKILL_SFX`·`playSfx`·`pickCompanion`·`companionImage`/`creatureSprite`.
- Produces: `trainingFlowReducer(state, event)`(`src/field/training/flow.ts`, 순수): `idle → study|challenge → done`, 이벤트 `answer(correct, ms)`·`timeout`·`quit`; 상태에 `index`·`mistakes`·`elapsedMs`·`finished`. `trainingText.ts`의 글 함수(`modeTitle(dan)`, `challengeLockedText`, `resultText(outcome)` 등).

- [ ] **Step 1: 실패하는 테스트** — `trainingFlow.test.ts`: 학습은 ×1~×9 끝까지 가야 `finished`이고 틀리면 같은 문제를 다시(틀린 횟수 기록), 도전은 틀리면 즉시 `finished` + `wrong`, 시간이 `TRAINING_MASTER_MS`를 넘으면 `slow`, 중간 `quit`은 `finished` 아님(→ `finishTraining`을 부르지 않음), 학습 안 한 단의 도전 요청은 거부. `trainingText.test.ts`: 글이 단 번호·"캡슐 5개"를 포함.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/trainingFlow.test.ts tests/field/trainingText.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 화면 구성은 퀴즈모험 단 고르기 화면(`BattleScreen` dan 모드: 위 시계, 가운데 문제 카드, 아래 보기, 끝나면 결과)을 따르되 필드 모험 전투 화면과 같은 톤·색·테두리로 새로 그림. 입구 화면에 "N단 트레이닝센터" 간판, **차례대로 학습 / 마스터 도전**(학습 전이면 🔒 "학습을 먼저 마쳐요"), "내 기록 보기"(Task 8의 `/field/records`) 버튼. 문제를 맞힐 때마다 `useTrainingFx`가 동행 구구몬(없으면 첫 구구몬)의 `ELEMENT_FX` 효과를 왼쪽 아래 구구몬에서 표적으로 쏘고 `SKILL_SFX` 소리를 냄(≤0.6초, 문제 진행을 막지 않음, 틀리면 흔들림만). 시계는 도전에서 `TRAINING_MASTER_MS` 카운트다운(눈금·색 구간 글자 없음 규칙 준수 불필요 — 퀴즈모험 `trial-clock`처럼 초 표시). 끝나면 `finishTraining` 한 번 호출 후 결과(캡슐 5개·마스터 여부·새 기록·레전드 구구몬 그림). 마스터이면 "지붕에 숫자가 켜졌어요" 글. 나가면 `navigate('/field')`.
- [ ] **Step 4: 실행해 통과 확인** — 단위 테스트 + 375px에서 학습·도전·결과 화면 직접 확인 + `npx tsc --noEmit -p .`.
- [ ] **Step 5: 커밋** — `git add src tests && git commit -m "트레이닝 화면(학습·마스터 도전·결과·효과) 추가"`

---

### Task 7: 무한의 계단 건물 연결

**Files:**
- Modify: `src/screens/StairsScreen.tsx`(`navigate('/explore')` 두 곳), `src/App.tsx`
- Test: `tests/field/stairsReturn.test.ts`, `e2e/training.spec.ts`

**Interfaces:**
- Consumes: Task 3 계단 문, Task 5 `doorAction`(`/stairs`), `isStairsOpen`.
- Produces: `returnPathAfterStairs(): '/field'` 상수 한 곳(`src/field/training/routes.ts`), 계단 화면의 나가기·그만하기·결과 닫기가 `#/field`로 돌아옴.

- [ ] **Step 1: 실패하는 테스트** — `stairsReturn.test.ts`: `returnPathAfterStairs()`가 `/field`, `isStairsOpen`이 `STAIRS_OPEN_AFTER_DAN=null`이면 항상 true, 숫자면 그 단 마스터 뒤 true.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/stairsReturn.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `StairsScreen`의 `navigate('/explore', ...)` 두 곳을 `returnPathAfterStairs()`로. 계단 규칙·별 보상은 그대로.
- [ ] **Step 4: 실행해 통과 확인** — 단위 테스트 + 브라우저에서 계단 건물 입장 → 나가기 → 마을 문 앞.
- [ ] **Step 5: 커밋** — `git add src tests && git commit -m "무한의 계단을 건물로 연결하고 끝나면 마을로 돌아오게 함"`

---

### Task 8: 퀴즈모험 끄기와 필드에서 기록 보기

**Files:**
- Create: `src/config/featureFlags.ts`
- Modify: `src/App.tsx`, `src/screens/TitleScreen.tsx`
- Test: `tests/field/featureFlags.test.ts`, `e2e/training.spec.ts`

**Interfaces:**
- Produces: `QUIZ_ADVENTURE_ENABLED = false`; `/pet`·`/explore`·`/shop`·`/records`·`/dex`·`/battle`·`/practice`·`/hatch`·`/welcome` 경로는 플래그가 꺼져 있으면 `#/field`로 되돌림(`/stairs`는 건물에서 오므로 살림, `/admin`·`/dev/*` 그대로), 새 경로 `/field/records`(전체 화면에 `RecordsScreen`을 담고 위쪽에 "마을로" 버튼).

- [ ] **Step 1: 실패하는 테스트** — `featureFlags.test.ts`: 플래그 끔 상태에서 허용 경로 판별 함수 `isRouteEnabled(path)`가 퀴즈 경로 false, `/field/*`·`/stairs`·`/admin`·`/dev/field` true, 플래그를 켜면 모두 true.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/featureFlags.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `App.tsx` 라우트에서 퀴즈 경로를 플래그로 감싸 `Navigate to="/field"`. `TitleScreen`은 "퀴즈 모험" 버튼을 플래그로 숨기고 "필드 모험"만(첫 화면에 단독 버튼). 코드·저장 데이터 삭제 금지. 틀린 문제 기록은 Task 6의 `recordTrainingAnswer`가 `learning.facts`를 갱신하므로 `RecordsScreen`이 그대로 보여줌.
- [ ] **Step 4: 실행해 통과 확인** — 단위 테스트 + 브라우저에서 `#/pet` 직접 입력 시 `#/field`로 감, 타이틀에 필드 모험 한 버튼.
- [ ] **Step 5: 커밋** — `git add src tests && git commit -m "퀴즈모험을 끄고 필드에서 학습 기록을 볼 수 있게 함"`

---

### Task 9: E2E·문서·전체 확인

**Files:**
- Create: `e2e/training.spec.ts`
- Modify: `e2e/field.spec.ts`·`e2e/helpers.ts`(퀴즈모험 타이틀 버튼·경로를 쓰던 테스트 보정, 플래그로 되살릴 수 있게 `window.__GUGU_E2E_QUIZ__` 스위치는 만들지 않고 해당 테스트만 `#/field`로 시작하도록 수정), `MVP_DESIGN.md`(맨 위 이력 v1.64: 트레이닝센터·무한의 계단 건물·퀴즈모험 끔, 해당 절 갱신), `CLAUDE.md`(폴더 표에 `src/field/training/`·`training.ts`·`featureFlags.ts`, 라우트 목록, "어디를 고치나" 표에 트레이닝 수치 행)
- Test: 위 전체

- [ ] **Step 1: E2E 작성** — 2단 학습 끝까지 → 도전 성공(시간 스위치로 27초 안) → 3단 문 열림, 3단 잠긴 문 글, 학습 전 도전 🔒, 12·13단은 저장에 앞 단 마스터 상태를 심어 보상(레전드)·두 번째 마스터에서 중복 지급 없음, 도전 실패에도 캡슐 5개, 계단 입장·복귀, `#/pet` → `#/field`. 시간 스위치는 기존 `__GUGU_E2E_NO_TIMER__` 방식에 맞춰 `debugFlags.ts` 한 곳에서만 읽게 필요하면 `__GUGU_E2E_TRAINING_MS__` 추가(`window`).
- [ ] **Step 2: 실행** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test`(단독 실행), `MSYS_NO_PATHCONV=1 npm run build` → 모두 통과(기존 `dex.spec` 놀이 장면의 시간 문제 실패는 따로 한 번 더).
- [ ] **Step 3: 직접 확인** — 375px에서 마을 훈련 거리·건물 문·학습·도전 화면·결과를 스크린샷으로 확인하고 서버 종료.
- [ ] **Step 4: 검토** — `opus-reviewer`에게 브랜치 전체 검토를 맡김(저장 데이터·마을 위치 이동·보상 지급 중복 중심).
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "트레이닝센터 E2E와 설계서·안내 문서 갱신"` (push·배포는 사용자가 "배포"라고 할 때만)

# 체육관·트레이너 NPC·셈연습·저학년 모드·별점수·건물 그림자 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트레이닝센터 12채를 체육관 한 채(+ 안의 트레이너 NPC)로 바꾸고, 셈연습 트레이너·저학년 모드·꺼 둔 별점수 시스템·건물 그림자를 더한다.

**Architecture:** 이미 만든 학습·도전 화면·러너·보상 코드(`src/field/training/*`, `training.ts`, `finishTraining`)를 재사용한다. 입구만 "건물 문 → 체육관 실내 지도(`gym`)의 NPC 말 걸기"로 바꾸고, 문제 화면은 문제 표시를 일반화한 `BoardQuestion`을 받게 해 구구단·셈연습·동상 문제가 같은 화면을 쓴다. 규칙·수치는 순수 도메인과 `tuning.ts` 한 곳, 켜고 끄는 기능은 `featureFlags.ts`.

**Tech Stack:** React 18 + TypeScript + Vite + Zustand(persist) + 캔버스 필드 렌더러 + Vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-gym-npc-lowgrade-design.md` (앞선 `2026-11-18-training-center-design.md`를 바꾸는 설계. CLAUDE.md도 함께 읽을 것). 작업 브랜치는 `training-center`(아직 main·배포 전)에서 이어 간다.

## Global Constraints

- 화면 글·주석·커밋 메시지는 **한국어**(어린이가 읽기 쉬운 말). 커밋 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`(Opus 에이전트는 `Claude Opus 5.5`).
- **체육관 단 트레이너 = `TRAINING_DANS = [2,3,4,5,6,7,8,9,12,13]` (10명, 11단·10단 없음).** 첫 단(2단)은 항상 열림, 그 밖은 바로 앞 단을 마스터해야 말 걸 수 있음(9 다음 12, 그다음 13).
- 마스터 도전: 3지선다 9문제 섞음, **전체 27초**(`TRAINING_MASTER_MS`), 하나도 안 틀려야 합격 — 기존 그대로. 마스터 도전은 그 단의 "차례대로 학습"을 끝까지 마쳐야 열림 — 기존 그대로.
- **캡슐 규칙**: 그 단을 **처음 마스터**한 도전 → 그 단의 캡슐 **20개**(`TRAINING_FIRST_MASTER_CAPSULES = 20`, 5개를 더하지 않음). 그 밖의 **성공**(학습 끝까지 마침 / 도전 합격) → **5개**(`TRAINING_CAPSULES = 5`). **도전 실패는 캡슐 없음**(앞서 "실패도 5개"였던 규칙을 바꿈). 캡슐 종류: 2~9단은 그 단이 있는 필드(초원 2·4·8, 물가 3·6·9, 사막 5·7), **12·13단은 황금**. 12·13단 첫 마스터는 레전드 구구몬 1마리(기존 `pickLegendReward`).
- **셈연습 트레이너 NPC 3명**(기본·고수·보수): **마스터 도전만**, 9문제 3지선다, 마스터 기준은 기존 `PRACTICE_MASTER_SEC_PER_Q`(기본 3초·고수 5초·보수 3초 × 9문제, 전체 제한, 하나도 안 틀림). 처음부터 열림. 보상: 처음 마스터 20개·그 밖의 성공 5개를 **무작위 필드 캡슐**(초원·물가·사막, 황금 제외, 주사위 `rng` 주입)로, **고수 첫 마스터는 레전드 구구몬 1마리**(`legendGranted.arithHard`). 도전 실패는 보상 없음.
- NPC 그림은 `013` 치비. **`c013`은 종에서 제거**(종 48, 레전드 11 = c014,c015,c016,c018,c019,c045~c050, 빛 속성 6마리). 옛 저장의 `c013` → `c046`으로 이전(둘 다 있으면 `c046`만 남김). NPC마다 **RGB로 색을 바꿔 구분**, 마스터하면 **머리색이 노랑**. 이미지가 없으면(`src/field/art/creatures/chibi`가 없을 때) 픽셀 폴백으로 동작해야 E2E·배포가 깨지지 않음.
- **저학년 모드**: `Settings.lowGrade`(기본 false), 타이틀 스위치, **켤 때·끌 때 모두 비밀번호 `1234`**(`LOWGRADE_PASSWORD`, `tuning.ts` 한 곳). 켜면 구구몬 잡는 문제: **초원 = 한 자리 + 한 자리 / 한 자리 − 한 자리, 물가 = 두 자리 − 한 자리, 사막 = 두 자리 + 한 자리**. 캡슐 구입 = 그 필드 문제 5개, 회복 = 틀린 문제 중심(없으면 무작위), **체육관은 그대로 구구단**.
- **별점수**(`STAR_POINTS_ENABLED = false` — 적립·화면·동상 모두 꺼 둠): 발견 5, 포획 5, 트레이닝 성공 3, 동상 5~15(시간 반비례) — 모두 `tuning.ts`. 꺼져 있으면 별점수 더하는 호출은 **아무것도 바꾸지 않음**. 저장 형식(`field.starPoints`)은 지금 넣는다.
- 건물 그림자: 마을의 건물(체육관·상점·집·계단 건물·담)에 `shadow.ts` 결의 연한 그림자(상수 한 곳).
- 수치·표는 `src/domain/field/tuning.ts`(+ NPC 표는 `src/field/world/maps/gym.ts` 한 곳) + `tests/field/tuning.test.ts` 고정값. `SaveData`에 필드를 더하면 **네 곳**(`createInitialSave`, `mergeSave` 깊게, `partialize`, `DataSecurityPanels.currentSave()`) 확인. `SAVE_VERSION`·`SAVE_KEY` 그대로. 예전 저장이 깨지면 안 됨.
- 퀴즈모험 코드·데이터·`facts.ts`/`questionGen.ts`는 건드리지 않음. 퀴즈 모험 플래그(`QUIZ_ADVENTURE_ENABLED=false`)·E2E 스위치 `__GUGU_E2E_QUIZ__` 그대로.
- 새 E2E 스위치는 `src/field/debugFlags.ts`/`featureFlags.ts` 한 곳에서 읽고 CLAUDE.md 스위치 목록에 적는다.
- 효과 ≤ 0.6초, 375px 폭 휴대폰에서 겹침·가로 스크롤 없음. 모델 분배(CLAUDE.md): 저장 데이터·보상 로직·마이그레이션은 `opus-expert`, 마지막 전체 검토는 `opus-reviewer`, 나머지는 Sonnet.
- push·merge·배포는 지휘자만(사용자가 "배포"라고 할 때).

## Review Focus

1. 옛 저장(c013 보유, 옛 마을 위치, `training` 있는/없는 두 경우)을 열어도 데이터가 사라지거나 벽 칸에 서지 않음 → Task 1·2 마이그레이션 테스트.
2. 첫 마스터 20개와 5개가 겹쳐 지급되거나 두 번 지급되지 않음, 실패 도전은 캡슐·별 없음 → Task 2 `finishTraining`/`finishArithTraining` 테스트.
3. 별점수 플래그 꺼짐 상태에서 저장이 전혀 바뀌지 않음 → Task 3 꺼짐/켜짐 테스트.
4. 저학년 비밀번호 틀림·취소 때 설정이 바뀌지 않음, 켜진 채로 새로고침해도 유지 → Task 5.
5. 체육관 NPC 말 걸고 돌아왔을 때 위치(체육관 안 NPC 앞), 잠긴 NPC 글, 이미지 없는 폴백 → Task 6·7.

---

## 파일 구조

| 파일 | 일 |
|---|---|
| `src/domain/field/{speciesIds,creatures,elements,fields}.ts`, `src/domain/monsterNames.ts`, `src/store/fieldData.ts` | c013 제거·이전, 레전드 11 |
| `src/domain/field/tuning.ts` | `TRAINING_*`(고침), `ARITH_TRAINER_*`, `STAR_*`, `STATUE_*`, `LOWGRADE_*`, 마을 줄 수 |
| `src/domain/field/training.ts` (수정), `arithTrainer.ts` (신규) | 훈련 데이터(`arith`·`legendGranted.arithHard`), 열림·보상 규칙, 셈연습 도전 계획·판정 |
| `src/domain/field/starPoints.ts` (신규) | 별점수 규칙(적립 함수·`statueStars`·`planStatueQuestions`) |
| `src/domain/field/lowGrade.ts` (신규) | 저학년 문제 생성(필드별)·상점 계획·틀린 문제 목록 |
| `src/store/useGameStore.ts`, `fieldData.ts`, `saveData.ts` | `finishTraining`(20/5 규칙)·`finishArithTraining`·`finishStatue`·`addStarPoints`·`setLowGrade`·저학년 틀린 문제 기록 |
| `src/field/world/maps/{town,townTiles,gym,gymTiles}.ts`, `loadField.ts` | 마을 체육관 구역, 체육관 실내 지도·NPC 표·동상·타일 |
| `src/field/world/{FieldScreen,fieldRenderer}.tsx/ts`, `src/field/art/npcTint.ts`, `npcSprite.ts` | NPC 그리기·말 걸기·색 변환·머리색, 그림자 |
| `src/field/training/*` | `BoardQuestion` 일반화, 셈연습 도전 화면, 동상 화면, 결과 글 |
| `src/screens/TitleScreen.tsx`, `src/field/lowgrade/PasswordDialog.tsx` | 저학년 스위치·비밀번호 |
| `src/config/featureFlags.ts` | `STAR_POINTS_ENABLED`, `isStarPointsEnabled()` |
| `e2e/*.spec.ts`, `MVP_DESIGN.md`, `CLAUDE.md` | 테스트·문서 |

---

### Task 1: c013 제거와 저장 이전 (opus-expert 담당)

**Files:**
- Modify: `src/domain/field/speciesIds.ts`, `src/domain/monsterNames.ts`, `src/domain/field/elements.ts`, `src/domain/field/creatures.ts`·`fields.ts`(c013 참조), `src/store/fieldData.ts`(`OLD_SPECIES_MAP`·`mergeField`), 종 개수를 세는 곳(도감 분모 등, grep `SPECIES.length`·`49`·`12`), 관련 테스트(`tests/field/speciesMigration.test.ts`, `elements.test.ts`, `creatures` 개수 테스트 등)
- Test: `tests/field/speciesMigration.test.ts`(확장), `tests/field/elements.test.ts`

**Interfaces:**
- Produces: `SPECIES_IDS` 48개(c013 없음), `LEGEND_SPECIES` 11개, 빛 속성 6마리, `OLD_SPECIES_MAP.c013 = 'c046'`; c013을 가진 저장은 `mergeField`에서 `c046`으로 옮겨(키·도감·동행·진행 중 값·기술 id), `c046`이 이미 있으면 `c046` 항목은 그대로 두고 `c013` 항목은 버린다.

- [ ] **Step 1: 실패하는 테스트** — `SPECIES_IDS.length === 48`, `LEGEND_SPECIES.length === 11`이고 `c013` 없음, `ELEMENT_GROUPS.light.length === 6`, 속성 주 7그룹 중 빛만 6·나머지 7, 부속성 개수 균형은 `7±1` 범위 유지, 필드별 종 수는 현재 `fields.ts`를 읽고 c013 제거만 반영해 계산한 값(레전드 11, 나머지 필드는 변동 없음)으로 테스트에 박는다; 옛 저장 `{species:{c013:{…}}, companion:'c013'}` → `c046`으로 이전(레벨·hp 보존), `c013`·`c046` 둘 다 있으면 `c046`만 남음, `c013` 키가 `seen`·`dex`에도 있을 때 처리.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/speciesMigration.test.ts tests/field/elements.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 파일에서 `c013` 제거. `c013` 그림 파일(`creatures/chibi/013-*`)은 NPC용으로 **지우지 않는다**(`creatureArt`에서 종으로 등록만 제거; `localSprites`의 `cNNN` 규칙이 c013을 더는 만들지 않게). 도감·SVG 폴백 등에서 c013 참조를 모두 정리(`grep -rn c013 src tests e2e`).
- [ ] **Step 4: 통과 확인** — 위 테스트 + `npx tsc --noEmit -p .` + `npx vitest run` 전체 → PASS.
- [ ] **Step 5: 커밋** — `git add -A src tests e2e && git commit -m "013을 종에서 빼고 옛 저장의 c013을 c046으로 옮김"`

---

### Task 2: 훈련 규칙 고치기 — 11단 삭제, 20/5 캡슐, 셈연습 데이터·보상 (opus-expert 담당)

**Files:**
- Modify: `src/domain/field/tuning.ts`, `src/domain/field/training.ts`, `src/store/fieldData.ts`(`mergeTraining`), `src/store/useGameStore.ts`(`finishTraining`), 기존 훈련 테스트들(`tests/field/training*.test.ts`, `trainingSave.test.ts`, `trainingRunner.test.ts`, `tuning.test.ts`, `doorEntry` 등 `11` 참조)
- Create: `src/domain/field/arithTrainer.ts`
- Test: `tests/field/training.test.ts`, `trainingSave.test.ts`, `arithTrainer.test.ts`, `tuning.test.ts`

**Interfaces:**
- Produces (`tuning.ts`): `TRAINING_DANS = [2,3,4,5,6,7,8,9,12,13] as const`, `TRAINING_CAPSULE_OF_DAN`(위 표), `TRAINING_CAPSULES = 5`, `TRAINING_FIRST_MASTER_CAPSULES = 20`, `ARITH_TRAINER_LEVELS = ['basic','hard','comp'] as const`, `ARITH_TRAINER_MASTER_MS: Record<ArithLevel, number>`(= `PRACTICE_MASTER_SEC_PER_Q` × 9 × 1000), `ARITH_CAPSULE_CHOICES = ['meadow','waterside','desert'] as const`, `ARITH_TRAINER_QUESTIONS = 9`.
- Produces (`training.ts`): `TrainingData`에 `arith: Partial<Record<ArithLevel, { studied?: never; mastered: { bestMs: number; at: number } }>>`(단순히 `mastered?: {bestMs, at}`만 둔다: `arith: Partial<Record<ArithLevel, { bestMs: number; at: number }>>`), `legendGranted: Partial<Record<12 | 13 | 'arithHard', SpeciesId>>`; `isTrainingOpen`은 새 목록 기준(12는 9 다음); `isFirstMaster(t, dan)`.
- Produces (`arithTrainer.ts`, 순수): `planArithTrainer(rng: Rng, level: ArithLevel): ArithTrainerQuestion[]`(9개, 그 단계의 `ArithKind`들에서 `generateArith`로 만들어 3지선다·`BoardQuestion` 변환은 Task 7이 함; 여기서는 `{ q: ArithQuestion; choices: number[] }`), `judgeArithTrainer({ mistakes, timeMs }, level): 'pass'|'wrong'|'slow'`.
- Produces (store): `finishTraining` 결과에 `firstMaster: boolean`·`stars: number`(별점수 꺼짐 동안 0)를 더하고 캡슐 규칙을 새 것으로(첫 마스터 20 / 성공 5 / 도전 실패 0, 학습 끝까지 5), `finishArithTraining(input: { level: ArithLevel; mistakes: number; timeMs: number; now: number; rng?: Rng }): ArithOutcome`(`{ ok, capsuleType: CapsuleType | null, capsules: number, mastered: boolean, firstMaster: boolean, newBest: boolean, bestMs: number | null, legend: { species: SpeciesId; duplicate: boolean } | null, stars: number }`; 실패는 `capsules: 0`, 거부 시 상태 불변).

- [ ] **Step 1: 실패하는 테스트** — `TRAINING_DANS` 길이 10·11 없음, `isTrainingOpen`(9 마스터 → 12 열림, 12 → 13), `finishTraining`: 학습 끝 → 5개·`studied`, 도전 합격 처음 → **20개**(5 아님·25 아님)·`firstMaster:true`, 도전 합격 두 번째 → 5개, 도전 실패 → 캡슐 0·마스터 없음, 12단 첫 합격 → 황금 20개 + 레전드 1마리·두 번째는 레전드 없음, 거부(학습 전 도전)는 상태 불변; `finishArithTraining`: 기본 첫 합격 → 무작위 필드 캡슐 20개(시드 고정으로 종류 고정), 두 번째 합격 5개, 실패 0, **고수 첫 합격 → 레전드 1마리**(`legendGranted.arithHard`)·두 번째 없음, 보수·기본은 레전드 없음; `mergeTraining`이 `arith`·`legendGranted.arithHard` 깨진 값을 거름(문자열·음수·모르는 단계·모르는 종); `judgeArithTrainer` 경계(기본 27000 합격/27001 느림, 고수 45000/45001, 보수 27000), `planArithTrainer` 9개·보기 3개·정답 포함·중복 없음.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/training.test.ts tests/field/trainingSave.test.ts tests/field/arithTrainer.test.ts tests/field/tuning.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 11단 관련 표·테스트·`doorEntry`/지붕 숫자 참조는 이 작업에서 **컴파일이 되도록 최소만** 고치고(문 종류·지도는 Task 6이 다시 함), 훈련 화면(`TrainingScreen` 등)이 새 결과 필드를 쓰도록 글 함수(`trainingText.resultText`)에 "처음 마스터 캡슐 20개 / 5개"를 반영. 별점수는 Task 3에서 연결(여기서는 `stars: 0` 고정 자리만).
- [ ] **Step 4: 통과 확인** — 위 테스트 + `npx tsc --noEmit -p .` + `npx vitest run` 전체 → PASS.
- [ ] **Step 5: 커밋** — `git add -A src tests && git commit -m "훈련 보상을 첫 마스터 20개·성공 5개로 바꾸고 셈연습 마스터 데이터를 추가"`

---

### Task 3: 별점수 시스템 — 만들어 두되 꺼 둔다 (opus-expert 담당)

**Files:**
- Modify: `src/config/featureFlags.ts`, `src/domain/field/tuning.ts`, `src/store/fieldData.ts`(`starPoints`), `src/store/saveData.ts`, `src/store/useGameStore.ts`(`markSeen`·`finishWildBattle`·`finishTraining`·`finishArithTraining`에 연결), `src/field/debugFlags.ts`(`__GUGU_E2E_STARS__` 읽기가 flag 쪽이면 featureFlags에)
- Create: `src/domain/field/starPoints.ts`
- Test: `tests/field/starPoints.test.ts`, `tests/field/starSave.test.ts`, `tests/field/tuning.test.ts`

**Interfaces:**
- Produces (`featureFlags.ts`): `STAR_POINTS_ENABLED = false`, `isStarPointsEnabled(): boolean`(window `__GUGU_E2E_STARS__`가 boolean이면 그 값).
- Produces (`tuning.ts`): `STAR_DISCOVER = 5`, `STAR_CATCH = 5`, `STAR_TRAINING = 3`, `STATUE_QUESTIONS = 7`, `STATUE_STARS_MIN = 5`, `STATUE_STARS_MAX = 15`, `STATUE_FAST_MS`(이 시간 이하면 최대), `STATUE_SLOW_MS`(이 시간 이상이면 최소) — 값은 `STATUE_FAST_MS = 20_000`, `STATUE_SLOW_MS = 70_000`.
- Produces (`starPoints.ts`, 순수): `statueStars(timeMs: number): number`(FAST 이하 15, SLOW 이상 5, 사이는 **시간에 반비례**: `round(5 + 10 × (1/t − 1/SLOW)/(1/FAST − 1/SLOW))`를 5~15로 자름), `planStatueQuestions(input: { facts: …; lowGrade: boolean; field?: FieldId; rng: Rng }): StatueQuestion[]`(7개; 구구단 모드는 **12 또는 13단 문제가 정확히 1개 이상 포함**되도록 하고 나머지는 틀린 문제(`lastWrongAt` 최근) 우선 + 랜덤, 저학년이면 `lowGrade.ts`의 틀린 문제 목록 우선 + 랜덤 덧뺄셈; 반환 형식은 Task 7이 `BoardQuestion`으로 바꿀 수 있는 `{ kind: 'mult'; dan; multiplier } | { kind: 'arith'; … }`), `addStarPoints(current: number, n: number): number`.
- Produces (store): `field.starPoints: number`(정수 ≥ 0, 기본 0), `addStarPoints(n: number, reason: 'discover'|'catch'|'training'|'statue'): void` — `isStarPointsEnabled()`가 거짓이면 **상태를 전혀 바꾸지 않음(set 호출도 안 함)**, `finishStatue(input: { timeMs: number; allCorrect: boolean; now: number }): { ok: boolean; stars: number }`(꺼져 있으면 `{ok:false, stars:0}`·불변, 켜져 있으면 전부 맞혔을 때만 `statueStars(timeMs)` 지급). 적립 연결: 새 종 발견(`markSeen`이 처음 보는 종일 때) +`STAR_DISCOVER`, 새 종 포획 +`STAR_CATCH`, `finishTraining`/`finishArithTraining`의 **성공**에 +`STAR_TRAINING`(결과의 `stars` 필드에 실제 지급량, 꺼져 있으면 0).

- [ ] **Step 1: 실패하는 테스트** — `statueStars`(20000 이하 15, 70000 이상 5, 중간값이 단조 감소·5~15), `planStatueQuestions`(구구단: 7개·12/13단 1개 이상·틀린 문제 우선·중복 없음, 저학년: 덧뺄셈 7개), 플래그 **꺼짐**: `addStarPoints`·`finishStatue`·발견·포획·훈련 성공 후에도 `field.starPoints === 0`이고 스토어 상태 객체가 그대로(참조 동일), 플래그 **켜짐**(`window.__GUGU_E2E_STARS__ = true` 또는 모듈 모킹): 발견 +5(같은 종 두 번째는 0)·포획 +5·훈련 성공 +3·실패 0·동상 전부 맞힘 +5~15·하나라도 틀리면 0, `mergeSave`가 `starPoints`를 정수 ≥ 0로 채움(문자열·음수·소수 → 0), 백업(`currentSave()`)에 포함.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/starPoints.test.ts tests/field/starSave.test.ts tests/field/tuning.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 화면 표시는 하지 않는다(필드 HUD·결과에 별점수 없음).
- [ ] **Step 4: 통과 확인** — 위 테스트 + `npx tsc --noEmit -p .` + `npx vitest run` 전체 → PASS.
- [ ] **Step 5: 커밋** — `git add -A src tests && git commit -m "별점수 저장·규칙을 만들고 코스튬 전까지 꺼 둠"`

---

### Task 4: 저학년 모드 도메인·저장 (opus-expert 담당)

**Files:**
- Create: `src/domain/field/lowGrade.ts`
- Modify: `src/domain/field/tuning.ts`, `src/store/saveData.ts`(`Settings.lowGrade`), `src/store/fieldData.ts`(`lowGrade.recentWrong`), `src/store/useGameStore.ts`(`setLowGrade`, `recordLowGradeAnswer`), `src/domain/field/shopQuiz.ts`·`wounds.ts`(계획에 저학년 갈래 연결은 Task 5 UI와 함께 하되 순수 함수는 여기서), `tests/` 해당
- Test: `tests/field/lowGrade.test.ts`, `tests/field/lowGradeSave.test.ts`, `tests/field/tuning.test.ts`

**Interfaces:**
- Produces (`tuning.ts`): `LOWGRADE_PASSWORD = '1234'`, `LOWGRADE_WRONG_KEEP = 20`(틀린 문제 최대 보관), `LOWGRADE_SHOP_QUESTIONS = 5`, 저학년 문제 시간표(`LOWGRADE_ANSWER_SEC: Record<FieldId, number>`; 값은 기존 필드 구구단 문제 시간 규칙을 읽고 같은 크기로: 초원 한 자리 덧뺄셈은 `PRACTICE_MASTER_SEC_PER_Q.basic`(3초) 기준, 물가·사막 두 자리 ± 한 자리는 5초).
- Produces (`lowGrade.ts`, 순수): `type LowGradeProblem = { a: number; op: '+' | '−'; b: number; result: number }`, `generateLowGrade(rng: Rng, field: FieldId): LowGradeProblem`(초원: 한 자리(1~9)+한 자리 또는 큰 수에서 작은 수를 뺀 한 자리−한 자리(결과 ≥ 0), 물가: 두 자리(10~99) − 한 자리(1~9)(결과 ≥ 1, 받아내림 있음·없음 섞임), 사막: 두 자리 + 한 자리(결과 ≤ 99는 요구 아님: ≤ 108 허용 안 함 — **결과가 두 자리(≤ 99)가 되도록**)), `lowGradeChoices(rng, p: LowGradeProblem): number[]`(3지선다, 정답 포함·중복 없음·음수 아님·그럴듯한 오답: ±1·±10·자리 바꿈), `planLowGradeField(rng, field, n): LowGradeProblem[]`, `planLowGradeShop(rng, field): LowGradeProblem[]`(5개), `planLowGradeHeal(wrong: readonly LowGradeProblem[], rng, n): LowGradeProblem[]`(틀린 문제 최근 순 우선, 모자라면 무작위로 채움 — 무작위 필드는 그 구구몬의 필드), `pushLowGradeWrong(list: readonly LowGradeProblem[], p: LowGradeProblem): LowGradeProblem[]`(같은 문제는 앞으로 올리고 `LOWGRADE_WRONG_KEEP`개로 자름).
- Produces (store): `Settings.lowGrade: boolean`(기본 false, `mergeSave`에서 boolean 아니면 false), `field.lowGrade: { recentWrong: LowGradeProblem[] }`(기본 `[]`, 깨진 항목은 거름), `setLowGrade(on: boolean): void`(비밀번호 검사는 UI 몫), `recordLowGradeAnswer(p: LowGradeProblem, correct: boolean): void`(틀리면 `recentWrong`에 push, 맞히면 그 문제를 목록에서 뺌).

- [ ] **Step 1: 실패하는 테스트** — `generateLowGrade` 필드별 범위(1000번 시드 반복: 초원은 한 자리끼리·결과 0~18 덧셈/뺄셈 결과 ≥0, 물가는 a 두 자리·b 한 자리·결과 ≥ 1, 사막은 a 두 자리·b 한 자리·결과 ≤ 99), `lowGradeChoices` 3개·정답 포함·중복 없음·음수 없음, `planLowGradeShop` 5개, `planLowGradeHeal`(틀린 문제 우선·부족분 무작위·n개), `pushLowGradeWrong`(중복 앞으로·최대 개수), 저장: `Settings.lowGrade` 병합·옛 저장 false, `recentWrong` 깨진 값 거르기, 백업 포함.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/lowGrade.test.ts tests/field/lowGradeSave.test.ts tests/field/tuning.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 화면은 건드리지 않는다.
- [ ] **Step 4: 통과 확인** — 위 테스트 + `npx tsc --noEmit -p .` + `npx vitest run` 전체 → PASS.
- [ ] **Step 5: 커밋** — `git add -A src tests && git commit -m "저학년 모드 문제 규칙·설정·틀린 문제 저장 추가"`

---

### Task 5: 저학년 모드 화면 — 타이틀 비밀번호·야생 전투·상점

**Files:**
- Create: `src/field/lowgrade/PasswordDialog.tsx`, `lowgrade.css`
- Modify: `src/screens/TitleScreen.tsx`·`title.css`, `src/field/battle/WildBattleScreen.tsx`·`useQuestionFeed.ts`(문제 받기·표시·판정), `src/domain/field/fieldQuestions.ts`(필요 시 저학년 갈래), `src/field/shop/{CapsulePractice,HealPractice,PracticeCard}.tsx`·`shopText.ts`, 문제 표시 컴포넌트(구구단 `QuestionDisplay`에 `arith` 종류를 더하는 방식이 가장 작으면 그 방식 — `facts.ts`/`questionGen.ts`는 수정 금지이므로 표시 컴포넌트 쪽에서 새 타입을 받게 한다)
- Test: `tests/field/lowGradeScreen.test.ts`(순수 부분), `e2e/lowgrade.spec.ts`

**Interfaces:**
- Consumes: Task 4 `generateLowGrade`·`lowGradeChoices`·`planLowGradeField`·`planLowGradeShop`·`planLowGradeHeal`·`setLowGrade`·`recordLowGradeAnswer`·`LOWGRADE_PASSWORD`.
- Produces: `checkLowGradePassword(input: string): boolean`(`src/domain/field/lowGrade.ts`에 추가, `=== LOWGRADE_PASSWORD`), 타이틀 스위치(눌렀을 때 비밀번호 창 → 맞으면 `setLowGrade(!on)`, 틀리면 "비밀번호가 맞지 않아요"·값 그대로, 취소하면 그대로, 틀려도 잠금 없음), 야생 전투가 `settings.lowGrade`가 켜졌을 때 그 필드의 덧뺄셈 문제를 내고(문제 시간은 `LOWGRADE_ANSWER_SEC`), 틀리면 `recordLowGradeAnswer`, 캡슐 구입 연습은 `planLowGradeShop`(5문제), 회복 연습은 `planLowGradeHeal`(틀린 문제 중심·없으면 무작위), 체육관·트레이닝 화면은 저학년 모드와 무관(구구단 그대로).

- [ ] **Step 1: 실패하는 테스트** — `checkLowGradePassword('1234')` true·그 밖(빈 문자열·'0000'·'12345') false; 야생 전투 문제 공급 순수 부분(문제 계획이 켜짐/꺼짐에 따라 갈라짐)을 단위 테스트로, E2E: 타이틀에서 스위치를 눌러 `1234` 입력 → 켜짐 표시, 틀린 번호는 그대로 꺼짐, 다시 눌러 `1234` → 꺼짐; 켠 뒤 `#/field`로 가서 초원 야생 전투 문제가 한 자리 덧셈/뺄셈 형태(`+`·`−`가 들어 있고 `×`가 없음), 캡슐 구입 연습이 5문제, 체육관(Task 6 이후)은 `×`.
- [ ] **Step 2: 실행해 실패 확인** — 단위 테스트 FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 비밀번호 창은 숫자 패드 모양(기존 관리자 PIN 입력 컴포넌트가 재사용 가능하면 사용), 375px에서 확인.
- [ ] **Step 4: 통과 확인** — 단위 + `E2E_PORT=5191 npx playwright test e2e/lowgrade.spec.ts` + `npx tsc --noEmit -p .`; 브라우저로 375px 타이틀·전투·상점 화면 직접 확인.
- [ ] **Step 5: 커밋** — `git add -A src tests e2e && git commit -m "저학년 모드 스위치(비밀번호)와 덧뺄셈 문제 연결"`

---

### Task 6: 체육관 — 마을 구역·실내 지도·NPC 표·동상

**Files:**
- Create: `src/field/world/maps/gym.ts`, `gymTiles.ts`
- Modify: `src/field/world/maps/town.ts`·`townTiles.ts`(훈련 거리·건물 타일·지붕 숫자 삭제, 체육관 구역 추가), `src/domain/field/fields.ts`(`MapId`에 `'gym'`), `src/domain/field/movement.ts`(`FieldDoor.kind`: `'shop'|'gym'|'stairs'`, 문 글자 표, 체육관 지도 파싱: NPC·동상 칸 막힘), `src/field/world/loadField.ts`(`gym` 로더·마을의 `entrances.gym`), `src/domain/field/doorEntry.ts`(체육관 문 → 지도 이동 `{ type: 'gym' }`), `src/domain/field/tuning.ts`(`TOWN_ROWS_ADDED` 새 값), `src/store/fieldData.ts`(위치 검증이 `gym` 지도를 허용), `src/field/world/fieldRenderer.ts`(`roofNumberRects`·지붕 숫자 삭제), `src/field/world/FieldScreen.tsx`(체육관 문·마을↔체육관 이동·걷기 출구)
- Test: `tests/field/maps.test.ts`(확장), `tests/field/doorEntry.test.ts`, `tests/field/gymMap.test.ts`, `tests/field/loadField.test.ts`

**Interfaces:**
- Produces (`gym.ts`): `GYM_ROWS: string[]`(약 14칸 폭 × 20줄 안팎, 사진 2: 위쪽 장식 벽, 바닥, 가운데 단상 칸(막힘), 아래 입구 `v`→`town`), `GYM_EXITS = { v: 'town' } as const`, `GYM_SIGNS: string[]`, **`GYM_NPCS: GymNpc[]`**(한 곳: `type GymNpc = { id: string; kind: 'dan'; dan: TrainingDan; pos: Pos; tint: Tint } | { id: string; kind: 'arith'; level: ArithLevel; pos: Pos; tint: Tint }`, `Tint = { r: number; g: number; b: number }`(0~2 곱셈 계수), 열 개의 단 NPC는 2~9,12,13 순서로 번호 1~10, 셈연습 3명(기본·고수·보수), 서로 다른 색), **`GYM_STATUES: Pos[]`**(2개, 사진 2의 아래쪽 동상 위치, 막힘 칸·말 걸 수 없는 장식 — 별점수 꺼진 동안).
- Produces (`movement.ts`): `FieldMap.npcs: { id; pos }[]`·`statues: Pos[]`(parseMap 옵션으로 받음), 걷기 막힘 칸 계산에 NPC·동상 칸 포함(주인공·동행이 겹쳐 서지 않음), `npcAt(map, pos)`.
- Produces: 마을 체육관 문(`kind: 'gym'`)에 부딪히면 `travelTo(town, 'gym')`, 체육관 아래 입구로 나가면 마을 체육관 문 앞 칸에 선다. 옛 훈련 거리 줄은 모두 없어지고 `TOWN_ROWS_ADDED`는 새 위쪽 줄 수 − 1로 고친다(옛 main 마을 39줄과 칸이 같음을 보는 `maps.test.ts`의 고정 배열 비교는 그대로 유지·통과). 무한의 계단 건물은 마을에 그대로 둔다(체육관 구역 옆에 같이 배치).

- [ ] **Step 1: 실패하는 테스트** — `gymMap.test.ts`: `GYM_NPCS` 정확히 13명(단 10 = `TRAINING_DANS` 순서·셈연습 3), 위치 중복 없음, 각 NPC 위치는 지도 안 걷는 칸이고 **그 네 방향 중 하나 이상이 걸어서 입구에서 닿는 칸**(NPC·동상·단상은 걷지 못함), 동상 2개·막힘, 입구 `v` 출구, 단상·NPC 칸 막힘, 모든 NPC 앞 칸이 입구에서 닿음; `maps.test.ts`: 마을 크기 `[20, 40 + TOWN_ROWS_ADDED]`, 옛 39줄 고정 배열과 칸 일치, 체육관 문 1·상점 문 1·계단 문 1, 모든 문 앞이 걸어서 닿음, 시작칸이 `@`; `doorEntry.test.ts`: 체육관 문 → `{type:'gym'}`; `loadField.test.ts`: `gym` 로드·마을 `entrances.gym`·체육관 `entrances.town`.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/gymMap.test.ts tests/field/maps.test.ts tests/field/doorEntry.test.ts tests/field/loadField.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 체육관 타일(바닥·벽·단상·매트)과 마을 체육관 건물 타일(사진 1: 큰 지붕·가운데 문·간판 `GYM`)은 기존 `pixelArt.ts` 틀(16×16)로 새로 그린다(`tests/field/pixelArt.test.ts`의 `TILE_SETS`에 `gym` 추가). 체육관 안에서는 야생 구구몬이 나오지 않는다. 옛 위치 이전(`mergeField`의 y 이동)은 `TOWN_ROWS_ADDED` 상수만 따르므로 새 값으로 `trainingSave.test.ts`·e2e 좌표를 함께 고친다. 훈련 건물 타일·지붕 숫자·`roofNumberRects` 테스트는 삭제.
- [ ] **Step 4: 통과 확인** — 위 테스트 + `npx tsc --noEmit -p .` + `npx vitest run` 전체; 브라우저로 375px에서 마을 체육관 구역·체육관 실내(NPC 자리 표시는 Task 7 전이라 칸 표시 정도)를 스크린샷으로 확인.
- [ ] **Step 5: 커밋** — `git add -A src tests && git commit -m "태초마을에 체육관을 짓고 실내 지도·NPC 자리·동상을 추가"`

---

### Task 7: NPC 그림·색·머리색, 말 걸기 연결, 셈연습·동상 화면

**Files:**
- Create: `src/field/art/npcTint.ts`(순수 색 변환), `src/field/art/npcSprite.ts`(캔버스에 구워 캐시), `src/field/training/ArithTrainerScreen.tsx`, `src/field/training/StatueScreen.tsx`, `src/field/training/boardQuestion.ts`
- Modify: `src/field/training/{QuizBoard,flow,ChallengeMode,StudyMode,useTrainingRun,runner,TrainingScreen,TrainingResult,trainingText}.tsx/ts`(문제 표시를 `BoardQuestion`으로 일반화, 문제 수를 받게), `src/field/world/FieldScreen.tsx`(NPC 말 걸기·잠금 글·NPC 그리기), `src/field/world/fieldRenderer.ts`(NPC 레이어, `roamerLayer` 방식), `src/App.tsx`(`/field/training/arith/:level`, `/field/statue`)
- Test: `tests/field/npcTint.test.ts`, `tests/field/boardQuestion.test.ts`, `tests/field/arithTrainerFlow.test.ts`, `tests/field/gymTalk.test.ts`, `e2e/gym.spec.ts`

**Interfaces:**
- Consumes: Task 2 `planArithTrainer`·`judgeArithTrainer`·`finishArithTraining`·`isTrainingOpen`, Task 3 `planStatueQuestions`·`finishStatue`·`isStarPointsEnabled`, Task 6 `GYM_NPCS`·`npcAt`·`GYM_STATUES`.
- Produces (`boardQuestion.ts`): `type BoardQuestion = { key: string; label: string; answer: number; choices: number[]; dan?: number; multiplier?: number }`, `fromTraining(q: TrainingQuestion): BoardQuestion`(label `"7 × 8"`), `fromArith(q: ArithQuestion & { choices: number[] }): BoardQuestion`(label `"53 − 8"`·보수는 `"7 + ? = 10"`).
- Produces (`npcTint.ts`, 순수): `tintPixel(rgba: [number, number, number, number], tint: Tint, mastered: boolean): [number, number, number, number]`(머리 화소 = 색상이 주황 계열(대략 색상 10~45°, 채도 ≥ 0.45, 밝기 ≥ 0.5 — 실제 013 그림을 보고 마스크 범위를 정해 상수로 두고 테스트에 합성 화소로 고정)이면 몸 색 변환에서 제외하고 `mastered`일 때 노랑(색상 약 55°)으로 바꿈; 그 밖의 화소는 RGB에 `tint` 곱셈 후 0~255로 자름; 투명 화소 그대로), `tintImageData(data: Uint8ClampedArray, tint, mastered): void`.
- Produces: NPC 모양: 013 치비(front/idle 시트)를 `tintImageData`로 구워 캐시(`npcSprite(npc, mastered)`; rAF·setTimeout 안에서만 부름 — `companionImage` 주의사항), 이미지가 없으면 픽셀 폴백(단순 사람 모양 도형, 같은 `tint`·머리색 규칙), NPC는 서 있고(가만히 시트) 주인공 쪽을 바라봄(방향 행 선택은 선택 사항 — 아래·가만히 고정도 허용).
- Produces: NPC 말 걸기: 부딪힌 칸이 NPC면 — 단 NPC: `isTrainingOpen`이면 `/field/training/<dan>`으로(주인공 현재 칸을 `setFieldPosition`으로 저장해 돌아오면 그 자리), 잠겼으면 기존 표지판 팝업 재사용 글 "{앞 단}단 트레이너를 먼저 이겨요"(`lockedText`); 셈연습 NPC → `/field/training/arith/<basic|hard|comp>`; 동상 → `isStarPointsEnabled()`가 참이면 `/field/statue`, 거짓이면 **아무 반응 없음**. 마스터한 NPC(`field.training.mastered[dan]` / `field.training.arith[level]`)는 머리색 노랑으로 그림.
- Produces (`ArithTrainerScreen`): 입구 화면 "○○ 트레이너"(마스터 도전 버튼 하나만, 학습 없음) → 9문제(3지선다·전체 `ARITH_TRAINER_MASTER_MS[level]`) → 결과(처음 마스터면 캡슐 20개·종류, 그 밖의 성공 5개, 고수 첫 마스터면 레전드 구구몬 그림·이름, 실패는 다시 하기), `finishArithTraining`을 끝까지 한 번만 부름(기존 `runner`의 한 번만 정산 구조를 그대로 재사용: 문제 수·판정 함수를 인자로 받게 일반화). `StatueScreen`: 7문제(`planStatueQuestions`)·푸는 시간 재기·끝나면 `finishStatue`·결과(별점수 켜진 경우만 별 개수 표시), 플래그 꺼져 있으면 `/field`로 되돌림.

- [ ] **Step 1: 실패하는 테스트** — `npcTint.test.ts`: 주황 머리 화소는 `mastered:false`면 그대로·`true`면 노랑 범위, 몸 화소(파랑 등)는 `tint` 곱셈 결과가 정확, 투명 화소 불변, `tint {1,1,1}`이면 몸 화소 불변; `boardQuestion.test.ts`: 구구단·덧셈·뺄셈·보수 label 형식; `arithTrainerFlow.test.ts`: 합격/틀림/느림·한 번만 정산·중간 이탈 정산 없음(기존 `trainingRunner.test.ts` 패턴); `gymTalk.test.ts`: 말 걸기 결정 순수 함수 `talkAction(npc, training): {type:'enter', to} | {type:'locked', text}` — 단 NPC 열림/잠김, 셈연습 NPC 항상 열림, 동상은 플래그 꺼짐이면 `{type:'none'}`; E2E `gym.spec.ts`: 마을 체육관 문 → 체육관 안 → 잠긴 NPC(3단) 글 → 2단 NPC → 학습 끝 → 도전 합격 → 체육관으로 돌아와 그 NPC 앞 → 머리색이 노랑(캔버스 대신 `data-mastered` 같은 DOM 표식 또는 저장 값으로 확인) → 3단 NPC 열림, 셈연습 NPC 도전 합격·다음 합격 5개, 고수 첫 합격 레전드, 12단 첫 합격 황금 20개(저장 시드로 단 상태 만들기), 동상은 별점수 꺼짐일 때 반응 없음·`__GUGU_E2E_STARS__`로 켠 경우 `/field/statue` 진입.
- [ ] **Step 2: 실행해 실패 확인** — 단위 테스트 FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 기존 학습·도전 화면의 동작(시계·한 번만 정산·그만하기·효과)은 바꾸지 않고 문제 표시만 `BoardQuestion`으로. 013 그림에서 머리 마스크 범위는 이미지를 직접 보고 정한다(`src/field/art/creatures/chibi/013-front.png`).
- [ ] **Step 4: 통과 확인** — 단위 + `E2E_PORT=5191 npx playwright test e2e/gym.spec.ts e2e/training.spec.ts` + `npx tsc --noEmit -p .`; 브라우저 375px에서 체육관 안 NPC 13명의 색 구분·머리 노랑·말 걸기 화면을 스크린샷으로 확인.
- [ ] **Step 5: 커밋** — 의미 단위 2~3개로 나눠도 됨(`git add -A src tests e2e && git commit -m "체육관 NPC 그림·머리색·말 걸기와 셈연습·동상 화면 추가"`)

---

### Task 8: 건물 그림자

**Files:**
- Modify: `src/field/art/shadow.ts`(건물용 상수·함수), `src/field/world/fieldRenderer.ts`·`maps/townTiles.ts`(타일 레이어에 그림자), 필요 시 `maps/gymTiles.ts`
- Test: `tests/field/shadow.test.ts`(확장), `tests/field/townShadow.test.ts`

**Interfaces:**
- Produces: `BUILDING_SHADOW = { dx: number; dy: number; alpha: number }`(상수 한 곳), `buildingShadowTiles(map: FieldMap): Pos[]`(순수: 건물 칸(`#`로 둘러싸인 건물 몸 — 마을의 체육관·상점·집·계단 건물·담)의 오른쪽·아래로 접한 길 칸 목록, 지도 밖·막힌 칸 제외), 마을 지도에서 타일 그림 위에 연한 어두운 띠로 그린다(타일 캐시·정적이라 프레임당 큰 할당 없음, 캐릭터 그림자와 같은 색 계열).

- [ ] **Step 1: 실패하는 테스트** — `buildingShadowTiles`: 작은 합성 지도(건물 `###` 아래·오른쪽 길 칸이 목록에 들어감, 지도 밖·다른 건물 칸·출구 칸은 제외, 중복 없음), 실제 마을 지도에서 체육관·상점 둘 다 그림자 칸이 1개 이상·모두 걷는 칸.
- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run tests/field/townShadow.test.ts tests/field/shadow.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 그림자가 걷기·충돌에 영향을 주지 않음(그리기만).
- [ ] **Step 4: 통과 확인** — 위 테스트 + `npx tsc --noEmit -p .`; 브라우저 375px 마을에서 건물 그림자를 스크린샷으로 확인(너무 진하거나 글자·문을 가리지 않는지).
- [ ] **Step 5: 커밋** — `git add -A src tests && git commit -m "마을 건물에 그림자를 넣음"`

---

### Task 9: E2E 정리·문서·전체 확인

**Files:**
- Modify: 옛 훈련 건물 기준으로 쓴 `e2e/training.spec.ts`(건물 → 체육관 NPC 흐름으로 다시 쓰거나 `gym.spec.ts`에 합침), `e2e/field.spec.ts`(마을 좌표 `TOWN_ROWS_ADDED`), `e2e/stairs.spec.ts`(계단 건물 위치), `MVP_DESIGN.md`(맨 위 이력 v1.65·해당 절), `CLAUDE.md`(폴더 표: 체육관 `gym.ts`·NPC·`npcTint`·`lowGrade.ts`·`starPoints.ts`·`arithTrainer.ts`, 라우트 `/field/training/arith/:level`·`/field/statue`, 플래그 `STAR_POINTS_ENABLED`·`__GUGU_E2E_STARS__`, "어디를 고치나" 행: 체육관 NPC·저학년 문제·별점수 수치, 훈련센터 문구 정정)
- Test: 위 전체

- [ ] **Step 1: E2E 보정** — 훈련·계단·필드 E2E를 새 마을·체육관 흐름에 맞춤(주장 약화 금지). 별점수 꺼짐 확인(발견·포획·트레이닝 후 `field.starPoints === 0`), 켠 경우 한 가지 시나리오.
- [ ] **Step 2: 실행** — PC가 느리므로 하나씩, 겹치지 않게 백그라운드로: `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/gym.spec.ts e2e/lowgrade.spec.ts e2e/training.spec.ts e2e/stairs.spec.ts`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`(전체), 마지막으로 전체 `E2E_PORT=5191 npx playwright test`, `MSYS_NO_PATHCONV=1 npm run build` → 모두 통과(`dex.spec` 놀이 장면은 따로 다시 돌려 확인).
- [ ] **Step 3: 직접 확인** — 375px에서 마을(체육관·그림자)·체육관 안·NPC 머리색·셈연습 화면·저학년 타이틀·전투 문제를 스크린샷으로 본 뒤 서버 종료.
- [ ] **Step 4: 검토** — `opus-reviewer`가 브랜치 전체(저장 이전·보상 지급 중복·플래그 꺼짐 동작·옛 저장) 검토.
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "체육관 E2E와 설계서·안내 문서 갱신"` (push·배포는 사용자가 "배포"라고 할 때만)

# 필드 모험 3차 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구구몬이 기술 1개로 시작해 레벨로 배우고(5개·장착 3), 위력·특수효과·속성 상성이 있는 기술을 문제 풀기 전에 고르며, 2% 복사·포획 실패 회복·캡슐 던지기 연출·효과음·기술 관리 화면까지 넣는다.

**Architecture:** 기술은 `src/domain/field/skills.ts`의 **표 하나**(슬롯 패턴 + 종별 이름)에서 나오고, 상성은 `elements.ts` 표 하나, 수치는 `tuning.ts` 한 곳이다 — 나중에 바꾸려면 이 세 곳만 고친다. 야생 체력은 "칸"으로 바꾸고 전투 상태기계(`wildBattle.ts`)에 위력·상성·회복을 넣는다. 저장은 `SpeciesEntry.skills`(장착)·`copied`(복사)만 추가하고, 레벨로 익힌 기술은 레벨에서 계산한다.

**Tech Stack:** React 18 + TypeScript + Vite + Zustand(persist), Vitest, Playwright, pixelfx, Web Audio 합성(`src/audio/sfx.ts`).

**Spec:** `docs/superpowers/specs/2026-11-12-field-adventure-3-design.md` (이하 "설계서"; 절 번호는 설계서 기준)

## Global Constraints

- 화면 글자·주석·커밋 메시지는 한국어(어린이가 읽기 쉬운 말). 커밋 끝에 `Co-Authored-By` 줄. push·merge·배포는 지휘자만(사용자가 시킬 때).
- 저장 키 `gugu-monster:save` 그대로. **로컬 데이터를 잃지 않는 것이 최우선**: 옛 저장(기술 필드 없음)은 지금 쓰던 기술 3개(레벨 8 이상)가 그대로 장착되어야 한다. 저장 형식 변경은 **네 곳**: `createInitialSave`, `mergeSave`(`mergeField`/`mergeEntry` 깊게 채우기), `useGameStore.partialize`, `admin/DataSecurityPanels.tsx currentSave()`.
- 운영 수치는 `src/domain/field/tuning.ts`에 상수로, 값은 `tests/field/tuning.test.ts`에서 고정. 새 수치: `CELLS_PER_HIT = 2`, `CAPTURE_FAIL_HEAL_RATIO = 0.5`, `COPY_CHANCE = 0.02`, `SKILL_SLOTS = 3`, `SKILL_LEARN_LEVELS = [1,3,8,14,20]`, `CALM_BONUS_MS = 3000`.
- 기술 효과(기술이 맞는 순간) 시간은 **0.6초 이하**(`until ÷ speed`), 효과 중심(`center`)은 맞는 쪽 몬스터 몸 위, 황금 구구몬은 금색, 동작 줄이기 설정이면 효과 없음.
- 전투 흐름(타이머·단계 전환·정산)·저장 데이터를 건드리는 작업은 `opus-expert`로 구현하고 `opus-reviewer`급(Opus) 검토를 받는다(CLAUDE.md "모델 분배"). 일반 구현·검토는 Sonnet 이상.
- E2E 새 스위치는 `src/field/debugFlags.ts` 한 곳에서 읽는다. 새 E2E는 흔들리지 않게 `__GUGU_E2E_TIER__`·`__GUGU_E2E_QUESTION__`을 고정하고 이벤트를 기다린다(고정 sleep 금지). E2E는 `E2E_PORT=5191`, 다른 E2E와 동시에 돌리지 않는다.
- 적 공격에는 상성·위력을 적용하지 않는다(설계서 1절). 진화·기술 사용 횟수(PP)·기술 상점은 범위 밖.

## 추후 변경을 위한 구조 (이 계획의 핵심 원칙)

| 바꿀 것 | 고칠 곳 (한 곳) | 같이 고칠 것 |
|---|---|---|
| 슬롯별 위력·특수효과·배우는 레벨 | `skills.ts`의 `SLOT_PATTERN` | `tests/field/skillsTable.test.ts`의 고정표 |
| 기술 이름 | `skills.ts`의 `SKILL_NAMES` | 이름 중복·빈 값 테스트가 지킴 |
| 상성표 | `elements.ts`의 `STRONG_AGAINST` | `tests/field/elements.test.ts`의 49쌍 표 |
| 확률·칸·회복·시간 | `tuning.ts` | `tests/field/tuning.test.ts` |
| 기술 효과 그림·소리 | `effects.ts`의 `ELEMENT_FX`·`sfx.ts`의 `SKILL_SFX` | `#/dev/field` 버튼 |
| 장착 한도 | `SKILL_SLOTS` | 단위 테스트가 상수로 단정 |

테스트는 가능하면 **상수·표를 읽어서** 단정하고(리터럴 복제 금지), 값 고정은 위 "고정표" 테스트 한 곳에만 둔다. 슬롯 수(5)를 바꿔도 코드가 깨지지 않도록 반복문은 `SKILL_LEARN_LEVELS.length`를 쓴다.

## Review Focus

1. **옛 저장**(`skills`·`copied` 없음, 레벨 1·2·8·14 구구몬, 동행 null): 기술이 줄거나 비지 않는다 → Task 2.
2. **이상한 저장값**(모르는 id, 다른 종의 레벨 기술, 중복, 4개 이상, 빈 목록, `copied`에 본인 종 기술): 걸러져서 앱이 안 깨지고 최소 1개 → Task 2.
3. **레벨이 한꺼번에 여러 개 오름**(1→9): 기술이 순서대로 하나씩 배워지고 선택창은 가득 찰 때만, 장착 중복 없음 → Task 5.
4. **복사 후보가 없음 / 이미 아는 기술만**: 아무 일 없음, 2% 한 번만 굴림 → Task 5.
5. **기술 1개뿐**: 고르기 단계를 건너뜀, 문제 시계·힌트 흐름은 지금과 같음 → Task 4.
6. **포획 실패 회복 직후** 시계·문제·체력 막대가 맞고 연타로 중복 던지기 불가 → Task 3·7.
7. **소리 끔/동작 줄이기**: 효과음·효과가 안 나오고 흐름은 같음 → Task 7·8·9.

---

### Task 1: 기술 표와 상수 (순수 로직)

**담당:** Sonnet

**Files:**
- Create: `src/domain/field/skills.ts`
- Modify: `src/domain/field/tuning.ts`, `src/domain/field/creatures.ts`(`MOVES`·`LEGEND_MOVES` 이름을 `skills.ts`로 옮기고 `SpeciesDef.moves`를 표에서 파생), `tests/field/tuning.test.ts`
- Test: `tests/field/skillsTable.test.ts`, `tests/field/skills.test.ts`

**Interfaces:**
- Produces (`skills.ts`):
  - `type SkillId = string`; `type SkillSpecial = 'heal' | 'calm' | 'clue'`
  - `interface SkillDef { id: SkillId; species: SpeciesId; slot: number /*1..5*/; name: string; element: Element; power: 1|2|3; special?: SkillSpecial; learnLevel: number }`
  - `SLOT_PATTERN: readonly { power: 1|2|3; special?: SkillSpecial }[]` (설계서 2-6 표: 슬롯1 `{2}`, 2 `{1,'heal'}`, 3 `{3}`, 4 `{2,'calm'}`, 5 `{2,'clue'}`), `SKILL_NAMES: Record<SpeciesId, string[]>` (종당 5개: 1~3번은 기존 `MOVES` 이름 그대로, 4·5번은 새 이름)
  - `SKILLS: readonly SkillDef[]`(종 11 × 슬롯 5 = 55개), `skillDef(id): SkillDef`(없으면 던짐), `speciesSkills(species): SkillDef[]`
  - `learnedAt(species: SpeciesId, level: number): SkillDef[]`, `newlyLearned(species, from: number, to: number): SkillDef[]`(from 초과 to 이하), `knownSkills(species, level, copied: SkillId[]): SkillDef[]`(레벨로 익힌 것 ∪ 복사한 것, 중복 제거), `defaultSkills(species, level): SkillId[]`(익힌 것의 앞 `SKILL_SLOTS`개, 최소 1개), `rollCopy(rng: Rng, wildSpecies, wildLevel, known: SkillId[]): SkillId | null`
- Produces (`tuning.ts`): 위 Global Constraints의 새 상수 6개.
- Consumes: `elements.ts`의 종→속성 조회(`elementOf` 같은 기존 함수; 읽고 이름 확인), `Rng` 타입(`wildBattle`/`encounter`의 기존 것).

- [ ] **Step 1: 실패하는 테스트** — `skillsTable.test.ts`(고정표: 종 11개 × 5개, 각 id·이름·슬롯·위력·특수·`learnLevel`, 이름 중복·빈 이름 없음, `SKILL_NAMES`의 1~3번은 예전 `MOVES` 이름과 같음) · `skills.test.ts`(`learnedAt` 레벨 1/2/3/7/8/13/14/20, `newlyLearned` 1→3·2→9(레벨 3·8 둘 다)·8→8 빈 배열, `knownSkills`에 `copied` 합침·중복 제거, `defaultSkills` 레벨 1이면 1개·레벨 20이면 3개, `rollCopy`: `rng()`가 `COPY_CHANCE` 미만이면 후보 중 하나·이상이면 null·이미 아는 기술 제외·후보 없으면 null·후보 선택은 두 번째 난수로).
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/field/skillsTable.test.ts tests/field/skills.test.ts` → FAIL(모듈 없음).
- [ ] **Step 3: 구현** — 표는 `SLOT_PATTERN`과 `SKILL_NAMES`에서 만들어 낸다(id는 `${species}-${slot}`). 새 이름 22개는 종 분위기에 맞는 짧은 한국어(예: 구름몬 4번 `구름 폭신`). 효과 그림 칸은 Task 8이 `elements.ts`에서 슬롯 번호로 찾는다 — 여기서는 만들지 않는다. `creatures.ts`는 `SpeciesDef.moves`를 기존 3칸 튜플 대신 `speciesSkills(id).map(s => s.name)` 파생으로 바꾸고, 이 필드를 읽던 곳(`DevFieldGallery`, `WildBattleScreen`)이 그대로 컴파일되게 한다(Task 4가 전투 쪽을 다시 고친다).
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS + `npx tsc --noEmit -p .` + `npx vitest run`.
- [ ] **Step 5: Commit** — `git commit -m "구구몬 기술 표: 종마다 5개, 슬롯별 위력·특수효과"`

---

### Task 2: 저장 — 장착 기술·복사 기술 (Opus)

**담당:** `opus-expert` (저장 데이터), 이후 Opus 검토

**Files:**
- Modify: `src/store/fieldData.ts`(`SpeciesEntry`, `newSpeciesEntry`, `mergeEntry`), `src/store/useGameStore.ts`(`partialize`, 액션), `src/store/saveData.ts`(`createInitialSave`/`mergeSave`가 필드를 그대로 통과시키는지 확인), `src/screens/admin/DataSecurityPanels.tsx`(`currentSave()`)
- Test: `tests/field/fieldData.test.ts`(또는 기존 필드 저장 테스트), `tests/field/fieldStore.test.ts`

**Interfaces:**
- Consumes (Task 1): `skillDef`, `knownSkills`, `defaultSkills`, `SKILL_SLOTS`.
- Produces:
  - `SpeciesEntry`에 `skills: SkillId[]`(장착, 1~`SKILL_SLOTS`개)와 `copied: SkillId[]` 추가
  - `newSpeciesEntry(species: SpeciesId, level: number, now: number): SpeciesEntry` — **시그니처가 종을 받도록 바뀐다**(호출부 전부 수정). `skills = defaultSkills(species, level)`, `copied = []`
  - `useGameStore` 액션: `replaceSkill(species: SpeciesId, removeId: SkillId, addId: SkillId): boolean`(장착 목록에서 removeId를 addId로 바꿈; removeId가 장착 중이 아니거나 addId가 모르는 기술이거나 이미 장착이면 거부·상태 불변), `setSkills(species: SpeciesId, ids: SkillId[]): boolean`(검증 후 한 번의 `set`; 최소 1·최대 `SKILL_SLOTS`·아는 기술만·중복 없음), `addCopiedSkill(species, id): boolean`(다른 종 기술만·중복 거부)

- [ ] **Step 1: 실패하는 테스트** — (a) 옛 저장 형태(필드 없음)의 레벨 1·2·3·8·14 구구몬이 `mergeEntry` 뒤 각각 1·2·2·3·3개 장착, 레벨 8 구구몬은 슬롯 1~3 모두(기술이 줄지 않음); (b) 이상한 값: 모르는 id 제거, 다른 종의 레벨 기술 제거(아는 기술 밖), 중복 제거, 4개→앞 3개, 빈 목록→`defaultSkills`, `copied`에 본인 종 기술·모르는 id 제거, 배열이 아닌 값(`null`·문자열) 무시; (c) `newSpeciesEntry('jelly', 8, now).skills`; (d) `replaceSkill`/`setSkills`/`addCopiedSkill`의 허용·거부 모든 경우와 **거부 시 상태 객체가 그대로**; (e) `partialize` 결과와 `currentSave()`에 `skills`·`copied`가 들어 있음(저장→다시 읽기 왕복에서 값 유지).
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/field`.
- [ ] **Step 3: 구현** — 검증은 한 곳(`fieldData.ts`의 순수 함수 `normalizeSkills(species, level, skills, copied)`)에서 하고 `mergeEntry`와 액션이 같이 쓴다. `setSkills`/`replaceSkill`은 한 번의 `set`.
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, 기존 E2E 필드 스펙 `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`(스타터 선택·잡기 흐름이 새 시그니처로도 동작).
- [ ] **Step 5: Commit** — `git commit -m "구구몬이 장착한 기술과 복사한 기술을 저장(옛 저장은 지금 기술 그대로)"`

---

### Task 3: 전투 규칙 — 칸 체력·위력·상성·회복 재전투 (Opus, 순수 로직)

**담당:** `opus-expert` (전투 흐름), 이후 Opus 검토

**Files:**
- Modify: `src/domain/field/wildBattle.ts`, `src/domain/field/strength.ts`(필요 시 최대 칸), `src/domain/field/elements.ts`(상성표), `src/domain/field/tuning.ts`
- Test: `tests/field/wildBattle.test.ts`, `tests/field/elements.test.ts`, `tests/field/tuning.test.ts`

**Interfaces:**
- Consumes (Task 1): `SkillSpecial`, `CELLS_PER_HIT`·`CAPTURE_FAIL_HEAL_RATIO`.
- Produces:
  - `elements.ts`: `STRONG_AGAINST: Record<Element, Element[]>`(설계서 2-7 표), `matchup(attack: Element, defend: Element): -1 | 0 | 1`
  - `wildBattle.ts`: 야생 체력은 **칸**: `WildState.hits`를 `cells`(깎인 칸)로 바꾸고 `maxCells(tier) = TIER_RULES[tier].hitsToDizzy * CELLS_PER_HIT`. `attackCells(power: 1|2|3, m: -1|0|1): number` = `clamp(power + m, 1, 3)`. `answerWild(s, correct, rng, hit?: { power: 1|2|3; matchup: -1|0|1 })` — `hit` 생략 시 `{power:2, matchup:0}`(옛 호출 호환). 어지러움 조건 `cells >= maxCells(tier)`. `wildHpRatio`는 칸 기준. `ThrowOutcome`의 `'retry'` → `'healed'`: 어지러움 해제, `cells = max(0, cells − ceil(maxCells × CAPTURE_FAIL_HEAL_RATIO))`, `phase: 'question'`, 문제 시간 처음부터. `escaped`·`angry` 그대로(`angry`는 `cells = 0`).
- 단계별 최소 정답 수는 2번 이상(강력 4칸이 한 번에 안 끝남)이 보장되어야 한다.

- [ ] **Step 1: 실패하는 테스트** — 상성 49쌍 전수(표에서 계산한 기대값과 독↔빛 보통·자기 속성 보통 포함, `STRONG_AGAINST`를 읽어 단정), `attackCells` 경계(1+(-1)→1, 3+1→3), 4단계 각각 위력 3+강함으로 한 번에 어지러워지지 않음, 위력 2 정답 N번 = 옛 `hitsToDizzy` 번과 같은 길이, `healed` 4단계(10·8·6·4칸 최대에서 각각 5·4·3·2칸 회복)와 황금, 회복 직후 `phase==='question'`·시간 리셋, 이어서 다시 어지러워지고 다시 던질 수 있음, `angry`가 `cells=0`으로 채움, `answerWild` 연타 무시(기존), `throwCapsule` 난수 한 번으로 결과 결정(기존 R11)이 `retry`→`healed` 이름만 바뀌고 확률 경계 그대로.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `hits`를 읽던 곳(화면·정산·테스트)을 함께 고친다. 화면은 Task 4가 다듬으므로 여기서는 **컴파일과 기존 동작 유지**까지(`hit` 생략 호환).
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`(기존 전투·포획 시나리오가 칸 단위에서도 같은 정답 수로 통과; `retry` 글을 기다리는 E2E가 있으면 Task 7과 함께 고친다는 메모).
- [ ] **Step 5: Commit** — `git commit -m "야생 체력을 칸으로, 기술 위력·속성 상성, 포획 실패하면 체력 회복 후 재전투"`

---

### Task 4: 전투 화면 — 기술 고르기 단계와 기술 적용 (Opus)

**담당:** `opus-expert` (전투 흐름), 이후 Opus 검토

**Files:**
- Modify: `src/field/battle/WildBattleScreen.tsx`, `src/field/battle/useQuestionFeed.ts`(필요 시), `src/field/battle/battleText.ts`, `src/domain/field/wildBattle.ts`(고르기 상태), `src/field/battle/*.css`(필요 시)
- Create: `src/field/battle/SkillPicker.tsx`
- Test: `tests/field/wildBattle.test.ts`, `e2e/field.spec.ts`

**Interfaces:**
- Consumes (Task 1·2·3): `SkillDef`, `skillDef`, `learnedAt`, `matchup`, `attackCells`, 저장된 `field.species[companion].skills`, 효과 칸은 Task 8의 `skillFxName(def): FxName`(임시로 `ELEMENT_FX[element][Math.min(2, slot-1)]`를 쓰고 Task 8에서 5칸으로).
- Produces:
  - `WildPhase`에 `'pick'`(기술 고르기) 추가: 새 문제마다 `resumeWild`가 `question` 대신 장착 기술이 2개 이상이면 `pick`으로, 1개면 바로 `question`으로 보낸다. `pickSkill(s, skillId): WildState`(`pick`→`question`, 문제 시계 시작; 고르기 시간은 시계에 안 셈).
  - `SkillPicker` 컴포넌트: 큰 버튼 최대 3개, 각 버튼에 기술 이름·속성 글자·위력 ★·특수효과 글·상성 글자("효과가 커요!"/"별로예요")+▲▼ 표시(색에만 의존 안 함).
  - 정답이면 고른 기술의 `power`·`matchup`으로 `answerWild(..., hit)`, 특수효과 적용: `heal` = `healSpecies`/`damageCompanion` 쪽 체력 +1(최대 안, 기존 체력 단위; 읽고 맞는 액션 사용), `calm` = 다음 문제 `timeLeftMs += CALM_BONUS_MS`, `clue` = 다음 문제 보기 중 틀린 것 하나 숨김. 오답·시간 초과 뒤 힌트가 끝나면 **같은 기술**으로 같은 문제(다시 고르지 않음). 보기 버튼은 **답 숫자만**.
  - 적의 기술 이름·효과: `learnedAt(wildSpecies, wildLevel)` 중 무작위(황금은 황금 기술). 적 공격 피해는 기존 단계별 값 그대로.
  - 전투 시작 시 동행의 장착 기술 목록을 고정(`useState`, 전투 중 안 바뀜).

- [ ] **Step 1: 실패하는 테스트** — 단위: `resumeWild`가 기술 1개면 `pick`을 건너뜀·2개 이상이면 `pick`, `pick` 단계에서는 `tickWild`가 시간을 깎지 않음, `pickSkill` 뒤 시계 시작, 오답→힌트→같은 문제에서 `pick`으로 가지 않음. E2E(`__GUGU_E2E_TIER__`·`__GUGU_E2E_QUESTION__` 고정): (a) 새 스타터(기술 1개)는 고르기 없이 문제가 바로 나옴, (b) 장착 3개로 시작하는 저장에서 고르기 단계 버튼 3개와 상성 글이 보이고 고른 뒤 문제, (c) `heal` 기술로 정답을 맞히면 내 체력 막대가 늘고(체력이 닳은 상태에서) `clue` 기술은 다음 문제 보기가 하나 줄고 `calm`은 다음 문제 시간이 늘어남.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 기존 `answerTimer`·`NO_TIMER` 스위치 동작을 깨지 않게. 효과는 `moveFx`가 `skillDef`로 얻은 `fx`를 사용(내 공격은 야생 위, 적 공격은 내 구구몬 위 — 2차 규칙 그대로).
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts e2e/title.spec.ts`, 375px 화면에서 고르기 단계·상성 글 눈으로 확인(스크린샷 저장).
- [ ] **Step 5: Commit** — `git commit -m "전투에서 문제를 풀기 전에 기술을 고르고, 위력·상성·특수효과가 적용됨"`

---

### Task 5: 정산 — 레벨업으로 배우기, 2% 복사, 알림 (Opus)

**담당:** `opus-expert` (저장·전투 정산), 이후 Opus 검토

**Files:**
- Modify: `src/store/useGameStore.ts`(`finishWildBattle`), `src/store/fieldData.ts`(`FieldNotice`), `src/store/useSessionStore.ts`, `src/field/debugFlags.ts`, `src/field/battle/battleText.ts`, `tests/field/debugFlags.test.ts`
- Test: `tests/field/fieldStore.test.ts`, `e2e/field.spec.ts`

**Interfaces:**
- Consumes (Task 1·2): `newlyLearned`, `rollCopy`, `knownSkills`, `addCopiedSkill`, `replaceSkill`, `SKILL_SLOTS`.
- Produces:
  - `finishWildBattle`가 레벨업 때마다 새 기술을 처리: 장착 < `SKILL_SLOTS`면 **같은 `set()` 안에서 자동 장착**하고 `FieldNotice`에 `{kind:'skill', species, skillId, how:'learned'}`; 가득이면 세션 `skillOffers`에 `{species, skillId, source:'level'}`만 넣고 **저장은 안 바꿈**(아는 기술로 남음).
  - 끝 `caught`·`released`일 때만 `rollCopy`(한 전투 한 번): 당첨이면 장착 < 3이면 `addCopiedSkill`+자동 장착(알림 `how:'copied'`), 가득이면 `skillOffers`에 `{source:'copy', fromSpecies}`(수락 시 `addCopiedSkill`+`replaceSkill`을 한 번에 — 둘이 따로 일어나 중간 상태가 남지 않게 `acceptSkillOffer(offer, removeId)` 액션).
  - `useSessionStore`: `skillOffers: SkillOffer[]`, `pushSkillOffer`, `shiftSkillOffer`. `SkillOffer = { species: SpeciesId; skillId: SkillId; source: 'level' | 'copy'; fromSpecies?: SpeciesId }`.
  - `debugFlags()`에 `copy: boolean`(`window.__GUGU_E2E_COPY__`), 켜면 `rollCopy` 확률 100%. `tests/field/debugFlags.test.ts`의 기본값·읽기 표를 갱신.
  - `acceptSkillOffer(offer: SkillOffer, removeId: SkillId | null): boolean`(레벨 제안은 `removeId`로 교체 장착, 복사 제안은 복사 기록+교체 장착; 거부 시 불변), 포기/보관은 큐만 비움.

- [ ] **Step 1: 실패하는 테스트** — 레벨 1→3(장착 1: 자동 장착 후 알림)·1→9(레벨 3·8 둘 다, 장착 3개 도달 후 더 이상 자동 장착 없음)·장착 3에서 레벨 14(제안만 쌓임·저장 불변)·복사: `rng` 스텁으로 경계(0.02 미만 당첨)와 후보 없음·장착 여유 있을 때 자동 장착·`escaped`는 굴리지 않음·`fainted`도 안 함, `acceptSkillOffer` 허용·거부, 한 `set()`으로 일어남(구독 한 번), 옛 저장에서도 안 깨짐. E2E: `__GUGU_E2E_COPY__`와 장착 3개 저장으로 잡기→선택창 대기열이 쌓임(창 UI는 Task 6, 여기서는 `useSessionStore` 상태·알림 글).
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`.
- [ ] **Step 5: Commit** — `git commit -m "레벨이 오르면 기술을 배우고, 잡거나 퇴치하면 2%로 기술을 복사"`

---

### Task 6: 선택창과 기술 관리 화면 (Sonnet)

**담당:** Sonnet

**Files:**
- Create: `src/field/SkillOfferDialog.tsx`, `src/field/SkillManager.tsx`(도감 상세의 기술 구역), `src/field/skillText.ts`(화면 글)
- Modify: `src/field/world/FieldScreen.tsx`(선택창 띄우기), `src/field/FieldDexScreen.tsx`, `src/pwa/autoUpdate.ts`는 호출만(`setUpdateBusy`)
- Test: `tests/field/skillText.test.ts`, `e2e/field.spec.ts`(또는 새 `e2e/skills.spec.ts`)

**Interfaces:**
- Consumes (Task 1·2·5): `skillDef`, `knownSkills`, `speciesSkills`, `useSessionStore.skillOffers`, `acceptSkillOffer`, `setSkills`, `SKILL_SLOTS`.
- Produces:
  - `SkillOfferDialog`: 새 기술 카드(이름·속성·위력 ★·특수효과 글·출처) + 장착 3개 버튼("이 기술과 바꿔서 장착") + 둘째 버튼(레벨 제안은 "장착 안 함", 복사 제안은 "포기"). 떠 있는 동안 `setUpdateBusy(true)`. 한 번에 하나씩, 큰 글자, 375px에서 안 잘림, Esc는 둘째 버튼과 같다.
  - `SkillManager`: 장착 칸 3개 + 아는 기술 목록(못 배운 레벨 기술은 "Lv N에 배워요" 잠금) + 눌러서 장착(빈 칸이면 바로, 가득이면 바꿀 기술을 고름) + 해제(최소 1개 남김). 저장은 `setSkills` 한 번. 전투 중에는 접근 불가(도감은 전투 밖에서만 열림 — 확인).
  - `skillText.ts`: 위력 별 표시, 특수효과 설명("체력이 조금 회복돼요", "다음 문제 시간이 늘어요", "틀린 보기가 하나 사라져요"), 출처 문구.

- [ ] **Step 1: 실패하는 테스트** — `skillText` 단위(별 개수·특수효과 문구·출처 문구가 `SkillDef`에서 나옴, 표가 바뀌어도 반영). E2E: 장착 3개 + 복사 스위치로 잡기 → 선택창이 뜸 → "바꿔서 장착"이 저장을 바꿈 / "포기"는 저장 불변; 레벨 제안 "장착 안 함"은 아는 기술로 남아 도감에서 장착 가능; 도감에서 장착 3개를 바꾸고 새로고침 뒤에도 유지, 마지막 1개는 해제 불가, 못 배운 기술은 눌러도 장착 안 됨.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, 관련 E2E, 375px 스크린샷으로 선택창·관리 화면 눈 확인.
- [ ] **Step 5: Commit** — `git commit -m "기술 선택창과 도감의 기술 관리 화면"`

---

### Task 7: 캡슐 던지기 연출과 효과음 (Sonnet)

**담당:** Sonnet (회복 재전투의 흐름 연결은 Task 3·4에서 이미 완료된 상태)

**Files:**
- Modify: `src/field/battle/WildBattleScreen.tsx`(던지기 시퀀스·`healed` 처리), `src/field/battle/battleText.ts`, `src/domain/field/tuning.ts`(연출 시간), `src/audio/sfx.ts`, `src/field/fx/effects.ts`(필요 시), 전투 CSS
- Test: `tests/audio/sfx.test.ts`(또는 기존), `tests/field/tuning.test.ts`, `e2e/field.spec.ts`

**Interfaces:**
- Consumes (Task 3): `ThrowOutcome`의 `healed`. 기존 `playFx`·`catch` 효과·`CapsuleBall`.
- Produces:
  - `Sfx` 이름 6개 추가: `throw`·`capsuleOpen`·`capsuleBounce`·`capsuleShake`·`capsuleClick`·`capsulePop`(Web Audio 합성, 기존 규칙: 소리 끔·첫 터치 뒤)
  - 던지기 시퀀스(설계서 4-1): 포물선 던짐 → 붉은 빛으로 빨려 들어감 → 통통 → 3번 흔들림(`capsuleShake` 3번) → 잡힘이면 `capsuleClick`+별가루+`capture`, 실패면 1~2번째에서 `capsulePop`으로 열려 야생 구구몬이 튀어나옴. 결과는 이미 정해진 `thrown.outcome`에 연출을 맞춤. 단계마다 `data-capsule-stage` 속성(E2E 표식). 총 길이 ≈3초(`tuning.ts`: `CAPSULE_*_MS`로 단계별 시간, 기존 `CAPSULE_SHAKE_MS`·`CAPSULE_SHAKES` 확장). `healed`는 글 "앗! 캡슐에서 빠져나왔어요! 힘을 조금 되찾았어요!"와 체력 막대가 차오름.
  - 동작 줄이기면 캔버스 효과 없이 흔들림만. 던지는 동안 입력 막음(`throwingRef`, 기존) 유지.

- [ ] **Step 1: 실패하는 테스트** — `sfx` 이름 6개가 `SOUNDS`에 있고 각 길이가 짧음·소리 끔이면 호출해도 `AudioContext`를 안 만듦(기존 방식), 시간 상수 고정표, E2E: 던지기 중 `data-capsule-stage`가 순서대로(throw→absorb→bounce→shake→result) 나타남, 잡힘 결과에서 `capsuleClick` 소리 스파이가 불림, 실패 결과(`__GUGU_E2E_*`로 결과 고정이 필요하면 `rng` 주입 스위치 추가)에서 `capsulePop` 불림·야생 구구몬이 다시 나옴, `healed`는 체력 막대가 늘고 다시 문제가 나옴, 던지는 동안 다시 눌러도 중복 던지기 없음.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`, 375px에서 연출 단계별 스크린샷(던짐·빨려듦·흔들림·열림·잡힘).
- [ ] **Step 5: Commit** — `git commit -m "캡슐 던지기 연출과 효과음: 날아가 빨려 들어가고 세 번 흔들림"`

---

### Task 8: 새 속성 효과 14개와 효과 칸 5개 (Sonnet)

**담당:** Sonnet

**Files:**
- Modify: `src/field/fx/effects.ts`(새 효과 14개 + `center`), `src/domain/field/elements.ts`(`ELEMENT_FX`를 속성당 5칸), `src/field/DevFieldGallery.tsx`, `tests/field/elements.test.ts`, `tests/field/fxCenter.test.ts`, `tests/field/fxMeasure.ts`(재사용), `CLAUDE.md`(효과 행)
- Create: 필요한 보조는 없음(기존 측정 도구 재사용)

**Interfaces:**
- Consumes (Task 1): `SkillDef.slot`, `SkillDef.element`.
- Produces: `ELEMENT_FX: Record<Element, [FxName, FxName, FxName, FxName, FxName]>`, `skillFxName(def: SkillDef): FxName`(= `ELEMENT_FX[def.element][def.slot - 1]`, Task 4의 임시 식을 대체), 새 효과 14개(속성마다 2개)는 `node_modules/pixelfx/fx/` 중 기존 21개와 겹치지 않는 것을 골라 `EFFECTS`에 한 줄씩(`load`·`until`·`speed`·`center`·`note`·`hold: false`·`screen: false`).

- [ ] **Step 1: 실패하는 테스트** — `elements.test.ts`: 모든 속성의 `ELEMENT_FX`가 5칸이고 모든 이름이 `EFFECTS`에 있으며 중복 없음, 전 효과 `until÷speed ≤ 0.6초`(35개), `fxCenter.test.ts`: 35개의 헤드리스 측정 중심이 표의 `center`와 1.5화소 안(기존 방식), `skillFxName`이 55개 기술 모두에 효과 이름을 돌려줌.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 새 효과마다 측정 도구로 중심을 재고 표에 적는다. 눈 확인: 375×812 전투 캔버스에서 **새 14개** 내 공격·적 공격 한창일 때(0.2~0.3초) 스크린샷을 저장하고, "효과 중심에 맞는 몬스터가 있는가"를 표로 적는다(몬스터 밖이면 `center` 손조정). 황금 한 장.
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `MSYS_NO_PATHCONV=1 npm run build`.
- [ ] **Step 5: Commit** — `git commit -m "속성마다 기술 효과 2개 더: 4번·5번 기술이 새 모양을 씀"`

---

### Task 9: 기술 효과음 (Haiku 또는 Sonnet)

**담당:** Sonnet(합성음 설계), 값이 정해지면 Haiku

**Files:**
- Modify: `src/audio/sfx.ts`, `src/field/battle/WildBattleScreen.tsx`(기술이 맞는 순간 재생), `src/domain/field/elements.ts`(속성→소리 이름)
- Test: `tests/audio/sfx.test.ts`, `tests/field/elements.test.ts`

**Interfaces:**
- Produces: `Sfx` 이름 12개 추가 — 속성 7개(`fxGrass`·`fxPoison`·`fxLight`·`fxWater`·`fxThunder`·`fxEarth`·`fxFire`), 상성 2개(`superEffective`·`notVery`), 특수 3개(`skillHeal`·`skillCalm`·`skillClue`); `SKILL_SFX: Record<Element, Sfx>`(`sfx.ts`의 한 곳) — 나중에 소리만 바꾸기 쉽게. 각 약 0.3초 이내.

- [ ] **Step 1: 실패하는 테스트** — `SKILL_SFX`가 속성 7개를 모두 덮음, 모든 새 소리 길이 ≤ 0.4초, 소리 끔이면 재생 안 함, 상성에 따라 `superEffective`/`notVery`가 겹쳐 재생(스파이), 특수효과 소리가 해당 기술에서만.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 맞는 순간 효과와 같은 타이밍(내 공격·적 공격 모두 그 속성 소리).
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`.
- [ ] **Step 5: Commit** — `git commit -m "기술이 맞을 때 속성별 효과음과 상성·특수효과 소리"`

---

### Task 10: 마무리 — 문서·전체 확인·검토

**담당:** 지휘자(Sonnet) + Opus 최종 검토

**Files:**
- Modify: `MVP_DESIGN.md`(맨 위 변경 이력 v1.42 한 줄 + 해당 절 반영), `CLAUDE.md`("어디를 고치나" 표: 기술 표·상성·연출·효과음 행, 폴더 표에 `skills.ts`·`SkillOfferDialog`·`SkillManager`), `tests/field/tuning.test.ts`

- [ ] **Step 1: 문서** — v1.42 행(기술·상성·복사·포획 회복·연출)과 CLAUDE.md 표 갱신.
- [ ] **Step 2: 전체 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `MSYS_NO_PATHCONV=1 npm run build`, `E2E_PORT=5191 npx playwright test`(혼자, 전체).
- [ ] **Step 3: 시각 확인** — 375px로 고르기 단계·선택창·관리 화면·던지기 연출·새 효과를 직접 보고, 이상하면 해당 작업 고침.
- [ ] **Step 4: Opus 전체 검토**(저장·전투 흐름 변경이므로) — 브랜치 전체 diff, 옛 저장·복사·회복·연출 중복 입력.
- [ ] **Step 5: Commit** — `git commit -m "필드 모험 3차 문서 정리"`; 병합·배포는 사용자 지시를 기다린다.

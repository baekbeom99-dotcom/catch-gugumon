# 필드 모험 3차 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구구몬이 주속성·부속성을 갖고, 기술 1개로 시작해 레벨로 배우며(주속성 3 + 부속성 1 + 특수 1, 최대 5), 문제를 풀기 전에 기술을 골라 빠르게 풀면 강력 발동·특수 기술은 조건 안에 못 풀면 가장 약한 기술이 나가고, 2% 복사·포획 실패 회복·캡슐 던지기 연출·효과음·기술 관리 화면까지 넣는다.

**Architecture:** 기술은 `src/domain/field/skills.ts`의 **표 하나**(슬롯 패턴 + 종별 이름·특수 배정), 속성·상성은 `elements.ts` 표 하나, 수치는 `tuning.ts` 한 곳이다 — 나중에 바꾸려면 이 세 곳만 고친다. 야생 체력은 "칸"으로 바꾸고 전투 상태기계(`wildBattle.ts`)에 위력·강력·특수·상성·회복을 넣는다. 저장은 `SpeciesEntry.skills`(가진 기술, 복사 기술은 다른 종 id) 하나만 추가한다.

**Tech Stack:** React 18 + TypeScript + Vite + Zustand(persist), Vitest, Playwright, pixelfx(`node_modules/pixelfx/src/fx/**`), Web Audio 합성(`src/audio/sfx.ts`).

**Spec:** `docs/superpowers/specs/2026-11-12-field-adventure-3-design.md` (개정 2, 이하 "설계서"; 절 번호는 설계서 기준)

## Global Constraints

- 화면 글자·주석·커밋 메시지는 한국어(어린이가 읽기 쉬운 말). 커밋 끝에 `Co-Authored-By` 줄. push·merge·배포는 지휘자만(사용자가 시킬 때).
- 저장 키 `gugu-monster:save` 그대로. **로컬 데이터를 잃지 않는 것이 최우선**: 옛 저장(`skills` 없음)은 예전 기술 3개(옛 레벨 1·3·8)를 **슬롯 1·2·5**(같은 이름)로 그대로 가진다. 저장 형식 변경은 **네 곳**: `createInitialSave`, `mergeSave`(`mergeField`/`mergeEntry` 깊게 채우기), `useGameStore.partialize`, `admin/DataSecurityPanels.tsx currentSave()`.
- 운영 수치는 `tuning.ts`에 상수로, 값은 `tests/field/tuning.test.ts`에서 고정. 새 상수: `CELLS_PER_HIT = 2`, `MAX_CHIP_CELLS = 4`, `FAST_BONUS_CELLS = 1`, `CHARGE_BONUS_CELLS = 1`, `CAPTURE_FAIL_HEAL_RATIO = 0.5`, `COPY_CHANCE = 0.02`, `MAX_SKILLS = 5`, `SPECIAL_HEAL = 25`, `CALM_BONUS_MS = 3000`, `GUARD_RATIO = 0.5`. (`SPECIAL_HEAL`은 `wounds.ts`의 체력 단위를 읽고 "보통 적 한 번 피해와 같다"는 값인지 확인해 맞춘다.)
- 기술 효과(맞는 순간) 시간은 **0.6초 이하**(`until ÷ speed`), 효과 중심(`center`)은 맞는 쪽 몬스터 몸 위, 황금 구구몬은 금색, 동작 줄이기 설정이면 효과 없음.
- 전투 흐름·저장 데이터를 건드리는 작업(Task 2·3·4·5)은 `opus-expert`로 구현하고 Opus 검토를 받는다(CLAUDE.md "모델 분배"). 나머지는 Sonnet 이상(일반 에이전트, `model: sonnet`).
- E2E 새 스위치는 `src/field/debugFlags.ts` 한 곳에서 읽는다(`__GUGU_E2E_COPY__`, `__GUGU_E2E_FAST__`). 새 E2E는 `__GUGU_E2E_TIER__`·`__GUGU_E2E_QUESTION__`을 고정하고 이벤트를 기다린다(고정 sleep 금지). E2E는 `E2E_PORT=5191`, 다른 E2E와 동시에 돌리지 않는다.
- 적 공격에는 상성·위력·강력 발동을 적용하지 않는다(설계서 1절). 진화·기술 사용 횟수·기술 상점은 범위 밖.
- 야생 체력 단위 주의: 지금 `tuning.ts`의 단계별 `hitsToDizzy`는 약함 3·보통 4·강함 4·강력 6, 황금 4이다(코드를 읽어 맞춘다) → 칸으로는 6·8·8·12·8.

## 추후 변경을 위한 구조 (이 계획의 핵심 원칙)

| 바꿀 것 | 고칠 곳 (한 곳) | 같이 고칠 것 |
|---|---|---|
| 슬롯별 위력·강력 조건·배우는 레벨·종류 순서 | `skills.ts`의 `SLOT_PATTERN` | `tests/field/skillsTable.test.ts` 고정표 |
| 기술 이름·종별 특수 배정 | `skills.ts`의 `SKILL_NAMES`·`SPECIAL_OF_SPECIES` | 이름 중복·빈 값 테스트가 지킴 |
| 종의 주·부 속성 | `elements.ts`의 `MAIN_ELEMENT`·`SUB_ELEMENT` | `elements.test.ts` 표 |
| 상성표 | `elements.ts`의 `STRONG_AGAINST` | 49쌍 테스트(표를 읽어 단정) |
| 확률·칸·회복·시간 | `tuning.ts` | `tuning.test.ts` |
| 효과 그림·소리 | `ELEMENT_FX`·`STRONG_FX`·`SPECIAL_FX`, `SKILL_SFX`·`SPECIAL_SFX` | `#/dev/field` 버튼 |
| 기술 최대 수 | `MAX_SKILLS`·`SLOT_PATTERN.length` | 반복문은 상수를 읽음 |

테스트는 상수·표를 읽어 단정하고 값 고정은 위 "고정표" 테스트 한 곳에만 둔다.

## Review Focus

1. **옛 저장**(`skills` 없음; 레벨 1·2·3·7·8·14·20, 동행 null): 기술이 줄거나 비지 않고 슬롯 1·2·5로 이월 → Task 2.
2. **이상한 저장값**(모르는 id, 레벨이 모자란 자기 종 기술, 중복, 6개 이상, 빈 목록, 배열 아님): 걸러져서 앱이 안 깨지고 최소 1개 → Task 2.
3. **레벨이 한꺼번에 여러 개 오름**(1→9)과 **가진 기술이 5개일 때 새 기술**: 순서대로 하나씩, 가득이면 선택창만, 중복 없음 → Task 5.
4. **복사 후보 없음 / 이미 가진 기술만 / 도망·쓰러짐**: 아무 일 없음, 한 전투에 한 번만 굴림 → Task 5.
5. **기술 1개뿐**: 고르기 단계를 건너뜀, 시계·힌트 흐름은 지금과 같음 → Task 4.
6. **강력 판정 경계**(정확히 제한 초, 여유(calm)로 늘어난 시간, 힌트 뒤 재도전, 시간 초과)와 **특수 실패 → 가장 약한 기술** → Task 3·4.
7. **포획 실패 회복 직후** 시계·문제·체력 막대가 맞고 연타로 중복 던지기 불가 → Task 3·7.
8. **소리 끔/동작 줄이기**: 효과음·효과가 안 나오고 흐름은 같음 → Task 7·8·9.

---

### Task 1: 기술 표·속성 표·상수 (순수 로직)

**담당:** Sonnet

**Files:**
- Create: `src/domain/field/skills.ts`
- Modify: `src/domain/field/elements.ts`(주·부 속성 표, 상성표, `elementOf`=주속성 유지, `subElementOf` 추가), `src/domain/field/tuning.ts`, `src/domain/field/creatures.ts`(`MOVES`·`LEGEND_MOVES` 이름을 `skills.ts`로 옮기고 `SpeciesDef.moves`를 표에서 파생해 컴파일 유지), `tests/field/tuning.test.ts`
- Test: `tests/field/skillsTable.test.ts`, `tests/field/skills.test.ts`, `tests/field/elements.test.ts`

**Interfaces:**
- Produces (`skills.ts`):
  - `type SkillId = string`; `type SkillKind = 'main' | 'sub' | 'special'`; `type SpecialKind = 'heal' | 'guard' | 'clue' | 'calm' | 'charge'`
  - `interface SkillDef { id: SkillId; species: SpeciesId; slot: number /*1..5*/; kind: SkillKind; name: string; element?: Element /*속성 기술만*/; basePower: number /*1..4*/; fastRatio: number /*0..1*/; learnLevel: number; special?: SpecialKind; fxIndex?: number /*ELEMENT_FX 칸: 주 0·1·2, 부 3*/ }`
  - `SLOT_PATTERN`(설계서 2-2 표: 슬롯1 main①·Lv1·2·0.6, 슬롯2 main②·Lv3·2·0.5, 슬롯3 special·Lv8·2·0.5, 슬롯4 sub·Lv14·2·0.5, 슬롯5 main③·Lv20·3·0.4), `SKILL_NAMES: Record<SpeciesId, string[]>`(5개: 슬롯1·2·5는 기존 이름 1·2·3번 그대로, 슬롯3(특수)·4(부속성)는 새 이름), `SPECIAL_OF_SPECIES: Record<SpeciesId, SpecialKind>`(설계서 2-2 표)
  - `SKILLS: readonly SkillDef[]`(11종 × 5 = 55개), `skillDef(id): SkillDef`(없으면 던짐), `speciesSkills(species): SkillDef[]`
  - `learnedAt(species, level): SkillDef[]`, `newlyLearned(species, from, to): SkillDef[]`(from 초과 to 이하, 레벨 순서), `defaultSkills(species, level): SkillId[]`(익힌 것 전부 최대 `MAX_SKILLS`, 최소 1개), `weakestSkill(held: SkillId[]): SkillDef | null`(가진 **속성 기술** 중 `basePower`가 가장 낮은 것, 같으면 `slot` 작은 것), `fastSeconds(def: SkillDef, timeMs: number): number`(= `Math.max(1, Math.round(timeMs * def.fastRatio / 1000))`), `rollCopy(rng: Rng, wildSpecies: SpeciesId, wildLevel: number, held: SkillId[]): SkillId | null`(첫 난수 `< COPY_CHANCE`면 당첨 → 후보(그 종이 그 레벨에서 익힌 기술 중 가진 것 제외) 중 두 번째 난수로 하나, 후보 없으면 null)
- Produces (`elements.ts`): `MAIN_ELEMENT`·`SUB_ELEMENT: Record<MonsterKind, Element>`(설계서 2-1 표), `elementOf(id)`(=주속성), `subElementOf(id)`, `STRONG_AGAINST: Record<Element, Element[]>`(설계서 2-6 표), `matchup(attack: Element, defend: Element): -1 | 0 | 1`.
- Consumes: 기존 `Rng` 타입(`wildBattle`/`encounter`에 있는 것을 읽어 확인), 기존 `speciesDef`.

- [ ] **Step 1: 실패하는 테스트** — `skillsTable.test.ts`(**고정표**: 11종×5, 각 id·이름·슬롯·종류·위력·`fastRatio`·`learnLevel`·특수, 이름 중복·빈 이름 없음, 슬롯1·2·5의 이름이 예전 `MOVES`와 같음, **주속성 3번째(슬롯5)의 `learnLevel`이 종마다 가장 큼**, 부속성 기술의 `element`가 종의 부속성·주속성 기술은 주속성) · `skills.test.ts`(`learnedAt` 레벨 1/2/3/7/8/13/14/19/20, `newlyLearned` 1→3·2→9(레벨 3·8 둘 다)·8→8 빈 배열, `defaultSkills` 레벨 1이면 1개·레벨 20이면 5개, `weakestSkill` 동률은 슬롯 작은 쪽·특수만 있으면 null, `fastSeconds`(7000ms에서 슬롯1=4·슬롯5=3, 5000ms에서 슬롯1=3, 하한 1), `rollCopy` 경계(0.02 미만 당첨·이상 null)·가진 기술 제외·후보 없으면 null·특수 기술도 후보) · `elements.test.ts`(`matchup` 49쌍 전수를 `STRONG_AGAINST`에서 계산한 기대값과 비교, 독↔빛 0, 같은 속성 0; 11종의 주·부 속성이 설계서 표와 같음; 주속성과 부속성이 같은 종 없음).
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/field/skillsTable.test.ts tests/field/skills.test.ts tests/field/elements.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 표는 `SLOT_PATTERN`·`SKILL_NAMES`·`SPECIAL_OF_SPECIES`에서 만든다(id는 `${species}-${slot}`). 새 이름 22개는 어린이가 읽기 쉬운 짧은 한국어(부속성 기술 이름은 그 속성 느낌: 예 새싹몬 4번 `햇살 반짝`). `creatures.ts`는 `SpeciesDef.moves`를 `speciesSkills(id).map(s => s.name)` 파생으로 바꿔 이 필드를 읽던 곳(`DevFieldGallery`, `WildBattleScreen`)이 컴파일되게 하고, 전투 쪽 실제 사용은 Task 4가 고친다.
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS + `npx tsc --noEmit -p .` + `npx vitest run`.
- [ ] **Step 5: Commit** — `git commit -m "구구몬 속성 2가지와 기술 표: 주속성 3·부속성 1·특수 1"`

---

### Task 2: 저장 — 가진 기술 (Opus)

**담당:** `opus-expert` (저장 데이터), 이후 Opus 검토

**Files:**
- Modify: `src/store/fieldData.ts`(`SpeciesEntry`, `newSpeciesEntry`, `mergeEntry`), `src/store/useGameStore.ts`(`partialize`, 액션), `src/store/saveData.ts`(필드를 통과시키는지 확인), `src/screens/admin/DataSecurityPanels.tsx`(`currentSave()`)
- Test: `tests/field/fieldData.test.ts`(또는 기존 필드 저장 테스트), `tests/field/fieldStore.test.ts`

**Interfaces:**
- Consumes (Task 1): `skillDef`, `speciesSkills`, `learnedAt`, `defaultSkills`, `MAX_SKILLS`.
- Produces:
  - `SpeciesEntry`에 `skills: SkillId[]`(가진 기술 1~`MAX_SKILLS`개)
  - `normalizeSkills(species: SpeciesId, level: number, skills: unknown): SkillId[]`(순수, `fieldData.ts` 한 곳): 허용 = ① 자기 종 기술이고 `learnLevel ≤ level`, ② 다른 종 기술(복사), ③ 옛 저장 이월 슬롯(`legacySlots(level)`: 레벨 1~2면 슬롯1, 3~7이면 슬롯1·2, 8 이상이면 슬롯1·2·5 — 이미 가진 것이 아니면 새로 주지 않음, 검증에서만 허용). 모르는 id·중복·`MAX_SKILLS` 초과(앞에서부터 자름)·빈 결과는 `defaultSkills`로 채움. 배열이 아니면 무시.
  - `newSpeciesEntry(species: SpeciesId, level: number, now: number): SpeciesEntry` — **종을 받도록 시그니처가 바뀐다**(호출부 전부 수정). 옛 데이터 이월(`skills` 없음)은 `mergeEntry`가 `legacySlots(level)` 슬롯을 가진 것으로 채운다.
  - 액션: `replaceSkill(species: SpeciesId, removeId: SkillId, addId: SkillId): boolean`(removeId가 가진 기술이고 addId가 모르는 기술/이미 가진 기술이 아니면 교체; 아니면 거부·상태 객체 불변. addId 허용은 `normalizeSkills` 규칙과 같다), `setSkills(species: SpeciesId, ids: SkillId[]): boolean`(검증 후 한 번의 `set`; 최소 1·최대 `MAX_SKILLS`·허용 규칙·중복 없음), `addSkill(species, id): boolean`(5개 미만일 때 추가)

- [ ] **Step 1: 실패하는 테스트** — (a) 옛 저장 형태(필드 없음)의 레벨 1·2·3·7·8·14·20 구구몬이 `mergeEntry` 뒤 각각 `[1]`·`[1]`·`[1,2]`·`[1,2]`·`[1,2,5]`·`[1,2,5]`·`[1,2,5]`+(레벨 14면 슬롯4까지? — **아니다**: 이월은 예전 3개만; 슬롯3·4는 다음 레벨업에서 `newlyLearned`로 얻으므로 이월 결과는 그대로 `[1,2,5]`) 슬롯 id 목록이고 종마다 기술 이름이 예전 이름과 같음(기술이 줄지 않음); (b) 이상한 값: 모르는 id·레벨이 모자란 자기 종 기술(예: 레벨 2에 슬롯5)·중복·6개→앞 5개·빈 목록→`defaultSkills`·배열이 아닌 값(`null`·문자열·숫자)·다른 종 기술(복사)은 허용; (c) `newSpeciesEntry('jelly', 8, now).skills`가 `defaultSkills('jelly', 8)`; (d) `replaceSkill`/`setSkills`/`addSkill`의 허용·거부 모든 경우와 **거부 시 상태 불변**; (e) `partialize` 결과와 `currentSave()`에 `skills`가 들어 있고 저장→다시 읽기 왕복에서 값 유지.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/field`.
- [ ] **Step 3: 구현** — 검증은 `normalizeSkills` 한 곳에서 하고 `mergeEntry`와 액션이 같이 쓴다. `set`은 액션당 한 번.
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`(스타터 선택·잡기 흐름이 새 시그니처로도 동작).
- [ ] **Step 5: Commit** — `git commit -m "구구몬이 가진 기술을 저장(옛 저장은 지금 기술 그대로)"`

---

### Task 3: 전투 규칙 — 칸 체력·위력·강력·특수·상성·회복 재전투 (Opus, 순수 로직)

**담당:** `opus-expert` (전투 흐름), 이후 Opus 검토

**Files:**
- Modify: `src/domain/field/wildBattle.ts`, `src/domain/field/tuning.ts`
- Test: `tests/field/wildBattle.test.ts`, `tests/field/tuning.test.ts`

**Interfaces:**
- Consumes (Task 1): `SkillDef`, `fastSeconds`, `weakestSkill`, `matchup`, 상수들.
- Produces (`wildBattle.ts`):
  - `WildState`: `hits` → `cells`(깎인 칸), `elapsedMs`(이 문제를 시작한 뒤 경과, 여유 늘림은 세지 않음), `charge: number`(다음 속성 기술에 더할 칸)와 `guard: boolean`(다음 적 공격 절반)은 **전투 상태가 아니라 `WildState`의 일부**로 둔다. `maxCells(tier) = TIER_RULES[tier].hitsToDizzy * CELLS_PER_HIT`. `WildPhase`에 `'pick'` 추가.
  - `chipCells(skill: SkillDef, fast: boolean, m: -1|0|1, charge: number): number` = `clamp(skill.basePower + (fast ? FAST_BONUS_CELLS : 0) + charge + m, 1, MAX_CHIP_CELLS)`(특수 기술 성공 시 `m=0`, 속성 없음).
  - `resolveAnswer(s: WildState, picked: SkillDef, held: SkillId[], wildMainElement: Element, timeMs: number): { state: WildState; fired: SkillDef; fast: boolean; usedFallback: boolean; special?: SpecialKind }`: 속성 기술이면 `fast = elapsedMs ≤ fastSeconds(...)×1000`, 피해 `chipCells`; 특수 기술이면 조건 안(`fast`)이면 위력 `basePower` 칸 + `special` 성공, 아니면 `weakestSkill(held)`가 대신 나감(`usedFallback: true`, 그 기술의 평소 위력·상성, 강력 아님). 정답 한 번당 호출. 오답·시간 초과는 기존 `strike` 그대로.
  - `answerWild(s, correct, rng)`는 오답 처리와 연타 방지(`phase !== 'question'` 무시)를 유지하되 정답 피해는 `resolveAnswer`로 옮긴다(옛 호출 호환이 필요하면 위력 2·보통·강력 아님 기본값). 어지러움 조건 `cells >= maxCells(tier)`. `wildHpRatio`는 칸 기준. `tickWild`는 `question` 단계에서만 시계·`elapsedMs`를 올리고 `pick` 단계에서는 멈춘다.
  - `pickSkill(s: WildState): WildState`(`pick`→`question`, 시계 시작·`elapsedMs=0`), `resumeWild`: 명중·힌트 뒤 새 문제는 `question` 대신 **가진 기술이 2개 이상이면 `pick`**(호출부가 `heldCount`를 넘김), 힌트 뒤 같은 문제는 `pick`을 거치지 않고 `question`(경과 시간은 이어서가 아니라 0부터).
  - `ThrowOutcome`의 `'retry'` → `'healed'`: 어지러움 해제, `cells = max(0, cells − ceil(maxCells × CAPTURE_FAIL_HEAL_RATIO))`, `phase`는 `question`/`pick`(기술 수에 따라), 문제 시간 처음부터. `escaped`·`angry` 그대로(`angry`는 `cells = 0`).
- `guard`·`charge`·`calm`·`clue`·`heal`의 **적용 자리**: `resolveAnswer`가 어떤 특수가 성공했는지(`special`)만 돌려주고, 상태 변경은 `WildState`에 `charge`·`guard`·`calmMs`·`hideChoice` 필드를 더해 이 파일이 처리(`heal`은 내 구구몬 체력이므로 호출부/스토어 몫 — `special === 'heal'`만 반환). 다음 문제로 넘어갈 때 `calmMs`는 시간에 더해지고 `charge`는 다음 속성 기술에서 소모, `guard`는 다음 적 공격 `damageOf` 절반(올림)에서 소모.

- [ ] **Step 1: 실패하는 테스트** — `chipCells` 경계(1+(-1)→1, 3+1+1→4 clamp, 충전 포함), 4단계+황금에서 최대 피해(4칸)로 한 번에 어지러워지지 않음(최소 정답 2번), 위력 2 정답 N번 = 옛 `hitsToDizzy` 번과 같은 길이, `resolveAnswer`: 속성 기술이 경계 시간(정확히 제한 초)에 강력·1ms 넘으면 아님·`calm`으로 늘어난 시간은 `elapsedMs`에 안 셈·특수 성공(조건 안)과 실패(→ `weakestSkill`, `usedFallback`)·`weakestSkill` 동률 규칙·특수만 가진 경우(없음) 처리(가진 속성 기술이 없으면 위력 1 기본 타격), 특수 5종 상태 변화(`charge`→다음 `chipCells`에 +1 후 소모, `guard`→다음 `damageOf` 절반 올림 후 소모, `calm`→다음 문제 시간 +`CALM_BONUS_MS`, `clue`→보기 하나 숨김 정보 `hideChoice`가 틀린 보기 하나, `heal`→`special:'heal'` 반환), `pick` 단계에서 `tickWild`가 시간을 안 깎음·`pickSkill` 뒤 시작, 힌트 뒤 같은 문제는 `pick`을 거치지 않음, 기술 1개면 `resumeWild`가 `pick`을 건너뜀, `healed` 4단계+황금(회복 칸 `ceil(max/2)`)과 회복 직후 `question`, 연타 무시·`throwCapsule` 난수 한 번 결정(R11) 유지, `angry`의 `cells=0`.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `hits`를 읽던 곳(화면·정산·테스트)을 함께 고쳐 컴파일과 기존 동작이 유지되게 한다(옛 호출은 기본 위력 2·보통·강력 아님으로). 화면의 고르기 UI는 Task 4.
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`(기존 전투·포획이 칸 단위에서도 같은 정답 수로 통과; `retry` 글을 기다리는 E2E는 `healed` 글로 고치고 메모).
- [ ] **Step 5: Commit** — `git commit -m "전투 규칙: 칸 체력, 위력·빠르게 풀면 강력·특수 기술·속성 상성, 포획 실패하면 회복 후 재전투"`

---

### Task 4: 전투 화면 — 기술 고르기와 기술 적용 (Opus)

**담당:** `opus-expert` (전투 흐름), 이후 Opus 검토

**Files:**
- Modify: `src/field/battle/WildBattleScreen.tsx`, `src/field/battle/useQuestionFeed.ts`(필요 시), `src/field/battle/battleText.ts`, 전투 CSS, `src/field/debugFlags.ts`(`fast` 스위치), `tests/field/debugFlags.test.ts`
- Create: `src/field/battle/SkillPicker.tsx`
- Test: `tests/field/wildBattle.test.ts`(보강), `e2e/field.spec.ts`

**Interfaces:**
- Consumes (Task 1·2·3): `SkillDef`, `skillDef`, `fastSeconds`, `matchup`, `resolveAnswer`, `pickSkill`, 저장된 `field.species[companion].skills`, Task 8 전까지의 효과 이름은 `skillFxName(def, strong)`(= `strong ? STRONG_FX[el][i] : ELEMENT_FX[el][i]`; Task 8이 40개를 채우기 전엔 `STRONG_FX`가 없으므로 임시로 평소 효과를 반환하게 하고 Task 8에서 교체).
- Produces:
  - `SkillPicker`: 가진 기술을 큰 버튼 최대 5개(두 줄 격자, 375px)로 — 이름·속성 글자·위력 ★·**발동 조건**("N초 안에 풀면 강력!" / 특수는 "N초 안에 풀면 ○○! 못 풀면 약한 기술이 나가요", N = `fastSeconds`, 현재 단계 시간 기준)·상성 글자("효과가 커요!"/"별로예요" + ▲▼). 가진 기술이 1개면 표시하지 않고 자동 선택.
  - 전투 시작 시 가진 기술 목록을 고정(`useState`, 전투 중 안 바뀜). 보기 버튼은 **답 숫자만**.
  - 정답이면 `resolveAnswer` 결과대로: 나간 기술의 효과(강력이면 `strong`), 글("○○! 강력!", 상성 글 한 줄, 특수 발동 글, `usedFallback`이면 "시간이 지나서 약한 기술이 나갔어요"), `special === 'heal'`이면 내 구구몬 체력 `SPECIAL_HEAL` 회복(체력 상한 안; 기존 체력·상처 액션을 읽고 맞는 것 사용, 단일 `set`), `clue`면 다음 문제 보기 하나 숨김 표시, `calm`·`charge`·`guard`는 상태(`WildState`)로 이미 반영됨을 화면 글/표시로.
  - 적의 기술 이름·효과: `learnedAt(wildSpecies, wildLevel)` 중 **속성 기술**에서 무작위(특수 제외, 황금은 황금 기술). 적 공격 피해는 기존 단계별 값 그대로(방어 `guard` 적용만).
  - `debugFlags()`에 `fast: boolean | null`(`window.__GUGU_E2E_FAST__`: `true`면 항상 강력 조건 충족, `false`면 항상 미충족, 없으면 실제 시간) — `NO_TIMER`와 함께 쓸 수 있게. 단위 테스트의 기본값·읽기 표 갱신.

- [ ] **Step 1: 실패하는 테스트** — 단위: 기술 1개면 `pick` 없이 문제, 2개 이상이면 `pick`; `fast` 스위치가 `resolveAnswer` 호출부에서 반영됨. E2E(`__GUGU_E2E_TIER__`·`__GUGU_E2E_QUESTION__`·`NO_TIMER` 고정): (a) 새 스타터(기술 1개)는 고르기 없이 바로 문제, (b) 5개를 가진 저장에서 고르기 단계 버튼 5개에 발동 조건·상성 글이 보임, (c) 속성 기술 + `__GUGU_E2E_FAST__=true` → "강력!" 글과 더 큰 체력 감소, `false` → 평소, (d) 특수 기술 성공이면 특수 글(예: 회복 때 내 체력 막대가 늘어남(체력이 닳은 상태에서)), 실패(`fast=false`)면 "약한 기술이 나갔어요", (e) 오답 → 힌트 뒤 같은 기술로 같은 문제(고르기 단계로 안 감).
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 기존 `answerTimer`·`NO_TIMER`·`QUESTION` 스위치 동작을 깨지 않게. `moveFx`는 `skillDef` 기반(내 공격은 야생 위, 적 공격은 내 구구몬 위 — 2차 규칙 그대로).
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts e2e/title.spec.ts`, 375px에서 고르기 단계(5개 버튼)·상성·발동 조건 글을 눈으로 확인(스크린샷 `.superpowers/sdd/…/task-4-shots/`).
- [ ] **Step 5: Commit** — `git commit -m "전투에서 문제를 풀기 전에 기술을 고르고, 빠르게 풀면 강력·특수 기술·상성이 적용됨"`

---

### Task 5: 정산 — 레벨업으로 배우기, 2% 복사, 알림 (Opus)

**담당:** `opus-expert` (저장·전투 정산), 이후 Opus 검토

**Files:**
- Modify: `src/store/useGameStore.ts`(`finishWildBattle`), `src/store/fieldData.ts`(`FieldNotice`), `src/store/useSessionStore.ts`, `src/field/debugFlags.ts`, `src/field/battle/battleText.ts`, `tests/field/debugFlags.test.ts`
- Test: `tests/field/fieldStore.test.ts`, `e2e/field.spec.ts`

**Interfaces:**
- Consumes (Task 1·2): `newlyLearned`, `rollCopy`, `addSkill`, `replaceSkill`, `MAX_SKILLS`.
- Produces:
  - `finishWildBattle`가 레벨업마다 새 기술을 레벨 순서로 처리: 가진 기술 < `MAX_SKILLS`면 **같은 `set()` 안에서 자동으로 가짐** + `FieldNotice` `{kind:'skill', species, skillId, how:'learned'}`; 5개면 `skillOffers`에 `{species, skillId, source:'level'}`만 넣고 **저장은 안 바꿈**(아는 기술로 남음, 관리 화면에서 다시 배움).
  - 끝 `caught`·`released`일 때만 `rollCopy`(한 전투 한 번, 동행 구구몬 기준 `held`): 당첨이고 5개 미만이면 바로 가짐(`how:'copied'`), 5개면 `skillOffers`에 `{source:'copy', fromSpecies}`.
  - `useSessionStore`: `skillOffers: SkillOffer[]`, `pushSkillOffer`, `shiftSkillOffer`; `SkillOffer = { species: SpeciesId; skillId: SkillId; source: 'level' | 'copy'; fromSpecies?: SpeciesId }`.
  - `acceptSkillOffer(offer: SkillOffer, removeId: SkillId): boolean`(`replaceSkill`과 같은 검증·한 번의 `set`), 포기/배우지 않기는 큐만 비움(저장 불변).
  - `debugFlags()`에 `copy: boolean`(`window.__GUGU_E2E_COPY__`, 켜면 `rollCopy` 확률 100%), 테스트 표 갱신.

- [ ] **Step 1: 실패하는 테스트** — 레벨 1→3(자동 가짐+알림)·1→9(슬롯 2·3 순서)·가진 5개에서 새 기술(제안만 쌓임·저장 불변)·복사: `rng` 스텁으로 경계(0.02 미만 당첨)와 후보 없음·5개 미만이면 자동·5개면 제안·`escaped`·`fainted`는 굴리지 않음, `acceptSkillOffer` 허용·거부·한 `set()`(구독 한 번), 옛 저장에서도 안 깨짐. E2E: `__GUGU_E2E_COPY__`와 기술 5개 저장으로 잡기 → `skillOffers`가 쌓임(창 UI는 Task 6), 5개 미만이면 알림 글.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`.
- [ ] **Step 5: Commit** — `git commit -m "레벨이 오르면 기술을 배우고, 잡거나 퇴치하면 2%로 기술을 복사"`

---

### Task 6: 선택창과 기술 관리 화면 (Sonnet)

**담당:** Sonnet

**Files:**
- Create: `src/field/SkillOfferDialog.tsx`, `src/field/SkillManager.tsx`, `src/field/skillText.ts`
- Modify: `src/field/world/FieldScreen.tsx`(선택창 띄우기), `src/field/FieldDexScreen.tsx`
- Test: `tests/field/skillText.test.ts`, `e2e/skills.spec.ts`(새)

**Interfaces:**
- Consumes (Task 1·2·5): `skillDef`, `speciesSkills`, `learnedAt`, `useSessionStore.skillOffers`, `acceptSkillOffer`, `setSkills`, `MAX_SKILLS`, `fastSeconds`.
- Produces:
  - `skillText.ts`: 위력 별, 종류 글(주속성/부속성/특수), 특수 설명("체력이 조금 회복돼요"·"다음 적 공격이 약해져요"·"틀린 보기가 하나 사라져요"·"다음 문제 시간이 늘어요"·"다음 기술이 더 세져요"), 발동 조건 문구, 출처 문구 — `SkillDef`에서 계산(표가 바뀌어도 따라감).
  - `SkillOfferDialog`: 새 기술 카드 + 가진 기술 5개 버튼("이 기술을 잊고 배우기") + 둘째 버튼(레벨 제안 "배우지 않기", 복사 제안 "포기"). 떠 있는 동안 `setUpdateBusy(true)`. 한 번에 하나, 큰 글자, 375px 안 잘림, Esc는 둘째 버튼과 같다.
  - `SkillManager`(도감 상세): 가진 기술 카드(최대 5) + "잊은/못 배운 기술" 목록(익혔지만 안 가진 것은 "다시 배우기", 못 익힌 것은 "Lv N에 배워요" 잠금). 다시 배우기는 가진 게 5개면 바꿀 기술을 고름. 최소 1개 유지. 저장은 `setSkills` 한 번. 전투·상점 중에는 접근 불가.

- [ ] **Step 1: 실패하는 테스트** — `skillText` 단위(별 개수·종류 글·특수 설명·조건 문구·출처 문구가 `SkillDef`에서 나옴). E2E: 5개 가진 저장 + 복사 스위치로 잡기 → 선택창이 뜸 → "잊고 배우기"가 저장을 바꿈 / "포기"는 저장 불변; 레벨 제안 "배우지 않기"는 아는 기술로 남아 관리 화면에서 다시 배울 수 있음; 못 익힌 기술은 눌러도 안 배워짐; 새로고침 뒤에도 유지; 가진 기술이 1개일 때 마지막 것은 바꿀 수만 있고 비울 수 없음.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, 관련 E2E, 375px 스크린샷으로 선택창·관리 화면 눈 확인.
- [ ] **Step 5: Commit** — `git commit -m "기술 선택창과 도감의 기술 관리 화면"`

---

### Task 7: 캡슐 던지기 연출과 효과음 (Sonnet)

**담당:** Sonnet (회복 재전투의 상태 흐름은 Task 3·4에서 이미 있음)

**Files:**
- Modify: `src/field/battle/WildBattleScreen.tsx`(던지기 시퀀스·`healed` 연출), `src/field/battle/battleText.ts`, `src/domain/field/tuning.ts`(연출 시간), `src/audio/sfx.ts`, 전투 CSS
- Test: `tests/audio/sfx.test.ts`(없으면 새로), `tests/field/tuning.test.ts`, `e2e/field.spec.ts`

**Interfaces:**
- Consumes (Task 3): `ThrowOutcome`의 `healed`. 기존 `playFx`·`catch` 효과·`CapsuleBall`.
- Produces:
  - `Sfx` 이름 6개: `throw`·`capsuleOpen`·`capsuleBounce`·`capsuleShake`·`capsuleClick`·`capsulePop`(Web Audio 합성, 기존 규칙: 소리 끔·첫 터치 뒤)
  - 던지기 시퀀스(설계서 4-1): 포물선 던짐 → 붉은 빛으로 빨려 들어감 → 통통 → 3번 흔들림(`capsuleShake` 3번) → 잡힘이면 `capsuleClick`+별가루+`capture`, 실패면 1~2번째에서 `capsulePop`으로 열려 야생 구구몬이 튀어나옴. 연출은 이미 정해진 `thrown.outcome`에 맞춤. 단계마다 `data-capsule-stage` 속성. 총 길이 ≈3초(`tuning.ts`: `CAPSULE_*_MS`로 단계별 시간, 기존 `CAPSULE_SHAKE_MS`·`CAPSULE_SHAKES` 확장). `healed`는 글 "앗! 캡슐에서 빠져나왔어요! 힘을 조금 되찾았어요!"와 체력 막대가 차오름.
  - 동작 줄이기면 캔버스 효과 없이 흔들림만. 던지는 동안 입력 막음(`throwingRef`) 유지.

- [ ] **Step 1: 실패하는 테스트** — `sfx` 이름 6개가 `SOUNDS`에 있고 각 길이가 짧음·소리 끔이면 `AudioContext`를 안 만듦(기존 방식), 시간 상수 고정표, E2E: 던지기 중 `data-capsule-stage`가 순서대로(throw→absorb→bounce→shake→result), 잡힘 결과에서 `capsuleClick` 소리 스파이가 불림, 실패 결과(필요하면 `rng` 주입 스위치 추가)에서 `capsulePop`·야생이 다시 나옴, `healed`는 체력 막대가 늘고 다시 문제, 던지는 동안 다시 눌러도 중복 던지기 없음.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `E2E_PORT=5191 npx playwright test e2e/field.spec.ts`, 375px에서 연출 단계별 스크린샷(던짐·빨려듦·흔들림·열림·잡힘).
- [ ] **Step 5: Commit** — `git commit -m "캡슐 던지기 연출과 효과음: 날아가 빨려 들어가고 세 번 흔들림"`

---

### Task 8: 새 효과 그림 40개 — 평소 부속성 7 + 강력 28 + 특수 5 (Sonnet)

**담당:** Sonnet

**Files:**
- Modify: `src/field/fx/effects.ts`(40개 + `center`), `src/domain/field/elements.ts`(`ELEMENT_FX` 4칸, `STRONG_FX`·`SPECIAL_FX`), `src/field/battle/WildBattleScreen.tsx`·`skillFxName`(임시 → 실제), `src/field/DevFieldGallery.tsx`(평소/강력/특수 버튼), `tests/field/elements.test.ts`, `tests/field/fxCenter.test.ts`, `tests/field/fxPlay.test.ts`(영향 시), `CLAUDE.md`(효과 행)

**Interfaces:**
- Consumes (Task 1): `SkillDef.fxIndex`·`element`·`special`.
- Produces: `ELEMENT_FX: Record<Element, readonly [FxName, FxName, FxName, FxName]>`(주①·주②·주③·부), `STRONG_FX: Record<Element, readonly [FxName, FxName, FxName, FxName]>`, `SPECIAL_FX: Record<SpecialKind, FxName>`, `skillFxName(def: SkillDef, strong: boolean): FxName`(특수는 `SPECIAL_FX`). 새 효과는 `node_modules/pixelfx/src/fx/` 중 기존 21개와 겹치지 않는 것(설계서 4-3 후보 목록; 구현자가 눈으로 골라 확정)을 `EFFECTS`에 한 줄씩(`load`·`until`·`speed`·`center`·`note`·`hold:false`·`screen:false`·필요하면 `options`). 강력 효과는 평소보다 크거나 화려하게.

- [ ] **Step 1: 실패하는 테스트** — `elements.test.ts`: 모든 속성의 `ELEMENT_FX`·`STRONG_FX`가 4칸이고 이름이 모두 `EFFECTS`에 있으며 서로 중복 없음, `SPECIAL_FX`가 5종을 덮음, 전 효과 `until÷speed ≤ 0.6초`(61개 전부), `fxCenter.test.ts`: 새 효과의 헤드리스 측정 중심이 표의 `center`와 1.5화소 안(기존 `tests/field/fxMeasure.ts` 방식), `skillFxName`이 55개 기술 × 강력 여부 모두 존재하는 효과 이름을 돌려줌.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 새 효과마다 측정 도구로 중심을 재서 표에 적는다. **눈 확인**: 375×812 전투 캔버스에서 새 40개의 내 공격·적 공격 한창일 때(0.2~0.3초) 스크린샷을 저장하고 "효과 중심에 맞는 몬스터가 있는가"를 표로 보고서에 적는다(몬스터 밖이면 `center` 손조정), 황금 한 장, 평소 vs 강력이 눈으로 구분되는지 한 줄.
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `MSYS_NO_PATHCONV=1 npm run build`.
- [ ] **Step 5: Commit** — `git commit -m "기술마다 전용 강력 효과와 부속성·특수 기술 효과 그림"`

---

### Task 9: 기술 효과음 (Sonnet)

**담당:** Sonnet

**Files:**
- Modify: `src/audio/sfx.ts`, `src/field/battle/WildBattleScreen.tsx`(맞는 순간 재생)
- Test: `tests/audio/sfx.test.ts`

**Interfaces:**
- Produces: `Sfx` 이름 15개 — 속성 7(`fxGrass`·`fxPoison`·`fxLight`·`fxWater`·`fxThunder`·`fxEarth`·`fxFire`), 강력 1(`fxPower`), 상성 2(`superEffective`·`notVery`), 특수 5(`skillHeal`·`skillGuard`·`skillClue`·`skillCalm`·`skillCharge`); `SKILL_SFX: Record<Element, Sfx>`·`SPECIAL_SFX: Record<SpecialKind, Sfx>`(`sfx.ts` 한 곳). 각 ≤0.4초.

- [ ] **Step 1: 실패하는 테스트** — `SKILL_SFX`가 속성 7개·`SPECIAL_SFX`가 5종을 모두 덮음, 새 소리 길이 ≤0.4초, 소리 끔이면 재생 안 함, 강력 발동이면 `fxPower`가 겹쳐 재생, 상성에 따라 `superEffective`/`notVery`(0이면 없음), 특수 성공 때만 특수 소리(스파이).
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — 맞는 순간 효과와 같은 타이밍(내 공격·적 공격 모두 그 속성 소리, 적 공격에는 `fxPower`·상성 소리 없음).
- [ ] **Step 4: 통과 확인** — `npx tsc --noEmit -p .`, `npx vitest run`.
- [ ] **Step 5: Commit** — `git commit -m "기술이 맞을 때 속성별 효과음과 강력·상성·특수 소리"`

---

### Task 10: 마무리 — 문서·전체 확인·검토

**담당:** 지휘자(Sonnet) + Opus 최종 검토

**Files:**
- Modify: `MVP_DESIGN.md`(맨 위 변경 이력 v1.42 한 줄 + 해당 절 반영), `CLAUDE.md`("어디를 고치나"에 기술 표·속성·상성·연출·효과음 행, 폴더 표에 `skills.ts`·`SkillOfferDialog`·`SkillManager`·`SkillPicker`), `tests/field/tuning.test.ts`

- [ ] **Step 1: 문서** — v1.42 행(기술 체계·상성·복사·포획 회복·연출)과 CLAUDE.md 표 갱신.
- [ ] **Step 2: 전체 확인** — `npx tsc --noEmit -p .`, `npx vitest run`, `MSYS_NO_PATHCONV=1 npm run build`, `E2E_PORT=5191 npx playwright test`(혼자, 전체).
- [ ] **Step 3: 시각 확인** — 375px로 고르기 단계·선택창·관리 화면·던지기 연출·새 효과를 직접 보고 이상하면 해당 작업 고침.
- [ ] **Step 4: Opus 전체 검토**(저장·전투 흐름 변경이므로) — 브랜치 전체 diff, 옛 저장·복사·회복·강력 판정·특수 폴백·연출 중복 입력.
- [ ] **Step 5: Commit** — `git commit -m "필드 모험 3차 문서 정리"`; 병합·배포는 사용자 지시를 기다린다.

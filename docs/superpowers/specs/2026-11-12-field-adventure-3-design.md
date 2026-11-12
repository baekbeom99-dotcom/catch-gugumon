# 필드 모험 3차 — 설계서

> 기준: 2차(`2026-11-11-field-adventure-2-design.md`) 위에 얹는다. 수치는 `src/domain/field/tuning.ts` 한 곳, 저장은 `SaveData.field`(키 `gugu-monster:save`).
> 사용자 요청(2026-11-12)과 답을 그대로 옮긴 것이며, "가정"으로 표시한 곳만 내가 정한 것이다.

## 0. 요청 한눈에

1. 캡슐 포획에 실패하면 **적이 체력을 일부 회복하고 다시 싸운다**.
2. 구구몬은 **기술 1개로 시작**하고 **레벨이 오르면 기술을 배운다**. (배우는 레벨 **1·3·8·14·20**, 종마다 기술 **5개**, 장착은 최대 **3개**)
3. 야생 구구몬을 **잡거나 쓰러뜨린 순간 2%** 확률로 그 구구몬의 **기술을 복사**할 수 있다. 장착이 3개로 가득 차 있으면 **하나를 지우고 장착하거나 포기**한다.
4. **캡슐이 날아가 잡는 과정에 연출(원작처럼)과 효과음**을 넣는다.

진화 시스템은 나중에 넣는다(이번엔 건드리지 않음 — 기술은 종에 붙고 진화 단계와 무관).

## 1. 결정과 가정

| 항목 | 결정 | 출처 |
|---|---|---|
| 보기 버튼 | 정답 **보기 3개는 그대로**. 버튼마다 **익힌 기술 이름을 무작위 배정**(기술 1개면 같은 이름이 3번). 고른 보기가 맞으면 **그 버튼의 기술**이 나감 | 사용자 |
| 기술 개수 | 종마다 5개(기존 3개 + 새 2개), 배우는 레벨 1·3·8·14·20 | 사용자 |
| 장착 한도 | 3개. 4번째부터 배울 때도 "지우고 장착 / 포기" | 사용자(복사 규칙을 레벨업에도 같게) — 가정 |
| 복사 시점 | 야생 구구몬을 **잡았을 때**(`caught`)나 **퇴치했을 때**(`released`, 캡슐 없어 돌려보냄). 도망(`escaped`)은 제외 | 사용자 |
| 복사 확률 | **2%** (그 한 번에 한 번만 굴림) | 사용자 |
| 복사 대상 | 그 야생 구구몬이 **자기 레벨에서 익힌 기술** 중 무작위 1개. 이미 장착한 기술(같은 id)이면 복사 후보에서 뺀다. 후보가 없으면 복사 없음 | 가정 |
| 포획 실패 | 지금의 결과 4가지 중 **`retry`(다시 던지기)** 를 **"체력 일부 회복 후 재전투"** 로 바꾼다. `escaped`·`angry`는 그대로 | 가정 |
| 회복량 | 어지러워진 적의 맞은 횟수를 **절반(올림)만큼 되돌림**(`CAPTURE_FAIL_HEAL_RATIO = 0.5`): 약함 5→3칸, 보통 4→2칸, 강함 3→2칸, 강력 2→1칸, 황금도 같은 규칙 | 가정 |

> 가정은 `tuning.ts` 값만 바꾸면 조정된다. 틀렸으면 알려 주면 된다.

## 2. 기술 시스템

### 2-1. 기술 표 (`src/domain/field/skills.ts`, 새 파일, 순수 로직)

- `SkillId` = 문자열 id(예: `cloud-1` … `cloud-5`, `legend-fluff-1` …). `SkillDef { id, name, element, fxIndex: 0|1|2, learnLevel }`.
- 종마다 기술 5개: **1~3번은 지금 이름 그대로**(`creatures.ts`의 `MOVES`·`LEGEND_MOVES`) 레벨 1·3·8에 배우고, **4·5번은 새로 만드는 이름**(종마다 2개 × 11종 = 22개, 어린이가 읽기 쉬운 한국어, 종 분위기에 맞게) 레벨 14·20에 배운다.
- 효과: 기술의 `element`(= 그 종의 속성)와 `fxIndex`로 지금의 `ELEMENT_FX[속성][fxIndex]`(21개)를 그대로 쓴다. 1~3번은 지금처럼 0·1·2, 4번은 2, 5번은 0 → 새 효과를 만들지 않고 돌려 쓴다. **복사한 기술은 원래 종의 속성·효과를 그대로 가져온다**(내 구구몬 속성과 달라도 됨).
- 순수 함수: `learnedAt(species, level): SkillDef[]`(그 레벨까지 익힌 목록), `newlyLearned(species, fromLevel, toLevel): SkillDef[]`(막 올랐을 때 새 기술), `defaultSkills(species, level): SkillId[]`(익힌 것 중 앞의 3개), `skillDef(id)`.
- 기술 이름·효과표를 바꿀 때는 이 파일 한 곳 (`MVP_DESIGN.md`·CLAUDE.md "어디를 고치나" 표에 한 줄 추가).

### 2-2. 저장 (`SpeciesEntry`)

- `SpeciesEntry`에 `skills: SkillId[]`(장착한 기술, 1~3개) 추가. **저장된 기술은 이 목록이 전부**다(배운 기록은 따로 두지 않는다 — 복사한 기술이 있어 "레벨로 계산" 불가).
- 옛 저장(`skills` 없음): `mergeEntry`가 `defaultSkills(species, level)`로 채운다 → 레벨 8 이상이면 지금 기술 3개가 그대로 장착, 레벨 1~2면 1~2개. **옛 저장에서 기술이 줄어드는 일은 없어야 한다**(레벨 3·8을 이미 넘은 구구몬은 3개 모두).
- 이상한 값(알 수 없는 id·중복·4개 이상·빈 목록)은 `mergeEntry`가 거르고, 비면 `defaultSkills`로 채운다. `newSpeciesEntry`는 종·레벨을 받아 `defaultSkills`로 시작 기술을 정한다(새로 잡은 구구몬·스타터는 기본으로 그 레벨에서 익힌 앞의 3개).
- CLAUDE.md 저장 네 곳: `createInitialSave`(필드 기본), `mergeSave`(`mergeField`/`mergeEntry` 깊게 채우기), `useGameStore.partialize`, `admin/DataSecurityPanels.tsx currentSave()`. 형식 추가이므로 키는 그대로.

### 2-3. 배우기 (레벨업)

- 레벨이 오르는 **기존 정산 지점**(`finishWildBattle`의 경험치 → `addExp`)에서 `newlyLearned`를 구한다.
- 장착이 3개 미만이면 **자동 장착**하고 알림 "「새 기술」을 배웠어요!"; **3개 가득이면 선택창**(§2-5)을 띄운다.
- 한 번에 여러 레벨이 올라도 기술은 레벨 순서대로 하나씩 처리한다(선택창은 차례로).

### 2-4. 복사 (2%)

- 전투 끝(`caught`·`released`) 정산에서 `rollCopy(rng, wildSpecies, wildLevel, equipped)`로 판정: `COPY_CHANCE = 0.02`. 당첨되면 후보에서 하나 고른다(§1).
- 장착이 3개 미만이면 바로 장착(알림 "○○에게서 「기술」을 따라 배웠어요!"), 3개 가득이면 선택창(§2-5)을 띄운다.
- E2E용 스위치 `__GUGU_E2E_COPY__`(true면 복사 100%)를 `debugFlags.ts`에 더한다.

### 2-5. 선택창 (`SkillOfferDialog`, 새 컴포넌트, 필드 화면)

- 내용: 구구몬 이름 + **새 기술 카드**(이름·속성 글자·"○○에게서" 또는 "레벨 N" 문구), 지금 장착한 기술 3개 버튼 **"이 기술을 잊고 배우기"**, **"배우지 않기"** 버튼. (원작처럼 한 번에 하나씩, 큰 글자.)
- 선택은 세션 상태(`useSessionStore`의 `skillOffers` 대기열, 저장 안 됨). 확정하면 `useGameStore.replaceSkill(species, removeId, newId)` / 포기는 아무것도 저장하지 않는다. **창을 닫거나 앱을 떠나 못 받은 제안은 사라진다**(다시 안 뜸) — 가정.
- 선택창이 떠 있는 동안 자동 새로고침을 막는다(`setUpdateBusy`, 기존 방식).

### 2-6. 전투에 연결 (`WildBattleScreen`·`useQuestionFeed` 주변)

- 동행의 **장착 기술**(`field.species[companion].skills`)이 지금의 `speciesDef(companion).moves`를 대신한다. 전투가 시작될 때 목록을 고정한다(전투 중 바뀌지 않음, 지금 동행 고정과 같은 방식).
- 문제가 나올 때마다 보기 3개에 **기술을 무작위로 배정**한다(§1). 같은 기술이 여러 보기에 붙을 수 있다. 배정은 한 문제 안에서 고정(다시 그려도 안 바뀜).
- 적(야생)의 기술 이름·효과도 **그 종이 그 레벨에서 익힌 기술**에서 무작위로 고른다(지금은 3개 중 하나). 황금 구구몬은 황금 기술.
- 효과: `ELEMENT_FX` 직접 조회 대신 `skillDef(id)`의 `element`·`fxIndex`로 효과 이름을 구한다(`moveFx`).
- 도감 화면(`FieldDexScreen`)에 구구몬마다 장착 기술 목록(읽기 전용, 이름만)을 보여 준다.

## 3. 포획 실패 → 체력 회복 후 재전투

- `wildBattle.ts`의 `throwCapsule`에서 `retry` 결과를 바꾼다: **`phase: 'question'`으로 돌아가고**, `hits`를 `max(0, hits − ceil(hitsToDizzy × CAPTURE_FAIL_HEAL_RATIO))`로 되돌리고(어지러움 해제), 문제 시간을 새로 시작한다. 결과 이름은 `retry` → **`healed`** 로 바꾼다(`ThrowOutcome`).
- 문장: 캡슐이 튕겨 나오고 "앗! 캡슐에서 빠져나왔어요! 힘을 조금 되찾았어요!" 같은 글을 `battleText.ts`에. 위 "다시 던지기" 글은 정리.
- 체력 막대가 늘어나는 것이 보이게(회복 연출: `HpBar`가 부드럽게 차오름, 작은 반짝 효과 — 기존 `catch`가 아닌 짧은 `hit`류 효과 재활용 또는 반짝 CSS).
- 그 뒤 흐름은 지금 그대로(다시 어지러우면 다시 던질 수 있다). 캡슐은 던질 때 이미 소모된다(지금과 같음).
- `escaped`·`angry`·캡슐 0개일 때 퇴치는 그대로. 확률표(`throwOdds`)의 `retry` 칸 값은 유지하고 이름만 의미가 바뀐다 → 1회 평균 캡슐 수·잡힘 확률 설계 숫자는 변하지 않는다(재전투 문제를 더 푸는 대신 캡슐 부담은 그대로).
- 이 변경은 **전투 흐름**이므로 구현·검토는 Opus.

## 4. 캡슐 던지기 연출과 효과음 (원작 풍)

### 4-1. 연출 순서 (캔버스 위 효과 + 기존 CSS 공 애니메이션)

던지기 버튼을 누르면(`onCapsule`, 던지기 중에는 입력 막음 — 지금과 같음):

1. **던짐**: 공이 내 구구몬 쪽에서 야생 구구몬 쪽으로 **포물선**으로 날아간다(공이 돈다). 효과음 `throw`(휙).
2. **맞음·빨려 들어감**: 공이 야생 구구몬에 닿으면 **붉은 빛 번쩍**과 함께 야생 구구몬이 빛으로 줄어들며 공 안으로 빨려 들어간다(기존 `wild__foe--capsule`). 효과음 `capsuleOpen`(슈웅).
3. **떨어짐·튕김**: 공이 땅에 떨어져 **한 번 통통** 튄다. 효과음 `capsuleBounce`.
4. **흔들림 3번**: 공이 좌우로 **3번 흔들린다**(원작처럼 사이에 잠깐 멈춤). 흔들릴 때마다 효과음 `capsuleShake`(딸깍). 흔들림 횟수와 시간은 `tuning.ts`(기존 `CAPSULE_SHAKE_MS`·`CAPSULE_SHAKES` 확장)에서.
5. **결과**
   - **잡힘**: 마지막 흔들림 뒤 **딸깍(`capsuleClick`)** 과 함께 공이 멈추고 **별가루 반짝**(기존 `catch` 효과 `collect-burst` 활용, 금빛은 황금 구구몬) + `capture` 팡파르.
   - **실패(회복·도망·화남)**: 중간(원작처럼 1~2번째 흔들림 뒤)에 공이 **쾅 하고 열리며** 야생 구구몬이 튀어나온다. 효과음 `capsulePop`(뾰옹). 실패 종류별로 이어지는 글·연출은 지금대로(도망은 사라짐, 화남은 몸이 붉게, 회복은 §3).
   - **몇 번째에서 터지는지는 결과가 정한다**: 잡힘 → 3번 다 흔들림, 실패 → 1~2번째에서(난수 하나로 이미 정해진 결과에 연출만 맞춘다, 규칙은 안 건드림).
- 연출 길이는 합쳐서 **약 3초 안**(지금 던지기 연출과 비슷). 동작 줄이기 설정이면 효과(캔버스 효과)는 빼고 공 애니메이션은 흔들림만 단순하게(기존 규칙).
- 효과(반짝·번쩍)는 pixelfx를 쓰고, 처음 쓸 때 내려받는다(기존 `playFx` 구조). 필요한 새 효과 이름은 `effects.ts`의 `EFFECTS`에 한 줄씩 더하고 `#/dev/field`에서 버튼으로 본다.

### 4-2. 효과음 (`src/audio/sfx.ts`에 합성음 5개 추가)

- 새 소리: `throw`(짧게 올라가는 휙), `capsuleOpen`(빨려 들어가는 슈웅, 내려가며 빨라지는 음), `capsuleBounce`(통), `capsuleShake`(딸깍), `capsuleClick`(탁, 높은 딸깍), `capsulePop`(열리는 뾰옹). 기존 `capture`(잡았을 때)는 그대로 쓴다.
- 기존 규칙 그대로: 파일 없이 Web Audio 합성, 소리 끄기 설정 존중(`sfx.ts`가 스토어에서 읽음), 사용자 첫 터치 뒤에 재생.
- 기술 효과음(기술 사용 때 소리)은 이번 범위 **밖**이다(요청은 캡슐 과정만).

## 5. 파일·책임

| 새로 / 고칠 곳 | 내용 |
|---|---|
| `src/domain/field/skills.ts` (새) | 기술 표·`learnedAt`·`newlyLearned`·`defaultSkills`·`rollCopy` |
| `src/domain/field/creatures.ts` | `moves` 배열을 기술 표에서 파생(기존 `moves`는 기술 이름 5개로 늘리거나 `skills.ts`가 대신 담당). 화면 글에서 쓰던 곳 정리 |
| `src/domain/field/tuning.ts` | `CAPTURE_FAIL_HEAL_RATIO`, `COPY_CHANCE`, `SKILL_SLOTS`(3), 배우는 레벨 `SKILL_LEARN_LEVELS = [1,3,8,14,20]`, 연출 시간들 |
| `src/domain/field/wildBattle.ts` | `retry`→`healed`(체력 회복 후 `question`) |
| `src/store/fieldData.ts` | `SpeciesEntry.skills`, `newSpeciesEntry`, `mergeEntry`, `FieldNotice`에 기술 알림 |
| `src/store/useGameStore.ts` | `finishWildBattle` 정산에서 기술 배우기·복사 판정, `replaceSkill`, 장착 목록 읽기 |
| `src/store/useSessionStore.ts` | `skillOffers` 대기열 |
| `src/field/battle/` | 보기 배정, 기술 목록 사용, 던지기 연출 시퀀스, `battleText` 글 |
| `src/field/SkillOfferDialog.tsx` (새) | 선택창 |
| `src/field/FieldDexScreen.tsx` | 장착 기술 목록 |
| `src/field/fx/effects.ts`·`src/audio/sfx.ts` | 새 효과(필요 시)·효과음 5개 |
| `src/field/debugFlags.ts` | `__GUGU_E2E_COPY__` (+ 단위 테스트 갱신) |
| `MVP_DESIGN.md`·`CLAUDE.md` | v1.42 이력 행, "어디를 고치나"에 기술·연출 행 |

## 6. 테스트 기준 (요지)

- 단위: 기술 표(종 11개 × 5개, 레벨 1·3·8·14·20, 이름 중복 없음·모든 효과 id 존재), `defaultSkills`/`newlyLearned` 경계(레벨 1→3, 2→9 한꺼번에), `rollCopy`(0.02 경계, 장착 중복 제외, 후보 없음), `throwCapsule`의 `healed`(hits 회복 수치 4단계·황금, 다시 어지러움 가능), `mergeEntry` 옛 저장·이상한 값, `partialize`/`currentSave`에 `skills`가 들어감, `replaceSkill`(없는 id·중복 거부).
- E2E: 기술 1개로 시작한 스타터가 보기 3개에 같은 기술 이름, 레벨업 시 새 기술 자동 장착(장착 3 미만), 가득 찰 때 선택창(지우고 배우기 / 배우지 않기), 복사 스위치로 선택창, 포획 실패(`healed`) 후 체력 막대가 늘고 다시 문제, 던지기 연출 단계가 순서대로 나타나는 표식(`data-` 속성)과 잡힘 시 `capsuleClick` 소리가 불림(스파이), 쓰러짐·기존 포획 흐름 회귀.
- 시각: 375px에서 선택창·던지기 연출을 직접 보고 확인, `#/dev/field`에 새 효과 버튼.

## 7. 범위 밖 / 나중

- 진화 시스템(요청: 추후), 기술 사용 효과음, 배운 기술을 상점이나 메뉴에서 다시 고르는 화면(이번엔 선택창과 도감 보기만), 기술 위력·상성 계산(문제 풀이 기반이라 지금처럼 피해는 단계 규칙).

## 8. 위험과 순서

1. **저장 형식 + 옛 저장 채우기**가 가장 위험(데이터 보호 최우선) → 먼저, Opus 구현·검토.
2. 포획 흐름(`healed`)과 정산(기술 배우기·복사)은 전투 흐름이므로 Opus.
3. 연출·효과음·선택창·도감 표시는 Sonnet.
4. 마지막에 전체 E2E·시각 확인, 이후 사용자 요청에 따라 병합·배포.

# 구구단 몬스터 탐험대 — 작업 안내

어린이용 구구단 학습 PWA. 몬스터 탐험(문제 풀이)으로 별을 모아 다마고치 펫을 키운다.
React 18 + TypeScript + Vite + Zustand, 해시 라우터(`#/` 타이틀, `#/field`, `#/field/battle`, `#/field/starter`, `#/field/dex`, `#/field/training/:dan`·`#/field/training/arith/:level` 체육관 트레이너 화면, `#/field/statue` 동상(별점수가 켜져 있어야 열림), `#/field/records` 학습 기록, `#/stairs` 무한의 계단). 마을 위쪽 체육관(실내 지도 `gym`)이 훈련 장소다. 퀴즈 모험(`#/pet` 등 탭 화면)은 `src/config/featureFlags.ts`로 꺼져 있고 `#/field`로 보낸다, GitHub Pages 정적 배포. 서버 없음 — 모든 데이터는 브라우저 localStorage.

- 라이브: https://catch-gugumon.baekbeom99.workers.dev (Cloudflare — `npm run build` 뒤 `npx wrangler deploy`, 수동). 옛 주소 https://baekbeom99-dotcom.github.io/catch-gugumon/ 는 `main` push 때 저장소 변수 `MIGRATE_TO`가 있으면 게임 대신 이사 안내(데이터 넘기기)만 보여 준다(`src/domain/migration.ts`·`src/screens/MigrateScreens.tsx`·`src/config/migration.ts`)
- 사용자는 한국어로 요청한다. 화면 글자·주석·커밋 메시지도 한국어(어린이가 읽기 쉬운 말).
- 규칙·수치의 기준은 `MVP_DESIGN.md`(설계서, 크다 — 필요한 절만 grep해서 읽기). 맨 위 변경 이력 표에 버전(v1.xx)을 한 줄씩 추가한다.

## 폴더

| 위치 | 내용 |
|---|---|
| `src/domain/` | 순수 로직(React 없음). 테스트는 여기를 대상으로. `pet.ts`(펫 상태·돌봄·똥/병·친밀도), `progress.ts`(답 기록·별·탐험 정산), `mastery.ts`·`scheduler.ts`(숙련도·출제), `arith*.ts`(셈 연습), `stairs.ts`(무한의 계단), `field/stairsItems.ts`(계단 위 아이템: 간격·종류·이어 놓기), `shop.ts`·`catalogRules.ts`(상점), `dex.ts`(도감·졸업) |
| `src/store/useGameStore.ts` | 저장되는 게임 상태와 액션(Zustand persist) |
| `src/store/saveData.ts` | `SaveData` 형식, `createInitialSave`, `mergeSave`(예전 저장 채우기), `SAVE_KEY` |
| `src/store/useSessionStore.ts` | 저장 안 되는 화면 상태(진화·레벨업 알림 대기 등) |
| `src/domain/field/training.ts`·`doorEntry.ts`·`gymTalk.ts` | 트레이닝 규칙(단 열림·문제 계획·합격 판정·12·13단 레전드 보상), 마을 문 처리(상점·체육관·계단 문 앞 칸), 체육관 NPC 말 걸기·잠김 글. 수치는 `tuning.ts`의 `TRAINING_*` |
| `src/domain/field/{clock,costumes,reverse}.ts` | 시계 읽기 트레이너(정각·5분·1분: 문제·보기·합격·열림, 수치 `CLOCK_TRAINER_*`), 꾸미기 세트 표(`COSTUME_SETS`·사기·입기, `COSTUME_PRICE`), 거꾸로 묻기(마스터한 단 문제를 나눗셈으로, `REVERSE_CHANCE`) |
| `src/field/art/{heroTint,heroCostume,bakeCache}.ts` | 주인공 017 그림 색 바꾸기: `tintHeroPixel`(머리·윗옷·바지만, 순수)·세트별 굽기·캐시·`useHeroArt`. 그림 파일이 없으면 아무것도 안 함 |
| `src/domain/field/{arithTrainer,starPoints,lowGrade,lowGradeRun}.ts` | 셈연습 트레이너(기본·고수·보수, 보상·레전드), 별점수(`starGain` 한 곳·동상 문제 계획, 수치 `STAR_*`·`STATUE_*`), 저학년 모드(필드별 덧뺄셈·틀린 문제·비밀번호 `checkLowGradePassword`, 수치 `LOWGRADE_*`)와 상점·전투 진행 |
| `src/config/featureFlags.ts` | `QUIZ_ADVENTURE_ENABLED`(퀴즈 모험 켜기, 지금 false)·`isQuizEnabled()`(E2E `__GUGU_E2E_QUIZ__` 우선)·`STAR_POINTS_ENABLED`(별점수 켜기, 지금 true)·`isStarPointsEnabled()`(E2E `__GUGU_E2E_STARS__` 우선)·`isRouteEnabled` |
| `src/field/training/` | 트레이닝·셈연습·동상 화면: `TrainingScreen`(구구단 트레이너 입구·학습/도전·결과 이동), `ArithTrainerScreen`(`#/field/training/arith/:level`), `StatueScreen`(`#/field/statue`), `StudyMode`·`ChallengeMode`(제네릭: 문제·진행기·제목을 props로), `TrainingResult`(캡슐·마스터·레전드), `QuizBoard`(문제 화면 틀), `boardQuestion`(`BoardQuestion` — 구구단·덧뺄셈·보수 공통 문제 모양), `flow`(진행 상태기계)·`runner`(`createRunner`), `trainingText`(글), `useTrainingRun`(`useRun` — 끝에서 정산 한 번)·`useRunClock`·`useTrainingFx`, `FieldRecordsScreen`(`#/field/records`), `routes`(계단 복귀) |
| `src/field/lowgrade/` | `PasswordDialog`(저학년 모드 켜고 끌 때 비밀번호 창, 관리자 `PinPad` 재사용), `LowGradeHint`(덧뺄셈 힌트) |
| `src/domain/field/` | 필드 모험 순수 로직: **`tuning`(운영 수치 전부)**, `companion`(쓰러졌을 때 대신 함께 다닐 구구몬 `healthyCompanions`·`pickReplacement`), `skills`(기술 표·슬롯 패턴·특수·복사), `fields`(필드·단 구성), `movement`, `wildBattle`, `encounter`(만남), `creatures`(종·기술 이름), `fieldQuestions`, `growth`(경험치·레벨·진화), `strength`(만남 강함 단계), `capsules`(캡슐 4종·개수), `wounds`(체력·상처), `shopQuiz`(상점 연습), `roam`(마을 구구몬 배회), `answerTimer`(문제 시계), `elements`(속성 7가지·기술 효과 표) |
| `src/field/shop/` | 마을 상점 팝업: `ShopPopup`, `CapsuleTab`(캡슐 탭), `CapsulePractice`(지역 단 중 하나를 무작위로 골라 ×1~×9 순서대로), `PotionTab`·`HealPractice`(회복 연습: 틀린 문제 중심, 없으면 그 구구몬 필드 문제), `PracticeCard`(연습 문제 카드), `shopText`(글), `shop.css` |
| `src/field/world/` | 필드 걷기 (주인공을 조작하고 동행 구구몬이 방금 떠난 칸을 따라옴): `FieldScreen`, `fieldRenderer`(캔버스, `drawField`가 주인공·동행을 그림 — 주인공은 치비 017 시트, 없으면 픽셀 `hero.ts`), `roamerLayer`(마을 구구몬·`playerPose` 시트 없는 동행의 통통·반전), `Joystick`, `FieldHud`(왼쪽 위 캡슐·도감·체력), `loadField`, `maps/`(필드마다 지도·타일 그림; `gym.ts`는 체육관 실내 지도·`GYM_NPCS`·동상) |
| `src/field/battle/` | 야생 전투 (포켓몬 3세대 배치: 적 정보 상자 왼쪽 위·적 오른쪽 위 앞모습, 내 구구몬 왼쪽 아래 뒷모습·내 정보 상자 오른쪽 아래 — 체력 숫자·EXP 막대, 잔디 타원 받침. 자리·크기는 `battleLayout`(무대 비율)): `WildBattleScreen`, `useQuestionFeed`(문제 받기), `BattleBars`(`HpBar`·`TimerBar` — 눈금·구간 색만, 글자 없음), `battleText`(화면 글), `SkillPicker`(기술 버튼 3개 한 줄·이름만, 특수만 설명 한 줄), `skillUse`(발동·글·`gaugeStops`/`gaugeZones`·`skillLines`/`buttonLines` 버튼 문구 — 선택창·관리 화면 카드도 같은 함수) |
| `src/field/art/` | 그림: `creatureArt`(구구몬 그림 등록표, `artSheets`·`artBox`), `creatureSprite`(DOM 그림: 시트 행 재생·전투 공격 한 번 재생), `companionImage`(캔버스용 `companionSheet`·`sheetFrame`), `spriteSheet`(치비 시트 순수 함수: **4열 프레임 × 4행 방향 — 행 0 아래(앞)·1 위(뒤)·2 오른쪽·3 왼쪽**, `BATTLE_ROW` 내 구구몬=행1 뒷모습·야생=행0 앞모습, `cellBox` 몸 높이 맞춤 기준 `BODY_H_TARGET`·`BODY_W_MAX`), `localSprites`(이 PC 전용 치비 그림 등록: **종 `cNNN` = 그림 번호 `NNN`**(번호표 없음), **주인공 = `017`**(`HERO_ART`, 종이 아님), 필드 자리 크기 `CHIBI_FIELD_FILL`), `hero`(그림이 없을 때 픽셀 주인공), `npcTint`·`npcSprite`(체육관 NPC 013 그림의 몸 색·머리색 — 마스터하면 머리 노랑), `shadow`(마을 건물 그림자), `PixelSprite`, `SpriteCredit`(그림이 있을 때만 출처 표기), `pixelArt`(픽셀 그림 틀·표지판), `CapsuleBall` |
| `src/field/fx/` | 효과: `effects`(효과 목록), `playFx`(틀기) |
| `src/field/` | 기술 화면: `SkillOfferDialog`(기술 선택창: 새 기술 + 그 자리 기술 하나), `SkillManager`(도감 기술 관리: 주속성 사슬·부속성 자리·특수 자리 세 구역), `SkillCard`, `skillText`(기술 글) |
| `src/field/` | 그 밖: `StarterScreen`, `FieldDexScreen`, `useFieldSession`(저장 안 되는 만남 상태), `debugFlags`(디버그 스위치), `DevFieldGallery`(#/dev/field) |
| `src/store/fieldData.ts` | 필드 모험 저장 데이터(`SaveData.field`) 형식·기본값·병합 |
| `src/screens/` | 화면. `TitleScreen.tsx`(타이틀 `#/`: `src/assets/title/` 그림 두 장을 비율대로 덮고 가운데 「시작하기」→`#/field`, 오른쪽 위 저학년 모드). Pet·Explore·Shop·Records·Dex(탭), Battle·Practice·Stairs(전체 화면), `admin/`(관리자, PIN) |
| `src/art/` | 펫·몬스터·모자 SVG 그림 |
| `src/data/defaultCatalog.ts` | 상점 기본 아이템 |
| `src/components/FullscreenButton.tsx`·`src/lib/fullscreen.ts` | 전체 화면 아이콘 버튼(타이틀 왼쪽 위·필드 메뉴 아래, 지원 안 하면 안 그림)과 그 도우미(`toggleFullscreen`·`useFullscreen`) |
| `src/pwa/autoUpdate.ts` | 서비스 워커 등록, 새 버전 확인(탭 복귀·30분), 문제 푸는 화면이 아닐 때 자동 새로고침 |
| `tests/` | Vitest 단위 테스트 |
| `e2e/` | Playwright. `helpers.ts`(`seedHatchedPet`, `playExploration`, `closeEvolutionIfShown`…), `fixtures.ts`(무작위 똥·병 끔) |

## 저장 데이터 — 바꿀 때 꼭

- 키: `catch-gugumon:save` (공유 코드 `catch-gugumon/shop`, 백업 `catch-gugumon/backup`). 로컬 데이터를 잃지 않는 것이 최우선.
- 원본 앱(`gugu-monster` 저장소, …github.io/gugu-monster/)과 같은 github.io 아래라 localStorage를 함께 쓴다 → 키를 원본(`gugu-monster:save`)과 다르게 둔다. 예전 키 기록은 `adoptLegacySave`가 처음 한 번 복사해 오고, 예전 형식 공유 코드·백업도 불러온다(v1.74).
- `SaveData`에 필드를 추가하면 함께 고친다(네 곳, `field` 같은 중첩 데이터도 `mergeSave`에서 깊게 채우기): `createInitialSave` 기본값, `mergeSave`(예전 저장에 기본값 채우기), `useGameStore`의 `partialize` 목록, 그리고 `admin/DataSecurityPanels.tsx`의 `currentSave()`(백업).
- 펫 친밀도·XP가 바뀌는 액션은 `settlePet(before, after, now)`로 진화·레벨업을 잡고, 화면이 결과의 `evolvedTo`·`levelUp`을 `useSessionStore`에 넘긴다.
- 같은 github.io 아래에 다른 버전을 배포하면 localStorage가 공유되므로 키를 바꿔야 한다.

## 명령

```bash
npx tsc --noEmit -p .        # 타입 검사
npx vitest run               # 단위 테스트
E2E_PORT=5181 npx playwright test   # E2E (다른 앱이 5181 등을 쓰면 5191 같은 빈 포트)
npm run build                # 배포용 빌드 (tsc -b && vite build)
```

- E2E 스위치(`window`에 설정): `__GUGU_E2E_CALM__`(똥·병 끔), `__GUGU_E2E_FIELD__`(필드 만남·캡슐 100%), `__GUGU_E2E_PATH__`(길 걸음도 만남 100%), `__GUGU_E2E_NO_WILD__`(강제 안 한 야생 만남 끔, e2e 기본), `__GUGU_E2E_NO_TIMER__`(전투 문제 시간 멈춤), `__GUGU_E2E_TIER__`(야생 강함 단계 고정, `'weak'`·`'normal'`·`'strong'`·`'mighty'`), `__GUGU_E2E_LEGEND__`(만남이 레전드), `__GUGU_E2E_QUESTION__`(전투 문제 고정), `__GUGU_E2E_FAST__`(true면 항상 빠르게=모든 조건 시간 충족, false면 항상 미충족), `__GUGU_E2E_COPY__`(true 복사 100%, false 복사 안 함, 없으면 2%; `e2e/fixtures.ts`가 기본 false), `__GUGU_E2E_THROW__`(`'caught'`·`'healed'`·`'escaped'`·`'angry'`로 던지기 결과 고정), `__GUGU_E2E_COMBAT__`(`{ crit, dodge, effect }`를 true·false로 전투 굴림 고정, `fixtures.ts` 기본은 크리티컬·회피 없음·효과 성공), `__GUGU_E2E_REVERSE__`(true면 마스터한 단의 거꾸로(나눗셈) 묻기 100%, false면 0%, 없으면 `REVERSE_CHANCE`; `e2e/fixtures.ts` 기본 false), `__GUGU_E2E_STARS__`(별점수 켜기·끄기 — 배포는 켜짐이라 `e2e/fixtures.ts`가 기본 false로 끄고, 별을 보는 스펙만 true), `__GUGU_E2E_QUIZ__`(true면 퀴즈 모험·타이틀 버튼을 켬. 없으면 꺼짐 — 퀴즈 화면을 보는 스펙은 `helpers.enableQuiz(page)`를 `beforeEach`에서). 트레이닝 도전 시계는 `__GUGU_E2E_NO_TIMER__`로 멈춘다. 필드 스위치는 `src/field/debugFlags.ts` 한 곳에서 읽는다.
- E2E 하나가 가끔 시간 문제로 실패할 수 있다(`dex.spec` 놀이 장면). 따로 다시 돌려 확인. 파이프로 줄일 때는 `set -o pipefail`로 실패를 놓치지 않기.
- Windows Git Bash에서 `BASE_PATH=/catch-gugumon/`처럼 `/`로 시작하는 값은 경로로 바뀐다 → 로컬 빌드 확인 때 `MSYS_NO_PATHCONV=1`.

## 배포

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해 Pages에 올린다. 경로는 저장소 이름으로 정해진다(`BASE_PATH: /<repo>/`).

1. 타입 검사·단위 테스트·E2E·빌드 통과
2. `git add -A && git commit` — 메시지는 한국어 한 줄 요약, 끝에 `Co-Authored-By` 줄
3. `git push origin main`
4. `gh run list --json databaseId,headSha`로 이번 커밋의 run을 찾아 `gh run watch <id> --exit-status`
5. 라이브 확인: 서비스 워커 캐시 때문에 `index.html?v=<시각>`을 받아 새 `assets/index-*.js` 이름과 바뀐 글자를 확인

사용자가 "바로 배포"라고 하면 확인 질문 없이 위 순서로 끝까지 한다. `backup` 같은 임시 폴더는 커밋하지 않는다.

## 작업 습관

- 저작권: 저장소 루트 `LICENSE`(모든 권리 보유)·`NOTICE.md`(제3자·캐릭터 그림 안내)가 기준이다. 표시 문구는 `src/config/copyright.ts` 한 곳, 타이틀·관리자 화면과 빌드 머리 주석이 같이 쓴다. 새 그림·코드를 가져올 때는 NOTICE.md에 출처를 적는다.
- 여러 줄 Python 패치는 bash heredoc보다 스크래치 폴더에 파일로 써서 실행하는 편이 따옴표 문제가 없다.
- 화면이 바뀌는 수정은 브라우저(개발 서버 `npx vite --port 5181`)에서 직접 보고 확인한다. 휴대폰 폭(375px) 기준.
- 관련 수치는 상수로 두고(`STAIRS_*`, `EXPLORATION_AFFECTION` 등) 테스트에서 값을 고정해 둔다.

## 필드 모험 — 어디를 고치나

| 바꿀 것 | 고칠 곳 | 함께 할 일 |
|---|---|---|
| 확률·강함 단계·문제 시간·캡슐·경험치·연출 시간 | `src/domain/field/tuning.ts` 한 곳 | `tests/field/tuning.test.ts` 고정값, `MVP_DESIGN.md` 이력 |
| 필드별 단·나오는 종 | `src/domain/field/fields.ts` | 설계서 4-6 |
| 종 이름 | `src/domain/monsterNames.ts` (기술 이름은 아래 `skills.ts` 행) | — |
| 체육관 NPC·트레이너 단 목록 | `src/field/world/maps/gym.ts`의 `GYM_NPCS`(자리·단·색)와 `tuning.ts`의 `TRAINING_DANS` | `tests/field/gymMap.test.ts`, `e2e/gym.spec.ts` |
| 꾸미기 세트(색·가격·이름) | `src/domain/field/costumes.ts`의 `COSTUME_SETS`(id는 한 번 정하면 안 바꿈 — 저장에 남음), 값 `COSTUME_PRICE` | `tests/field/costumes.test.ts`(상표 글자·색 구별), `heroTint` 그림은 `#/dev/field`에서 확인 |
| 시계 읽기(문제·제한 시간·NPC 자리) | `src/domain/field/clock.ts`·`tuning.ts`의 `CLOCK_TRAINER_*`, NPC는 `maps/gym.ts`의 `GYM_NPCS`(`kind: 'clock'`) | `tests/field/clock*.test.ts`, `gymMap.test.ts`, `e2e/clock.spec.ts` |
| 거꾸로 묻기 확률 | `tuning.ts`의 `REVERSE_CHANCE` (규칙 `reverse.ts`) | `tests/field/reverse*.test.ts` |
| 훈련 보상·마스터 제한 시간·계단 열림 조건 | `tuning.ts`의 `TRAINING_*`(`TRAINING_MASTER_MS`·`TRAINING_FIRST_MASTER_CAPSULES`·`STAIRS_OPEN_AFTER_DAN`…)·`ARITH_TRAINER_*` | `tests/field/tuning.test.ts`, `e2e/training.spec.ts`·`arith.spec.ts`, `MVP_DESIGN.md` 이력 |
| 계단 아이템(간격·황금 확률·별 개수·별 비율) | `tuning.ts`의 `STAIRS_ITEM_*` (규칙 `src/domain/field/stairsItems.ts`) | `tests/field/stairsItems.test.ts`·`tuning.test.ts`, `e2e/stairs-items.spec.ts`, `MVP_DESIGN.md` 이력 |
| 레전드 보상 별점수 | `tuning.ts`의 `STAR_LEGEND_REWARD` | `tests/field/legendStars.test.ts`·`tuning.test.ts` |
| 저학년 전투 문제 시간 배수 | `tuning.ts`의 `LOWGRADE_TIME_FACTOR` (`questionBaseMs`) | `tests/field/wildBattle.test.ts`·`tuning.test.ts` |
| 별점수(적립량·동상 문제 수)·켜기 | `tuning.ts`의 `STAR_*`·`STATUE_*`, `featureFlags.ts`의 `STAR_POINTS_ENABLED` (켜져 있음 — 필드 HUD에 별 개수 `hud-stars`, 끄면 적립·화면 없음·동상은 장식) | `tests/field/starPoints.test.ts` |
| 저학년 모드(문제·시간·비밀번호) | `tuning.ts`의 `LOWGRADE_*`, `src/domain/field/lowGrade.ts` | `tests/field/lowGrade*.test.ts`, `e2e/lowgrade.spec.ts` |
| 건물 그림자 | `src/field/art/shadow.ts`의 `BUILDING_SHADOW`(밀림·진하기) | `tests/field/townShadow.test.ts` |
| NPC 색·머리색(013 그림) | `src/field/art/npcTint.ts`·`npcSprite.ts` — **`c013`은 종이 아니라 NPC 그림 전용**(종 48·레전드 11, 옛 저장의 c013은 c046으로 옮김) | `tests/field/npcTint.test.ts` |
| 상점 글 | `src/field/shop/shopText.ts` | E2E가 글을 찾으면 `e2e/field.spec.ts`도 |
| 캡슐·단 연습 수치 | `src/domain/field/tuning.ts` | `tests/field/tuning.test.ts` |
| 기술(슬롯 패턴 위력·조건 시간·배우는 레벨·이름·종별 특수·주② 효과 M2) | `src/domain/field/skills.ts`의 `SLOT_PATTERN`·`SKILL_NAMES`·`SPECIAL_OF_SPECIES`·`M2_EFFECT_OF_SPECIES` | `tests/field/skillsTable.test.ts` 고정표 |
| 종의 주·부속성·상성표 | `src/domain/field/elements.ts`의 `MAIN_ELEMENT`·`SUB_ELEMENT`·상성표 | 49쌍 테스트(`tests/field/elements.test.ts`) |
| 기술 확률·칸·회복·복사·연출 시간 | `src/domain/field/tuning.ts` | `tests/field/tuning.test.ts` |
| 기술 효과음 | `src/audio/sfx.ts`의 `SKILL_SFX`·`SPECIAL_SFX` | — |
| 속성·기술 효과 | `src/field/fx/effects.ts`(효과 옵션·`center`: 그린 화소의 무게중심, 잴 때는 `tests/field/fxMeasure.ts`; 글자 든 효과는 `noMirror`)와 `src/domain/field/elements.ts`의 `ELEMENT_FX`(평소 4칸: 주①②③+부 — 개정 3에서 실제 쓰이는 칸)·`SPECIAL_FX`(특수 효과, 스턴 포함)·`STRONG_FX`(강력 4칸, 보관만 하고 쓰지 않음) | `#/dev/field`에서 속성별 버튼으로 확인, 효과 시간 ≤ 0.6초(`tests/field/elements.test.ts`) |
| 전투 화면 글 | `src/field/battle/battleText.ts` | E2E가 글을 찾으면 `e2e/field.spec.ts`도 |
| 구구몬 그림 교체 | 파일을 `src/field/art/creatures/`에 넣고 `src/field/art/creatureArt.ts`의 `IMAGE_ART`에 한 줄 | `#/dev/field`에서 앞·뒤·동행 크기 확인 (퀴즈 모험 몬스터 그림은 그대로) |
| 치비 그림·시트(가만히·걷기·공격) | `python scripts/cut-chibi.py [번호...]`(없으면 001~050, 017 주인공 포함)가 원본(`C:\Antigravity\sprite\sprites\<번호>\idle·walk·attack.png`, 4열×4행, `CHIBI_SRC`로 바꿈)에서 `src/field/art/creatures/chibi/<번호>-front·back·idle·walk·attack.png`+`manifest.json`(`cw·ch`·프레임 ms·`bodyH·bodyW`)을 만든다 (.gitignore — 저장소·배포에 넣지 않음, 없으면 구구몬은 SVG·주인공은 픽셀). 종 `cNNN`은 번호 `NNN`을 저절로 쓴다 | `#/dev/field`에서 주인공 4방향, 종마다 가만히·걷기 4방향·전투 공격(뒤·앞), 크기 비교 확인. 그림 없는 상태는 `tests/field/creatureArt.test.ts`(빈 파일 표)가 고정 |
| 쓰러짐 뒤 대신 다닐 구구몬 | `src/domain/field/companion.ts`(`healthyCompanions`·`pickReplacement`), 저장은 `useGameStore.damageCompanion`(같은 저장에서 동행 바꿈·마을로), 알림 글은 `battleText.replacedField` | `tests/field/companionPick.test.ts`, `tests/field/fieldStore.test.ts` |
| 지도·타일(체육관 실내 `gym.ts`·`gymTiles.ts`·동상 자리 포함) | `src/field/world/maps/<필드>.ts`·`<필드>Tiles.ts` | `tests/field/maps.test.ts` |
| 효과 추가 | `src/field/fx/effects.ts`의 `EFFECTS`에 한 줄 → 틀 곳에서 `playFx(canvas, '이름', 자리)` | `#/dev/field`에서 버튼으로 확인, 이름 목록 테스트(`pixelArt.test.ts`) |

- **날아가는 효과:** `FxSpec`의 `motion: 'travel'`(+`travelMs`·`orb` 구슬 색)이면 `playFx(..., { from })`가 쏘는 구구몬에서 맞는 구구몬까지 구슬을 날린 뒤 도착 지점에서 터뜨린다(이동 + 터짐 ≤ 0.6초, 효과음·흔들림은 `moveFxRoute`의 `arriveMs`만큼 늦춤). 바닥에서 솟는 효과·특수 기술은 `burst` 그대로. **줄기 효과:** `motion: 'beam'`(+`beam: { reach, axisY }`)은 물줄기·번개줄기·불 뿜기(`water-jet`·`chain-lightning`·`fire-breath`·`flamethrower`)처럼 입에서 뻗는 효과 — `fx/beam.ts`가 효과를 따로 그린 뒤 쏘는 구구몬 입에서 맞는 구구몬 쪽으로 돌려(적 공격은 가로로 뒤집어) 붙이고 맞는 구구몬 한가운데에서 자른다. `travelMs`는 줄기 끝이 닿는 시간(효과음·피해 글 지연), `until ÷ speed`와 합쳐 ≤ 0.6초. `from`이 없으면 예전처럼 `at`에서 바로 재생.
- **디버그:** 개발 서버(`npx vite --port 5188` 등)에서 `#/dev/field` — 구구몬 그림 전부(앞·뒷모습·동행 한 칸·치비 시트), 주인공(017 치비 또는 픽셀) 네 방향, 캡슐, 효과 버튼, 만남 100%·레전드 스위치. 배포 빌드에는 없다.
- `companionImage`는 React를 따로 그려 굽는다: React가 그리는 중(컴포넌트 본문·useEffect)에 부르면 null. rAF·setTimeout 안에서 부른다.

## 모델 분배

**지휘자는 Sonnet** (`.claude/settings.json`의 `"model": "sonnet"`). 다른 모델은 에이전트(`.claude/agents/`)로 불러 쓴다.

| 에이전트 | 모델 | 맡길 일 |
|---|---|---|
| `opus-expert` | Opus | 새 규칙·새 시스템의 설계와 계획, 저장 데이터(`SaveData`·`mergeSave`·백업)를 건드리는 구현, 전투 흐름(타이머·단계 전환·도망 판정) 수정, 지휘자가 두 번 고치지 못한 버그 |
| `opus-reviewer` | Opus (읽기만) | 큰 기능을 마친 뒤 전체 검토, 저장 데이터·전투 흐름이 바뀐 변경 검토 |
| `haiku-worker` | Haiku | 파일·값이 정확히 정해진 수정(`tuning.ts` 값, `battleText` 문구, 등록표 한 줄), 픽셀 그림 줄 맞추기, 테스트·빌드 돌려 요약 |
| (일반 에이전트, `model: sonnet`) | Sonnet | 지휘자가 나눠 맡기는 보통 구현·작업마다의 검토 (검토자는 Sonnet보다 아래로 내리지 않는다) |

- 지휘자가 직접 하는 일: 운영 수치 조정, 그림 교체, 효과 추가, 화면 한두 개 고치기, 배포. 필드 모험은 위 "어디를 고치나" 표대로 한 곳만 고치고 `#/dev/field`·375px에서 확인한다.
- 저장 데이터나 전투 흐름에 손이 가면 지휘자가 직접 고치지 말고 `opus-expert`에 맡기고, 끝나면 `opus-reviewer`로 검토한다.
- 일반 에이전트를 부를 때는 `model`을 꼭 적는다(안 적으면 지휘자 모델을 그대로 씀). 에이전트에게는 할 일·파일·확인 방법만 짧게 넘기고, 에이전트는 다른 에이전트를 부르지 않는다.
- push·merge·배포는 지휘자만 한다.

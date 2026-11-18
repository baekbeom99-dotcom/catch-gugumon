/** 트레이닝센터 화면 글 — 어린이가 읽기 쉬운 말. 순수 함수 */
import type { TrainingOutcome } from '../../store/useGameStore';
import type { FlowMode, FlowResult } from './flow';

export interface ResultText {
  title: string;
  lines: string[];
  /** lines 중 '새 기록!' 줄의 번호 (없으면 null) — 결과 화면이 그 줄을 눈에 띄게 그린다 */
  newBestIndex: number | null;
}

export const trainingText = {
  /** 입구 간판 */
  title: (dan: number) => `${dan}단 트레이닝센터`,
  studyButton: '차례대로 학습',
  studyHint: '×1부터 ×9까지 차례로 풀어요',
  challengeButton: '마스터 도전',
  challengeHint: '9문제를 모두 맞혀요',
  lockedHint: '학습을 먼저 마쳐요',
  recordsButton: '내 기록 보기',
  backToTown: '마을로',
  again: '다시 하기',
  quit: '그만하기',
  /** 틀렸을 때 (같은 문제를 다시 푼다) */
  tryAgain: '아깝다! 다시 해 봐요',
  showAnswer: (answer: number) => `정답은 ${answer}이에요. 눌러 봐요!`,
  good: '맞았어요!',
  missEnd: '앗, 틀렸어요!',
  /** 위쪽 진행 글 */
  progress: (done: number, total: number) => `${done}/${total}`,
  studyRule: '천천히 풀어도 돼요',
  challengeRule: (seconds: number) => `틀리면 끝! ${seconds}초 안에 9문제`,
  seconds: (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}초`,
  capsuleGain: (n: number) => `캡슐 ${n}개 얻었어요`,
  /** 처음 마스터했을 때의 캡슐 글 */
  firstMasterGain: (n: number) => `처음 마스터 선물! 캡슐 ${n}개 얻었어요`,
  legendLine: (name: string, duplicate: boolean) =>
    duplicate ? `또 만났어요, ${name}! 더 튼튼해졌어요` : `새 친구 ${name}! 함께하게 됐어요`,

  /** 결과 화면 글: 제목과 줄들. timeMs는 도전 합격 때 걸린 시간 */
  result(dan: number, mode: FlowMode, result: FlowResult, outcome: TrainingOutcome, timeMs?: number): ResultText {
    const lines: string[] = [];
    let title: string;
    let newBestIndex: number | null = null;
    if (mode === 'study') {
      title = `${dan}단 학습 끝!`;
      lines.push('끝까지 해냈어요!', '이제 마스터 도전을 할 수 있어요');
    } else if (result === 'pass') {
      title = `${dan}단 마스터!`;
      lines.push('지붕에 숫자가 켜졌어요');
      if (timeMs !== undefined) lines.push(`걸린 시간 ${trainingText.seconds(timeMs)}`);
      if (outcome.newBest) {
        newBestIndex = lines.length;
        lines.push('새 기록!');
      }
    } else if (result === 'wrong') {
      title = `${dan}단 아쉬워요`;
      lines.push('틀리면 끝이에요. 다시 도전해 봐요!');
    } else {
      title = `${dan}단 시간이 다 됐어요`;
      lines.push('조금만 더 빨리! 다시 도전해 봐요!');
    }
    // 캡슐은 성공했을 때만 (도전 실패는 capsules 0이라 글이 없다)
    if (outcome.ok && outcome.capsules > 0)
      lines.push(outcome.firstMaster ? trainingText.firstMasterGain(outcome.capsules) : trainingText.capsuleGain(outcome.capsules));
    return { title, lines, newBestIndex };
  },
} as const;

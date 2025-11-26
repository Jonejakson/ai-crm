const CLOSED_WON_EXACT = [
  'closed_won',
  'закрыто и реализованное',
  'закрыто и реализовано',
  'закрыта (успех)',
  'закрыто успешно',
];

const CLOSED_LOST_EXACT = [
  'closed_lost',
  'закрыто пропала потребность',
  'закрыто проиграно',
  'закрыто не реализовано',
  'закрыта (провал)',
  'закрыто проигрыш',
];

const CLOSED_WON_KEYWORDS = [
  ['закрыт', 'реализ'],
  ['закрыт', 'усп'],
];

const CLOSED_LOST_KEYWORDS = [
  ['закрыт', 'пропал'],
  ['закрыт', 'потреб'],
  ['закрыт', 'проиг'],
  ['закрыт', 'не реал'],
];

const normalizeStage = (stage?: string | null) =>
  (stage || '')
    .toString()
    .trim()
    .toLowerCase();

const matchesKeywords = (value: string, keywords: string[][]) =>
  keywords.some((set) => set.every((keyword) => value.includes(keyword)));

const matchesExact = (value: string, options: string[]) =>
  options.some((option) => value === option);

export type StageCategory = 'closed_won' | 'closed_lost' | 'open';

export const getStageCategory = (stage?: string | null): StageCategory => {
  const normalized = normalizeStage(stage);
  if (!normalized) {
    return 'open';
  }

  if (
    matchesExact(normalized, CLOSED_WON_EXACT) ||
    matchesKeywords(normalized, CLOSED_WON_KEYWORDS)
  ) {
    return 'closed_won';
  }

  if (
    matchesExact(normalized, CLOSED_LOST_EXACT) ||
    matchesKeywords(normalized, CLOSED_LOST_KEYWORDS)
  ) {
    return 'closed_lost';
  }

  return 'open';
};

export const isClosedWonStage = (stage?: string | null) =>
  getStageCategory(stage) === 'closed_won';

export const isClosedLostStage = (stage?: string | null) =>
  getStageCategory(stage) === 'closed_lost';

export const isClosedStage = (stage?: string | null) =>
  getStageCategory(stage) !== 'open';


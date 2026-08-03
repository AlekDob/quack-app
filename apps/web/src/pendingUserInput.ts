// FILE: pendingUserInput.ts
// Purpose: Normalize draft answers and progress for pending user input prompts.
// Layer: Web chat state utility
// Exports: Draft answer helpers and progress derivation used by ChatView/composer panels.

import type { ProviderUserInputAnswers, UserInputQuestion } from "@synara/contracts";

export const PENDING_USER_INPUT_OTHER_OPTION_LABEL = "Other";
export const PENDING_USER_INPUT_OTHER_OPTION_DESCRIPTION = "Type your own answer";

const OTHER_OPTION_LABEL_PATTERN = /^(other|altro|something else)$/i;

export interface PendingUserInputDraftAnswer {
  selectedOptionLabels?: string[];
  customAnswer?: string;
  /** True when the user chose the synthetic Other option (may still be empty). */
  preferCustomAnswer?: boolean;
}

export interface PendingUserInputProgress {
  questionIndex: number;
  activeQuestion: UserInputQuestion | null;
  activeDraft: PendingUserInputDraftAnswer | undefined;
  selectedOptionLabels: string[];
  customAnswer: string;
  resolvedAnswer: string | string[] | null;
  usingCustomAnswer: boolean;
  answeredQuestionCount: number;
  isLastQuestion: boolean;
  isComplete: boolean;
  canAdvance: boolean;
}

export function questionProvidesOtherOption(question: Pick<UserInputQuestion, "options">): boolean {
  return question.options.some((option) => OTHER_OPTION_LABEL_PATTERN.test(option.label.trim()));
}

function normalizeDraftAnswer(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Normalize option selections so UI and submit logic can share one canonical list.
function normalizeSelectedOptionLabels(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
}

export function resolvePendingUserInputAnswer(
  question: UserInputQuestion,
  draft: PendingUserInputDraftAnswer | undefined,
): string | string[] | null {
  const customAnswer = normalizeDraftAnswer(draft?.customAnswer);
  if (customAnswer) {
    return customAnswer;
  }

  // Other selected with an empty composer is intentionally unanswered.
  if (draft?.preferCustomAnswer) {
    return null;
  }

  const selectedOptionLabels = normalizeSelectedOptionLabels(draft?.selectedOptionLabels);
  if (question.multiSelect) {
    return selectedOptionLabels.length > 0 ? selectedOptionLabels : null;
  }

  return selectedOptionLabels[0] ?? null;
}

export function setPendingUserInputCustomAnswer(
  draft: PendingUserInputDraftAnswer | undefined,
  customAnswer: string,
): PendingUserInputDraftAnswer {
  const prefersCustom = customAnswer.trim().length > 0 || Boolean(draft?.preferCustomAnswer);
  const selectedOptionLabels = prefersCustom
    ? undefined
    : normalizeSelectedOptionLabels(draft?.selectedOptionLabels);

  return {
    customAnswer,
    ...(prefersCustom ? { preferCustomAnswer: true } : {}),
    ...(selectedOptionLabels && selectedOptionLabels.length > 0 ? { selectedOptionLabels } : {}),
  };
}

export function selectPendingUserInputOtherAnswer(
  draft: PendingUserInputDraftAnswer | undefined,
): PendingUserInputDraftAnswer {
  return {
    preferCustomAnswer: true,
    customAnswer: draft?.customAnswer ?? "",
  };
}

// Toggle selections in-place so multi-select prompts can keep the same draft state shape.
export function togglePendingUserInputOptionSelection(
  question: UserInputQuestion,
  draft: PendingUserInputDraftAnswer | undefined,
  optionLabel: string,
): PendingUserInputDraftAnswer {
  if (question.multiSelect) {
    const selectedOptionLabels = normalizeSelectedOptionLabels(draft?.selectedOptionLabels);
    const nextSelectedOptionLabels = selectedOptionLabels.includes(optionLabel)
      ? selectedOptionLabels.filter((label) => label !== optionLabel)
      : [...selectedOptionLabels, optionLabel];

    return {
      customAnswer: "",
      ...(nextSelectedOptionLabels.length > 0
        ? { selectedOptionLabels: nextSelectedOptionLabels }
        : {}),
    };
  }

  return {
    customAnswer: "",
    selectedOptionLabels: [optionLabel],
  };
}

export function buildPendingUserInputAnswers(
  questions: ReadonlyArray<UserInputQuestion>,
  draftAnswers: Record<string, PendingUserInputDraftAnswer>,
): Record<string, string | string[]> | null {
  const answers: Record<string, string | string[]> = {};

  for (const question of questions) {
    const answer = resolvePendingUserInputAnswer(question, draftAnswers[question.id]);
    if (!answer) {
      return null;
    }
    answers[question.id] = answer;
  }

  return answers;
}

export function hasCompletePendingUserInputAnswers(answers: ProviderUserInputAnswers): boolean {
  const entries = Object.entries(answers);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([, answer]) => {
    if (typeof answer === "string") {
      return answer.trim().length > 0;
    }

    if (Array.isArray(answer)) {
      return answer.some((entry) => typeof entry === "string" && entry.trim().length > 0);
    }

    return false;
  });
}

export function omitNullPendingUserInputAnswers(
  answers: ProviderUserInputAnswers,
): ProviderUserInputAnswers {
  return Object.fromEntries(
    Object.entries(answers).filter(([, answer]) => answer !== null && answer !== undefined),
  );
}

export function countAnsweredPendingUserInputQuestions(
  questions: ReadonlyArray<UserInputQuestion>,
  draftAnswers: Record<string, PendingUserInputDraftAnswer>,
): number {
  return questions.reduce((count, question) => {
    return resolvePendingUserInputAnswer(question, draftAnswers[question.id]) ? count + 1 : count;
  }, 0);
}

export function findFirstUnansweredPendingUserInputQuestionIndex(
  questions: ReadonlyArray<UserInputQuestion>,
  draftAnswers: Record<string, PendingUserInputDraftAnswer>,
): number {
  const unansweredIndex = questions.findIndex(
    (question) => !resolvePendingUserInputAnswer(question, draftAnswers[question.id]),
  );

  return unansweredIndex === -1 ? Math.max(questions.length - 1, 0) : unansweredIndex;
}

export function derivePendingUserInputProgress(
  questions: ReadonlyArray<UserInputQuestion>,
  draftAnswers: Record<string, PendingUserInputDraftAnswer>,
  questionIndex: number,
): PendingUserInputProgress {
  const normalizedQuestionIndex =
    questions.length === 0 ? 0 : Math.max(0, Math.min(questionIndex, questions.length - 1));
  const activeQuestion = questions[normalizedQuestionIndex] ?? null;
  const activeDraft = activeQuestion ? draftAnswers[activeQuestion.id] : undefined;
  const resolvedAnswer = activeQuestion
    ? resolvePendingUserInputAnswer(activeQuestion, activeDraft)
    : null;
  const customAnswer = activeDraft?.customAnswer ?? "";
  const answeredQuestionCount = countAnsweredPendingUserInputQuestions(questions, draftAnswers);
  const isLastQuestion =
    questions.length === 0 ? true : normalizedQuestionIndex >= questions.length - 1;

  return {
    questionIndex: normalizedQuestionIndex,
    activeQuestion,
    activeDraft,
    selectedOptionLabels: normalizeSelectedOptionLabels(activeDraft?.selectedOptionLabels),
    customAnswer,
    resolvedAnswer,
    usingCustomAnswer: Boolean(activeDraft?.preferCustomAnswer) || customAnswer.trim().length > 0,
    answeredQuestionCount,
    isLastQuestion,
    isComplete: buildPendingUserInputAnswers(questions, draftAnswers) !== null,
    canAdvance: Boolean(resolvedAnswer),
  };
}

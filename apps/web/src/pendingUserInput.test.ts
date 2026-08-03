import { describe, expect, it } from "vitest";

import {
  buildPendingUserInputAnswers,
  countAnsweredPendingUserInputQuestions,
  derivePendingUserInputProgress,
  findFirstUnansweredPendingUserInputQuestionIndex,
  hasCompletePendingUserInputAnswers,
  questionProvidesOtherOption,
  resolvePendingUserInputAnswer,
  selectPendingUserInputOtherAnswer,
  setPendingUserInputCustomAnswer,
  togglePendingUserInputOptionSelection,
} from "./pendingUserInput";

describe("resolvePendingUserInputAnswer", () => {
  it("prefers a custom answer over a selected option", () => {
    expect(
      resolvePendingUserInputAnswer(
        {
          id: "compat",
          header: "Compat",
          question: "How strict should compatibility be?",
          options: [],
        },
        {
          selectedOptionLabels: ["Keep current envelope"],
          customAnswer: "Keep the existing envelope for one release",
        },
      ),
    ).toBe("Keep the existing envelope for one release");
  });

  it("falls back to the selected option", () => {
    expect(
      resolvePendingUserInputAnswer(
        {
          id: "scope",
          header: "Scope",
          question: "What should the plan target first?",
          options: [],
        },
        {
          selectedOptionLabels: ["Scaffold only"],
        },
      ),
    ).toBe("Scaffold only");
  });

  it("treats Other with an empty custom answer as unanswered", () => {
    expect(
      resolvePendingUserInputAnswer(
        {
          id: "scope",
          header: "Scope",
          question: "What should the plan target first?",
          options: [],
        },
        selectPendingUserInputOtherAnswer({
          selectedOptionLabels: ["Scaffold only"],
        }),
      ),
    ).toBeNull();
  });

  it("clears the preset selection when a custom answer is entered", () => {
    expect(
      setPendingUserInputCustomAnswer(
        {
          selectedOptionLabels: ["Preserve existing tags"],
        },
        "doesn't matter",
      ),
    ).toEqual({
      preferCustomAnswer: true,
      customAnswer: "doesn't matter",
    });
  });

  it("keeps Other selected while the custom answer is still empty", () => {
    expect(
      setPendingUserInputCustomAnswer(selectPendingUserInputOtherAnswer(undefined), ""),
    ).toEqual({
      preferCustomAnswer: true,
      customAnswer: "",
    });
  });

  it("returns all selected options for multi-select questions", () => {
    expect(
      resolvePendingUserInputAnswer(
        {
          id: "targets",
          header: "Targets",
          question: "Which outputs should we ship?",
          multiSelect: true,
          options: [],
        },
        {
          selectedOptionLabels: ["CLI", "Desktop"],
        },
      ),
    ).toEqual(["CLI", "Desktop"]);
  });
});

describe("questionProvidesOtherOption", () => {
  it("detects existing Other-like options case-insensitively", () => {
    expect(
      questionProvidesOtherOption({
        options: [{ label: "Altro", description: "Scrivi tu" }],
      }),
    ).toBe(true);
    expect(
      questionProvidesOtherOption({
        options: [{ label: "Keep going", description: "Continue" }],
      }),
    ).toBe(false);
  });
});

describe("selectPendingUserInputOtherAnswer", () => {
  it("marks Other without submitting a preset label", () => {
    expect(
      selectPendingUserInputOtherAnswer({
        selectedOptionLabels: ["Scaffold only"],
        customAnswer: "partial",
      }),
    ).toEqual({
      preferCustomAnswer: true,
      customAnswer: "partial",
    });
  });
});

describe("togglePendingUserInputOptionSelection", () => {
  it("toggles options for multi-select questions", () => {
    const question = {
      id: "targets",
      header: "Targets",
      question: "Which outputs should we ship?",
      multiSelect: true,
      options: [],
    } as const;

    expect(
      togglePendingUserInputOptionSelection(question, { selectedOptionLabels: ["CLI"] }, "Desktop"),
    ).toEqual({
      customAnswer: "",
      selectedOptionLabels: ["CLI", "Desktop"],
    });

    expect(
      togglePendingUserInputOptionSelection(
        question,
        { selectedOptionLabels: ["CLI", "Desktop"] },
        "CLI",
      ),
    ).toEqual({
      customAnswer: "",
      selectedOptionLabels: ["Desktop"],
    });
  });

  it("clears Other when a preset option is chosen", () => {
    const question = {
      id: "scope",
      header: "Scope",
      question: "What should the plan target first?",
      options: [],
    } as const;

    expect(
      togglePendingUserInputOptionSelection(
        question,
        selectPendingUserInputOtherAnswer(undefined),
        "Scaffold only",
      ),
    ).toEqual({
      customAnswer: "",
      selectedOptionLabels: ["Scaffold only"],
    });
  });
});

describe("buildPendingUserInputAnswers", () => {
  it("returns a canonical answer map for complete prompts", () => {
    expect(
      buildPendingUserInputAnswers(
        [
          {
            id: "scope",
            header: "Scope",
            question: "What should the plan target first?",
            options: [
              {
                label: "Orchestration-first",
                description: "Focus on orchestration first",
              },
            ],
          },
          {
            id: "compat",
            header: "Compat",
            question: "How strict should compatibility be?",
            options: [
              {
                label: "Keep current envelope",
                description: "Preserve current wire format",
              },
            ],
          },
        ],
        {
          scope: {
            selectedOptionLabels: ["Orchestration-first"],
          },
          compat: {
            customAnswer: "Keep the current envelope for one release window",
          },
        },
      ),
    ).toEqual({
      scope: "Orchestration-first",
      compat: "Keep the current envelope for one release window",
    });
  });

  it("returns null when any question is unanswered", () => {
    expect(
      buildPendingUserInputAnswers(
        [
          {
            id: "scope",
            header: "Scope",
            question: "What should the plan target first?",
            options: [
              {
                label: "Orchestration-first",
                description: "Focus on orchestration first",
              },
            ],
          },
        ],
        {},
      ),
    ).toBeNull();
  });

  it("returns null while Other is selected without a typed answer", () => {
    expect(
      buildPendingUserInputAnswers(
        [
          {
            id: "scope",
            header: "Scope",
            question: "What should the plan target first?",
            options: [
              {
                label: "Orchestration-first",
                description: "Focus on orchestration first",
              },
            ],
          },
        ],
        {
          scope: selectPendingUserInputOtherAnswer(undefined),
        },
      ),
    ).toBeNull();
  });
});

describe("hasCompletePendingUserInputAnswers", () => {
  it("accepts non-empty string and array answers", () => {
    expect(
      hasCompletePendingUserInputAnswers({
        language: "TypeScript",
        features: ["Auth", "Testing"],
      }),
    ).toBe(true);
  });

  it("rejects null and empty answers before dispatch", () => {
    expect(
      hasCompletePendingUserInputAnswers({
        language: null,
        features: [],
      }),
    ).toBe(false);
  });
});

describe("pending user input question progress", () => {
  const questions = [
    {
      id: "scope",
      header: "Scope",
      question: "What should the plan target first?",
      options: [
        {
          label: "Orchestration-first",
          description: "Focus on orchestration first",
        },
      ],
    },
    {
      id: "compat",
      header: "Compat",
      question: "How strict should compatibility be?",
      options: [
        {
          label: "Keep current envelope",
          description: "Preserve current wire format",
        },
      ],
    },
  ] as const;

  it("counts only answered questions", () => {
    expect(
      countAnsweredPendingUserInputQuestions(questions, {
        scope: {
          selectedOptionLabels: ["Orchestration-first"],
        },
      }),
    ).toBe(1);
  });

  it("finds the first unanswered question", () => {
    expect(
      findFirstUnansweredPendingUserInputQuestionIndex(questions, {
        scope: {
          selectedOptionLabels: ["Orchestration-first"],
        },
      }),
    ).toBe(1);
  });

  it("returns the last question index when all answers are complete", () => {
    expect(
      findFirstUnansweredPendingUserInputQuestionIndex(questions, {
        scope: {
          selectedOptionLabels: ["Orchestration-first"],
        },
        compat: {
          customAnswer: "Keep it for one release window",
        },
      }),
    ).toBe(1);
  });

  it("derives the active question and advancement state", () => {
    expect(
      derivePendingUserInputProgress(
        questions,
        {
          scope: {
            selectedOptionLabels: ["Orchestration-first"],
          },
        },
        0,
      ),
    ).toMatchObject({
      questionIndex: 0,
      activeQuestion: questions[0],
      selectedOptionLabels: ["Orchestration-first"],
      customAnswer: "",
      resolvedAnswer: "Orchestration-first",
      answeredQuestionCount: 1,
      isLastQuestion: false,
      isComplete: false,
      canAdvance: true,
    });
  });

  it("marks Other as a custom-answer path before text is typed", () => {
    expect(
      derivePendingUserInputProgress(
        questions,
        {
          scope: selectPendingUserInputOtherAnswer(undefined),
        },
        0,
      ),
    ).toMatchObject({
      usingCustomAnswer: true,
      selectedOptionLabels: [],
      customAnswer: "",
      resolvedAnswer: null,
      canAdvance: false,
    });
  });
});

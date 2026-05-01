export type EvaluatedQuestionStatus = "correct" | "incorrect" | "skipped";

const MULTIPLE_CHOICE_TYPES = new Set([
  "multiple_choice",
  "multiple_correct",
  "multi",
  "mcq_multi",
]);

const INTEGER_TYPES = new Set([
  "integer",
  "numerical",
]);

const unwrapStoredAnswer = (answer: unknown): unknown => {
  if (
    answer &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "answer" in (answer as Record<string, unknown>)
  ) {
    return (answer as Record<string, unknown>).answer;
  }

  return answer;
};

const normalizeSectionType = (sectionType?: string | null) =>
  String(sectionType || "").toLowerCase();

export const isMultipleChoiceType = (sectionType?: string | null) =>
  MULTIPLE_CHOICE_TYPES.has(normalizeSectionType(sectionType));

export const isIntegerType = (sectionType?: string | null) =>
  INTEGER_TYPES.has(normalizeSectionType(sectionType));

export const isAnswerEmpty = (answer: unknown) => {
  const unwrapped = unwrapStoredAnswer(answer);

  if (Array.isArray(unwrapped)) {
    return unwrapped.length === 0 || unwrapped.every((value) => isAnswerEmpty(value));
  }

  return unwrapped === undefined || unwrapped === null || String(unwrapped).trim() === "";
};

const normalizeChoiceToken = (value: unknown): string => {
  const unwrapped = unwrapStoredAnswer(value);

  if (isAnswerEmpty(unwrapped)) return "";

  const stringValue = String(unwrapped).trim();
  if (/^[A-Za-z]$/.test(stringValue)) return stringValue.toUpperCase();

  const parsedNumber = Number.parseInt(stringValue, 10);
  if (!Number.isNaN(parsedNumber) && parsedNumber >= 0 && parsedNumber <= 25) {
    return String.fromCharCode(65 + parsedNumber);
  }

  return stringValue.toUpperCase();
};

export const normalizeAnswerCollection = (
  answer: unknown,
  sectionType?: string | null,
): string[] => {
  const unwrapped = unwrapStoredAnswer(answer);

  if (isAnswerEmpty(unwrapped)) return [];

  const rawValues = Array.isArray(unwrapped)
    ? unwrapped
    : isMultipleChoiceType(sectionType) && typeof unwrapped === "string" && unwrapped.includes(",")
      ? unwrapped.split(",")
      : [unwrapped];

  return Array.from(new Set(rawValues.map(normalizeChoiceToken).filter(Boolean)));
};

export const formatAnswerDisplay = (
  answer: unknown,
  sectionType?: string | null,
) => {
  const unwrapped = unwrapStoredAnswer(answer);

  if (isAnswerEmpty(unwrapped)) return "-";
  if (isIntegerType(sectionType)) return String(unwrapped);

  return normalizeAnswerCollection(unwrapped, sectionType).join(", ");
};

export interface ScoreEvaluation {
  status: EvaluatedQuestionStatus;
  isCorrect: boolean;
  marksObtained: number;
  normalizedUserAnswers: string[];
  normalizedCorrectAnswers: string[];
  userAnswerLabel: string;
  correctAnswerLabel: string;
}

export const evaluateQuestionScore = ({
  sectionType,
  correctAnswer,
  userAnswer,
  marks,
  negativeMarks,
  isBonus,
}: {
  sectionType?: string | null;
  correctAnswer: unknown;
  userAnswer: unknown;
  marks?: number | null;
  negativeMarks?: number | null;
  isBonus?: boolean | null;
}): ScoreEvaluation => {
  const resolvedMarks = marks ?? 4;
  const resolvedNegative = negativeMarks ?? 1;
  const normalizedCorrectAnswers = normalizeAnswerCollection(correctAnswer, sectionType);
  const normalizedUserAnswers = normalizeAnswerCollection(userAnswer, sectionType);
  const correctAnswerLabel = formatAnswerDisplay(correctAnswer, sectionType);
  const userAnswerLabel = formatAnswerDisplay(userAnswer, sectionType);

  if (isBonus) {
    return {
      status: "correct",
      isCorrect: true,
      marksObtained: resolvedMarks,
      normalizedUserAnswers,
      normalizedCorrectAnswers,
      userAnswerLabel,
      correctAnswerLabel,
    };
  }

  if (isAnswerEmpty(userAnswer)) {
    return {
      status: "skipped",
      isCorrect: false,
      marksObtained: 0,
      normalizedUserAnswers,
      normalizedCorrectAnswers,
      userAnswerLabel,
      correctAnswerLabel,
    };
  }

  if (isIntegerType(sectionType)) {
    const correctNumber = Number.parseFloat(String(unwrapStoredAnswer(correctAnswer)));
    const userNumber = Number.parseFloat(String(unwrapStoredAnswer(userAnswer)));
    const isCorrect =
      !Number.isNaN(correctNumber) &&
      !Number.isNaN(userNumber) &&
      Math.abs(correctNumber - userNumber) < 0.01;

    return {
      status: isCorrect ? "correct" : "incorrect",
      isCorrect,
      marksObtained: isCorrect ? resolvedMarks : -resolvedNegative,
      normalizedUserAnswers,
      normalizedCorrectAnswers,
      userAnswerLabel,
      correctAnswerLabel,
    };
  }

  if (isMultipleChoiceType(sectionType)) {
    const correctSet = new Set(normalizedCorrectAnswers);
    const userSet = new Set(normalizedUserAnswers);
    const uniqueUserAnswers = [...userSet];
    const totalCorrect = correctSet.size;
    const correctCount = uniqueUserAnswers.filter((answer) => correctSet.has(answer)).length;
    const wrongCount = uniqueUserAnswers.filter((answer) => !correctSet.has(answer)).length;

    // Scale partial marks proportionally to the question's configured marks.
    // JEE Advanced default (marks=4): full=+4, 3-of-4=+3, 2=+2, 1=+1.
    // For other marks values (e.g. marks=3), partial marks scale relative to resolvedMarks.
    const partialUnit = resolvedMarks / 4;
    let marksObtained = -resolvedNegative;
    let status: EvaluatedQuestionStatus = "incorrect";

    if (wrongCount === 0) {
      if (correctCount === totalCorrect && uniqueUserAnswers.length === totalCorrect) {
        marksObtained = resolvedMarks;
        status = "correct";
      } else if (totalCorrect === 4 && correctCount === 3 && uniqueUserAnswers.length === 3) {
        marksObtained = partialUnit * 3;
        status = "correct";
      } else if (totalCorrect >= 3 && correctCount === 2 && uniqueUserAnswers.length === 2) {
        marksObtained = partialUnit * 2;
        status = "correct";
      } else if (totalCorrect >= 2 && correctCount === 1 && uniqueUserAnswers.length === 1) {
        marksObtained = partialUnit;
        status = "correct";
      }
    }

    return {
      status,
      isCorrect: status === "correct",
      marksObtained,
      normalizedUserAnswers,
      normalizedCorrectAnswers,
      userAnswerLabel,
      correctAnswerLabel,
    };
  }

  const correctOption = normalizedCorrectAnswers[0] || normalizeChoiceToken(correctAnswer);
  const userOption = normalizedUserAnswers[0] || normalizeChoiceToken(userAnswer);
  const isCorrect = Boolean(correctOption) && userOption === correctOption;

  return {
    status: isCorrect ? "correct" : "incorrect",
    isCorrect,
    marksObtained: isCorrect ? resolvedMarks : -resolvedNegative,
    normalizedUserAnswers,
    normalizedCorrectAnswers,
    userAnswerLabel,
    correctAnswerLabel,
  };
};
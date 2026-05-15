export function calculatePrecisionRecallF1(params: {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}) {
  const { truePositive, falsePositive, falseNegative } = params;

  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;

  const precision =
    precisionDenominator === 0 ? 0 : truePositive / precisionDenominator;

  const recall = recallDenominator === 0 ? 0 : truePositive / recallDenominator;

  const f1Denominator = precision + recall;

  const f1 = f1Denominator === 0 ? 0 : (2 * precision * recall) / f1Denominator;

  return {
    truePositive,
    falsePositive,
    falseNegative,
    precision,
    recall,
    f1,
  };
}

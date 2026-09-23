// CYCLO Impact Tracker — every number here is derived from real completed Transaction
// rows (see ImpactService.getUserImpact), never fabricated. ecoScore and the CO2e
// estimate are explicitly labeled as estimates/heuristics since they're derived
// quantities, not directly measured ones.

export interface MaterialBreakdown {
  category: string;
  weightKg: number;
}

export interface ImpactAchievement {
  id: string;
  label: string;
  icon: string;
  achieved: boolean;
  // Threshold this achievement unlocks at, and the user's current progress toward it —
  // lets the UI show "6/10 collections" for a not-yet-achieved badge instead of just a
  // locked icon with no context.
  threshold: number;
  progress: number;
}

export interface UserImpactSummary {
  totalWeightKg: number;
  materialBreakdown: MaterialBreakdown[];
  totalEarningsTzs: number;
  completedTransactionCount: number;
  // Sum of category-specific factors × weight — explicitly an estimate, not a measured
  // quantity. See ImpactService.CO2_FACTORS_BY_CATEGORY for the per-category factors used.
  estimatedCo2AvoidedKg: number;
  // 0-100 heuristic combining weight and transaction frequency — not a scientific
  // measure, just a gamified progress indicator. See ImpactService for the formula.
  ecoScore: number;
  achievements: ImpactAchievement[];
}

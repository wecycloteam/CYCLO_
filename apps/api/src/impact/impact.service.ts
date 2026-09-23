import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImpactAchievement, MaterialBreakdown, UserImpactSummary } from '@cyclo/shared-types';

// Widely-cited rough recycling-vs-landfill CO2e savings per kg, by material category —
// same spirit as UsersService.impact's flat 2.5kg/kg factor, but split per-category since
// the actual savings vary a lot by material (metal smelting is far more carbon-intensive
// than glass, for instance). Never precise for any individual transaction — always
// surfaced as "Estimated CO2e avoided", never a measured quantity.
const CO2_FACTORS_BY_CATEGORY: Record<string, number> = {
  plastic: 1.5,
  metal: 2.2,
  paper: 1.1,
  cardboard: 1.1,
  glass: 0.3,
  e_waste: 1.0,
  organic: 0.5,
  other: 0.5,
};
const DEFAULT_CO2_FACTOR = 0.5;

@Injectable()
export class ImpactService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserImpact(userId: string): Promise<UserImpactSummary> {
    const transactions = await this.prisma.transaction.findMany({
      where: { sellerId: userId },
      select: { verifiedWeightKg: true, agreedPrice: true, material: { select: { category: true } } },
    });

    const totalWeightKg = transactions.reduce((sum, t) => sum + t.verifiedWeightKg, 0);
    const totalEarningsTzs = transactions.reduce((sum, t) => sum + (t.agreedPrice ?? 0), 0);
    const completedTransactionCount = transactions.length;

    const weightByCategory = new Map<string, number>();
    for (const t of transactions) {
      const category = t.material.category;
      weightByCategory.set(category, (weightByCategory.get(category) ?? 0) + t.verifiedWeightKg);
    }
    const materialBreakdown: MaterialBreakdown[] = [...weightByCategory.entries()]
      .map(([category, weightKg]) => ({ category, weightKg }))
      .sort((a, b) => b.weightKg - a.weightKg);

    const estimatedCo2AvoidedKg =
      Math.round(
        transactions.reduce((sum, t) => sum + t.verifiedWeightKg * (CO2_FACTORS_BY_CATEGORY[t.material.category] ?? DEFAULT_CO2_FACTOR), 0) * 10,
      ) / 10;

    // Heuristic, not a scientific measure: rewards both volume (weight) and consistency
    // (transaction count), capped at 100 so a single huge drop-off can't max it out alone.
    const ecoScore = Math.min(100, Math.round(totalWeightKg * 0.5 + completedTransactionCount * 5));

    // `icon` is a semantic key, not an emoji — the frontend maps each to a lucide-react
    // icon (see ImpactDashboard.tsx's ACHIEVEMENT_ICONS), consistent with the rest of the
    // app's icon system.
    const achievements: ImpactAchievement[] = [
      {
        id: 'first_10kg',
        label: 'First 10 KG',
        icon: 'recycle',
        threshold: 10,
        progress: Math.min(totalWeightKg, 10),
        achieved: totalWeightKg >= 10,
      },
      {
        id: 'eco_starter',
        label: 'Eco Starter',
        icon: 'sprout',
        threshold: 1,
        progress: Math.min(completedTransactionCount, 1),
        achieved: completedTransactionCount >= 1,
      },
      {
        id: 'ten_collections',
        label: '10 Collections',
        icon: 'repeat',
        threshold: 10,
        progress: Math.min(completedTransactionCount, 10),
        achieved: completedTransactionCount >= 10,
      },
      {
        id: 'champion_100kg',
        label: '100 KG Champion',
        icon: 'trophy',
        threshold: 100,
        progress: Math.min(totalWeightKg, 100),
        achieved: totalWeightKg >= 100,
      },
    ];

    return {
      totalWeightKg,
      materialBreakdown,
      totalEarningsTzs,
      completedTransactionCount,
      estimatedCo2AvoidedKg,
      ecoScore,
      achievements,
    };
  }
}

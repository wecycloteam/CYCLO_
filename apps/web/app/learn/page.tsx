"use client";

import Link from "next/link";
import { Recycle, Leaf, Coins, ShieldCheck, Camera, MessageCircle, ShoppingBag } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { useLanguage } from "@/lib/i18n";

function Section({ icon: Icon, title, children }: { icon: typeof Recycle; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 mb-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={18} className="text-[var(--cyclo-teal)]" />
        <h2 className="text-sm font-extrabold text-[var(--text-1)]">{title}</h2>
      </div>
      <div className="text-sm text-[var(--text-2)] leading-relaxed">{children}</div>
    </div>
  );
}

export default function LearnPage() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Learn" />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <h1 className="text-lg font-extrabold text-[var(--text-on-bg)] mb-1">{t("Why waste management matters")}</h1>
        <p className="text-sm text-[var(--text-on-bg-2)] mb-5">
          {t("A short guide to recycling, and how CYCLO turns it into real income.")}
        </p>

        <Section icon={Leaf} title={t("Why it matters")}>
          {t(
            "Waste that ends up in open dumps or is burned releases methane and toxic smoke, contaminates soil and groundwater, and blocks drainage that causes flooding in urban areas. Materials like plastic, metal, and glass can be reused almost indefinitely instead of being extracted and manufactured from scratch each time — recycling one tonne of these materials avoids a meaningful amount of the energy, water, and raw material that virgin production would otherwise need."
          )}
        </Section>

        <Section icon={Coins} title={t("Waste has real value")}>
          {t(
            "Plastic, metal, cardboard, paper, and textiles all have active scrap markets — someone is willing to pay for them because they can be reprocessed into new products. Most of that value is lost when recyclable material is thrown away instead of sorted and sold. CYCLO exists to connect the people generating that material with the collectors and recyclers who already want to buy it."
          )}
        </Section>

        <Section icon={Recycle} title={t("What you can do today")}>
          {t(
            "Separate recyclables (plastic bottles, cardboard, metal cans, paper, clean textiles) from general waste before you throw anything away. Rinse food residue off plastic and metal containers — contaminated material is worth less and harder to sell. Flatten cardboard and boxes to make them easier to store and transport."
          )}
        </Section>

        <Section icon={Camera} title={t("Scan before you sort")}>
          {t("Not sure what category something falls under, whether it's actually recyclable, or roughly what it's worth? Use")}{" "}
          <Link href="/scan" className="font-bold text-[var(--cyclo-teal)]">
            {t("AI Scan")}
          </Link>{" "}
          {t("to photograph an item and get a real classification, condition assessment, and an estimated price in TZS.")}
        </Section>

        <Section icon={ShoppingBag} title={t("List it, don't bin it")}>
          {t("Once you know what you have,")}{" "}
          <Link href="/marketplace/new" className="font-bold text-[var(--cyclo-teal)]">
            {t("list it on the marketplace")}
          </Link>{" "}
          {t("instead of throwing it away. A buyer can purchase it directly in-app, or a collector can pick it up through a scheduled collection.")}
        </Section>

        <Section icon={MessageCircle} title={t("Talk it through")}>
          {t("Unsure about pricing, condition, or how to prepare something for sale?")}{" "}
          <Link href="/chat" className="font-bold text-[var(--cyclo-teal)]">
            {t("Message a buyer or seller directly")}
          </Link>{" "}
          {t("in-app, or ask CYCLO AI (the floating chat button) for guidance on sorting, cleaning, and pricing.")}
        </Section>

        <Section icon={ShieldCheck} title={t("Verified, not anonymous")}>
          {t(
            "Every account goes through admin review before it's marked verified, and every rating you see traces back to a real, completed transaction between two real people — never a fabricated number. That's what the verification badge and star ratings on listings actually mean."
          )}
        </Section>

        {!user && (
          <Link
            href="/login"
            className="block w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm text-center py-3 mt-2"
          >
            {t("Create a free account to start")}
          </Link>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}

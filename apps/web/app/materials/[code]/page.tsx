"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { Star, Recycle } from "lucide-react";
import { getMaterialByCode } from "@/lib/materials-catalog";
import { api, WasteListing } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function MaterialDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { t } = useLanguage();
  const material = getMaterialByCode(code);
  const [matchingListing, setMatchingListing] = useState<WasteListing | null>(null);
  const [checkedListings, setCheckedListings] = useState(false);

  useEffect(() => {
    if (!material) return;
    api
      .browseListings()
      .then((listings) => {
        const match = listings.find((l) => l.material.category === material.realCategory);
        setMatchingListing(match ?? null);
      })
      .catch(() => undefined)
      .finally(() => setCheckedListings(true));
  }, [material]);

  if (!material) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F6F9F8] px-6 text-center text-[#10161A]">
        <h1 className="text-2xl font-extrabold">{t("Material not found")}</h1>
        <p className="text-[#5B6C69]">{t("We couldn't find that material in the catalog.")}</p>
        <Link href="/" className="text-sm font-extrabold text-[#275458] underline decoration-[#48F53B] decoration-2 underline-offset-4">
          {t("← Back to home")}
        </Link>
      </main>
    );
  }

  // Links straight to a real, active listing in this category when one exists; only
  // falls back to the general browse page when there genuinely isn't one to buy yet.
  const buyHref = matchingListing ? `/marketplace/${matchingListing.id}` : "/marketplace";
  const buyLabel = !checkedListings ? t("Buy this material") : matchingListing ? t("Buy this material") : t("Browse this category");

  return (
    <main className="min-h-screen bg-[#F6F9F8] text-[#10161A]">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="text-sm font-extrabold text-[#275458]">
          {t("← CYCLO")}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-bold text-[#275458] transition hover:bg-black/5"
          >
            {t("Log in")}
          </Link>
        </div>
      </nav>

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 pb-20 pt-4 lg:grid-cols-[1fr_1fr] lg:items-start lg:px-10">
        <div className="relative h-72 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#DCE7E4] to-[#B9CDC8] sm:h-96 lg:h-[420px]">
          {material.image ? (
            <Image src={material.image} alt={material.title} fill className="object-cover" sizes="(min-width: 1024px) 45vw, 100vw" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Recycle size={72} className="text-[#275458]/40" />
            </div>
          )}
          <span className="absolute left-5 top-5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-white">
            {material.category}
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#275458] sm:text-4xl">{t(material.title)}</h1>

          <div className="mt-3 flex items-center gap-2 text-sm" aria-label={`${material.rating} out of 5 stars from ${material.reviews} reviews`}>
            <span className="flex items-center gap-0.5 text-[#E6A51A]" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
              ))}
            </span>
            <span className="font-extrabold text-[#275458]">{material.rating}</span>
            <span className="text-[#8B9997]">({material.reviews} reviews)</span>
          </div>

          <p className="mt-6 text-base leading-7 text-[#5B6C69]">{t(material.description)}</p>

          <div className="mt-8 rounded-[1.25rem] border border-[#E2E9E7] bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5B6C69]">{t("Reference price")}</p>
            <p className="mt-2 text-3xl font-extrabold text-[#275458]">{material.price}</p>
            <p className="mt-1 text-xs text-[#8B9997]">{t("Typical price seen in active listings — actual offers vary by condition and location.")}</p>
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5B6C69] mb-3">{t("Accepted forms")}</p>
            <div className="flex flex-wrap gap-2">
              {material.acceptedForms.map((f) => (
                <span key={f} className="rounded-full border border-[#E2E9E7] bg-white px-3 py-1.5 text-xs font-bold text-[#275458]">
                  {t(f)}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={buyHref}
              className="rounded-full bg-[#48F53B] px-6 py-3.5 text-sm font-extrabold text-[#0E2A1F] shadow-[0_12px_28px_rgba(72,245,59,.22)] transition hover:bg-[#CAFFBD]"
            >
              {buyLabel}
            </Link>
            <Link
              href={`/login?redirect=${encodeURIComponent("/marketplace/new")}`}
              className="rounded-full border border-[#275458]/25 px-6 py-3.5 text-sm font-bold text-[#275458] transition hover:bg-black/5"
            >
              {t("Sell this material")}
            </Link>
          </div>
          <p className="mt-3 text-xs text-[#8B9997]">{t("Browse listings freely — you'll only need to log in or sign up when you're ready to buy or sell.")}</p>
        </div>
      </div>
    </main>
  );
}

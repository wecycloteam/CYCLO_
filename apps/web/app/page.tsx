"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, ArrowUpRight, Recycle } from "lucide-react";
import { api, tokenStore } from "@/lib/api";
import { MATERIALS_CATALOG } from "@/lib/materials-catalog";
import { useLanguage } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

// Chart bars are rendered relative to whatever the busiest day in the window was, so the
// shape stays meaningful (tallest bar always visible) instead of using fixed pixel heights
// tuned for the old hardcoded numbers.
function barHeight(count: number, max: number): number {
  if (max <= 0) return 6;
  return Math.max(6, Math.round((count / max) * 94));
}

export default function RootPage() {
  const hasSession = tokenStore.getAccess();
  const { t } = useLanguage();
  const [stats, setStats] = useState<{ materialsListed: number; valueRecoveredTzs: number; kgDiverted: number; kgHandled: number; diversionRatePercent: number; dailyListingCounts: number[] } | null>(null);

  useEffect(() => {
    document.title = "CYCLO — Turn waste into value";
  }, []);

  useEffect(() => {
    api.landingStats().then(setStats).catch(() => undefined);
  }, []);

  const maxDailyCount = stats ? Math.max(...stats.dailyListingCounts, 1) : 1;

  return (
    <main className="min-h-screen overflow-hidden bg-[#F6F9F8] text-[#10161A]">
      <section className="relative min-h-[720px] overflow-hidden bg-[#1B3E41] text-[#EFFBF3]">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(115deg, transparent 0 46%, rgba(202,255,189,.08) 46% 46.2%, transparent 46.2% 100%), linear-gradient(25deg, transparent 0 62%, rgba(72,245,59,.07) 62% 62.2%, transparent 62.2% 100%)",
            backgroundSize: "100% 100%, 100% 100%",
          }}
        />
        <div className="pointer-events-none absolute -right-44 -top-52 h-[560px] w-[560px] rounded-full border border-[#CAFFBD]/15 bg-[#48F53B]/10 blur-[1px]" />
        <div className="pointer-events-none absolute -bottom-64 left-[38%] h-[540px] w-[540px] rounded-full border border-[#CAFFBD]/10" />

        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <Link href="/" aria-label="CYCLO home">
            <Image
              src="/brand/cyclo-logo-dark.png"
              alt="CYCLO"
              width={150}
              height={44}
              className="h-auto w-[150px]"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <Link
              href="/login"
              className="rounded-full px-4 py-2.5 text-sm font-bold text-[#EFFBF3] transition hover:bg-white/10"
            >
              {t("Log in")}
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[#48F53B] px-4 py-2.5 text-sm font-extrabold text-[#0E2A1F] shadow-[0_8px_22px_rgba(72,245,59,.2)] transition hover:bg-[#CAFFBD]"
            >
              {t("Sign up")}
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-24">
          <div className="max-w-2xl">
            <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.24em] text-[#48F53B]">{t("The circular marketplace")}</p>
            <h1 className="max-w-xl text-5xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-7xl">
              {t("Waste is not the end of the story.")}
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#B9D6D1] sm:text-xl">
              {t("CYCLO helps people, collectors and businesses turn recyclable materials into income, opportunity and a cleaner tomorrow.")}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={hasSession ? "/home" : "/login"}
                className="rounded-full bg-[#48F53B] px-6 py-3.5 text-sm font-extrabold text-[#0E2A1F] shadow-[0_12px_28px_rgba(72,245,59,.22)] transition hover:bg-[#CAFFBD]"
              >
                {hasSession ? t("Open dashboard") : t("Get started")}
              </Link>
              <Link
                href={hasSession ? "/marketplace/new" : `/login?redirect=${encodeURIComponent("/marketplace/new")}`}
                className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-[#EFFBF3] transition hover:bg-white/10"
              >
                {t("Sell your recyclables")}
              </Link>
              <a href="#how-it-works" className="text-sm font-bold text-[#EFFBF3] underline decoration-white/30 decoration-2 underline-offset-4 transition hover:decoration-white/60">
                {t("See how it works")}
              </a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#B9D6D1]">
              <span><strong className="text-[#EFFBF3]">{t("Sell")}</strong> {t("what you collect")}</span>
              <span><strong className="text-[#EFFBF3]">{t("Find")}</strong> {t("trusted materials")}</span>
              <span><strong className="text-[#EFFBF3]">{t("Move")}</strong> {t("value forward")}</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:justify-self-end">
            <div className="relative rounded-[2rem] border border-white/15 bg-[#275458]/80 p-4 shadow-[0_28px_80px_rgba(0,0,0,.22)] backdrop-blur-sm sm:p-5">
              <div className="rounded-[1.5rem] bg-[#F6F9F8] p-5 text-[#10161A] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5B6C69]">{t("Today's value")}</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#275458]">{t("Keep it moving.")}</p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#CAFFBD] text-[#1B3E41]">
                    <ArrowUpRight size={22} strokeWidth={2.25} />
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#EEF3F2] p-4">
                    <p className="text-xs font-bold text-[#5B6C69]">{t("Materials listed")}</p>
                    <p className="mt-2 text-2xl font-extrabold text-[#275458]">
                      {stats ? stats.materialsListed.toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#EEF3F2] p-4">
                    <p className="text-xs font-bold text-[#5B6C69]">{t("Impact Tracked")}</p>
                    <p className="mt-2 text-2xl font-extrabold text-[#275458]">
                      {stats ? `${stats.diversionRatePercent}%` : "—"}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-[#5B6C69]">
                      {stats ? t("of waste handled diverted from landfill") : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-[#275458] p-4 text-[#EFFBF3]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">{t("New listings")}</span>
                    <span className="rounded-full bg-[#48F53B] px-2.5 py-1 text-xs font-extrabold text-[#0E2A1F]">{t("Last 7 days")}</span>
                  </div>
                  <div className="mt-6 flex items-end gap-1.5" aria-label="Listings created per day over the last 7 days">
                    {(stats?.dailyListingCounts ?? new Array(7).fill(0)).map((count, index) => (
                      <span key={index} className="flex-1 rounded-t-md bg-[#48F53B]" style={{ height: barHeight(count, maxDailyCount) }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 rounded-2xl border border-white/15 bg-[#CAFFBD] px-4 py-3 text-sm font-extrabold text-[#1B3E41] shadow-xl sm:-left-8">
              {t("Better waste. Better value.")}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E2E9E7] bg-[#EEF3F2] px-6 py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#2FA827]">{t("Materials in demand")}</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#275458] sm:text-5xl">{t("Give useful things a second life.")}</h2>
              <p className="mt-5 text-base leading-7 text-[#5B6C69] sm:text-lg">{t("These are some of the materials people are already collecting, buying and putting back into circulation.")}</p>
            </div>
            <Link
              href="/marketplace"
              className="text-sm font-extrabold text-[#275458] underline decoration-[#48F53B] decoration-2 underline-offset-4"
            >
              {t("Browse the marketplace →")}
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MATERIALS_CATALOG.map((material) => (
              <article key={material.code} className="overflow-hidden rounded-[1.25rem] border border-[#E2E9E7] bg-white shadow-[0_8px_24px_rgba(16,22,26,.05)] transition hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,22,26,.1)]">
                <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#DCE7E4] to-[#B9CDC8]">
                  {material.image ? (
                    <Image src={material.image} alt={material.title} fill className="object-cover transition duration-500 hover:scale-105" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Recycle size={40} className="text-[#275458]/40" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-5 pb-4 pt-10">
                    <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">{material.code} {t("material")}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-extrabold leading-snug text-[#275458]">{t(material.title)}</h3>
                  <p className="mt-3 min-h-20 text-sm leading-6 text-[#5B6C69]">{t(material.detail)}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-extrabold text-[#275458]">{t("From")} {material.price}</span>
                    <span className="text-xs text-[#8B9997]">{t("Typical listing")}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm" aria-label={`${material.rating} out of 5 stars from ${material.reviews} reviews`}>
                    <span className="flex items-center gap-0.5 text-[#E6A51A]" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                      ))}
                    </span>
                    <span className="font-extrabold text-[#275458]">{material.rating}</span>
                    <span className="text-[#8B9997]">({material.reviews})</span>
                  </div>
                  <Link
                    href={`/materials/${material.code}`}
                    className="mt-4 inline-flex text-sm font-extrabold text-[#275458] underline decoration-[#48F53B] decoration-2 underline-offset-4"
                  >
                    {t("Explore material")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#2FA827]">{t("A better waste economy")}</p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#275458] sm:text-5xl">{t("One place for every next step.")}</h2>
          <p className="mt-5 text-base leading-7 text-[#5B6C69] sm:text-lg">{t("From the first collection to the final buyer, CYCLO keeps the people, materials and opportunities connected.")}</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { number: "01", title: "List what you have", text: "Share recyclable materials and connect with people who are looking for them." },
            { number: "02", title: "Find what you need", text: "Browse trusted listings from households, collectors and businesses nearby." },
            { number: "03", title: "Make value visible", text: "Keep transactions clear while more useful materials stay in circulation." },
          ].map((item) => (
            <article key={item.number} className="rounded-[1.25rem] border border-[#E2E9E7] bg-white p-6 shadow-[0_8px_24px_rgba(16,22,26,.05)] sm:p-7">
              <span className="text-sm font-extrabold text-[#2FA827]">{item.number}</span>
              <h3 className="mt-10 text-xl font-extrabold text-[#275458]">{t(item.title)}</h3>
              <p className="mt-3 leading-7 text-[#5B6C69]">{t(item.text)}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#E2E9E7] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[#5B6C69] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-extrabold text-[#275458]">CYCLO</span>
          <span>{t("Turning waste into wealth.")}</span>
        </div>
      </footer>
    </main>
  );
}

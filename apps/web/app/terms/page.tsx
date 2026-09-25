"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

const LAST_UPDATED = "24 September 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-extrabold text-[#275458] mb-2">{title}</h2>
      <div className="text-sm leading-7 text-[#5B6C69] [&>p]:mb-3 [&>ul]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:mb-1">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#F6F9F8] text-[#10161A]">
      <header className="sticky top-0 z-10 border-b border-[#E2E9E7] bg-[#F6F9F8]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-extrabold text-[#275458]">
            <ArrowLeft size={16} />
            <Image src="/brand/cyclo-logo-light.png" alt="CYCLO" width={80} height={22} className="hidden dark:block h-[22px] w-auto" />
            <span>CYCLO</span>
          </Link>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#275458] sm:text-3xl mb-1">
          {t("Terms and Conditions")}
        </h1>
        <p className="text-xs text-[#8B9997] mb-8">{t("Last updated:")} {LAST_UPDATED}</p>

        <Section title={t("1. Acceptance of these Terms")}>
          <p>
            {t(
              "These Terms and Conditions (\"Terms\") govern your access to and use of CYCLO — the mobile and web application, website, and related services (together, the \"Service\") operated by the CYCLO team (\"CYCLO\", \"we\", \"us\", or \"our\"). By creating an account, browsing the marketplace, or otherwise using the Service, you agree to be bound by these Terms and by our handling of your information as described here. If you do not agree, do not create an account or use the Service."
            )}
          </p>
        </Section>

        <Section title={t("2. Eligibility and accounts")}>
          <p>
            {t(
              "You must be at least 18 years old, or the age of legal majority in your jurisdiction, to create a CYCLO account. By registering, you confirm that the information you provide (name, phone number, email, and any other details) is accurate and that you will keep it up to date."
            )}
          </p>
          <p>
            {t(
              "You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. Notify us immediately if you suspect unauthorized use of your account. CYCLO is not liable for losses caused by your failure to keep your credentials secure."
            )}
          </p>
          <p>
            {t(
              "CYCLO supports distinct account roles (household/seller, collector/buyer, business, recycling company, environmental authority). Some features are only available to certain roles, and switching between seller and buyer mode may change which features and listings are visible to you."
            )}
          </p>
        </Section>

        <Section title={t("3. The marketplace: listings, buying and selling")}>
          <p>
            {t(
              "CYCLO is a marketplace that connects people who have recyclable materials to sell with people who want to buy or collect them. CYCLO is not the seller of any material listed on the Service, is not a party to transactions between buyers and sellers, and does not take ownership or physical custody of any material at any point."
            )}
          </p>
          <ul>
            <li>{t("Sellers are solely responsible for the accuracy of their listings, including the material type, quantity, condition, photos, and asking price.")}</li>
            <li>{t("Buyers are solely responsible for inspecting or verifying a material (in person, by chat, or by phone) before agreeing to purchase it.")}</li>
            <li>{t("Prices, weights, and \"estimated market value\" figures shown on the Service — including AI scan results — are estimates only and are never a guaranteed or binding price.")}</li>
            <li>{t("CYCLO reserves the right to remove any listing that violates these Terms, local law, or that we reasonably believe to be fraudulent, unsafe, or misleading.")}</li>
          </ul>
        </Section>

        <Section title={t("4. Payments")}>
          <p>
            {t(
              "Where the Service facilitates a purchase, payment is arranged directly between buyer and seller (for example, by mobile money) and confirmed manually within the app. CYCLO does not process, hold, or guarantee any payment, and is not a bank, payment processor, or escrow service. You are responsible for confirming that a payment has genuinely been received before releasing material, and for confirming that material has genuinely been received before releasing payment."
            )}
          </p>
        </Section>

        <Section title={t("5. Prohibited materials and conduct")}>
          <p>{t("You agree not to use the Service to:")}</p>
          <ul>
            <li>{t("List or request hazardous, illegal, stolen, or counterfeit materials, or any item prohibited by Tanzanian law or applicable local regulation;")}</li>
            <li>{t("Impersonate another person, misrepresent your identity, or create an account on behalf of someone else without authorization;")}</li>
            <li>{t("Harass, threaten, or defraud other users, including through chat messages;")}</li>
            <li>{t("Attempt to circumvent, disable, or interfere with the Service's security features, rate limits, or moderation systems;")}</li>
            <li>{t("Use automated means (bots, scrapers) to access the Service without our prior written consent.")}</li>
          </ul>
          <p>
            {t(
              "We may suspend or terminate accounts that violate this section, remove associated content, and, where required by law, report illegal activity to the relevant authorities."
            )}
          </p>
        </Section>

        <Section title={t("6. AI features")}>
          <p>
            {t(
              "CYCLO offers AI-assisted features, including photo-based waste identification (\"AI Scan\") and a conversational assistant (\"CYCLO AI\"), powered by third-party AI models. These features are provided to help you sort, price, and understand materials, but their output is an estimate, not a certified or guaranteed result. Always use your own judgment, and treat AI-provided pricing, classification, or advice as a starting point rather than a final answer."
            )}
          </p>
        </Section>

        <Section title={t("7. Ratings, reviews and verification")}>
          <p>
            {t(
              "Ratings and reviews shown on the Service are meant to reflect real, completed transactions between users. Submitting a fake review, manipulating your own rating, or retaliating against another user for a genuine review is prohibited. Account verification badges indicate that CYCLO's admin team has reviewed certain account details — they are not a guarantee of a user's honesty, reliability, or the quality of any specific transaction."
            )}
          </p>
        </Section>

        <Section title={t("8. Content you submit")}>
          <p>
            {t(
              "You retain ownership of the photos, descriptions, and messages you submit to the Service (\"User Content\"), but you grant CYCLO a worldwide, non-exclusive, royalty-free license to host, display, and distribute that content solely for the purpose of operating and promoting the Service (for example, showing your listing photo in the marketplace). You are solely responsible for your User Content and confirm you have the right to share it."
            )}
          </p>
        </Section>

        <Section title={t("9. Disclaimers")}>
          <p>
            {t(
              "The Service is provided \"as is\" and \"as available,\" without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, or non-infringement. CYCLO does not warrant that the Service will be uninterrupted, error-free, or completely secure, or that any listing, user, or AI-generated estimate is accurate or reliable."
            )}
          </p>
        </Section>

        <Section title={t("10. Limitation of liability")}>
          <p>
            {t(
              "To the fullest extent permitted by law, CYCLO and its team will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or goodwill, arising from your use of the Service, any transaction between users, or any material exchanged as a result of using the Service — even if we have been advised of the possibility of such damages. Our total liability for any claim arising from these Terms or the Service will not exceed the greater of the amount you paid us in the past 12 months (if any) or TZS 50,000."
            )}
          </p>
        </Section>

        <Section title={t("11. Termination")}>
          <p>
            {t(
              "You may stop using the Service and delete your account at any time by contacting us. We may suspend or terminate your access to the Service, with or without notice, if we reasonably believe you have violated these Terms, engaged in fraudulent or unlawful activity, or created risk or legal exposure for CYCLO or other users."
            )}
          </p>
        </Section>

        <Section title={t("12. Changes to these Terms")}>
          <p>
            {t(
              "We may update these Terms from time to time to reflect changes to the Service or for legal, regulatory, or operational reasons. If we make material changes, we will make a reasonable effort to notify you (for example, in-app). Continuing to use the Service after changes take effect means you accept the updated Terms."
            )}
          </p>
        </Section>

        <Section title={t("13. Governing law")}>
          <p>
            {t(
              "These Terms are governed by the laws of the United Republic of Tanzania, without regard to its conflict-of-law principles. Any dispute arising from these Terms or the Service will be subject to the exclusive jurisdiction of the courts of Tanzania."
            )}
          </p>
        </Section>

        <Section title={t("14. Contact us")}>
          <p>
            {t("If you have questions about these Terms, contact the CYCLO team through the in-app chat support or the contact details provided on our website.")}
          </p>
        </Section>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CYCLO — Turning Waste Into Wealth",
  description:
    "CYCLO connects households, businesses, collectors, recycling companies and environmental authorities in one digital ecosystem.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

// Dark is the default theme app-wide (the design tokens' html[data-theme="dark"] palette,
// same teal/green look as the public landing page's hero) — rendered server-side so there
// is no flash of a light theme before JS runs. The inline script below is the one
// exception: it runs synchronously, before paint, to respect a user's *explicit* choice
// of light mode (stored by apps/web/lib/theme.ts's setTheme) — without it, someone who
// picked light would see a flash of dark on every navigation.
const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('cyclo.theme')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

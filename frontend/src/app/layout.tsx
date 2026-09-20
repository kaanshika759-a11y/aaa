import type { Metadata, Viewport } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#03030a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "ApniAwaaz – AI Multilingual Communication & Confidence Coach",
  description:
    "Help Indian students speak English confidently. Practice conversations, translate between 22 Indian languages, and get AI coaching for interviews, presentations and daily life.",
  keywords: [
    "English speaking practice",
    "AI confidence coach",
    "multilingual translator",
    "Hindi to English",
    "Indian language translator",
    "interview preparation",
    "communication skills",
    "ApniAwaaz",
    "speech practice",
    "English learning India",
  ],
  authors: [{ name: "ApniAwaaz" }],
  openGraph: {
    title: "ApniAwaaz – AI Multilingual Communication & Confidence Coach",
    description: "Speak English confidently. Practice in your mother tongue. AI coach for every Indian student.",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-slate-950 text-slate-100 antialiased overflow-hidden selection:bg-cyan-500/30 selection:text-white">
        <div className="flex h-screen w-full overflow-hidden bg-slate-950">
          <Navigation />
          <main className="flex-1 h-screen overflow-y-auto min-w-0 flex flex-col bg-slate-950">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}




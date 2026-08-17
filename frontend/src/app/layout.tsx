import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApniAwaaz – AI Confidence Coach",
  description:
    "Your real-time, voice-to-voice AI coach that helps you unlock unshakeable confidence, improve public speaking, and communicate with power.",
  keywords: [
    "confidence coach",
    "AI voice coach",
    "public speaking",
    "communication skills",
    "ApniAwaaz",
  ],
  authors: [{ name: "ApniAwaaz" }],
  openGraph: {
    title: "ApniAwaaz – AI Confidence Coach",
    description: "Real-time voice AI that coaches your confidence.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#03030a" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-[#03030a] text-white antialiased">
        {children}
      </body>
    </html>
  );
}

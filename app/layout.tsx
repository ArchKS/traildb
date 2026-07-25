import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "TrialScope · 药物临床管线图谱",
    description: "按公司、药物管线与临床试验组织的本地化临床情报工作台。",
    openGraph: {
      title: "TrialScope · 药物临床管线图谱",
      description: "从公司到临床，一屏看清药物管线。",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "TrialScope 药物临床管线图谱" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "TrialScope · 药物临床管线图谱",
      description: "从公司到临床，一屏看清药物管线。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

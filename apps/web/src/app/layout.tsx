import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NameSolver｜名字條件探索器",
  description: "以筆畫、五行與名字氣質，透明整理適合的繁中姓名候選。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}

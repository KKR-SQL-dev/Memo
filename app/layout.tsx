import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "메모장",
  description: "쿠라레코리아 실시간 공유 메모장",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

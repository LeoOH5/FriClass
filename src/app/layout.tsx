import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "감튀모임",
  description: "내 동네 감자튀김 모임 지도",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

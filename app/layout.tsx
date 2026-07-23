import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genius Director Workstation | AI Pre-Production Workspace",
  description:
    "A public showcase of an AI pre-production workspace for directors, visual creators, and screenwriters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Materia Web",
  description: "Next.js migration shell for Materia",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FoodHub — Restaurant, in rhythm",
  description: "A thoughtful ordering and operations experience for FoodHub.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./contributions.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Givva Contributions",
  description: "Support a fundraiser through Givva.",
};

export default function ContributionLayout({ children }: { children: React.ReactNode }) {
  return <div className={`givva-contributions ${inter.className}`}>{children}</div>;
}

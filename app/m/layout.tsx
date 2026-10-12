import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { formatSheetDate } from "@/lib/stock-sheet-date";
import "./mobile.css";

export const metadata: Metadata = {
  title: "BITS Stock | Employee",
  description: "Add today’s sales and warranty entries and download the daily stock report.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14150f",
};

const TABS = [
  { href: "/m", label: "Today" },
  { href: "/m/sale", label: "Sale" },
  { href: "/m/warranty", label: "Warranty" },
  { href: "/m/pending", label: "Pending" },
  { href: "/m/billback", label: "Bill Back" },
];

export default function EmployeePortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="m-shell">
      <header className="m-topbar">
        <span className="m-topbar-brand"><i aria-hidden="true">B</i> BITS · EMPLOYEE</span>
        <span className="m-topbar-date">{formatSheetDate(new Date(), { weekday: "short", day: "2-digit", month: "short" })}</span>
      </header>
      <main className="m-main">{children}</main>
      <nav className="m-tabbar" aria-label="Employee portal sections">
        {TABS.map((tab) => (
          <Link key={tab.href} className="m-tab" href={tab.href}>{tab.label}</Link>
        ))}
      </nav>
    </div>
  );
}

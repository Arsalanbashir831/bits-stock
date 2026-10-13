"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/m", label: "Today" },
  { href: "/m/sale", label: "Sales" },
  { href: "/m/warranty", label: "Warranty" },
  { href: "/m/more", label: "More" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="m-tabbar" aria-label="Employee portal sections">
      {tabs.map((tab) => {
        const active = tab.href === "/m"
          ? pathname === "/m"
          : tab.href === "/m/more"
            ? ["/m/more", "/m/pending", "/m/billback", "/m/lab-dead"].some((path) => pathname.startsWith(path))
            : pathname.startsWith(tab.href);
        return <Link key={tab.href} className="m-tab" href={tab.href} aria-current={active ? "page" : undefined}>{tab.label}</Link>;
      })}
    </nav>
  );
}

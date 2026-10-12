import Link from "next/link";

export function PortalTabs({ tabs, current }: { tabs: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="m-tabs" aria-label="Warranty entry type">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.href === current ? "page" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}

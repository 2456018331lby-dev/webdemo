"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstallAppPrompt } from "./install-app-prompt";
import { PwaBootstrap } from "./pwa-bootstrap";

const navItems = [
  { href: "/", icon: "⌂", label: "首页" },
  { href: "/homes", icon: "◎", label: "总览" },
  { href: "/devices", icon: "◫", label: "设备" },
  { href: "/activity", icon: "◌", label: "日志" },
  { href: "/settings", icon: "◈", label: "设置" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <PwaBootstrap />
      <header className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">⌂</div>
            <div>
              <div>智能家居</div>
              <div className="nav-logo-subtitle">Mobile command deck</div>
            </div>
          </Link>

          <nav className="nav-links" aria-label="主导航">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="shell-actions">
            <Link href="/#install-app" className="btn btn-secondary btn-sm shell-install-link">
              安装 App
            </Link>
            <span className="shell-badge">PWA Ready</span>
          </div>
        </div>
      </header>

      <main className="main-content">{children}</main>

      <nav className="mobile-bottom-nav" aria-label="移动端导航">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-bottom-nav__item ${isActive(pathname, item.href) ? "active" : ""}`}
          >
            <span className="mobile-bottom-nav__icon">{item.icon}</span>
            <span className="mobile-bottom-nav__label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <InstallAppPrompt compact={pathname === "/offline"} />
    </>
  );
}

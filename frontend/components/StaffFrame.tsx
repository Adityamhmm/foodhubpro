"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Percent,
  ShoppingBag,
  Settings,
  Utensils,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { api, ApiError, type StaffRole } from "@/lib/api";
import type { Staff } from "@/lib/types";

const adminLinks: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin#overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin#menu", label: "Menu", icon: Utensils },
  { href: "/admin#tables", label: "Tables", icon: ClipboardList },
  { href: "/admin#orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin#billing", label: "Billing", icon: CircleDollarSign },
  { href: "/admin#tax", label: "Tax", icon: Percent },
  { href: "/admin#requests", label: "Requests", icon: Bell },
  { href: "/admin#team", label: "Team", icon: Users },
  { href: "/admin#settings", label: "Settings", icon: Settings },
];

export function StaffFrame({
  role,
  title,
  description,
  children,
}: {
  role: StaffRole;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const links =
    role === "ADMIN"
      ? adminLinks
      : [{ href: "/kitchen", label: "Live orders", icon: ChefHat }];

  useEffect(() => {
    const updateSection = () => {
      if (pathname !== "/admin") {
        setActiveSection("");
        return;
      }
      const candidate = window.location.hash.slice(1) || "overview";
      setActiveSection(
        adminLinks.some(({ href }) => href.endsWith(`#${candidate}`))
          ? candidate
          : "overview",
      );
    };
    updateSection();
    window.addEventListener("hashchange", updateSection);
    window.addEventListener("popstate", updateSection);
    return () => {
      window.removeEventListener("hashchange", updateSection);
      window.removeEventListener("popstate", updateSection);
    };
  }, [pathname]);

  function handleAdminLinkClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (
      role !== "ADMIN" ||
      pathname !== "/admin" ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    const section = href.split("#")[1] ?? "overview";
    if (window.location.hash === `#${section}`) {
      setActiveSection(section);
      return;
    }
    window.location.hash = section;
  }

  useEffect(() => {
    let live = true;
    api<Staff>("/auth/me")
      .then((user) => {
        if (!live) return;
        if (user.role !== role) {
          router.replace("/login?next=" + encodeURIComponent(pathname));
          return;
        }
        setStaff(user);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login?next=" + encodeURIComponent(pathname));
        } else {
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, [pathname, role, router]);

  async function signOut() {
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } catch {
      /* the session may already be gone */
    }
    router.push("/login");
  }

  if (!ready)
    return (
      <div className="staff-loading" aria-label="Loading staff workspace">
        <span className="loading-mark" />
      </div>
    );

  return (
    <div className="staff-app">
      <aside className="staff-sidebar">
        <Link
          className="brand-lockup"
          href={role === "ADMIN" ? "/admin#overview" : "/admin"}
          onClick={(event) =>
            handleAdminLinkClick(
              event,
              role === "ADMIN" ? "/admin#overview" : "/admin",
            )
          }
          aria-label="FoodHub home"
        >
          <span className="brand-mark">
            <Utensils size={17} strokeWidth={1.8} />
          </span>
          <span>
            foodhub<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace-label">RESTAURANT WORKSPACE</div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">F</span>
          <span>
            <strong>FoodHub Kitchen</strong>
            <small>Local workspace</small>
          </span>
          <ArrowUpRight size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="staff-nav" aria-label="Staff navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const section =
              href.split("#")[1] ?? (role === "ADMIN" ? "overview" : "");
            const active = section
              ? pathname === "/admin" && activeSection === section
              : pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={(event) => handleAdminLinkClick(event, href)}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {label === "Live orders" ? (
                  <span className="nav-live-dot" />
                ) : null}
              </Link>
            );
          })}
          {role === "ADMIN" ? (
            <Link href="/kitchen" className="nav-secondary">
              <ChefHat size={17} strokeWidth={1.8} />
              <span>Kitchen display</span>
            </Link>
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          <div className="online-status">
            <span /> System connected
          </div>
          <div className="staff-profile">
            <span className="profile-avatar">
              {staff?.username.slice(0, 1).toUpperCase() ?? "S"}
            </span>
            <span className="profile-copy">
              <strong>{staff?.username ?? "Staff"}</strong>
              <small>
                {role === "ADMIN" ? "Administrator" : "Kitchen staff"}
              </small>
            </span>
            <button
              className="icon-button quiet"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="staff-main">
        <header className="staff-topbar">
          <div className="crumb">
            <span>FoodHub</span>
            <span className="crumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "Asia/Kolkata",
              }).format(new Date())}
            </span>
            <span className="avatar-mini">
              {staff?.username.slice(0, 1).toUpperCase() ?? "S"}
            </span>
          </div>
        </header>
        <div className="staff-content">
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                {role === "ADMIN" ? "MANAGEMENT" : "SERVICE IN PROGRESS"}
              </div>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="live-chip">
              <span /> Live updates
            </div>
          </div>
          {children}
        </div>
      </main>
      <nav className="mobile-staff-nav" aria-label="Mobile staff navigation">
        {links.map(({ href, label, icon: Icon }) => {
          const section =
            href.split("#")[1] ?? (role === "ADMIN" ? "overview" : "");
          const active = section
            ? pathname === "/admin" && activeSection === section
            : pathname === href;
          return (
            <Link
              href={href}
              key={href}
              onClick={(event) => handleAdminLinkClick(event, href)}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <ClipboardList size={18} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function Notice({
  children,
  kind = "error",
}: {
  children: React.ReactNode;
  kind?: "error" | "success" | "info";
}) {
  if (!children) return null;
  return (
    <div
      className={`notice notice-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

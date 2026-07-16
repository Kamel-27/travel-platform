"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Shared site header.
 * `overlay` renders it transparent over a hero image until the page is
 * scrolled, then it transitions to a solid surface. Pages using `overlay`
 * must pull the hero under the header with `-mt-16 pt-16` on the section.
 */
export default function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = user?.role === "technical_admin";
  const dashboardPath = isAdmin ? "/admin" : "/user-dashboard";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    // rAF for the initial check: avoids react-hooks/set-state-in-effect
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const transparent = overlay && !scrolled;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        transparent
          ? "bg-transparent"
          : "bg-surface-container-lowest dark:bg-inverse-surface shadow-md"
      }`}
    >
      <div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
        <div className="flex items-center gap-lg">
          <Link href="/">
            <span
              className={`font-headline-lg-mobile text-headline-lg-mobile font-bold cursor-pointer ${
                transparent ? "text-white drop-shadow-md" : "text-primary dark:text-inverse-primary"
              }`}
            >
              Safariyat
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-md">
            <Link
              className={`font-bold border-b-2 pb-1 font-label-md text-label-md ${
                transparent
                  ? "text-white border-white drop-shadow-md"
                  : "text-primary dark:text-inverse-primary border-primary dark:border-inverse-primary"
              }`}
              href="/"
            >
              رحلات طيران
            </Link>
            <Link
              className={`transition-colors font-label-md text-label-md ${
                transparent
                  ? "text-white/85 hover:text-white drop-shadow-md"
                  : "text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-inverse-primary"
              }`}
              href="/manage-bookings"
            >
              رحلاتي
            </Link>
            <Link
              className={`transition-colors font-label-md text-label-md ${
                transparent
                  ? "text-white/85 hover:text-white drop-shadow-md"
                  : "text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-inverse-primary"
              }`}
              href="/support"
            >
              الدعم
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-sm">
          {isAuthenticated ? (
            <div className="flex items-center gap-sm">
              <Link
                href={dashboardPath}
                className={`font-label-md text-label-md transition-colors ${
                  transparent
                    ? "text-white/85 hover:text-white drop-shadow-md"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                حسابي
              </Link>
              <button
                onClick={() => logout()}
                className={`px-md py-2 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                  transparent
                    ? "bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <Link
              href="/signin"
              className={`px-md py-2 rounded-lg font-label-md text-label-md scale-98 active:scale-95 transition-transform duration-200 text-center flex items-center justify-center ${
                transparent
                  ? "bg-white text-primary font-bold shadow-md"
                  : "bg-primary text-on-primary"
              }`}
            >
              تسجيل الدخول
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

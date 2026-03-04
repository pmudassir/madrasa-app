"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Receipt,
  GraduationCap,
  BarChart3,
  Settings,
  Activity,
  LogOut,

  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/events", label: "Events & Donations", icon: Calendar },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/teachers", label: "Teachers & Salaries", icon: GraduationCap },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/activity", label: "Activity Log", icon: Activity },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#e2e8f0]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#1e293b] rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#00c853]" />
          </div>
          <div>
            <div className="font-bold text-[#1e293b] text-[15px] leading-tight">Madrasa Manager</div>
            <div className="text-[11px] text-[#00c853] font-medium">Admin Portal</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-[#e8faf0] text-[#00c853] border-l-3 border-[#00c853]"
                  : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-1 border-t border-[#e2e8f0] pt-3">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-[#e8faf0] text-[#00c853]"
                  : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-all w-full cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1e293b] rounded-lg flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-[#00c853]" />
          </div>
          <span className="font-bold text-[#1e293b] text-sm">Madrasa Manager</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#f8fafc] transition cursor-pointer"
        >
          {mobileOpen ? <X className="w-5 h-5 text-[#1e293b]" /> : <Menu className="w-5 h-5 text-[#1e293b]" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] min-h-screen bg-white border-r border-[#e2e8f0] flex-col fixed left-0 top-0 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}

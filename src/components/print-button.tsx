"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print View" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] cursor-pointer inline-flex items-center gap-2"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
}

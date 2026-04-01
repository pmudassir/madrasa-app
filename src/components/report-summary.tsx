"use client";

export function SummaryGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{children}</div>;
}

export function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
      <p className="text-[11px] uppercase tracking-wider text-[#94a3b8] font-semibold">{label}</p>
      <p className="text-2xl font-bold text-[#1e293b] mt-2">{value}</p>
      {helper ? <p className="text-sm text-[#64748b] mt-1">{helper}</p> : null}
    </div>
  );
}

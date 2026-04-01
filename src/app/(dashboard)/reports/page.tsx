"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import { fetchJson } from "@/lib/fetcher";

type ReportsSummary = {
  admissions: number;
  families: number;
  members: number;
  fee_transactions: number;
  total_due: number;
  total_collected: number;
  total_pending: number;
  donations_collected: number;
  donations_offered: number;
  total_expenses: number;
  collector_balance: number;
  collectors: number;
  ledger_entries: number;
  transfers: number;
  expenses_count: number;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ReportsSummary | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetchJson<{ data: ReportsSummary }>("/api/reports/summary");
        setMetrics(response.data);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const summary = metrics || {
    admissions: 0,
    families: 0,
    members: 0,
    fee_transactions: 0,
    total_due: 0,
    total_collected: 0,
    total_pending: 0,
    donations_collected: 0,
    donations_offered: 0,
    total_expenses: 0,
    collector_balance: 0,
    collectors: 0,
    ledger_entries: 0,
    transfers: 0,
    expenses_count: 0,
  };

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1e293b]">Cross-Module Reports</h1>
        <p className="text-[#64748b] text-sm mt-1">High-level operational summary with direct links into the richer section reports.</p>
      </div>
      <PrintButton label="Print Summary" />

      <SummaryGrid>
        <SummaryCard label="Fee Due / Collected" value={`${formatCurrency(summary.total_due)} / ${formatCurrency(summary.total_collected)}`} helper={`Pending ${formatCurrency(summary.total_pending)}`} />
        <SummaryCard label="Donations" value={formatCurrency(summary.donations_collected)} helper={`Offered ${formatCurrency(summary.donations_offered)}`} />
        <SummaryCard label="Expenses" value={formatCurrency(summary.total_expenses)} helper={`Collectors holding ${formatCurrency(summary.collector_balance)}`} />
        <SummaryCard label="Admissions / Families" value={`${summary.admissions} / ${summary.families}`} helper={`${summary.members} family members tracked`} />
      </SummaryGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportTile
          title="Admissions & Fees"
          description="Open the fee section for class-wise, month-wise, due-status, and student-wise reporting."
          stats={[
            `Admissions: ${summary.admissions}`,
            `Fee transactions: ${summary.fee_transactions}`,
            `Pending: ${formatCurrency(summary.total_pending)}`,
          ]}
          href="/students"
        />
        <ReportTile
          title="Events & Donations"
          description="Open the donation section for event-wise, collector-wise, offered-vs-collected, and anonymous contribution reporting."
          stats={[
            `Collected: ${formatCurrency(summary.donations_collected)}`,
            `Offered: ${formatCurrency(summary.donations_offered)}`,
            `Transfers tracked: ${summary.transfers}`,
          ]}
          href="/events"
        />
        <ReportTile
          title="Collectors"
          description="Open the collector section for balances, ledger timeline, transfers in/out, and collector-level responsibility reports."
          stats={[
            `Collectors: ${summary.collectors}`,
            `Balance held: ${formatCurrency(summary.collector_balance)}`,
            `Ledger entries: ${summary.ledger_entries}`,
          ]}
          href="/collectors"
        />
        <ReportTile
          title="Expenses"
          description="Open the expense section for category breakdown, paid-by reporting, and date-range spending reports."
          stats={[
            `Expenses: ${summary.expenses_count}`,
            `Total spend: ${formatCurrency(summary.total_expenses)}`,
            `Families: ${summary.families}`,
          ]}
          href="/expenses"
        />
      </div>

      {loading ? <p className="text-sm text-[#94a3b8]">Refreshing report data...</p> : null}
    </div>
  );
}

function ReportTile({
  title,
  description,
  stats,
  href,
}: {
  title: string;
  description: string;
  stats: string[];
  href: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-[#1e293b]">{title}</h2>
        <p className="text-sm text-[#64748b] mt-1">{description}</p>
      </div>
      <div className="space-y-2">
        {stats.map((stat) => (
          <p key={stat} className="text-sm text-[#334155]">{stat}</p>
        ))}
      </div>
      <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold text-[#00c853] hover:underline">
        Open section report <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

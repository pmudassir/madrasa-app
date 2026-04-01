"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import type { Collector, CollectorLedgerEntry } from "@/lib/types";

export default function CollectorDetailPage() {
  const supabase = createClient();
  const { id } = useParams<{ id: string }>();
  const [collector, setCollector] = useState<Collector | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<CollectorLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [collectorRes, ledgerRes] = await Promise.all([
      supabase.from("collectors").select("*").eq("id", id).single(),
      supabase.from("collector_ledger_entries").select("*").eq("collector_id", id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    setCollector((collectorRes.data || null) as Collector | null);
    setLedgerEntries((ledgerRes.data || []) as CollectorLedgerEntry[]);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    async function run() {
      await loadData();
    }

    void run();
  }, [loadData]);

  const totals = useMemo(() => {
    return {
      collections: ledgerEntries
        .filter((entry) => entry.movement_type === "fee_collection" || entry.movement_type === "donation_collection")
        .reduce((sum, entry) => sum + Number(entry.amount_delta), 0),
      transfersIn: ledgerEntries
        .filter((entry) => entry.movement_type === "transfer_in")
        .reduce((sum, entry) => sum + Number(entry.amount_delta), 0),
      transfersOut: Math.abs(
        ledgerEntries
          .filter((entry) => entry.movement_type === "transfer_out")
          .reduce((sum, entry) => sum + Number(entry.amount_delta), 0)
      ),
      expenses: Math.abs(
        ledgerEntries
          .filter((entry) => entry.movement_type === "expense")
          .reduce((sum, entry) => sum + Number(entry.amount_delta), 0)
      ),
    };
  }, [ledgerEntries]);

  if (loading) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Loading collector...</div>;
  }

  if (!collector) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Collector not found.</div>;
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="text-sm text-[#64748b]">
        <Link href="/collectors" className="text-[#00c853] hover:underline">Collectors</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">{collector.name}</span>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
        <h1 className="text-2xl font-bold text-[#1e293b]">{collector.name}</h1>
        <p className="text-sm text-[#64748b] mt-2">
          Phone: {collector.phone || "—"} • WhatsApp: {collector.whatsapp_no || "—"}
        </p>
        {collector.notes ? <p className="text-sm text-[#334155] mt-4">{collector.notes}</p> : null}
      </div>

      <SummaryGrid>
        <SummaryCard label="Current Balance" value={formatCurrency(Number(collector.current_balance))} helper={`Opening ${formatCurrency(Number(collector.opening_balance))}`} />
        <SummaryCard label="Collections" value={formatCurrency(totals.collections)} helper="Fees + donations" />
        <SummaryCard label="Transfers In / Out" value={`${formatCurrency(totals.transfersIn)} / ${formatCurrency(totals.transfersOut)}`} />
        <SummaryCard label="Expenses Paid" value={formatCurrency(totals.expenses)} />
      </SummaryGrid>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        <div className="p-5 border-b border-[#f1f5f9]">
          <h2 className="text-lg font-bold text-[#1e293b]">Running Ledger</h2>
        </div>
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
              <th className="text-left px-6 py-4 font-medium">Date</th>
              <th className="text-left px-4 py-4 font-medium">Movement</th>
              <th className="text-left px-4 py-4 font-medium">Counterparty</th>
              <th className="text-left px-4 py-4 font-medium">Reference</th>
              <th className="text-left px-4 py-4 font-medium">Description</th>
              <th className="text-right px-6 py-4 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledgerEntries.map((entry) => (
              <tr key={`${entry.id}-${entry.movement_type}-${entry.collector_id}`} className="border-b border-[#f1f5f9]">
                <td className="px-6 py-4 text-sm">{formatDate(entry.entry_date || entry.created_at)}</td>
                <td className="px-4 py-4 text-sm capitalize">{entry.movement_type.replaceAll("_", " ")}</td>
                <td className="px-4 py-4 text-sm">{entry.counterparty_name || "—"}</td>
                <td className="px-4 py-4 text-sm">{entry.reference_no || "—"}</td>
                <td className="px-4 py-4 text-sm">{entry.description || "—"}</td>
                <td className={`px-6 py-4 text-sm text-right font-semibold ${Number(entry.amount_delta) >= 0 ? "text-[#00c853]" : "text-red-500"}`}>
                  {formatCurrency(Number(entry.amount_delta))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

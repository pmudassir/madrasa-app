"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Eye, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchJson } from "@/lib/fetcher";
import { buildCsv, downloadCsv, formatCurrency, formatDate } from "@/lib/format";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import { PrintButton } from "@/components/print-button";
import { useToast } from "@/components/toast";
import type { Collector, CollectorLedgerEntry } from "@/lib/types";

export default function CollectorsPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<CollectorLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCollectorForm, setShowCollectorForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [collectorForm, setCollectorForm] = useState({
    name: "",
    phone: "",
    whatsapp_no: "",
    notes: "",
    opening_balance: "",
  });
  const [transferForm, setTransferForm] = useState({
    from_collector_id: "",
    to_collector_id: "",
    amount: "",
    transfer_date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [collectorFilter, setCollectorFilter] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [collectorsRes, ledgerRes] = await Promise.all([
      supabase.from("collectors").select("*").order("name"),
      supabase.from("collector_ledger_entries").select("*").order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);

    setCollectors((collectorsRes.data || []) as Collector[]);
    setLedgerEntries((ledgerRes.data || []) as CollectorLedgerEntry[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLedger = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      const matchesCollector = !collectorFilter || entry.collector_id === collectorFilter;
      const matchesMovement = !movementFilter || entry.movement_type === movementFilter;
      const date = entry.entry_date ? new Date(entry.entry_date) : new Date(entry.created_at);
      const matchesFrom = !dateFrom || date >= new Date(`${dateFrom}T00:00:00`);
      const matchesTo = !dateTo || date <= new Date(`${dateTo}T23:59:59`);
      return matchesCollector && matchesMovement && matchesFrom && matchesTo;
    });
  }, [collectorFilter, dateFrom, dateTo, ledgerEntries, movementFilter]);

  const filteredCollectors = collectors.filter((collector) => !collectorFilter || collector.id === collectorFilter);
  const currentBalance = filteredCollectors.reduce((sum, collector) => sum + Number(collector.current_balance), 0);
  const totalCollected = filteredLedger
    .filter((entry) => entry.movement_type === "fee_collection" || entry.movement_type === "donation_collection")
    .reduce((sum, entry) => sum + Number(entry.amount_delta), 0);
  const transfersIn = filteredLedger
    .filter((entry) => entry.movement_type === "transfer_in")
    .reduce((sum, entry) => sum + Number(entry.amount_delta), 0);
  const transfersOut = Math.abs(
    filteredLedger
      .filter((entry) => entry.movement_type === "transfer_out")
      .reduce((sum, entry) => sum + Number(entry.amount_delta), 0)
  );
  const expensesPaid = Math.abs(
    filteredLedger
      .filter((entry) => entry.movement_type === "expense")
      .reduce((sum, entry) => sum + Number(entry.amount_delta), 0)
  );

  async function handleCreateCollector(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await fetchJson("/api/collectors", {
        method: "POST",
        body: JSON.stringify({
          ...collectorForm,
          opening_balance: Number(collectorForm.opening_balance || 0),
        }),
      });
      success("Collector created successfully");
      setCollectorForm({ name: "", phone: "", whatsapp_no: "", notes: "", opening_balance: "" });
      setShowCollectorForm(false);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to create collector");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await fetchJson("/api/collectors/transfers", {
        method: "POST",
        body: JSON.stringify({
          ...transferForm,
          amount: Number(transferForm.amount || 0),
        }),
      });
      success("Transfer recorded successfully");
      setTransferForm({
        from_collector_id: "",
        to_collector_id: "",
        amount: "",
        transfer_date: new Date().toISOString().split("T")[0],
        note: "",
      });
      setShowTransferForm(false);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to record transfer");
    } finally {
      setSaving(false);
    }
  }

  function exportLedger() {
    const rows: Array<Array<string | number>> = [["Date", "Collector", "Movement", "Reference", "Counterparty", "Amount"]];
    filteredLedger.forEach((entry) => {
      const collector = collectors.find((item) => item.id === entry.collector_id);
      rows.push([
        formatDate(entry.entry_date || entry.created_at),
        collector?.name || "—",
        entry.movement_type,
        entry.reference_no || "—",
        entry.counterparty_name || "—",
        entry.amount_delta,
      ]);
    });
    downloadCsv("collector-ledger.csv", buildCsv(rows));
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Collectors</h1>
          <p className="text-[#64748b] text-sm mt-1">Track every cash holder, movement, balance, and handover trail.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrintButton label="Print Ledger" />
          <button onClick={exportLedger} className="border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] cursor-pointer">
            Export Ledger CSV
          </button>
          <button onClick={() => setShowTransferForm(true)} className="border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-medium text-[#334155] flex items-center gap-2 hover:bg-[#f8fafc] cursor-pointer">
            <ArrowRightLeft className="w-4 h-4" /> Transfer
          </button>
          <button onClick={() => setShowCollectorForm(true)} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add Collector
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Collectors</option>
          {collectors.map((collector) => (
            <option key={collector.id} value={collector.id}>{collector.name}</option>
          ))}
        </select>

        <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Movements</option>
          <option value="fee_collection">Fee collections</option>
          <option value="donation_collection">Donation collections</option>
          <option value="expense">Expenses</option>
          <option value="transfer_in">Transfers in</option>
          <option value="transfer_out">Transfers out</option>
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
      </div>

      <SummaryGrid>
        <SummaryCard label="Current Balance" value={formatCurrency(currentBalance)} helper="Live from collector balances" />
        <SummaryCard label="Collected" value={formatCurrency(totalCollected)} helper="Fees + donations" />
        <SummaryCard label="Transfers In / Out" value={`${formatCurrency(transfersIn)} / ${formatCurrency(transfersOut)}`} helper="Within filtered view" />
        <SummaryCard label="Expenses Paid" value={formatCurrency(expensesPaid)} helper="Deducted from collector balances" />
      </SummaryGrid>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
          <div className="p-5 border-b border-[#f1f5f9]">
            <h2 className="text-lg font-bold text-[#1e293b]">Collector Balances</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[#94a3b8]">Loading collectors...</div>
          ) : (
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                  <th className="text-left px-6 py-4 font-medium">Collector</th>
                  <th className="text-left px-4 py-4 font-medium">Phone</th>
                  <th className="text-right px-4 py-4 font-medium">Opening</th>
                  <th className="text-right px-4 py-4 font-medium">Current</th>
                  <th className="text-right px-6 py-4 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollectors.map((collector) => (
                  <tr key={collector.id} className="border-b border-[#f1f5f9]">
                    <td className="px-6 py-4 text-sm font-medium text-[#1e293b]">{collector.name}</td>
                    <td className="px-4 py-4 text-sm text-[#334155]">{collector.phone || "—"}</td>
                    <td className="px-4 py-4 text-sm text-right">{formatCurrency(Number(collector.opening_balance))}</td>
                    <td className="px-4 py-4 text-sm text-right font-semibold text-[#00c853]">{formatCurrency(Number(collector.current_balance))}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/collectors/${collector.id}`} className="inline-flex items-center gap-1 text-[#00c853] text-sm font-semibold hover:underline">
                        <Eye className="w-4 h-4" /> Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
          <div className="p-5 border-b border-[#f1f5f9]">
            <h2 className="text-lg font-bold text-[#1e293b]">Ledger Report</h2>
          </div>
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Date</th>
                <th className="text-left px-4 py-4 font-medium">Collector</th>
                <th className="text-left px-4 py-4 font-medium">Movement</th>
                <th className="text-left px-4 py-4 font-medium">Counterparty</th>
                <th className="text-right px-6 py-4 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((entry) => {
                const collector = collectors.find((item) => item.id === entry.collector_id);
                return (
                  <tr key={`${entry.id}-${entry.collector_id}-${entry.movement_type}`} className="border-b border-[#f1f5f9]">
                    <td className="px-6 py-4 text-sm">{formatDate(entry.entry_date || entry.created_at)}</td>
                    <td className="px-4 py-4 text-sm">{collector?.name || "—"}</td>
                    <td className="px-4 py-4 text-sm capitalize">{entry.movement_type.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4 text-sm">{entry.counterparty_name || entry.reference_no || "—"}</td>
                    <td className={`px-6 py-4 text-sm text-right font-semibold ${Number(entry.amount_delta) >= 0 ? "text-[#00c853]" : "text-red-500"}`}>
                      {formatCurrency(Number(entry.amount_delta))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCollectorForm ? (
        <Modal title="Add Collector" onClose={() => setShowCollectorForm(false)}>
          <form onSubmit={handleCreateCollector} className="space-y-4">
            <FormField label="Name"><input type="text" required value={collectorForm.name} onChange={(e) => setCollectorForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></FormField>
            <FormField label="Phone"><input type="tel" value={collectorForm.phone} onChange={(e) => setCollectorForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></FormField>
            <FormField label="WhatsApp"><input type="tel" value={collectorForm.whatsapp_no} onChange={(e) => setCollectorForm((prev) => ({ ...prev, whatsapp_no: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></FormField>
            <FormField label="Opening Balance"><input type="number" min="0" value={collectorForm.opening_balance} onChange={(e) => setCollectorForm((prev) => ({ ...prev, opening_balance: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></FormField>
            <FormField label="Notes"><textarea value={collectorForm.notes} onChange={(e) => setCollectorForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none" /></FormField>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCollectorForm(false)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer">{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showTransferForm ? (
        <Modal title="Transfer Balance" onClose={() => setShowTransferForm(false)}>
          <form onSubmit={handleTransfer} className="space-y-4">
            <FormField label="From Collector">
              <select value={transferForm.from_collector_id} onChange={(e) => setTransferForm((prev) => ({ ...prev, from_collector_id: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                <option value="">Select sender</option>
                {collectors.map((collector) => (
                  <option key={collector.id} value={collector.id}>{collector.name} ({formatCurrency(Number(collector.current_balance))})</option>
                ))}
              </select>
            </FormField>
            <FormField label="To Collector">
              <select value={transferForm.to_collector_id} onChange={(e) => setTransferForm((prev) => ({ ...prev, to_collector_id: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                <option value="">Select receiver</option>
                {collectors.map((collector) => (
                  <option key={collector.id} value={collector.id}>{collector.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Amount"><input type="number" min="1" value={transferForm.amount} onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></FormField>
            <FormField label="Transfer Date"><input type="date" value={transferForm.transfer_date} onChange={(e) => setTransferForm((prev) => ({ ...prev, transfer_date: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></FormField>
            <FormField label="Note"><textarea value={transferForm.note} onChange={(e) => setTransferForm((prev) => ({ ...prev, note: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none" /></FormField>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowTransferForm(false)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer">{saving ? "Saving..." : "Transfer"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#1e293b] mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#1e293b] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

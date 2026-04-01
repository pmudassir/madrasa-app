"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchJson } from "@/lib/fetcher";
import { formatCurrency, formatDate } from "@/lib/format";
import { getReceiptDownloadUrl } from "@/lib/receipt-utils";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import { useToast } from "@/components/toast";
import type { Collector, Donation, MadrasaEvent } from "@/lib/types";
import { relationItem } from "@/lib/relation-utils";

export default function EventDetailPage() {
  const supabase = createClient();
  const { id } = useParams<{ id: string }>();
  const { success, error: showError } = useToast();
  const [event, setEvent] = useState<MadrasaEvent | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCollectForm, setShowCollectForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [form, setForm] = useState({
    donor_name: "",
    amount: "",
    notes: "",
    status: "collected",
    collected_by_collector_id: "",
    effective_date: new Date().toISOString().split("T")[0],
  });
  const [collectForm, setCollectForm] = useState({
    collected_by_collector_id: "",
    collected_at: new Date().toISOString().split("T")[0],
  });

  const loadData = useCallback(async () => {
    setLoading(true);

    const [eventRes, donationRes, collectorRes] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).single(),
      supabase.from("donations").select("*, collectors(id, name), events(id, title)").eq("event_id", id).order("created_at", { ascending: false }),
      supabase.from("collectors").select("*").eq("is_active", true).order("name"),
    ]);

    setEvent((eventRes.data || null) as MadrasaEvent | null);
    setDonations((donationRes.data || []) as Donation[]);
    setCollectors((collectorRes.data || []) as Collector[]);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDonations = useMemo(() => {
    return donations.filter((donation) => {
      const matchesStatus = !statusFilter || donation.status === statusFilter;
      const matchesCollector = !collectorFilter || donation.collected_by_collector_id === collectorFilter;
      return matchesStatus && matchesCollector;
    });
  }, [collectorFilter, donations, statusFilter]);

  const offeredTotal = filteredDonations.filter((donation) => donation.status === "offered").reduce((sum, donation) => sum + Number(donation.amount), 0);
  const collectedTotal = filteredDonations.filter((donation) => donation.status === "collected").reduce((sum, donation) => sum + Number(donation.amount), 0);

  async function handleSaveDonation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await fetchJson("/api/donations", {
        method: "POST",
        body: JSON.stringify({
          event_id: id,
          donor_name: form.donor_name || null,
          amount: Number(form.amount || 0),
          notes: form.notes || null,
          status: form.status,
          collected_by_collector_id: form.status === "collected" ? form.collected_by_collector_id : null,
          effective_date: form.effective_date,
        }),
      });

      success(form.status === "collected" ? "Donation recorded successfully" : "Offered donation saved");
      setShowForm(false);
      setForm({
        donor_name: "",
        amount: "",
        notes: "",
        status: "collected",
        collected_by_collector_id: "",
        effective_date: new Date().toISOString().split("T")[0],
      });
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save donation");
    } finally {
      setSaving(false);
    }
  }

  async function handleCollectOfferedDonation(e: React.FormEvent) {
    e.preventDefault();
    if (!showCollectForm) return;
    setSaving(true);

    try {
      await fetchJson(`/api/donations/${showCollectForm}/collect`, {
        method: "POST",
        body: JSON.stringify(collectForm),
      });
      success("Offered donation marked as collected");
      setShowCollectForm(null);
      setCollectForm({
        collected_by_collector_id: "",
        collected_at: new Date().toISOString().split("T")[0],
      });
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to collect donation");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Loading event...</div>;
  }

  if (!event) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Event not found.</div>;
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="text-sm text-[#64748b]">
        <Link href="/events" className="text-[#00c853] hover:underline">Events</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">{event.title}</span>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
        <h1 className="text-2xl font-bold text-[#1e293b]">{event.title}</h1>
        <p className="text-sm text-[#64748b] mt-2">
          {formatDate(event.event_date)} • Host: {event.host || "—"} • Scholar: {event.scholar_name || "—"}
        </p>
        {event.description ? <p className="text-sm text-[#334155] mt-4">{event.description}</p> : null}
      </div>

      <SummaryGrid>
        <SummaryCard label="Collected" value={formatCurrency(collectedTotal)} helper="Cash already received" />
        <SummaryCard label="Offered" value={formatCurrency(offeredTotal)} helper="Pending collection" />
        <SummaryCard label="Donations" value={String(filteredDonations.length)} helper="Current filtered records" />
        <SummaryCard label="Collectors Used" value={String(new Set(filteredDonations.map((donation) => donation.collected_by_collector_id).filter(Boolean)).size)} />
      </SummaryGrid>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            <option value="">All Status</option>
            <option value="offered">Offered</option>
            <option value="collected">Collected</option>
          </select>
          <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            <option value="">All Collectors</option>
            {collectors.map((collector) => (
              <option key={collector.id} value={collector.id}>{collector.name}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm cursor-pointer">
          <Plus className="w-4 h-4" /> Add Donation
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        <table className="w-full min-w-[840px]">
          <thead>
            <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
              <th className="text-left px-6 py-4 font-medium">Donor</th>
              <th className="text-left px-4 py-4 font-medium">Status</th>
              <th className="text-left px-4 py-4 font-medium">Collector</th>
              <th className="text-left px-4 py-4 font-medium">Reference</th>
              <th className="text-left px-4 py-4 font-medium">Date</th>
              <th className="text-right px-4 py-4 font-medium">Amount</th>
              <th className="text-right px-6 py-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredDonations.map((donation) => {
              const receiptUrl = getReceiptDownloadUrl(donation.receipt_pdf_path);
              return (
                <tr key={donation.id} className="border-b border-[#f1f5f9]">
                  <td className="px-6 py-4 text-sm font-medium text-[#1e293b]">{donation.donor_name || "Anonymous"}</td>
                  <td className="px-4 py-4 text-sm capitalize">{donation.status}</td>
                  <td className="px-4 py-4 text-sm">{relationItem(donation.collectors)?.name || "—"}</td>
                  <td className="px-4 py-4 text-sm">{donation.receipt_no || "Pending"}</td>
                  <td className="px-4 py-4 text-sm">{formatDate(donation.collected_at || donation.offered_at || donation.created_at)}</td>
                  <td className="px-4 py-4 text-sm text-right font-semibold text-[#00c853]">{formatCurrency(Number(donation.amount))}</td>
                  <td className="px-6 py-4 text-right">
                    {donation.status === "offered" ? (
                      <button onClick={() => setShowCollectForm(donation.id)} className="text-sm text-[#00c853] font-semibold hover:underline cursor-pointer">
                        Mark Collected
                      </button>
                    ) : receiptUrl ? (
                      <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#00c853] font-semibold hover:underline">
                        <Download className="w-4 h-4" /> Receipt
                      </a>
                    ) : (
                      <span className="text-xs text-[#94a3b8]">No receipt</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Add Donation</h2>
            <form onSubmit={handleSaveDonation} className="space-y-4">
              <Field label="Donor Name"><input type="text" value={form.donor_name} onChange={(e) => setForm((prev) => ({ ...prev, donor_name: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" placeholder="Anonymous if left blank" /></Field>
              <Field label="Amount"><input type="number" min="1" required value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                  <option value="collected">Collected</option>
                  <option value="offered">Offered</option>
                </select>
              </Field>
              {form.status === "collected" ? (
                <Field label="Collected By">
                  <select value={form.collected_by_collector_id} onChange={(e) => setForm((prev) => ({ ...prev, collected_by_collector_id: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                    <option value="">Select collector</option>
                    {collectors.map((collector) => (
                      <option key={collector.id} value={collector.id}>{collector.name}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label={form.status === "collected" ? "Collected Date" : "Offer Date"}>
                <input type="date" value={form.effective_date} onChange={(e) => setForm((prev) => ({ ...prev, effective_date: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
              </Field>
              <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none" /></Field>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer">
                  {saving ? "Saving..." : "Save Donation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCollectForm ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCollectForm(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Mark Donation as Collected</h2>
            <form onSubmit={handleCollectOfferedDonation} className="space-y-4">
              <Field label="Collected By">
                <select value={collectForm.collected_by_collector_id} onChange={(e) => setCollectForm((prev) => ({ ...prev, collected_by_collector_id: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                  <option value="">Select collector</option>
                  {collectors.map((collector) => (
                    <option key={collector.id} value={collector.id}>{collector.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Collected On">
                <input type="date" value={collectForm.collected_at} onChange={(e) => setCollectForm((prev) => ({ ...prev, collected_at: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
              </Field>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCollectForm(null)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer">
                  {saving ? "Saving..." : "Mark Collected"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#1e293b] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

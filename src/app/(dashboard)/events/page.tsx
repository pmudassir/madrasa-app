"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchJson } from "@/lib/fetcher";
import { buildCsv, downloadCsv, formatCurrency, formatDate } from "@/lib/format";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import { PrintButton } from "@/components/print-button";
import { useToast } from "@/components/toast";
import type { Collector, Donation, MadrasaEvent } from "@/lib/types";
import { relationItem } from "@/lib/relation-utils";

export default function EventsPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [events, setEvents] = useState<MadrasaEvent[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: new Date().toISOString().split("T")[0],
    host: "",
    scholar_name: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [eventsRes, donationsRes, collectorsRes] = await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: false }),
      supabase.from("donations").select("*, collectors(id, name), events(id, title, host, scholar_name)").order("created_at", { ascending: false }),
      supabase.from("collectors").select("*").eq("is_active", true).order("name"),
    ]);

    setEvents((eventsRes.data || []) as MadrasaEvent[]);
    setDonations((donationsRes.data || []) as Donation[]);
    setCollectors((collectorsRes.data || []) as Collector[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      return (
        !search ||
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        (event.host || "").toLowerCase().includes(search.toLowerCase()) ||
        (event.scholar_name || "").toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [events, search]);

  const allowedEventIds = new Set(filteredEvents.filter((event) => !eventFilter || event.id === eventFilter).map((event) => event.id));

  const filteredDonations = donations.filter((donation) => {
    const eventDate = donation.collected_at || donation.offered_at || donation.created_at;
    const date = new Date(eventDate);
    const matchesEvent = allowedEventIds.has(donation.event_id);
    const matchesCollector = !collectorFilter || donation.collected_by_collector_id === collectorFilter;
    const matchesStatus = !statusFilter || donation.status === statusFilter;
    const matchesFrom = !dateFrom || date >= new Date(`${dateFrom}T00:00:00`);
    const matchesTo = !dateTo || date <= new Date(`${dateTo}T23:59:59`);
    return matchesEvent && matchesCollector && matchesStatus && matchesFrom && matchesTo;
  });

  const offeredTotal = filteredDonations.filter((donation) => donation.status === "offered").reduce((sum, donation) => sum + Number(donation.amount), 0);
  const collectedTotal = filteredDonations.filter((donation) => donation.status === "collected").reduce((sum, donation) => sum + Number(donation.amount), 0);
  const anonymousTotal = filteredDonations.filter((donation) => donation.status === "collected" && !donation.donor_name).reduce((sum, donation) => sum + Number(donation.amount), 0);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await fetchJson("/api/events", {
        method: "POST",
        body: JSON.stringify(form),
      });
      success("Event created successfully");
      setForm({
        title: "",
        description: "",
        event_date: new Date().toISOString().split("T")[0],
        host: "",
        scholar_name: "",
      });
      setShowForm(false);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to create event");
    } finally {
      setSaving(false);
    }
  }

  function exportDonations() {
    const rows: Array<Array<string | number>> = [["Event", "Donor", "Status", "Collector", "Date", "Amount"]];
    filteredDonations.forEach((donation) => {
      const event = relationItem(donation.events);
      const collector = relationItem(donation.collectors);
      rows.push([
        event?.title || "—",
        donation.donor_name || "Anonymous",
        donation.status,
        collector?.name || "—",
        formatDate(donation.collected_at || donation.offered_at || donation.created_at),
        donation.amount,
      ]);
    });
    downloadCsv("donation-report.csv", buildCsv(rows));
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Events & Donations</h1>
          <p className="text-[#64748b] text-sm mt-1">Track hosted events, scholar visits, donation offers, and collected cash by collector.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrintButton label="Print Donation Report" />
          <button onClick={exportDonations} className="border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] cursor-pointer">
            Export Donation CSV
          </button>
          <button onClick={() => setShowForm(true)} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search event, host, scholar..." className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Events</option>
          {filteredEvents.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
        <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Collectors</option>
          {collectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Donation Status</option>
          <option value="offered">Offered</option>
          <option value="collected">Collected</option>
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
        </div>
      </div>

      <SummaryGrid>
        <SummaryCard label="Events" value={String(filteredEvents.length)} helper="Filtered by title, host, scholar" />
        <SummaryCard label="Collected" value={formatCurrency(collectedTotal)} helper="Cash already received" />
        <SummaryCard label="Offered" value={formatCurrency(offeredTotal)} helper="Still pending to collect" />
        <SummaryCard label="Anonymous Collected" value={formatCurrency(anonymousTotal)} helper="No donor name recorded" />
      </SummaryGrid>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
          <div className="p-5 border-b border-[#f1f5f9]">
            <h2 className="text-lg font-bold text-[#1e293b]">Events</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[#94a3b8]">Loading events...</div>
          ) : (
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                  <th className="text-left px-6 py-4 font-medium">Event</th>
                  <th className="text-left px-4 py-4 font-medium">Date</th>
                  <th className="text-left px-4 py-4 font-medium">Host</th>
                  <th className="text-left px-4 py-4 font-medium">Scholar</th>
                  <th className="text-right px-6 py-4 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b border-[#f1f5f9]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#e8faf0] flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-[#00c853]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1e293b]">{event.title}</p>
                          <p className="text-xs text-[#64748b]">{event.description || "No description"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">{formatDate(event.event_date)}</td>
                    <td className="px-4 py-4 text-sm">{event.host || "—"}</td>
                    <td className="px-4 py-4 text-sm">{event.scholar_name || "—"}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/events/${event.id}`} className="text-[#00c853] text-sm font-semibold hover:underline">
                        View
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
            <h2 className="text-lg font-bold text-[#1e293b]">Donation Report</h2>
          </div>
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Event</th>
                <th className="text-left px-4 py-4 font-medium">Donor</th>
                <th className="text-left px-4 py-4 font-medium">Status</th>
                <th className="text-left px-4 py-4 font-medium">Collector</th>
                <th className="text-left px-4 py-4 font-medium">Date</th>
                <th className="text-right px-6 py-4 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredDonations.map((donation) => (
                <tr key={donation.id} className="border-b border-[#f1f5f9]">
                  <td className="px-6 py-4 text-sm">{relationItem(donation.events)?.title || "—"}</td>
                  <td className="px-4 py-4 text-sm">{donation.donor_name || "Anonymous"}</td>
                  <td className="px-4 py-4 text-sm capitalize">{donation.status}</td>
                  <td className="px-4 py-4 text-sm">{relationItem(donation.collectors)?.name || "—"}</td>
                  <td className="px-4 py-4 text-sm">{formatDate(donation.collected_at || donation.offered_at || donation.created_at)}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-[#00c853]">{formatCurrency(Number(donation.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Create Event</h2>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <Field label="Title"><input type="text" required value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
              <Field label="Date"><input type="date" value={form.event_date} onChange={(e) => setForm((prev) => ({ ...prev, event_date: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
              <Field label="Host"><input type="text" value={form.host} onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
              <Field label="Scholar Name"><input type="text" value={form.scholar_name} onChange={(e) => setForm((prev) => ({ ...prev, scholar_name: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
              <Field label="Description"><textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none" /></Field>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer">{saving ? "Saving..." : "Create Event"}</button>
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

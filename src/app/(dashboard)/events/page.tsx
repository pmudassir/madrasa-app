"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { logActivity } from "@/lib/activity-logger";
import ConfirmDialog from "@/components/confirm-dialog";
import { Plus, Search, Calendar, Trash2 } from "lucide-react";
import Link from "next/link";

export default function EventsPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", event_date: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    const { data: evts } = await supabase.from("events").select("*").order("event_date", { ascending: false });
    if (!evts) { setLoading(false); return; }
    const { data: donations } = await supabase.from("donations").select("event_id, amount");
    const totals: Record<string, number> = {};
    (donations || []).forEach((d: any) => { totals[d.event_id] = (totals[d.event_id] || 0) + Number(d.amount); });
    setEvents(evts.map(e => ({ ...e, total_donations: totals[e.id] || 0 })));
    setLoading(false);
  }

  function validateEventForm() {
    const errors: Record<string, string> = {};
    if (!newEvent.title.trim()) errors.title = "Event title is required";
    if (!newEvent.event_date) errors.event_date = "Event date is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEventForm()) return;
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) { showError("Could not load profile"); setSaving(false); return; }
    const { error } = await supabase.from("events").insert({ ...newEvent, madrasa_id: profile.madrasa_id });
    if (error) {
      showError("Failed to create event: " + error.message);
    } else {
      await logActivity("events", `Created new event: ${newEvent.title}`, "event");
      success(`Event "${newEvent.title}" created successfully!`);
      setNewEvent({ title: "", description: "", event_date: "" });
      setShowNewForm(false);
      loadEvents();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete donations first (FK constraint)
    await supabase.from("donations").delete().eq("event_id", deleteTarget.id);
    const { error } = await supabase.from("events").delete().eq("id", deleteTarget.id);
    if (error) {
      showError("Failed to delete event: " + error.message);
    } else {
      await logActivity("events", `Deleted event: ${deleteTarget.title}`, "event");
      success(`Event "${deleteTarget.title}" has been deleted.`);
      loadEvents();
    }
    setDeleteTarget(null);
    setDeleting(false);
  }

  const filtered = events.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));
  const totalDonations = events.reduce((s, e) => s + e.total_donations, 0);
  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Events & Donations</h1>
          <p className="text-[#64748b] text-sm mt-1">Manage school events and track charitable contributions.</p>
        </div>
        <button onClick={() => { setShowNewForm(true); setFormErrors({}); }}
          className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition cursor-pointer w-fit">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {/* New Event Modal */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowNewForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Create New Event</h2>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Event Title</label>
                <input type="text" value={newEvent.title} onChange={e => { setNewEvent(p => ({ ...p, title: e.target.value })); setFormErrors(p => ({ ...p, title: "" })); }}
                  placeholder="e.g., Annual Community Iftar" className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 ${formErrors.title ? "border-red-400" : "border-[#e2e8f0]"}`} />
                {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Description</label>
                <textarea value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of the event" rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Event Date</label>
                <input type="date" value={newEvent.event_date} onChange={e => { setNewEvent(p => ({ ...p, event_date: e.target.value })); setFormErrors(p => ({ ...p, event_date: "" })); }}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 ${formErrors.event_date ? "border-red-400" : "border-[#e2e8f0]"}`} />
                {formErrors.event_date && <p className="text-red-500 text-xs mt-1">{formErrors.event_date}</p>}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition disabled:opacity-50 cursor-pointer">
                  {saving ? "Creating..." : "Create Event"}
                </button>
                <button type="button" onClick={() => setShowNewForm(false)} className="text-[#64748b] text-sm cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 my-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input type="text" placeholder="Search events by title..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] mb-6 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-[#94a3b8]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[#94a3b8]">No events yet. Create your first event!</div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Event Title</th>
                <th className="text-left px-4 py-4 font-medium">Date</th>
                <th className="text-left px-4 py-4 font-medium">Description</th>
                <th className="text-right px-4 py-4 font-medium">Total Donations</th>
                <th className="text-right px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(event => (
                <tr key={event.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-6 py-4">
                    <Link href={`/events/${event.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="w-8 h-8 rounded-lg bg-[#e8faf0] flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-[#00c853]" />
                      </div>
                      <span className="text-sm font-semibold text-[#1e293b]">{event.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{fmtDate(event.event_date)}</td>
                  <td className="px-4 py-4 text-sm text-[#64748b] max-w-[300px] truncate">{event.description || "—"}</td>
                  <td className="px-4 py-4 text-right">
                    <span className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-1 text-sm font-semibold text-[#1e293b]">{fmt(event.total_donations)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(event); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748b] hover:text-red-500 transition cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
          <p className="text-sm text-[#64748b]">Total Events</p>
          <p className="text-2xl font-bold text-[#1e293b] mt-2">{events.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
          <p className="text-sm text-[#64748b]">Total Donations</p>
          <p className="text-2xl font-bold text-[#1e293b] mt-2">{fmt(totalDonations)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
          <p className="text-sm text-[#64748b]">Avg per Event</p>
          <p className="text-2xl font-bold text-[#1e293b] mt-2">{events.length ? fmt(totalDonations / events.length) : "₹0"}</p>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? All donations for this event will also be removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

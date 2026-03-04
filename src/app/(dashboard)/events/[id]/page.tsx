"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-logger";
import { Plus, Calendar, MoreVertical } from "lucide-react";
import Link from "next/link";
import type { Donation, MadrasaEvent } from "@/lib/types";

export default function EventDetailPage() {
  const supabase = createClient();
  const { id } = useParams();
  const [event, setEvent] = useState<MadrasaEvent | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [donationForm, setDonationForm] = useState({ donor_name: "", amount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) loadEvent(); }, [id]);

  async function loadEvent() {
    const { data: evt } = await supabase.from("events").select("*").eq("id", id).single();
    setEvent(evt);
    const { data: dons } = await supabase.from("donations").select("*").eq("event_id", id).order("created_at", { ascending: false });
    setDonations(dons || []);
    setLoading(false);
  }

  async function handleAddDonation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) return;

    const { error } = await supabase.from("donations").insert({
      event_id: id,
      madrasa_id: profile.madrasa_id,
      donor_name: donationForm.donor_name || null,
      amount: parseFloat(donationForm.amount),
      notes: donationForm.notes || null,
    });
    if (!error) {
      await logActivity("financial", `Recorded ₹${donationForm.amount} donation for ${event?.title}`, "donation");
      setDonationForm({ donor_name: "", amount: "", notes: "" });
      setShowDonationForm(false);
      loadEvent();
    }
    setSaving(false);
  }

  const totalDonations = donations.reduce((s, d) => s + Number(d.amount), 0);
  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (loading) return <div className="p-8 text-[#94a3b8]">Loading...</div>;
  if (!event) return <div className="p-8 text-[#94a3b8]">Event not found.</div>;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="text-sm text-[#64748b] mb-6">
        <Link href="/" className="text-[#00c853] hover:underline">Dashboard</Link>
        <span className="mx-2">›</span>
        <Link href="/events" className="text-[#00c853] hover:underline">Events</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">Event Details</span>
      </div>

      {/* Event Info */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 mb-8">
        <h1 className="text-2xl font-bold text-[#1e293b] mb-2">{event.title}</h1>
        <div className="flex items-center gap-4 text-sm text-[#64748b]">
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{fmtDate(event.event_date)}</span>
        </div>
        {event.description && <p className="text-[#334155] text-sm mt-4 leading-relaxed">{event.description}</p>}
      </div>

      {/* Donations Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#1e293b]">Donations Received</h2>
          <p className="text-sm text-[#64748b]">Real-time tracking of event contributions</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#00c853]">Total: {fmt(totalDonations)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setShowDonationForm(true)}
          className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition cursor-pointer">
          <Plus className="w-4 h-4" /> Add Donation
        </button>
      </div>

      {/* Donation form modal */}
      {showDonationForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDonationForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Add Donation</h2>
            <form onSubmit={handleAddDonation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Donor Name (optional)</label>
                <input type="text" value={donationForm.donor_name} onChange={e => setDonationForm(p => ({ ...p, donor_name: e.target.value }))}
                  placeholder="Anonymous if left blank" className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 focus:border-[#00c853]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Amount (₹)</label>
                <input type="number" required min="1" step="0.01" value={donationForm.amount} onChange={e => setDonationForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00" className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Notes (optional)</label>
                <textarea value={donationForm.notes} onChange={e => setDonationForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional notes" rows={2} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition disabled:opacity-50 cursor-pointer">{saving ? "Saving..." : "Add Donation"}</button>
                <button type="button" onClick={() => setShowDonationForm(false)} className="text-[#64748b] text-sm cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Donations table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0]">
        {donations.length === 0 ? (
          <div className="p-8 text-center text-[#94a3b8]">No donations yet for this event.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Donor Name</th>
                <th className="text-left px-4 py-4 font-medium">Amount</th>
                <th className="text-left px-4 py-4 font-medium">Date</th>
                <th className="text-left px-4 py-4 font-medium">Notes</th>
                <th className="text-right px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donations.map(d => (
                <tr key={d.id} className="border-b border-[#f1f5f9]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#e8faf0] text-[#00c853] font-semibold text-xs flex items-center justify-center">
                        {(d.donor_name || "A").substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[#1e293b]">{d.donor_name || "Anonymous"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-[#00c853]">{fmt(Number(d.amount))}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{fmtDate(d.created_at)}</td>
                  <td className="px-4 py-4 text-sm text-[#64748b] max-w-[250px] truncate">{d.notes || "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1 text-[#94a3b8] hover:text-[#64748b] cursor-pointer"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

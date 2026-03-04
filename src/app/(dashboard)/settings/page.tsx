"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-logger";
import { useToast } from "@/components/toast";
import { Save, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [madrasaId, setMadrasaId] = useState("");

  async function loadSettings() {
    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) return;
    setMadrasaId(profile.madrasa_id);
    const { data } = await supabase.from("madrasas").select("*").eq("id", profile.madrasa_id).single();
    if (data) setForm({
      name: data.name || "", phone: data.phone || "",
      email: data.email || "", address: data.address || "",
    });
    setLoading(false);
  }

  useEffect(() => { loadSettings(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { showError("Madrasa name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("madrasas").update(form).eq("id", madrasaId);
    if (error) {
      showError("Failed to save: " + error.message);
    } else {
      await logActivity("settings", `Updated madrasa settings`, "madrasa", madrasaId);
      success("Settings saved successfully!");
    }
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-[#94a3b8]">Loading...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1e293b] mb-1">Madrasa Settings</h1>
      <p className="text-[#64748b] text-sm mb-8">Manage your madrasa&apos;s profile and core administrative information.</p>

      <form onSubmit={handleSave}>
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 mb-8">
          <h2 className="text-lg font-bold text-[#1e293b] mb-6">General Information</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Madrasa Name</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Phone Number</label>
                <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Full Address</label>
              <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={3}
                className="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-sm resize-none" />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button type="submit" disabled={saving}
              className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition disabled:opacity-50 cursor-pointer">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h2 className="text-lg font-bold text-red-500">Danger Zone</h2>
      </div>
      <div className="bg-white rounded-2xl border border-red-200 p-6 flex items-center justify-between">
        <div>
          <p className="font-semibold text-[#1e293b]">Delete Madrasa Account</p>
          <p className="text-sm text-[#64748b]">Once you delete this madrasa, there is no going back. Please be certain.</p>
        </div>
        <button className="border border-red-300 text-red-500 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-red-50 transition cursor-pointer">
          Delete Madrasa
        </button>
      </div>
    </div>
  );
}

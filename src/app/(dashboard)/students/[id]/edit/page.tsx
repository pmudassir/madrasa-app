"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-logger";
import { useToast } from "@/components/toast";
import { Save, X } from "lucide-react";
import Link from "next/link";

export default function EditStudentPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", class: "", date_of_birth: "", gender: "male",
    parent_name: "", parent_phone: "", parent_email: "", address: "", is_active: true,
  });

  async function loadStudent() {
    const { data } = await supabase.from("students").select("*").eq("id", id).single();
    if (data) setForm({
      name: data.name, class: data.class || "", date_of_birth: data.date_of_birth || "",
      gender: data.gender || "male", parent_name: data.parent_name || "",
      parent_phone: data.parent_phone || "", parent_email: data.parent_email || "",
      address: data.address || "", is_active: data.is_active,
    });
    setLoading(false);
  }

  useEffect(() => {
    if (id) loadStudent();
  }, [id]);

  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showError("Student name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("students").update({
      ...form, date_of_birth: form.date_of_birth || null,
    }).eq("id", id);
    if (error) {
      showError("Failed to update: " + error.message);
    } else {
      await logActivity("students", `Updated student: ${form.name}`, "student", id as string);
      success(`${form.name} updated successfully!`);
      router.push(`/students/${id}`);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-[#94a3b8]">Loading...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="text-sm text-[#64748b] mb-2">
        <Link href="/students" className="text-[#00c853] hover:underline">Students</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">Edit Student</span>
      </div>
      <h1 className="text-2xl font-bold text-[#1e293b] mb-6">Edit Student</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Full Name</label>
            <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 focus:border-[#00c853]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Class</label>
            <input type="text" value={form.class} onChange={(e) => update("class", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Gender</label>
            <div className="flex gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="male" checked={form.gender === "male"} onChange={(e) => update("gender", e.target.value)} className="accent-[#00c853]" /><span className="text-sm">Male</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="female" checked={form.gender === "female"} onChange={(e) => update("gender", e.target.value)} className="accent-[#00c853]" /><span className="text-sm">Female</span></label>
            </div>
          </div>
          <div><label className="block text-sm font-medium text-[#1e293b] mb-1.5">Parent Name</label><input type="text" value={form.parent_name} onChange={(e) => update("parent_name", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" /></div>
          <div><label className="block text-sm font-medium text-[#1e293b] mb-1.5">Phone</label><input type="tel" value={form.parent_phone} onChange={(e) => update("parent_phone", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" /></div>
          <div><label className="block text-sm font-medium text-[#1e293b] mb-1.5">Email</label><input type="email" value={form.parent_email} onChange={(e) => update("parent_email", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" /></div>
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Status</label>
            <select value={form.is_active ? "active" : "inactive"} onChange={(e) => update("is_active", e.target.value === "active")} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Address</label>
            <textarea value={form.address} onChange={(e) => update("address", e.target.value)} rows={2} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 resize-none" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition disabled:opacity-50 cursor-pointer"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save Changes"}</button>
          <Link href={`/students/${id}`} className="text-[#64748b] hover:text-[#1e293b] flex items-center gap-1 text-sm"><X className="w-4 h-4" /> Cancel</Link>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { CLASS_LEVELS } from "@/lib/types";

export default function EditStudentPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    class_level: "1",
    admission_date: "",
    father_name: "",
    mother_name: "",
    phone_no: "",
    date_of_birth: "",
    gender: "male",
    address: "",
    is_active: true,
  });

  useEffect(() => {
    async function loadStudent() {
      const { data, error } = await supabase.from("students").select("*").eq("id", id).single();
      if (error || !data) {
        showError(error?.message || "Student not found");
        setLoading(false);
        return;
      }

      setForm({
        name: data.name || "",
        class_level: data.class_level || data.class || "1",
        admission_date: data.admission_date || data.joined_at || "",
        father_name: data.father_name || data.parent_name || "",
        mother_name: data.mother_name || "",
        phone_no: data.phone_no || data.parent_phone || "",
        date_of_birth: data.date_of_birth || "",
        gender: data.gender || "male",
        address: data.address || "",
        is_active: data.is_active,
      });
      setLoading(false);
    }

    loadStudent();
  }, [id, showError, supabase]);

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("students")
      .update({
        name: form.name,
        class: form.class_level,
        class_level: form.class_level,
        admission_date: form.admission_date || null,
        joined_at: form.admission_date || null,
        father_name: form.father_name || null,
        mother_name: form.mother_name || null,
        phone_no: form.phone_no || null,
        parent_name: form.father_name || null,
        parent_phone: form.phone_no || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address || null,
        is_active: form.is_active,
      })
      .eq("id", id);

    if (error) {
      showError(error.message);
    } else {
      success("Admission details updated");
      router.push(`/students/${id}`);
    }

    setSaving(false);
  }

  if (loading) {
    return <div className="p-8 text-[#94a3b8]">Loading admission details...</div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="text-sm text-[#64748b] mb-2">
        <Link href="/students" className="text-[#00c853] hover:underline">Students</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">Edit Admission</span>
      </div>

      <h1 className="text-2xl font-bold text-[#1e293b] mb-6">Edit Admission</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Student Name">
            <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          </Field>

          <Field label="Class">
            <select value={form.class_level} onChange={(e) => update("class_level", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
              {CLASS_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </Field>

          <Field label="Admission Date">
            <input type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          </Field>

          <Field label="Date of Birth">
            <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          </Field>

          <Field label="Father Name">
            <input type="text" value={form.father_name} onChange={(e) => update("father_name", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          </Field>

          <Field label="Mother Name">
            <input type="text" value={form.mother_name} onChange={(e) => update("mother_name", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          </Field>

          <Field label="Phone Number">
            <input type="tel" value={form.phone_no} onChange={(e) => update("phone_no", e.target.value)} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          </Field>

          <Field label="Status">
            <select value={form.is_active ? "active" : "inactive"} onChange={(e) => update("is_active", e.target.value === "active")} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Address">
              <textarea value={form.address} onChange={(e) => update("address", e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none" />
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition disabled:opacity-50 cursor-pointer">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/students/${id}`} className="text-[#64748b] hover:text-[#1e293b] flex items-center gap-1 text-sm">
            <X className="w-4 h-4" /> Cancel
          </Link>
        </div>
      </form>
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

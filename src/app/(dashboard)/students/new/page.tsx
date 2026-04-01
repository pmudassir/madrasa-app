"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, UserRoundPlus, X } from "lucide-react";
import { CLASS_LEVELS } from "@/lib/types";
import { fetchJson } from "@/lib/fetcher";
import { useToast } from "@/components/toast";

export default function AddStudentPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    class_level: "1",
    admission_date: new Date().toISOString().split("T")[0],
    admission_fee: "",
    monthly_fee: "",
    father_name: "",
    mother_name: "",
    phone_no: "",
    date_of_birth: "",
    gender: "male",
    address: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      showError("Student name is required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetchJson<{ data: { id: string; admission_no: string } }>("/api/students", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          admission_fee: Number(form.admission_fee || 0),
          monthly_fee: Number(form.monthly_fee || 0),
          date_of_birth: form.date_of_birth || null,
        }),
      });

      success(`Admission created successfully. Admission No: ${response.data.admission_no}`);
      router.push(`/students/${response.data.id}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to create admission");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="text-sm text-[#64748b] mb-2">
        <Link href="/" className="text-[#00c853] hover:underline">Dashboard</Link>
        <span className="mx-2">›</span>
        <Link href="/students" className="text-[#00c853] hover:underline">Students</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">New Admission</span>
      </div>

      <h1 className="text-2xl font-bold text-[#1e293b] mb-1">New Admission</h1>
      <p className="text-[#64748b] text-sm mb-8">Register a student, configure admission charges, and seed the fee dues ledger.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e293b] mb-5">
            <UserRoundPlus className="w-5 h-5 text-[#00c853]" />
            Admission Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Student Name">
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                placeholder="Enter student name"
              />
            </Field>

            <Field label="Class">
              <select
                value={form.class_level}
                onChange={(e) => update("class_level", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
              >
                {CLASS_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </Field>

            <Field label="Admission Date">
              <input
                type="date"
                required
                value={form.admission_date}
                onChange={(e) => update("admission_date", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
              />
            </Field>

            <Field label="Date of Birth">
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => update("date_of_birth", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
              />
            </Field>

            <Field label="Admission Fee (One Time)">
              <input
                type="number"
                min="0"
                value={form.admission_fee}
                onChange={(e) => update("admission_fee", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                placeholder="0"
              />
            </Field>

            <Field label="Monthly Fee">
              <input
                type="number"
                min="0"
                value={form.monthly_fee}
                onChange={(e) => update("monthly_fee", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                placeholder="0"
              />
            </Field>

            <Field label="Gender">
              <div className="flex items-center gap-5 pt-2">
                {["male", "female"].map((gender) => (
                  <label key={gender} className="flex items-center gap-2 text-sm text-[#334155]">
                    <input
                      type="radio"
                      name="gender"
                      value={gender}
                      checked={form.gender === gender}
                      onChange={(e) => update("gender", e.target.value)}
                      className="accent-[#00c853]"
                    />
                    {gender === "male" ? "Male" : "Female"}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Phone Number">
              <input
                type="tel"
                value={form.phone_no}
                onChange={(e) => update("phone_no", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                placeholder="+91 00000 00000"
              />
            </Field>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="text-lg font-bold text-[#1e293b] mb-5">Family Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Father Name">
              <input
                type="text"
                value={form.father_name}
                onChange={(e) => update("father_name", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
              />
            </Field>

            <Field label="Mother Name">
              <input
                type="text"
                value={form.mother_name}
                onChange={(e) => update("mother_name", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Address">
                <textarea
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving..." : "Save Admission"}
          </button>
          <Link href="/students" className="text-[#64748b] hover:text-[#1e293b] flex items-center gap-1 text-sm">
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-logger";
import { useToast } from "@/components/toast";
import { Save, X, User, Users as UsersIcon, MapPin } from "lucide-react";
import Link from "next/link";

export default function AddStudentPage() {
  const supabase = createClient();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    class: "",
    date_of_birth: "",
    gender: "male",
    parent_name: "",
    parent_phone: "",
    parent_email: "",
    address: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showError("Student name is required"); return; }
    setLoading(true);

    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) { showError("Could not load profile"); setLoading(false); return; }

    const { error } = await supabase.from("students").insert({
      ...form,
      madrasa_id: profile.madrasa_id,
      date_of_birth: form.date_of_birth || null,
    });

    if (error) {
      showError("Failed to add student: " + error.message);
    } else {
      await logActivity("students", `Added new student: ${form.name}`, "student");
      success(`${form.name} added successfully!`);
      router.push("/students");
    }
    setLoading(false);
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-sm text-[#64748b] mb-2">
        <Link href="/" className="text-[#00c853] hover:underline">Dashboard</Link>
        <span className="mx-2">›</span>
        <Link href="/students" className="text-[#00c853] hover:underline">Students</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">Add New Student</span>
      </div>

      <h1 className="text-2xl font-bold text-[#1e293b] mb-1">Add New Student</h1>
      <p className="text-[#64748b] text-sm mb-8">Register a new student to the Madrasa database with complete details.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student Details */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e293b] mb-5">
            <User className="w-5 h-5 text-[#00c853]" />
            Student Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Full Name</label>
              <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)}
                placeholder="Enter student's full name"
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 focus:border-[#00c853]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Class / Grade</label>
              <select value={form.class} onChange={(e) => update("class", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 text-[#64748b]">
                <option value="">Select a class</option>
                {["Class 1-A","Class 1-B","Class 2-A","Class 2-B","Class 3-A","Class 3-B","Class 4-A","Class 5-A","Class 5-B"].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Gender</label>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gender" value="male" checked={form.gender === "male"} onChange={(e) => update("gender", e.target.value)}
                    className="w-4 h-4 accent-[#00c853]" />
                  <span className="text-sm text-[#334155]">Male</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gender" value="female" checked={form.gender === "female"} onChange={(e) => update("gender", e.target.value)}
                    className="w-4 h-4 accent-[#00c853]" />
                  <span className="text-sm text-[#334155]">Female</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Parent Details */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e293b] mb-5">
            <UsersIcon className="w-5 h-5 text-[#00c853]" />
            Parent / Guardian Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Parent Full Name</label>
              <input type="text" value={form.parent_name} onChange={(e) => update("parent_name", e.target.value)}
                placeholder="Guardian's name"
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Phone Number</label>
              <input type="tel" value={form.parent_phone} onChange={(e) => update("parent_phone", e.target.value)}
                placeholder="+91 00000 00000"
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Email Address</label>
              <input type="email" value={form.parent_email} onChange={(e) => update("parent_email", e.target.value)}
                placeholder="parent@example.com"
                className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e293b] mb-5">
            <MapPin className="w-5 h-5 text-[#00c853]" />
            Address Information
          </h2>
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Residential Address</label>
            <textarea value={form.address} onChange={(e) => update("address", e.target.value)}
              placeholder="Enter complete residential address" rows={3}
              className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 resize-none" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={loading}
            className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition disabled:opacity-50 cursor-pointer">
            <Save className="w-4 h-4" />
            {loading ? "Saving..." : "Save Student"}
          </button>
          <Link href="/students" className="text-[#64748b] hover:text-[#1e293b] flex items-center gap-1 text-sm">
            <X className="w-4 h-4" /> Cancel Registration
          </Link>
        </div>
      </form>
    </div>
  );
}

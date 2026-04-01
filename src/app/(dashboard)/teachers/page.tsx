"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-logger";
import { useToast } from "@/components/toast";
import ConfirmDialog from "@/components/confirm-dialog";
import { Plus, Banknote, Trash2 } from "lucide-react";
import type { Teacher } from "@/lib/types";

export default function TeachersPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSalary, setShowSalary] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", phone: "", monthly_salary: "" });
  const [salaryForm, setSalaryForm] = useState({ amount: "", month: "", year: new Date().getFullYear().toString() });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadTeachers = useCallback(async () => {
    const { data } = await supabase.from("teachers").select("*").order("name");
    setTeachers((data || []) as Teacher[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    async function run() {
      await loadTeachers();
    }

    void run();
  }, [loadTeachers]);

  function validateTeacherForm() {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Teacher name is required";
    if (form.monthly_salary && parseFloat(form.monthly_salary) < 0) errors.monthly_salary = "Salary cannot be negative";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateSalaryForm() {
    const errors: Record<string, string> = {};
    if (!salaryForm.amount || parseFloat(salaryForm.amount) <= 0) errors.amount = "Enter a valid amount";
    if (!salaryForm.month) errors.month = "Select a month";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAddTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!validateTeacherForm()) return;
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) { showError("Could not load profile"); setSaving(false); return; }
    const { error } = await supabase.from("teachers").insert({
      madrasa_id: profile.madrasa_id, name: form.name, subject: form.subject,
      phone: form.phone, monthly_salary: parseFloat(form.monthly_salary) || 0,
    });
    if (error) {
      showError("Failed to add teacher: " + error.message);
    } else {
      await logActivity("teachers", `Added new teacher: ${form.name}`, "teacher");
      success(`${form.name} added successfully!`);
      setForm({ name: "", subject: "", phone: "", monthly_salary: "" });
      setShowForm(false);
      loadTeachers();
    }
    setSaving(false);
  }

  async function handlePaySalary(e: React.FormEvent) {
    e.preventDefault();
    if (!validateSalaryForm()) return;
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) { showError("Could not load profile"); setSaving(false); return; }
    const teacher = teachers.find(t => t.id === showSalary);
    const { error } = await supabase.from("salary_payments").insert({
      madrasa_id: profile.madrasa_id, teacher_id: showSalary,
      amount: parseFloat(salaryForm.amount), month: parseInt(salaryForm.month), year: parseInt(salaryForm.year),
    });
    if (error) {
      showError("Failed to record payment: " + error.message);
    } else {
      await logActivity("financial", `Paid salary ₹${salaryForm.amount} to ${teacher?.name}`, "salary_payment");
      success(`Salary of ₹${salaryForm.amount} paid to ${teacher?.name}.`);
      setSalaryForm({ amount: "", month: "", year: new Date().getFullYear().toString() });
      setShowSalary(null);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete salary payments first (FK constraint)
    await supabase.from("salary_payments").delete().eq("teacher_id", deleteTarget.id);
    const { error } = await supabase.from("teachers").delete().eq("id", deleteTarget.id);
    if (error) {
      showError("Failed to delete teacher: " + error.message);
    } else {
      await logActivity("teachers", `Deleted teacher: ${deleteTarget.name}`, "teacher");
      success(`${deleteTarget.name} has been removed.`);
      loadTeachers();
    }
    setDeleteTarget(null);
    setDeleting(false);
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Teachers & Salaries</h1>
          <p className="text-[#64748b] text-sm mt-1">Manage teaching staff and salary disbursements.</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormErrors({}); }} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition cursor-pointer w-fit">
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      {/* Add Teacher Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Add Teacher</h2>
            <form onSubmit={handleAddTeacher} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormErrors(p => ({ ...p, name: "" })); }}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${formErrors.name ? "border-red-400" : "border-[#e2e8f0]"}`} />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div><label className="block text-sm font-medium mb-1.5">Subject</label><input type="text" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1.5">Phone</label><input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Monthly Salary (₹)</label>
                <input type="number" value={form.monthly_salary} onChange={e => { setForm(p => ({ ...p, monthly_salary: e.target.value })); setFormErrors(p => ({ ...p, monthly_salary: "" })); }}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${formErrors.monthly_salary ? "border-red-400" : "border-[#e2e8f0]"}`} />
                {formErrors.monthly_salary && <p className="text-red-500 text-xs mt-1">{formErrors.monthly_salary}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="bg-[#00c853] text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer">{saving ? "Saving..." : "Add Teacher"}</button>
                <button type="button" onClick={() => setShowForm(false)} className="text-[#64748b] text-sm cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {showSalary && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSalary(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Record Salary Payment</h2>
            <form onSubmit={handlePaySalary} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Amount (₹)</label>
                <input type="number" value={salaryForm.amount} onChange={e => { setSalaryForm(p => ({ ...p, amount: e.target.value })); setFormErrors(p => ({ ...p, amount: "" })); }}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${formErrors.amount ? "border-red-400" : "border-[#e2e8f0]"}`} />
                {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Month</label>
                  <select value={salaryForm.month} onChange={e => { setSalaryForm(p => ({ ...p, month: e.target.value })); setFormErrors(p => ({ ...p, month: "" })); }}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm ${formErrors.month ? "border-red-400" : "border-[#e2e8f0]"}`}>
                    <option value="">Select</option>{months.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                  </select>
                  {formErrors.month && <p className="text-red-500 text-xs mt-1">{formErrors.month}</p>}
                </div>
                <div><label className="block text-sm font-medium mb-1.5">Year</label><input type="number" value={salaryForm.year} onChange={e => setSalaryForm(p => ({ ...p, year: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="bg-[#00c853] text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer">{saving ? "Saving..." : "Record Payment"}</button>
                <button type="button" onClick={() => setShowSalary(null)} className="text-[#64748b] text-sm cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        {loading ? <div className="p-8 text-center text-[#94a3b8]">Loading...</div> : teachers.length === 0 ? <div className="p-8 text-center text-[#94a3b8]">No teachers yet.</div> : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Teacher</th>
                <th className="text-left px-4 py-4 font-medium">Subject</th>
                <th className="text-left px-4 py-4 font-medium">Phone</th>
                <th className="text-right px-4 py-4 font-medium">Monthly Salary</th>
                <th className="text-right px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm flex items-center justify-center">{t.name.charAt(0)}</div>
                      <span className="text-sm font-semibold text-[#1e293b]">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{t.subject || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{t.phone || "—"}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-[#1e293b]">{fmt(Number(t.monthly_salary))}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setShowSalary(t.id); setSalaryForm(p => ({ ...p, amount: String(t.monthly_salary) })); setFormErrors({}); }}
                        className="bg-[#e8faf0] text-[#00c853] font-semibold px-4 py-1.5 rounded-lg text-xs hover:bg-[#d0f5e0] transition cursor-pointer flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5" /> Pay Salary
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748b] hover:text-red-500 transition cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Teacher"
        message={`Delete ${deleteTarget?.name}? All salary records for this teacher will also be removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

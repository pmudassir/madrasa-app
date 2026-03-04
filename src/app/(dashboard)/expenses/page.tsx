"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-logger";
import { useToast } from "@/components/toast";
import ConfirmDialog from "@/components/confirm-dialog";
import { Plus, Trash2 } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/types";

export default function ExpensesPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "", description: "", amount: "", expense_date: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { loadExpenses(); }, []);

  async function loadExpenses() {
    const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }

  function validateForm() {
    const errors: Record<string, string> = {};
    if (!form.category) errors.category = "Category is required";
    if (!form.amount || parseFloat(form.amount) <= 0) errors.amount = "Enter a valid amount";
    if (!form.expense_date) errors.expense_date = "Date is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) { showError("Could not load profile"); setSaving(false); return; }
    const { error } = await supabase.from("expenses").insert({
      madrasa_id: profile.madrasa_id, category: form.category,
      description: form.description, amount: parseFloat(form.amount), expense_date: form.expense_date,
    });
    if (error) {
      showError("Failed to add expense: " + error.message);
    } else {
      await logActivity("financial", `Added expense: ${form.description || form.category} (₹${form.amount})`, "expense");
      success("Expense recorded successfully!");
      setForm({ category: "", description: "", amount: "", expense_date: "" });
      setShowForm(false);
      loadExpenses();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("expenses").delete().eq("id", deleteTarget.id);
    if (error) {
      showError("Failed to delete expense: " + error.message);
    } else {
      await logActivity("financial", `Deleted expense: ${deleteTarget.description || deleteTarget.category}`, "expense");
      success("Expense has been deleted.");
      loadExpenses();
    }
    setDeleteTarget(null);
    setDeleting(false);
  }

  const filtered = expenses.filter(e => !categoryFilter || e.category === categoryFilter);
  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const catColors: Record<string, string> = {
    maintenance: "bg-orange-100 text-orange-700", electricity: "bg-blue-100 text-blue-700",
    water: "bg-cyan-100 text-cyan-700", supplies: "bg-green-100 text-green-700",
    transport: "bg-purple-100 text-purple-700", food: "bg-yellow-100 text-yellow-700", other: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Expenses</h1>
          <p className="text-[#64748b] text-sm mt-1">Track and manage all expenditures.</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormErrors({}); }} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition cursor-pointer w-fit">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Add Expense</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Category</label>
                <select value={form.category} onChange={e => { setForm(p => ({ ...p, category: e.target.value })); setFormErrors(p => ({ ...p, category: "" })); }}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${formErrors.category ? "border-red-400" : "border-[#e2e8f0]"}`}>
                  <option value="">Select</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {formErrors.category && <p className="text-red-500 text-xs mt-1">{formErrors.category}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" placeholder="Optional details" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Amount (₹)</label>
                  <input type="number" min="0" value={form.amount} onChange={e => { setForm(p => ({ ...p, amount: e.target.value })); setFormErrors(p => ({ ...p, amount: "" })); }}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm ${formErrors.amount ? "border-red-400" : "border-[#e2e8f0]"}`} />
                  {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date</label>
                  <input type="date" value={form.expense_date} onChange={e => { setForm(p => ({ ...p, expense_date: e.target.value })); setFormErrors(p => ({ ...p, expense_date: "" })); }}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm ${formErrors.expense_date ? "border-red-400" : "border-[#e2e8f0]"}`} />
                  {formErrors.expense_date && <p className="text-red-500 text-xs mt-1">{formErrors.expense_date}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="bg-[#00c853] text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer">{saving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => setShowForm(false)} className="text-[#64748b] text-sm cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        {loading ? <div className="p-8 text-center text-[#94a3b8]">Loading...</div> : filtered.length === 0 ? <div className="p-8 text-center text-[#94a3b8]">No expenses yet.</div> : (
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Date</th>
                <th className="text-left px-4 py-4 font-medium">Category</th>
                <th className="text-left px-4 py-4 font-medium">Description</th>
                <th className="text-right px-4 py-4 font-medium">Amount</th>
                <th className="text-right px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id} className="border-b border-[#f1f5f9]">
                  <td className="px-6 py-4 text-sm">{fmtDate(exp.expense_date)}</td>
                  <td className="px-4 py-4"><span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${catColors[exp.category] || "bg-gray-100 text-gray-700"}`}>{exp.category}</span></td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{exp.description || "—"}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold">{fmt(Number(exp.amount))}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setDeleteTarget(exp)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748b] hover:text-red-500 transition cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Expense"
        message={`Delete expense "${deleteTarget?.description || deleteTarget?.category}" of ${deleteTarget ? fmt(Number(deleteTarget.amount)) : ""}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

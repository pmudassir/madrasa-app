"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchJson } from "@/lib/fetcher";
import { buildCsv, downloadCsv, formatCurrency, formatDate } from "@/lib/format";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import { PrintButton } from "@/components/print-button";
import { useToast } from "@/components/toast";
import { EXPENSE_CATEGORIES, type Collector, type Expense } from "@/lib/types";
import { relationItem } from "@/lib/relation-utils";

export default function ExpensesPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [form, setForm] = useState({
    category: "maintenance",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    paid_by_collector_id: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [expenseRes, collectorRes] = await Promise.all([
      supabase.from("expenses").select("*, collectors(id, name)").order("expense_date", { ascending: false }),
      supabase.from("collectors").select("*").eq("is_active", true).order("name"),
    ]);
    setExpenses((expenseRes.data || []) as Expense[]);
    setCollectors((collectorRes.data || []) as Collector[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const date = new Date(expense.expense_date);
      const matchesCategory = !categoryFilter || expense.category === categoryFilter;
      const matchesCollector = !collectorFilter || expense.paid_by_collector_id === collectorFilter;
      const matchesFrom = !dateFrom || date >= new Date(`${dateFrom}T00:00:00`);
      const matchesTo = !dateTo || date <= new Date(`${dateTo}T23:59:59`);
      return matchesCategory && matchesCollector && matchesFrom && matchesTo;
    });
  }, [categoryFilter, collectorFilter, dateFrom, dateTo, expenses]);

  const totalSpent = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const paidByBreakdown = collectors
    .map((collector) => ({
      name: collector.name,
      total: filteredExpenses.filter((expense) => expense.paid_by_collector_id === collector.id).reduce((sum, expense) => sum + Number(expense.amount), 0),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await fetchJson("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount || 0),
        }),
      });
      success("Expense recorded successfully");
      setShowForm(false);
      setForm({
        category: "maintenance",
        description: "",
        amount: "",
        expense_date: new Date().toISOString().split("T")[0],
        paid_by_collector_id: "",
      });
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to record expense");
    } finally {
      setSaving(false);
    }
  }

  function exportExpenses() {
    const rows: Array<Array<string | number>> = [["Date", "Category", "Description", "Paid By", "Amount"]];
    filteredExpenses.forEach((expense) => {
      rows.push([
        formatDate(expense.expense_date),
        expense.category,
        expense.description || "—",
        relationItem(expense.collectors)?.name || "—",
        expense.amount,
      ]);
    });
    downloadCsv("expenses-report.csv", buildCsv(rows));
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Expenses</h1>
          <p className="text-[#64748b] text-sm mt-1">Record who paid each expense and report spending by collector, category, and date range.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrintButton label="Print Expense Report" />
          <button onClick={exportExpenses} className="border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] cursor-pointer">
            Export Expense CSV
          </button>
          <button onClick={() => setShowForm(true)} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
        <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Paid By</option>
          {collectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
      </div>

      <SummaryGrid>
        <SummaryCard label="Total Spent" value={formatCurrency(totalSpent)} helper={`${filteredExpenses.length} filtered expenses`} />
        <SummaryCard label="Top Paid By" value={paidByBreakdown[0] ? paidByBreakdown[0].name : "—"} helper={paidByBreakdown[0] ? formatCurrency(paidByBreakdown[0].total) : "No spend yet"} />
        <SummaryCard label="Categories" value={String(new Set(filteredExpenses.map((expense) => expense.category)).size)} helper="Visible category count" />
        <SummaryCard label="Collectors Used" value={String(new Set(filteredExpenses.map((expense) => expense.paid_by_collector_id).filter(Boolean)).size)} helper="Who paid in this view" />
      </SummaryGrid>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
              <th className="text-left px-6 py-4 font-medium">Date</th>
              <th className="text-left px-4 py-4 font-medium">Category</th>
              <th className="text-left px-4 py-4 font-medium">Description</th>
              <th className="text-left px-4 py-4 font-medium">Paid By</th>
              <th className="text-right px-6 py-4 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-[#94a3b8]">Loading expenses...</td></tr>
            ) : filteredExpenses.map((expense) => (
              <tr key={expense.id} className="border-b border-[#f1f5f9]">
                <td className="px-6 py-4 text-sm">{formatDate(expense.expense_date)}</td>
                <td className="px-4 py-4 text-sm capitalize">{expense.category}</td>
                <td className="px-4 py-4 text-sm">{expense.description || "—"}</td>
                <td className="px-4 py-4 text-sm">{relationItem(expense.collectors)?.name || "—"}</td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-red-500">{formatCurrency(Number(expense.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">Add Expense</h2>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              <Field label="Category">
                <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                  {EXPENSE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </Field>
              <Field label="Paid By">
                <select value={form.paid_by_collector_id} onChange={(e) => setForm((prev) => ({ ...prev, paid_by_collector_id: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                  <option value="">Select collector</option>
                  {collectors.map((collector) => (
                    <option key={collector.id} value={collector.id}>{collector.name} ({formatCurrency(Number(collector.current_balance))})</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount"><input type="number" min="1" required value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
              <Field label="Date"><input type="date" value={form.expense_date} onChange={(e) => setForm((prev) => ({ ...prev, expense_date: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
              <Field label="Description"><textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none" /></Field>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer">{saving ? "Saving..." : "Save Expense"}</button>
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

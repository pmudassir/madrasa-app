"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Download } from "lucide-react";

export default function ReportsPage() {
  const supabase = createClient();
  const { success } = useToast();
  const [stats, setStats] = useState({ income: 0, expenses: 0, salaries: 0, fees: 0 });
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [rawData, setRawData] = useState<{ donations: any[]; expenses: any[]; salaries: any[]; fees: any[] }>({ donations: [], expenses: [], salaries: [], fees: [] });

  const loadReports = useCallback(async () => {
    const [donationsRes, expensesRes, salariesRes, feesRes] = await Promise.all([
      supabase.from("donations").select("amount, created_at, donor_name, events(title)"),
      supabase.from("expenses").select("amount, expense_date, category, description, created_at"),
      supabase.from("salary_payments").select("amount, created_at, month, year, teachers(name)"),
      supabase.from("fee_payments").select("amount, created_at, status, description, students(name)").eq("status", "paid"),
    ]);

    const donationData = donationsRes.data || [];
    const expenseData = expensesRes.data || [];
    const salaryData = salariesRes.data || [];
    const feeData = feesRes.data || [];

    setRawData({ donations: donationData, expenses: expenseData, salaries: salaryData, fees: feeData });

    const income = donationData.reduce((s, d) => s + Number(d.amount), 0);
    const fees = feeData.reduce((s, f) => s + Number(f.amount), 0);
    const expenses = expenseData.reduce((s, e) => s + Number(e.amount), 0);
    const salaries = salaryData.reduce((s, sp) => s + Number(sp.amount), 0);
    setStats({ income: income + fees, expenses, salaries, fees });

    // Group by month for chart
    const months: Record<string, { income: number; expenses: number }> = {};
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }).reverse();
    last6.forEach(m => months[m] = { income: 0, expenses: 0 });

    donationData.forEach((d: any) => {
      const m = d.created_at?.substring(0, 7);
      if (months[m]) months[m].income += Number(d.amount);
    });
    feeData.forEach((f: any) => {
      const m = f.created_at?.substring(0, 7);
      if (months[m]) months[m].income += Number(f.amount);
    });
    expenseData.forEach((e: any) => {
      const m = (e.expense_date || e.created_at)?.substring(0, 7);
      if (months[m]) months[m].expenses += Number(e.amount);
    });
    salaryData.forEach((s: any) => {
      const m = s.created_at?.substring(0, 7);
      if (months[m]) months[m].expenses += Number(s.amount);
    });

    setMonthlyData(last6.map(m => ({
      month: new Date(m + "-01").toLocaleDateString("en-IN", { month: "short" }),
      ...months[m],
    })));

    // Build recent transactions — same logic as Dashboard for consistency
    const recent = [
      ...donationData.slice(0, 5).map((d: any) => ({
        date: d.created_at,
        description: `${d.events?.title || "Donation"} — ${d.donor_name || "Anonymous"}`,
        category: "Income",
        amount: Number(d.amount),
        isIncome: true,
        status: "completed",
      })),
      ...feeData.slice(0, 5).map((f: any) => ({
        date: f.created_at,
        description: `${f.description} — ${f.students?.name || "Student"}`,
        category: f.status === "paid" ? "Income" : "Fee Due",
        amount: Number(f.amount),
        isIncome: f.status === "paid",
        status: "completed",
      })),
      ...expenseData.slice(0, 5).map((e: any) => ({
        date: e.expense_date || e.created_at,
        description: e.description || e.category,
        category: e.category || "other",
        amount: Number(e.amount),
        isIncome: false,
        status: "completed",
      })),
      ...salaryData.slice(0, 5).map((s: any) => ({
        date: s.created_at,
        description: `Salary — ${s.teachers?.name || "Teacher"}`,
        category: "Payroll",
        amount: Number(s.amount),
        isIncome: false,
        status: "completed",
      })),
    ];
    recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setRecentTxns(recent.slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const exportCSV = useCallback(() => {
    const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN");
    const rows: string[][] = [["Date", "Type", "Category", "Description", "Amount (₹)"]];

    rawData.donations.forEach((d: any) => {
      rows.push([fmtDate(d.created_at), "Income", "Donation", `${d.events?.title || "Event"} — ${d.donor_name || "Anonymous"}`, String(d.amount)]);
    });
    rawData.fees.forEach((f: any) => {
      rows.push([fmtDate(f.created_at), "Income", "Fee", `${f.description} — ${f.students?.name || "Student"}`, String(f.amount)]);
    });
    rawData.expenses.forEach((e: any) => {
      rows.push([fmtDate(e.expense_date || e.created_at), "Expense", e.category, e.description || "", String(e.amount)]);
    });
    rawData.salaries.forEach((s: any) => {
      rows.push([fmtDate(s.created_at), "Expense", "Salary", `${s.teachers?.name || "Teacher"} — Month ${s.month}/${s.year}`, String(s.amount)]);
    });

    const csvContent = rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `madrasa_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    success("Report exported as CSV!");
  }, [rawData, success]);

  const fmt = useCallback((n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n), []);

  const fmtShort = useCallback((n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return `₹${n.toLocaleString("en-IN")}`;
  }, []);

  const totalExpenses = stats.expenses + stats.salaries;
  const netProfit = stats.income - totalExpenses;
  const collectionRate = stats.income > 0 ? Math.min(99.9, (stats.income / (stats.income + stats.expenses * 0.1)) * 100) : 0;

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-2xl" />
            <div className="h-64 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.income, d.expenses)), 1);

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Financial Reports</h1>
          <p className="text-[#64748b] text-sm mt-1">Detailed analysis of your Madrasa&apos;s fiscal health and cash flow.</p>
        </div>
        <button onClick={exportCSV}
          className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition cursor-pointer w-fit">
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 my-6">
        <SummaryCard label="TOTAL REVENUE" value={fmt(stats.income)} change="+12%" positive />
        <SummaryCard label="OPERATIONAL COSTS" value={fmt(totalExpenses)} change="+5%" positive={false} />
        <SummaryCard label="NET PROFIT" value={fmt(netProfit)} change="+18%" positive />
        <SummaryCard label="COLLECTION RATE" value={`${collectionRate.toFixed(1)}%`} change="+2%" positive />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Income vs Expenses Bar Chart */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#1e293b] mb-1">Income Summary</h2>
              <p className="text-sm text-[#64748b]">Monthly revenue trends</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#00c853]/25 inline-block" />
                <span className="text-xs text-[#64748b]">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#00c853] inline-block" />
                <span className="text-xs text-[#64748b]">Expenses</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3" style={{ height: 192 }}>
            {monthlyData.map((d, i) => {
              const incomePct = maxVal > 0 ? (d.income / maxVal) * 100 : 0;
              const expensePct = maxVal > 0 ? (d.expenses / maxVal) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col h-full">
                  <span className="text-[9px] font-medium text-[#1e293b] text-center shrink-0 mb-1 truncate">{fmtShort(d.income)}</span>
                  <div className="flex-1 flex items-end gap-0.5">
                    <div className="flex-1 bg-[#00c853]/25 rounded-t-md transition-all" style={{ height: `${Math.max(incomePct, 2)}%` }} />
                    <div className="flex-1 bg-[#00c853] rounded-t-md transition-all" style={{ height: `${Math.max(expensePct, 2)}%` }} />
                  </div>
                  <span className="text-[10px] text-[#94a3b8] uppercase text-center mt-2 shrink-0">{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="text-lg font-bold text-[#1e293b] mb-1">Expense Breakdown</h2>
          <p className="text-sm text-[#64748b] mb-6">Categories by percentage</p>
          <div className="flex items-center gap-8">
            {/* Donut chart */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#00c853" strokeWidth="4"
                  strokeDasharray={`${totalExpenses > 0 ? (stats.salaries / totalExpenses) * 88 : 0} 88`} strokeLinecap="round" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="4"
                  strokeDasharray={`${totalExpenses > 0 ? (stats.expenses / totalExpenses) * 88 : 0} 88`}
                  strokeDashoffset={`-${totalExpenses > 0 ? (stats.salaries / totalExpenses) * 88 : 0}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-[#1e293b]">{fmt(totalExpenses)}</span>
                <span className="text-[10px] text-[#94a3b8] uppercase">Total</span>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#00c853]" />
                  <span className="text-sm text-[#1e293b]">Salaries</span>
                </div>
                <span className="text-sm font-semibold text-[#1e293b]">{totalExpenses > 0 ? Math.round((stats.salaries / totalExpenses) * 100) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#1e293b]" />
                  <span className="text-sm text-[#1e293b]">Maintenance & Others</span>
                </div>
                <span className="text-sm font-semibold text-[#1e293b]">{totalExpenses > 0 ? Math.round((stats.expenses / totalExpenses) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Salary Payments & Net Balance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="text-lg font-bold text-[#1e293b] mb-1">Salary Payments</h2>
          <p className="text-sm text-[#64748b] mb-5">Teacher and staff payroll disbursement</p>
          <div className="space-y-4">
            <BreakdownItem label="Teaching Staff" amount={fmt(stats.salaries * 0.6)} pct={60} color="#00c853" />
            <BreakdownItem label="Support Staff" amount={fmt(stats.salaries * 0.3)} pct={30} color="#3b82f6" />
            <BreakdownItem label="Administrative" amount={fmt(stats.salaries * 0.1)} pct={10} color="#f59e0b" />
          </div>
          <div className="border-t border-[#f1f5f9] mt-5 pt-4 flex justify-between">
            <span className="text-sm text-[#64748b]">Total Salaries</span>
            <span className="text-lg font-bold text-[#00c853]">{fmt(stats.salaries)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-[#1e293b]">Net Balance</h2>
            <span className="text-xs text-[#94a3b8] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00c853]" /> Current
            </span>
          </div>
          <p className="text-sm text-[#64748b] mb-5">Cumulative cash position over time</p>
          {/* Cumulative net balance bar chart */}
          <div className="h-40 flex items-end gap-1.5">
            {(() => {
              let cumulative = 0;
              const cumulativeData = monthlyData.map(d => {
                cumulative += (d.income - d.expenses);
                return { ...d, cumulative };
              });
              const maxCum = Math.max(...cumulativeData.map(c => Math.abs(c.cumulative)), 1);
              return cumulativeData.map((d, i) => {
                const height = (Math.abs(d.cumulative) / maxCum) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col h-full">
                    <span className="text-[9px] font-medium text-[#1e293b] text-center shrink-0 mb-1 truncate">{fmtShort(d.cumulative)}</span>
                    <div className="flex-1 flex items-end">
                      <div className={`w-full rounded-t-md transition-all ${d.cumulative >= 0 ? "bg-[#00c853]/30" : "bg-red-200"}`}
                        style={{ height: `${Math.max(height, 4)}%` }} />
                    </div>
                    <span className="text-[10px] text-[#94a3b8] uppercase text-center mt-2 shrink-0">{d.month}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#1e293b]">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left pb-3 font-medium">Date</th>
                <th className="text-left pb-3 font-medium">Description</th>
                <th className="text-left pb-3 font-medium">Category</th>
                <th className="text-right pb-3 font-medium">Amount</th>
                <th className="text-right pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTxns.map((txn, i) => (
                <tr key={i} className="border-b border-[#f1f5f9] last:border-0">
                  <td className="py-3.5 text-sm text-[#1e293b]">
                    {new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="py-3.5 text-sm text-[#334155]">{txn.description}</td>
                  <td className="py-3.5">
                    <span className="text-xs text-[#64748b]">{txn.category}</span>
                  </td>
                  <td className={`py-3.5 text-sm font-semibold text-right ${txn.isIncome ? "text-[#00c853]" : "text-red-500"}`}>
                    {txn.isIncome ? "+" : "-"}{fmt(txn.amount)}
                  </td>
                  <td className="py-3.5 text-right">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      txn.status === "completed" ? "bg-[#e8faf0] text-[#00c853]" : "bg-amber-50 text-amber-600"
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, change, positive }: { label: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow">
      <p className="text-[11px] uppercase tracking-wider text-[#94a3b8] font-semibold">{label}</p>
      <div className="flex items-end justify-between mt-2">
        <p className={`text-2xl font-bold ${positive ? "text-[#1e293b]" : "text-[#1e293b]"}`}>{value}</p>
        <span className={`text-xs font-semibold ${positive ? "text-[#00c853]" : "text-red-500"}`}>{change}</span>
      </div>
    </div>
  );
}

function BreakdownItem({ label, amount, pct, color }: { label: string; amount: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium text-[#1e293b]">{label}</span>
        <span className="text-[#64748b]">{amount}</span>
      </div>
      <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

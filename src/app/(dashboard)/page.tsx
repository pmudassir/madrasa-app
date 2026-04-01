"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, TrendingUp, TrendingDown, Wallet, Clock, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { relationItem } from "@/lib/relation-utils";

interface Transaction {
  date: string;
  type: string;
  description: string;
  amount: number;
  isIncome: boolean;
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_date: string;
}

interface RecentStudent {
  id: string;
  name: string;
  class: string | null;
  is_active: boolean;
  created_at: string;
}

interface DonationRow {
  amount: number;
  created_at: string;
  donor_name: string | null;
  events: Array<{ title: string }> | { title: string } | null;
}

interface ExpenseRow {
  amount: number;
  created_at: string;
  category: string;
  description: string | null;
}

interface SalaryRow {
  amount: number;
  created_at: string;
  teachers: Array<{ name: string }> | { name: string } | null;
}

interface FeeRow {
  amount: number;
  created_at: string;
  status: "paid" | "pending";
  description: string;
  students: Array<{ name: string }> | { name: string } | null;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({ students: 0, income: 0, expenses: 0, balance: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("Admin");

  useEffect(() => {
    let active = true;

    async function run() {
      const { data: profile } = await supabase
        .from("profiles")
        .select("madrasa_id, full_name")
        .single();

      if (!profile || !active) return;
      setProfileName(profile.full_name?.split(" ")[0] || "Admin");

      const [studentsRes, donationsRes, expensesRes, salariesRes, feesRes, eventsRes, recentStudentsRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("donations").select("amount, created_at, donor_name, status, events(title)").eq("status", "collected").order("created_at", { ascending: false }),
        supabase.from("expenses").select("amount, created_at, category, description").order("created_at", { ascending: false }),
        supabase.from("salary_payments").select("amount, created_at, teachers(name)").order("created_at", { ascending: false }),
        supabase.from("fee_payments").select("amount, created_at, status, description, students(name)").order("created_at", { ascending: false }),
        supabase.from("events").select("id, title, event_date").gte("event_date", new Date().toISOString().split("T")[0]).order("event_date", { ascending: true }).limit(3),
        supabase.from("students").select("id, name, class, is_active, created_at").order("created_at", { ascending: false }).limit(3),
      ]);

      if (!active) return;

      const donationData = (donationsRes.data || []) as DonationRow[];
      const expenseData = (expensesRes.data || []) as ExpenseRow[];
      const salaryData = (salariesRes.data || []) as SalaryRow[];
      const feeData = (feesRes.data || []) as FeeRow[];

      const totalDonations = donationData.reduce((sum, donation) => sum + Number(donation.amount), 0);
      const totalFees = feeData.filter((fee) => fee.status === "paid").reduce((sum, fee) => sum + Number(fee.amount), 0);
      const totalIncome = totalDonations + totalFees;
      const totalExpenses = expenseData.reduce((sum, expense) => sum + Number(expense.amount), 0);
      const totalSalaries = salaryData.reduce((sum, salary) => sum + Number(salary.amount), 0);
      const totalOutgoing = totalExpenses + totalSalaries;

      setStats({
        students: studentsRes.count || 0,
        income: totalIncome,
        expenses: totalOutgoing,
        balance: totalIncome - totalOutgoing,
      });

      setEvents((eventsRes.data || []) as UpcomingEvent[]);
      setRecentStudents((recentStudentsRes.data || []) as RecentStudent[]);

      const merged: Transaction[] = [
        ...donationData.slice(0, 5).map((donation) => ({
          date: donation.created_at,
          type: "Donation",
          description: `${relationItem(donation.events)?.title || "Event"} — ${donation.donor_name || "Anonymous"}`,
          amount: Number(donation.amount),
          isIncome: true,
        })),
        ...expenseData.slice(0, 5).map((expense) => ({
          date: expense.created_at,
          type: "Expense",
          description: expense.description || expense.category,
          amount: Number(expense.amount),
          isIncome: false,
        })),
        ...salaryData.slice(0, 5).map((salary) => ({
          date: salary.created_at,
          type: "Salary",
          description: `Salary — ${relationItem(salary.teachers)?.name || "Teacher"}`,
          amount: Number(salary.amount),
          isIncome: false,
        })),
        ...feeData.slice(0, 5).map((fee) => ({
          date: fee.created_at,
          type: fee.status === "paid" ? "Income" : "Fee Due",
          description: `${fee.description} — ${relationItem(fee.students)?.name || "Student"}`,
          amount: Number(fee.amount),
          isIncome: fee.status === "paid",
        })),
      ];

      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(merged.slice(0, 5));
      setLoading(false);
    }

    void run();

    return () => {
      active = false;
    };
  }, [supabase]);

  const fmt = useCallback((n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n), []);

  const fmtDate = useCallback((d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), []);

  const typeBadge = useMemo(() => ({
    Income: "bg-[#e8faf0] text-[#00c853]",
    Donation: "bg-blue-50 text-blue-600",
    Expense: "bg-red-50 text-red-500",
    Salary: "bg-orange-50 text-orange-600",
    "Fee Due": "bg-amber-50 text-amber-600",
  }), []);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-100 rounded w-96" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl" />)}
          </div>
          <div className="h-80 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1e293b]">Assalamu Alaikum, {profileName}</h1>
        <p className="text-[#64748b] mt-1">Here&apos;s what&apos;s happening in your Madrasa today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Users} label="Total Students" value={stats.students.toLocaleString()} color="#00c853" bgColor="#e8faf0" />
        <StatCard icon={TrendingUp} label="Total Income" value={fmt(stats.income)} color="#00c853" bgColor="#e8faf0" />
        <StatCard icon={TrendingDown} label="Total Expenses" value={fmt(stats.expenses)} color="#ef4444" bgColor="#fef2f2" />
        <StatCard icon={Wallet} label="Net Balance" value={fmt(stats.balance)} color="#00c853" bgColor="#e8faf0" />
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#1e293b]">Recent Transactions</h2>
          <Link href="/reports" className="bg-[#00c853] hover:bg-[#00a844] text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
            View All
          </Link>
        </div>

        {transactions.length === 0 ? (
          <p className="text-[#94a3b8] text-sm text-center py-8">No transactions yet. Start by adding donations or expenses.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#94a3b8] uppercase tracking-wider">
                  <th className="text-left pb-4 font-medium">Date</th>
                  <th className="text-left pb-4 font-medium">Type</th>
                  <th className="text-left pb-4 font-medium">Description</th>
                  <th className="text-right pb-4 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn, i) => (
                  <tr key={i} className="border-t border-[#f1f5f9]">
                    <td className="py-4 text-sm text-[#1e293b]">{fmtDate(txn.date)}</td>
                    <td className="py-4">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${(typeBadge as Record<string, string>)[txn.type] || "bg-gray-100 text-gray-600"}`}>
                        {txn.type}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-[#334155]">{txn.description}</td>
                    <td className={`py-4 text-sm font-semibold text-right ${txn.isIncome ? "text-[#00c853]" : "text-red-500"}`}>
                      {txn.isIncome ? "+" : "-"}{fmt(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Section: Upcoming Events + Recent Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming events */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="text-lg font-bold text-[#1e293b] mb-5">Upcoming Events</h2>
          {events.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No upcoming events scheduled.</p>
          ) : (
            <div className="space-y-4">
              {events.map(evt => {
                const d = new Date(evt.event_date);
                return (
                  <Link key={evt.id} href={`/events/${evt.id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#f8fafc] transition group">
                    <div className="w-12 h-14 bg-[#e8faf0] rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[#00c853] font-bold text-lg leading-none">{d.getDate()}</span>
                      <span className="text-[#00c853] text-[10px] uppercase font-semibold">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1e293b] truncate group-hover:text-[#00c853] transition">{evt.title}</p>
                      <p className="text-xs text-[#94a3b8] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {evt.event_date ? new Date(evt.event_date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }) : "TBD"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Student Registrations */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="text-lg font-bold text-[#1e293b] mb-5">Recent Student Registrations</h2>
          {recentStudents.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No students registered yet.</p>
          ) : (
            <div className="space-y-4">
              {recentStudents.map(stu => (
                <Link key={stu.id} href={`/students/${stu.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f8fafc] transition">
                  <div className="w-10 h-10 rounded-full bg-[#e8faf0] text-[#00c853] font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {stu.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1e293b]">{stu.name}</p>
                    <p className="text-xs text-[#94a3b8]">{stu.class || "—"} • Registered {fmtDate(stu.created_at)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${stu.is_active ? "bg-[#e8faf0] text-[#00c853]" : "bg-amber-50 text-amber-600"}`}>
                    {stu.is_active ? "Active" : "Pending"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor }: { icon: LucideIcon; label: string; value: string; color: string; bgColor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bgColor }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-sm text-[#64748b] mt-3">{label}</p>
      <p className="text-2xl font-bold text-[#1e293b] mt-1">{value}</p>
    </div>
  );
}

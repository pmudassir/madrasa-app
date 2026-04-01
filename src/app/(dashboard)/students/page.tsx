"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import { PrintButton } from "@/components/print-button";
import { buildCsv, downloadCsv, formatCurrency, formatDate, getMonthLabel } from "@/lib/format";
import { CLASS_LEVELS, type FeePayment, type Student, type StudentFeeDue } from "@/lib/types";
import { fetchJson } from "@/lib/fetcher";
import { relationItem } from "@/lib/relation-utils";

export default function StudentsPage() {
  const supabase = createClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [dues, setDues] = useState<StudentFeeDue[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState("");
  const [dueStatusFilter, setDueStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ensureDuesForSelection = useCallback(async () => {
    const { data: latestDue } = await supabase
      .from("student_fee_dues")
      .select("due_year, due_month")
      .eq("fee_type", "monthly")
      .order("due_year", { ascending: false })
      .order("due_month", { ascending: false })
      .limit(1)
      .maybeSingle();

    const targetYear = Number(yearFilter);
    const targetMonth = Number(monthFilter);
    const latestYear = latestDue?.due_year ?? 0;
    const latestMonth = latestDue?.due_month ?? 0;
    const needsSync = latestYear < targetYear || (latestYear === targetYear && latestMonth < targetMonth);

    if (needsSync) {
      await fetchJson<{ data: number }>("/api/students/dues/sync", {
        method: "POST",
        body: JSON.stringify({
          through_year: targetYear,
          through_month: targetMonth,
        }),
      });
    }
  }, [monthFilter, supabase, yearFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await ensureDuesForSelection();

    const [studentsRes, dueRes, paymentRes] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: false }),
      supabase.from("student_fee_dues").select("*").order("due_year", { ascending: false }).order("due_month", { ascending: false }),
      supabase.from("fee_payments").select("*, students(id, name, class_level), collectors(id, name)").order("collected_at", { ascending: false }),
    ]);

    setStudents((studentsRes.data || []) as Student[]);
    setDues((dueRes.data || []) as StudentFeeDue[]);
    setPayments((paymentRes.data || []) as FeePayment[]);
    setLoading(false);
  }, [ensureDuesForSelection, supabase]);

  useEffect(() => {
    async function run() {
      await loadData();
    }

    void run();
  }, [loadData]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        !search ||
        student.name.toLowerCase().includes(search.toLowerCase()) ||
        (student.admission_no || "").toLowerCase().includes(search.toLowerCase()) ||
        (student.father_name || "").toLowerCase().includes(search.toLowerCase());

      const matchesClass = !classFilter || student.class_level === classFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" && student.is_active) ||
        (statusFilter === "inactive" && !student.is_active);
      const admission = student.admission_date ? new Date(student.admission_date) : null;
      const matchesFrom = !dateFrom || (admission && admission >= new Date(`${dateFrom}T00:00:00`));
      const matchesTo = !dateTo || (admission && admission <= new Date(`${dateTo}T23:59:59`));

      return matchesSearch && matchesClass && matchesStatus && matchesFrom && matchesTo;
    });
  }, [students, search, classFilter, statusFilter, dateFrom, dateTo]);

  const allowedStudentIds = new Set(
    filteredStudents
      .filter((student) => !studentFilter || student.id === studentFilter)
      .map((student) => student.id)
  );

  const filteredDues = dues.filter((due) => {
    const matchesStudent = allowedStudentIds.has(due.student_id);
    const matchesFeeType = !feeTypeFilter || due.fee_type === feeTypeFilter;
    const matchesStatus = !dueStatusFilter || due.status === dueStatusFilter;
    const matchesMonth = due.fee_type === "admission" || (!monthFilter || due.due_month === Number(monthFilter));
    const matchesYear = due.fee_type === "admission" || (!yearFilter || due.due_year === Number(yearFilter));
    return matchesStudent && matchesFeeType && matchesStatus && matchesMonth && matchesYear;
  });

  const filteredPayments = payments.filter((payment) => {
    const studentId = payment.students?.id || payment.student_id;
    const matchesStudent = allowedStudentIds.has(studentId);
    const matchesFeeType = !feeTypeFilter || payment.fee_type === feeTypeFilter;
    const paidAt = payment.collected_at || payment.fee_date;
    const matchesMonth = !monthFilter || new Date(paidAt).getMonth() + 1 === Number(monthFilter);
    const matchesYear = !yearFilter || new Date(paidAt).getFullYear() === Number(yearFilter);
    return matchesStudent && matchesFeeType && matchesMonth && matchesYear;
  });

  const admissionsCount = filteredStudents.length;
  const admissionFeeDue = filteredDues.filter((due) => due.fee_type === "admission").reduce((sum, due) => sum + Number(due.due_amount), 0);
  const admissionFeeCollected = filteredDues.filter((due) => due.fee_type === "admission").reduce((sum, due) => sum + Number(due.collected_amount), 0);
  const monthlyFeePending = filteredDues.filter((due) => due.fee_type === "monthly").reduce((sum, due) => sum + Number(due.outstanding_amount), 0);
  const totalFeeDue = filteredDues.reduce((sum, due) => sum + Number(due.due_amount), 0);
  const totalCollected = filteredDues.reduce((sum, due) => sum + Number(due.collected_amount), 0);
  const collectionRate = totalFeeDue > 0 ? `${Math.round((totalCollected / totalFeeDue) * 100)}%` : "0%";

  function exportFeeReport() {
    const rows: Array<Array<string | number>> = [
      ["Student", "Admission No.", "Class", "Fee Type", "Period", "Due", "Collected", "Pending", "Status"],
    ];

    filteredDues.forEach((due) => {
      const student = students.find((item) => item.id === due.student_id);
      rows.push([
        student?.name || "—",
        student?.admission_no || "—",
        student?.class_level || "—",
        due.fee_type,
        due.fee_type === "admission" ? "One time" : `${getMonthLabel(due.due_month)} ${due.due_year ?? ""}`.trim(),
        due.due_amount,
        due.collected_amount,
        due.outstanding_amount,
        due.status,
      ]);
    });

    downloadCsv(`fee-report-${yearFilter}-${monthFilter}.csv`, buildCsv(rows));
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Admissions & Fees</h1>
          <p className="text-[#64748b] text-sm mt-1">Manage admissions and get fast fee reporting by class, student, month, and status.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrintButton label="Print Report" />
          <button
            onClick={exportFeeReport}
            className="border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] transition cursor-pointer"
          >
            Export Fee CSV
          </button>
          <Link
            href="/students/new"
            className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition"
          >
            <Plus className="w-4 h-4" /> New Admission
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search student, admission no., father..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
            />
          </div>

          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            <option value="">All Classes</option>
            {CLASS_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            <option value="">All Admission Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            <option value="">All Students</option>
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>{student.name}</option>
            ))}
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />

          <select value={feeTypeFilter} onChange={(e) => setFeeTypeFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            <option value="">All Fee Types</option>
            <option value="admission">Admission</option>
            <option value="monthly">Monthly</option>
          </select>

          <select value={dueStatusFilter} onChange={(e) => setDueStatusFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            <option value="">All Due Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>

          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={String(index + 1)}>
                {getMonthLabel(index + 1)}
              </option>
            ))}
          </select>

          <input type="number" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
        </div>
      </div>

      <SummaryGrid>
        <SummaryCard label="Admissions" value={String(admissionsCount)} helper="Filtered by current admission filters" />
        <SummaryCard label="Admission Fee Due" value={formatCurrency(admissionFeeDue)} helper={`Collected ${formatCurrency(admissionFeeCollected)}`} />
        <SummaryCard label="Monthly Fee Pending" value={formatCurrency(monthlyFeePending)} helper={`For ${getMonthLabel(Number(monthFilter))} ${yearFilter}`} />
        <SummaryCard label="Collection Rate" value={collectionRate} helper={`Collected ${formatCurrency(totalCollected)} of ${formatCurrency(totalFeeDue)}`} />
      </SummaryGrid>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
          <div className="p-5 border-b border-[#f1f5f9]">
            <h2 className="text-lg font-bold text-[#1e293b]">Admissions</h2>
            <p className="text-sm text-[#64748b] mt-1">Quick view of registered students with admission metadata.</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-[#94a3b8]">Loading admissions...</div>
          ) : (
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                  <th className="text-left px-6 py-4 font-medium">Student</th>
                  <th className="text-left px-4 py-4 font-medium">Admission No.</th>
                  <th className="text-left px-4 py-4 font-medium">Class</th>
                  <th className="text-left px-4 py-4 font-medium">Admission Date</th>
                  <th className="text-right px-6 py-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#e8faf0] text-[#00c853] font-semibold text-sm flex items-center justify-center">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1e293b]">{student.name}</p>
                          <p className="text-xs text-[#64748b]">{student.father_name || student.parent_name || "No guardian entered"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">{student.admission_no || "—"}</td>
                    <td className="px-4 py-4 text-sm">{student.class_level || "—"}</td>
                    <td className="px-4 py-4 text-sm">{formatDate(student.admission_date)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/students/${student.id}`} className="inline-flex items-center gap-1 text-[#00c853] text-sm font-semibold hover:underline">
                        <Eye className="w-4 h-4" /> Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
          <div className="p-5 border-b border-[#f1f5f9]">
            <h2 className="text-lg font-bold text-[#1e293b]">Fee Due Report</h2>
            <p className="text-sm text-[#64748b] mt-1">Filtered due ledger for the selected student, month, class, and status.</p>
          </div>

          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Student</th>
                <th className="text-left px-4 py-4 font-medium">Type</th>
                <th className="text-left px-4 py-4 font-medium">Period</th>
                <th className="text-right px-4 py-4 font-medium">Due</th>
                <th className="text-right px-4 py-4 font-medium">Collected</th>
                <th className="text-right px-6 py-4 font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {filteredDues.map((due) => {
                const student = students.find((item) => item.id === due.student_id);
                return (
                  <tr key={due.id} className="border-b border-[#f1f5f9]">
                    <td className="px-6 py-4 text-sm font-medium text-[#1e293b]">{student?.name || "Unknown"}</td>
                    <td className="px-4 py-4 text-sm capitalize">{due.fee_type}</td>
                    <td className="px-4 py-4 text-sm">
                      {due.fee_type === "admission" ? "One time" : `${getMonthLabel(due.due_month)} ${due.due_year ?? ""}`.trim()}
                    </td>
                    <td className="px-4 py-4 text-sm text-right">{formatCurrency(Number(due.due_amount))}</td>
                    <td className="px-4 py-4 text-sm text-right text-[#00c853]">{formatCurrency(Number(due.collected_amount))}</td>
                    <td className="px-6 py-4 text-sm text-right text-red-500">{formatCurrency(Number(due.outstanding_amount))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        <div className="p-5 border-b border-[#f1f5f9]">
          <h2 className="text-lg font-bold text-[#1e293b]">Filtered Payment Transactions</h2>
          <p className="text-sm text-[#64748b] mt-1">Quick collection report by student, month, and collector for the selected view.</p>
        </div>

        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
              <th className="text-left px-6 py-4 font-medium">Receipt</th>
              <th className="text-left px-4 py-4 font-medium">Student</th>
              <th className="text-left px-4 py-4 font-medium">Collector</th>
              <th className="text-left px-4 py-4 font-medium">Date</th>
              <th className="text-left px-4 py-4 font-medium">Type</th>
              <th className="text-right px-6 py-4 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => (
              <tr key={payment.id} className="border-b border-[#f1f5f9]">
                <td className="px-6 py-4 text-sm font-medium text-[#1e293b]">{payment.receipt_no || "Legacy"}</td>
                <td className="px-4 py-4 text-sm">{relationItem(payment.students)?.name || "Unknown"}</td>
                <td className="px-4 py-4 text-sm">{relationItem(payment.collectors)?.name || "—"}</td>
                <td className="px-4 py-4 text-sm">{formatDate(payment.collected_at || payment.fee_date)}</td>
                <td className="px-4 py-4 text-sm capitalize">{payment.fee_type || "monthly"}</td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-[#00c853]">{formatCurrency(Number(payment.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

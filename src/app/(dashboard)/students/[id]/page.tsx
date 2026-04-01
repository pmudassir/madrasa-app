"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Edit2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchJson } from "@/lib/fetcher";
import { formatCurrency, formatDate, getMonthLabel } from "@/lib/format";
import { getReceiptDownloadUrl } from "@/lib/receipt-utils";
import { useToast } from "@/components/toast";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import type { Collector, FeePayment, Student, StudentFeeDue } from "@/lib/types";
import { relationItem } from "@/lib/relation-utils";

export default function StudentDetailPage() {
  const supabase = createClient();
  const { id } = useParams<{ id: string }>();
  const { success, error: showError } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [dues, setDues] = useState<StudentFeeDue[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feeForm, setFeeForm] = useState({
    due_id: "",
    amount: "",
    collected_by_collector_id: "",
    collected_at: new Date().toISOString().split("T")[0],
  });

  const syncDues = useCallback(async () => {
    const now = new Date();
    const throughYear = now.getFullYear();
    const throughMonth = now.getMonth() + 1;

    const { data: latestDue } = await supabase
      .from("student_fee_dues")
      .select("due_year, due_month")
      .eq("student_id", id)
      .eq("fee_type", "monthly")
      .order("due_year", { ascending: false })
      .order("due_month", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestYear = latestDue?.due_year ?? 0;
    const latestMonth = latestDue?.due_month ?? 0;
    const needsSync = latestYear < throughYear || (latestYear === throughYear && latestMonth < throughMonth);

    if (needsSync) {
      await fetchJson<{ data: number }>("/api/students/dues/sync", {
        method: "POST",
        body: JSON.stringify({
          through_year: throughYear,
          through_month: throughMonth,
        }),
      });
    }
  }, [id, supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      await syncDues();

      const [studentRes, dueRes, paymentRes, collectorRes] = await Promise.all([
        supabase.from("students").select("*").eq("id", id).single(),
        supabase.from("student_fee_dues").select("*").eq("student_id", id).order("due_year", { ascending: true }).order("due_month", { ascending: true }),
        supabase.from("fee_payments").select("*, collectors(id, name)").eq("student_id", id).order("collected_at", { ascending: false }),
        supabase.from("collectors").select("*").eq("is_active", true).order("name"),
      ]);

      setStudent(studentRes.data as Student | null);
      setDues((dueRes.data || []) as StudentFeeDue[]);
      setPayments((paymentRes.data || []) as FeePayment[]);
      setCollectors((collectorRes.data || []) as Collector[]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to load student");
    } finally {
      setLoading(false);
    }
  }, [id, showError, supabase, syncDues]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const selectedDue = useMemo(
    () => dues.find((due) => due.id === feeForm.due_id) || null,
    [dues, feeForm.due_id]
  );

  const totalDue = dues.reduce((sum, due) => sum + Number(due.due_amount), 0);
  const totalCollected = dues.reduce((sum, due) => sum + Number(due.collected_amount), 0);
  const totalPending = dues.reduce((sum, due) => sum + Number(due.outstanding_amount), 0);
  const pendingDues = dues.filter((due) => due.outstanding_amount > 0);

  async function handleCollectFee(e: React.FormEvent) {
    e.preventDefault();

    if (!feeForm.due_id || !feeForm.collected_by_collector_id) {
      showError("Select both the due item and collector");
      return;
    }

    setSaving(true);

    try {
      await fetchJson<{ data: { receipt_no: string } }>(`/api/students/${id}/fees`, {
        method: "POST",
        body: JSON.stringify({
          ...feeForm,
          amount: Number(feeForm.amount || 0),
        }),
      });

      success("Fee payment recorded successfully");
      setShowForm(false);
      setFeeForm({
        due_id: "",
        amount: "",
        collected_by_collector_id: "",
        collected_at: new Date().toISOString().split("T")[0],
      });
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to record fee");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Loading student profile...</div>;
  }

  if (!student) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Student not found.</div>;
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="text-sm text-[#64748b]">
        <Link href="/" className="text-[#00c853] hover:underline">Dashboard</Link>
        <span className="mx-2">›</span>
        <Link href="/students" className="text-[#00c853] hover:underline">Students</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">{student.name}</span>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="w-18 h-18 rounded-2xl bg-[#e8faf0] text-[#00c853] font-bold text-2xl flex items-center justify-center shrink-0">
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1e293b]">{student.name}</h1>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#e8faf0] text-[#00c853]">
              {student.class_level || "—"}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${student.is_active ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-600"}`}>
              {student.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-sm text-[#64748b] mt-2">
            Admission No. {student.admission_no || "—"} • Admitted on {formatDate(student.admission_date)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
            <InfoItem label="Father" value={student.father_name || student.parent_name || "—"} />
            <InfoItem label="Mother" value={student.mother_name || "—"} />
            <InfoItem label="Phone" value={student.phone_no || student.parent_phone || "—"} />
          </div>
        </div>
        <Link
          href={`/students/${student.id}/edit`}
          className="border border-[#e2e8f0] rounded-xl px-4 py-2 text-sm font-medium text-[#334155] flex items-center gap-2 hover:bg-[#f8fafc] transition"
        >
          <Edit2 className="w-4 h-4" /> Edit Admission
        </Link>
      </div>

      <SummaryGrid>
        <SummaryCard label="Total Fee Due" value={formatCurrency(totalDue)} helper="All seeded dues" />
        <SummaryCard label="Collected" value={formatCurrency(totalCollected)} helper="Against due ledger" />
        <SummaryCard label="Pending" value={formatCurrency(totalPending)} helper={`${pendingDues.length} dues open`} />
        <SummaryCard label="Monthly Fee" value={formatCurrency(student.monthly_fee)} helper={`Admission ${formatCurrency(student.admission_fee)}`} />
      </SummaryGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-[#e2e8f0] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1e293b]">Fee Dues Ledger</h2>
              <p className="text-sm text-[#64748b]">Admission and monthly dues with exact outstanding amounts.</p>
            </div>
            <button
              onClick={() => setShowForm((prev) => !prev)}
              className="bg-[#00c853] hover:bg-[#00a844] text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Collect Fee
            </button>
          </div>

          {showForm ? (
            <form onSubmit={handleCollectFee} className="bg-[#f8fafc] rounded-2xl p-4 mb-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Due Item">
                  <select
                    value={feeForm.due_id}
                    onChange={(e) => {
                      const nextDue = dues.find((due) => due.id === e.target.value);
                      setFeeForm((prev) => ({
                        ...prev,
                        due_id: e.target.value,
                        amount: nextDue ? String(nextDue.outstanding_amount) : "",
                      }));
                    }}
                    className="w-full px-3 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                  >
                    <option value="">Select a due item</option>
                    {pendingDues.map((due) => (
                      <option key={due.id} value={due.id}>
                        {due.fee_type === "admission"
                          ? `Admission fee - ${formatCurrency(due.outstanding_amount)}`
                          : `${getMonthLabel(due.due_month)} ${due.due_year} - ${formatCurrency(due.outstanding_amount)}`}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Collected By">
                  <select
                    value={feeForm.collected_by_collector_id}
                    onChange={(e) => setFeeForm((prev) => ({ ...prev, collected_by_collector_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                  >
                    <option value="">Select collector</option>
                    {collectors.map((collector) => (
                      <option key={collector.id} value={collector.id}>
                        {collector.name} ({formatCurrency(Number(collector.current_balance))})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Amount">
                  <input
                    type="number"
                    min="1"
                    max={selectedDue?.outstanding_amount || undefined}
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                  />
                </Field>

                <Field label="Collected On">
                  <input
                    type="date"
                    value={feeForm.collected_at}
                    onChange={(e) => setFeeForm((prev) => ({ ...prev, collected_at: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#e2e8f0] rounded-xl text-sm"
                  />
                </Field>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                  <th className="text-left py-3 font-medium">Type</th>
                  <th className="text-left py-3 font-medium">Period</th>
                  <th className="text-right py-3 font-medium">Due</th>
                  <th className="text-right py-3 font-medium">Collected</th>
                  <th className="text-right py-3 font-medium">Pending</th>
                  <th className="text-right py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((due) => (
                  <tr key={due.id} className="border-b border-[#f1f5f9]">
                    <td className="py-3 text-sm font-medium text-[#1e293b]">{due.fee_type === "admission" ? "Admission" : "Monthly"}</td>
                    <td className="py-3 text-sm text-[#334155]">{due.fee_type === "monthly" ? `${getMonthLabel(due.due_month)} ${due.due_year}` : "One time"}</td>
                    <td className="py-3 text-sm text-right">{formatCurrency(Number(due.due_amount))}</td>
                    <td className="py-3 text-sm text-right text-[#00c853]">{formatCurrency(Number(due.collected_amount))}</td>
                    <td className="py-3 text-sm text-right text-red-500">{formatCurrency(Number(due.outstanding_amount))}</td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        due.status === "paid"
                          ? "bg-[#e8faf0] text-[#00c853]"
                          : due.status === "partial"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-red-50 text-red-500"
                      }`}>
                        {due.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
          <h2 className="text-lg font-bold text-[#1e293b] mb-4">Admission Summary</h2>
          <div className="space-y-4">
            <InfoItem label="Admission No." value={student.admission_no || "—"} />
            <InfoItem label="Admission Date" value={formatDate(student.admission_date)} />
            <InfoItem label="Admission Fee" value={formatCurrency(student.admission_fee)} />
            <InfoItem label="Monthly Fee" value={formatCurrency(student.monthly_fee)} />
            <InfoItem label="Date of Birth" value={formatDate(student.date_of_birth)} />
            <InfoItem label="Address" value={student.address || "—"} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1e293b]">Payment History</h2>
            <p className="text-sm text-[#64748b]">All recorded collections with collectors and receipt files.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {payments.length === 0 ? (
            <p className="text-sm text-[#94a3b8] py-8 text-center">No payments recorded yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                  <th className="text-left py-3 font-medium">Receipt</th>
                  <th className="text-left py-3 font-medium">Type</th>
                  <th className="text-left py-3 font-medium">Collected By</th>
                  <th className="text-left py-3 font-medium">Date</th>
                  <th className="text-right py-3 font-medium">Amount</th>
                  <th className="text-right py-3 font-medium">File</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const receiptUrl = getReceiptDownloadUrl(payment.receipt_pdf_path);
                  return (
                    <tr key={payment.id} className="border-b border-[#f1f5f9]">
                      <td className="py-3 text-sm font-medium text-[#1e293b]">{payment.receipt_no || "Legacy"}</td>
                      <td className="py-3 text-sm text-[#334155]">
                        {payment.fee_type === "admission"
                          ? "Admission"
                          : `${getMonthLabel(payment.billing_month)} ${payment.billing_year ?? ""}`.trim()}
                      </td>
                      <td className="py-3 text-sm text-[#334155]">{relationItem(payment.collectors)?.name || "—"}</td>
                      <td className="py-3 text-sm text-[#334155]">{formatDate(payment.collected_at || payment.fee_date)}</td>
                      <td className="py-3 text-sm text-right font-semibold text-[#00c853]">{formatCurrency(Number(payment.amount))}</td>
                      <td className="py-3 text-right">
                        {receiptUrl ? (
                          <a
                            href={receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-[#00c853] hover:underline"
                          >
                            <Download className="w-4 h-4" />
                            Receipt
                          </a>
                        ) : (
                          <span className="text-xs text-[#94a3b8]">Not available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#64748b] mb-1">{label}</span>
      {children}
    </label>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[#94a3b8] font-medium mb-1">{label}</p>
      <p className="text-sm text-[#1e293b]">{value}</p>
    </div>
  );
}

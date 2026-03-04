"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Edit2, CreditCard, Clock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Student, FeePayment } from "@/lib/types";
import { useToast } from "@/components/toast";
import ConfirmDialog from "@/components/confirm-dialog";
import { logActivity } from "@/lib/activity-logger";

export default function StudentDetailPage() {
  const supabase = createClient();
  const { id } = useParams();
  const { success, error: showError } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeForm, setFeeForm] = useState({ description: "", amount: "", fee_date: new Date().toISOString().split("T")[0], status: "paid" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const [{ data: stu }, { data: feeData }] = await Promise.all([
      supabase.from("students").select("*").eq("id", id).single(),
      supabase.from("fee_payments").select("*").eq("student_id", id).order("fee_date", { ascending: false }),
    ]);
    setStudent(stu);
    setFees(feeData || []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const totalOutstanding = fees.filter(f => f.status === "pending").reduce((s, f) => s + Number(f.amount), 0);
  const lastPaid = fees.find(f => f.status === "paid");

  async function handleAddFee(e: React.FormEvent) {
    e.preventDefault();
    if (!feeForm.description || !feeForm.amount) return;
    setSaving(true);

    const { data: profile } = await supabase.from("profiles").select("madrasa_id").single();
    if (!profile) { setSaving(false); return; }

    const { error: err } = await supabase.from("fee_payments").insert({
      madrasa_id: profile.madrasa_id,
      student_id: id,
      description: feeForm.description,
      amount: parseFloat(feeForm.amount),
      status: feeForm.status,
      fee_date: feeForm.fee_date,
    });

    if (err) {
      showError("Failed to add fee: " + err.message);
    } else {
      success("Fee payment recorded successfully");
      await logActivity("financial",
        `Recorded fee ${fmt(parseFloat(feeForm.amount))} for ${student?.name}`, "fee_payment");
      setShowFeeForm(false);
      setFeeForm({ description: "", amount: "", fee_date: new Date().toISOString().split("T")[0], status: "paid" });
      loadData();
    }
    setSaving(false);
  }

  async function handleMarkPaid(fee: FeePayment) {
    const { error: err } = await supabase.from("fee_payments").update({ status: "paid" }).eq("id", fee.id);
    if (err) { showError("Failed to update"); return; }
    success("Marked as paid!");
    loadData();
  }

  async function handleDeleteFee() {
    if (!deleteId) return;
    setDeleting(true);
    const { error: err } = await supabase.from("fee_payments").delete().eq("id", deleteId);
    if (err) { showError("Failed to delete"); }
    else { success("Fee record deleted"); loadData(); }
    setDeleteId(null);
    setDeleting(false);
  }

  if (loading) return <div className="p-4 sm:p-8 text-[#94a3b8]">Loading...</div>;
  if (!student) return <div className="p-4 sm:p-8 text-[#94a3b8]">Student not found.</div>;

  return (
    <div className="p-4 sm:p-8">
      {/* Breadcrumb */}
      <div className="text-sm text-[#64748b] mb-6">
        <Link href="/" className="text-[#00c853] hover:underline">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/students" className="text-[#00c853] hover:underline">Students</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">Student Profile</span>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#e8faf0] text-[#00c853] font-bold text-2xl flex items-center justify-center shrink-0">
          {student.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1e293b]">{student.name}</h1>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              student.is_active ? "bg-[#e8faf0] text-[#00c853]" : "bg-gray-100 text-gray-500"
            }`}>
              {student.is_active ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
          <p className="text-[#64748b] text-sm mt-1">
            {student.class || "No class"} • Enrolled: {student.joined_at ? new Date(student.joined_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "N/A"}
          </p>
        </div>
        <Link href={`/students/${student.id}/edit`}
          className="border border-[#e2e8f0] rounded-xl px-4 py-2 text-sm font-medium text-[#334155] flex items-center gap-2 hover:bg-[#f8fafc] transition">
          <Edit2 className="w-4 h-4" /> Edit Profile
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Student Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#1e293b] mb-4">
              <User className="w-4 h-4 text-[#00c853]" /> Student Information
            </h2>
            <div className="space-y-4">
              <InfoItem label="PARENT NAME" value={student.parent_name || "—"} />
              <InfoItem label="PHONE NUMBER" value={student.parent_phone || "—"} />
              <InfoItem label="EMAIL ADDRESS" value={student.parent_email || "—"} />
              <InfoItem label="RESIDENTIAL ADDRESS" value={student.address || "—"} />
              <InfoItem label="DATE OF BIRTH" value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
              <InfoItem label="GENDER" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—"} />
            </div>
          </div>
        </div>

        {/* Right Column - Fee Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border-2 border-[#e8faf0] p-5">
              <p className="text-sm text-[#64748b] mb-1">Total Outstanding Balance</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-[#1e293b]">{fmt(totalOutstanding)}</span>
                <CreditCard className="w-8 h-8 text-[#00c853]" />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
              <p className="text-sm text-[#64748b] mb-1">Last Payment Received</p>
              <span className="text-2xl font-bold text-[#1e293b]">{lastPaid ? fmt(Number(lastPaid.amount)) : "—"}</span>
              {lastPaid && (
                <p className="text-xs text-[#94a3b8] mt-1">Paid on {new Date(lastPaid.fee_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</p>
              )}
            </div>
          </div>

          {/* Fee History */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-[#1e293b]">
                <Clock className="w-4 h-4 text-[#00c853]" /> Fee History
              </h2>
              <button onClick={() => setShowFeeForm(true)}
                className="bg-[#00c853] hover:bg-[#00a844] text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer">
                <Plus className="w-4 h-4" /> Add Fee
              </button>
            </div>

            {/* Add Fee Form */}
            {showFeeForm && (
              <form onSubmit={handleAddFee} className="bg-[#f8fafc] rounded-xl p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">Description *</label>
                    <input type="text" value={feeForm.description} onChange={e => setFeeForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="e.g. Monthly Tuition - March" required
                      className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">Amount (₹) *</label>
                    <input type="number" value={feeForm.amount} onChange={e => setFeeForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="500" required min="1"
                      className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">Date</label>
                    <input type="date" value={feeForm.fee_date} onChange={e => setFeeForm(p => ({ ...p, fee_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">Status</label>
                    <select value={feeForm.status} onChange={e => setFeeForm(p => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20">
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowFeeForm(false)}
                    className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-gray-50 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-2 text-sm bg-[#00c853] text-white font-semibold rounded-lg hover:bg-[#00a844] disabled:opacity-50 cursor-pointer">
                    {saving ? "Saving..." : "Save Fee"}
                  </button>
                </div>
              </form>
            )}

            {/* Fee Table */}
            <div className="overflow-x-auto">
              {fees.length === 0 ? (
                <p className="text-sm text-[#94a3b8] text-center py-8">No fee records yet. Click &quot;Add Fee&quot; to record one.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                      <th className="text-center px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map(fee => (
                      <tr key={fee.id} className="border-b border-[#f1f5f9]">
                        <td className="px-4 py-3 text-sm text-[#1e293b]">
                          {new Date(fee.fee_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#334155]">{fee.description}</td>
                        <td className="px-4 py-3 text-sm text-[#1e293b] text-right font-medium">{fmt(Number(fee.amount))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            fee.status === "paid" ? "bg-[#e8faf0] text-[#00c853]" : "bg-amber-100 text-amber-700"
                          }`}>
                            {fee.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {fee.status === "pending" && (
                              <button onClick={() => handleMarkPaid(fee)}
                                className="text-xs text-[#00c853] font-semibold hover:underline cursor-pointer">Pay Now</button>
                            )}
                            <button onClick={() => setDeleteId(fee.id)} className="text-[#94a3b8] hover:text-red-500 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Fee Record"
        message="Are you sure you want to delete this fee record? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteFee}
        onCancel={() => setDeleteId(null)}
      />
    </div>
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

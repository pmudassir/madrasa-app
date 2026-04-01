"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SummaryCard, SummaryGrid } from "@/components/report-summary";
import { PrintButton } from "@/components/print-button";
import { FAMILY_GRADES, FAMILY_MEMBER_STATUSES, type Family, type FamilyGrade, type FamilyMember } from "@/lib/types";
import { useToast } from "@/components/toast";
import { fetchJson } from "@/lib/fetcher";

type EditableMember = Omit<FamilyMember, "id" | "created_at" | "family_id"> & { localId: string };

const emptyMember = (): EditableMember => ({
  localId: Math.random().toString(36).slice(2),
  name: "",
  relation: "",
  age: null,
  phone_no: "",
  status: "none",
  class_or_work_details: "",
});

export default function FamiliesPage() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    head_name: "",
    phone_no: "",
    whatsapp_no: "",
    job: "",
    financial_grade: "C" as FamilyGrade,
    address: "",
    notes: "",
  });
  const [members, setMembers] = useState<EditableMember[]>([emptyMember()]);
  const [saving, setSaving] = useState(false);

  const loadFamilies = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("families")
      .select("*, family_members(*)")
      .order("created_at", { ascending: false });
    setFamilies((data || []) as Family[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  const filteredFamilies = useMemo(() => {
    return families.filter((family) => {
      const membersList = family.family_members || [];
      const matchesSearch =
        !search ||
        family.head_name.toLowerCase().includes(search.toLowerCase()) ||
        (family.phone_no || "").toLowerCase().includes(search.toLowerCase()) ||
        membersList.some((member) => member.name.toLowerCase().includes(search.toLowerCase()));

      const matchesGrade = !gradeFilter || family.financial_grade === gradeFilter;
      const matchesStatus =
        !statusFilter ||
        membersList.some((member) => member.status === statusFilter);

      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [families, gradeFilter, search, statusFilter]);

  const totalMembers = filteredFamilies.reduce((sum, family) => sum + (family.family_members?.length || 0), 0);
  const workingCount = filteredFamilies.reduce((sum, family) => sum + (family.family_members || []).filter((member) => member.status === "working").length, 0);
  const studyingCount = filteredFamilies.reduce((sum, family) => sum + (family.family_members || []).filter((member) => member.status === "studying").length, 0);

  function openCreateForm() {
    setEditingId(null);
    setForm({
      head_name: "",
      phone_no: "",
      whatsapp_no: "",
      job: "",
      financial_grade: "C",
      address: "",
      notes: "",
    });
    setMembers([emptyMember()]);
    setShowForm(true);
  }

  function openEditForm(family: Family) {
    setEditingId(family.id);
    setForm({
      head_name: family.head_name,
      phone_no: family.phone_no || "",
      whatsapp_no: family.whatsapp_no || "",
      job: family.job || "",
      financial_grade: family.financial_grade,
      address: family.address || "",
      notes: family.notes || "",
    });
    setMembers(
      (family.family_members || []).map((member) => ({
        localId: member.id,
        name: member.name,
        relation: member.relation,
        age: member.age,
        phone_no: member.phone_no || "",
        status: member.status,
        class_or_work_details: member.class_or_work_details || "",
      }))
    );
    setShowForm(true);
  }

  async function handleSaveFamily(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const validMembers = members.filter((member) => member.name.trim() && member.relation.trim());
      await fetchJson("/api/families", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          id: editingId,
          ...form,
          members: validMembers.map((member) => ({
            name: member.name,
            relation: member.relation,
            age: member.age,
            phone_no: member.phone_no || null,
            status: member.status,
            class_or_work_details: member.class_or_work_details || null,
          })),
        }),
      });

      success(editingId ? "Family updated successfully" : "Family created successfully");
      setShowForm(false);
      await loadFamilies();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save family");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Families</h1>
          <p className="text-[#64748b] text-sm mt-1">Maintain family directory data with member-level working and studying context.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrintButton label="Print Directory" />
          <button onClick={openCreateForm} className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add Family
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search head, phone, or member..." className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Grades</option>
          {FAMILY_GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
          <option value="">All Member Status</option>
          {FAMILY_MEMBER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      <SummaryGrid>
        <SummaryCard label="Families" value={String(filteredFamilies.length)} helper="Filtered directory count" />
        <SummaryCard label="Members" value={String(totalMembers)} helper="Across filtered families" />
        <SummaryCard label="Working" value={String(workingCount)} helper={`Studying ${studyingCount}`} />
        <SummaryCard label="Grades" value={filteredFamilies.map((family) => family.financial_grade).join(", ") || "—"} helper="Visible grade mix" />
      </SummaryGrid>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        <div className="p-5 border-b border-[#f1f5f9]">
          <h2 className="text-lg font-bold text-[#1e293b]">Family Registry</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#94a3b8]">Loading families...</div>
        ) : (
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Head of Family</th>
                <th className="text-left px-4 py-4 font-medium">Phone</th>
                <th className="text-left px-4 py-4 font-medium">Job</th>
                <th className="text-left px-4 py-4 font-medium">Grade</th>
                <th className="text-left px-4 py-4 font-medium">Members</th>
                <th className="text-right px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFamilies.map((family) => (
                <tr key={family.id} className="border-b border-[#f1f5f9]">
                  <td className="px-6 py-4 text-sm font-medium text-[#1e293b]">{family.head_name}</td>
                  <td className="px-4 py-4 text-sm">{family.phone_no || "—"}</td>
                  <td className="px-4 py-4 text-sm">{family.job || "—"}</td>
                  <td className="px-4 py-4 text-sm">
                    <span className="inline-flex px-3 py-1 rounded-full bg-[#f8fafc] border border-[#e2e8f0] font-semibold">{family.financial_grade}</span>
                  </td>
                  <td className="px-4 py-4 text-sm">{family.family_members?.length || 0}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/families/${family.id}`} className="inline-flex items-center gap-1 text-[#00c853] text-sm font-semibold hover:underline">
                        <Eye className="w-4 h-4" /> Detail
                      </Link>
                      <button onClick={() => openEditForm(family)} className="text-sm text-[#334155] hover:underline cursor-pointer">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b] mb-4">{editingId ? "Edit Family" : "Add Family"}</h2>
            <form onSubmit={handleSaveFamily} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Head Name"><input type="text" required value={form.head_name} onChange={(e) => setForm((prev) => ({ ...prev, head_name: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                <Field label="Phone"><input type="tel" value={form.phone_no} onChange={(e) => setForm((prev) => ({ ...prev, phone_no: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                <Field label="WhatsApp"><input type="tel" value={form.whatsapp_no} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp_no: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                <Field label="Job"><input type="text" value={form.job} onChange={(e) => setForm((prev) => ({ ...prev, job: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                <Field label="Financial Grade">
                  <select value={form.financial_grade} onChange={(e) => setForm((prev) => ({ ...prev, financial_grade: e.target.value as FamilyGrade }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                    {FAMILY_GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                </Field>
                <Field label="Address"><input type="text" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                <div className="sm:col-span-2">
                  <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm resize-none" /></Field>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#1e293b]">Family Members</h3>
                  <button type="button" onClick={() => setMembers((prev) => [...prev, emptyMember()])} className="text-sm text-[#00c853] font-semibold cursor-pointer">
                    + Add Member
                  </button>
                </div>

                {members.map((member, index) => (
                  <div key={member.localId} className="border border-[#e2e8f0] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1e293b]">Member {index + 1}</p>
                      <button type="button" onClick={() => setMembers((prev) => prev.filter((item) => item.localId !== member.localId))} className="text-red-500 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="Name"><input type="text" value={member.name} onChange={(e) => setMembers((prev) => prev.map((item) => item.localId === member.localId ? { ...item, name: e.target.value } : item))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                      <Field label="Relation"><input type="text" value={member.relation} onChange={(e) => setMembers((prev) => prev.map((item) => item.localId === member.localId ? { ...item, relation: e.target.value } : item))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                      <Field label="Age"><input type="number" min="0" value={member.age ?? ""} onChange={(e) => setMembers((prev) => prev.map((item) => item.localId === member.localId ? { ...item, age: e.target.value ? Number(e.target.value) : null } : item))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                      <Field label="Phone"><input type="tel" value={member.phone_no || ""} onChange={(e) => setMembers((prev) => prev.map((item) => item.localId === member.localId ? { ...item, phone_no: e.target.value } : item))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                      <Field label="Status">
                        <select value={member.status} onChange={(e) => setMembers((prev) => prev.map((item) => item.localId === member.localId ? { ...item, status: e.target.value as EditableMember["status"] } : item))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm">
                          {FAMILY_MEMBER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </Field>
                      <Field label="Class / Work Details"><input type="text" value={member.class_or_work_details || ""} onChange={(e) => setMembers((prev) => prev.map((item) => item.localId === member.localId ? { ...item, class_or_work_details: e.target.value } : item))} className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" /></Field>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer">
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Family"}
                </button>
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

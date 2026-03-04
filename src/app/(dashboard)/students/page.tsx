"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { logActivity } from "@/lib/activity-logger";
import ConfirmDialog from "@/components/confirm-dialog";
import { Plus, Search, Edit2, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Student } from "@/lib/types";

export default function StudentsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    const { data } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });
    setStudents(data || []);
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("students").delete().eq("id", deleteTarget.id);
    if (error) {
      showError("Failed to delete student: " + error.message);
    } else {
      await logActivity("students", `Deleted student: ${deleteTarget.name}`, "student", deleteTarget.id);
      success(`${deleteTarget.name} has been removed.`);
      loadStudents();
    }
    setDeleteTarget(null);
    setDeleting(false);
  }

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.parent_name || "").toLowerCase().includes(search.toLowerCase());
    const matchClass = !classFilter || s.class === classFilter;
    return matchSearch && matchClass;
  });

  const classes = Array.from(new Set(students.map((s) => s.class).filter(Boolean)));
  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-[#1e293b]">Students</h1>
        <Link
          href="/students/new"
          className="bg-[#00c853] hover:bg-[#00a844] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition w-fit"
        >
          <Plus className="w-4 h-4" /> Add Student
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by student or parent name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 focus:border-[#00c853]"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#00c853]/20 min-w-[160px]"
        >
          <option value="">Filter by Class</option>
          {classes.map((c) => (
            <option key={c} value={c!}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-[#94a3b8]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[#94a3b8]">
            {students.length === 0 ? "No students yet. Add your first student!" : "No students match your search."}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Name</th>
                <th className="text-left px-4 py-4 font-medium">Class</th>
                <th className="text-left px-4 py-4 font-medium">Parent Name</th>
                <th className="text-left px-4 py-4 font-medium">Phone</th>
                <th className="text-left px-4 py-4 font-medium">Status</th>
                <th className="text-left px-4 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#e8faf0] text-[#00c853] font-semibold text-sm flex items-center justify-center">
                        {getInitial(student.name)}
                      </div>
                      <p className="text-sm font-semibold text-[#1e293b]">{student.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{student.class || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{student.parent_name || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{student.parent_phone || "—"}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      student.is_active
                        ? "bg-[#e8faf0] text-[#00c853]"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {student.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link href={`/students/${student.id}`} className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] transition">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link href={`/students/${student.id}/edit`} className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] transition">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => setDeleteTarget(student)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748b] hover:text-red-500 transition cursor-pointer">
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
        title="Delete Student"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

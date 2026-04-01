"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Family } from "@/lib/types";

export default function FamilyDetailPage() {
  const supabase = createClient();
  const { id } = useParams<{ id: string }>();
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFamily = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("families").select("*, family_members(*)").eq("id", id).single();
    setFamily((data || null) as Family | null);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    async function run() {
      await loadFamily();
    }

    void run();
  }, [loadFamily]);

  if (loading) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Loading family...</div>;
  }

  if (!family) {
    return <div className="p-4 sm:p-8 text-[#94a3b8]">Family not found.</div>;
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="text-sm text-[#64748b]">
        <Link href="/families" className="text-[#00c853] hover:underline">Families</Link>
        <span className="mx-2">›</span>
        <span className="text-[#1e293b]">{family.head_name}</span>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
        <h1 className="text-2xl font-bold text-[#1e293b]">{family.head_name}</h1>
        <p className="text-sm text-[#64748b] mt-2">
          Grade {family.financial_grade} • Phone {family.phone_no || "—"} • WhatsApp {family.whatsapp_no || "—"} • Job {family.job || "—"}
        </p>
        {family.address ? <p className="text-sm text-[#334155] mt-4">Address: {family.address}</p> : null}
        {family.notes ? <p className="text-sm text-[#334155] mt-2">Notes: {family.notes}</p> : null}
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        <div className="p-5 border-b border-[#f1f5f9]">
          <h2 className="text-lg font-bold text-[#1e293b]">Family Members</h2>
        </div>
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
              <th className="text-left px-6 py-4 font-medium">Name</th>
              <th className="text-left px-4 py-4 font-medium">Relation</th>
              <th className="text-left px-4 py-4 font-medium">Age</th>
              <th className="text-left px-4 py-4 font-medium">Phone</th>
              <th className="text-left px-4 py-4 font-medium">Status</th>
              <th className="text-left px-6 py-4 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {(family.family_members || []).map((member) => (
              <tr key={member.id} className="border-b border-[#f1f5f9]">
                <td className="px-6 py-4 text-sm font-medium text-[#1e293b]">{member.name}</td>
                <td className="px-4 py-4 text-sm">{member.relation}</td>
                <td className="px-4 py-4 text-sm">{member.age ?? "—"}</td>
                <td className="px-4 py-4 text-sm">{member.phone_no || "—"}</td>
                <td className="px-4 py-4 text-sm capitalize">{member.status}</td>
                <td className="px-6 py-4 text-sm">{member.class_or_work_details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

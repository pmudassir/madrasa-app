"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter, Info } from "lucide-react";

const categoryColors: Record<string, string> = {
  students: "bg-[#e8faf0] text-[#00c853]",
  teachers: "bg-blue-100 text-blue-600",
  financial: "bg-amber-100 text-amber-700",
  events: "bg-purple-100 text-purple-600",
  settings: "bg-gray-100 text-gray-600",
  system: "bg-slate-100 text-slate-600",
};

export default function ActivityLogPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => { loadLogs(); }, [page, dateFrom, dateTo]);

  async function loadLogs() {
    let query = supabase.from("activity_log").select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

    const { data, count } = await query;
    setLogs(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  const filtered = logs.filter(l =>
    !search || l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.user_name.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-IN", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-[#1e293b] mb-1">Activity Log</h1>
      <p className="text-[#64748b] text-sm mb-6">Track all system actions and administrative changes across the platform.</p>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input type="text" placeholder="Search actions, users, or descriptions..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/20" />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="px-3 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
          <span className="text-[#94a3b8] text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="px-3 py-2.5 border border-[#e2e8f0] rounded-xl text-sm" />
        </div>
        <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
          className="flex items-center gap-1.5 bg-[#1e293b] text-white font-semibold px-4 py-2.5 rounded-xl text-sm cursor-pointer">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
        {loading ? <div className="p-8 text-center text-[#94a3b8]">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-[#94a3b8]">No activity logs found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[#94a3b8] uppercase tracking-wider border-b border-[#f1f5f9]">
                <th className="text-left px-6 py-4 font-medium">Date & Time</th>
                <th className="text-left px-4 py-4 font-medium">User</th>
                <th className="text-left px-4 py-4 font-medium">Category</th>
                <th className="text-left px-4 py-4 font-medium">Description</th>
                <th className="text-right px-6 py-4 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b border-[#f1f5f9]">
                  <td className="px-6 py-4 text-sm text-[#1e293b]">{fmtDateTime(log.created_at)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#e8faf0] text-[#00c853] text-[10px] font-bold flex items-center justify-center">
                        {log.user_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[#1e293b]">{log.user_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${categoryColors[log.category] || "bg-gray-100 text-gray-600"}`}>
                      {log.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{log.description}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[#94a3b8] hover:text-[#00c853] cursor-pointer"><Info className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#00c853]">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} actions
          </p>
          <div className="flex items-center gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-sm disabled:opacity-40 cursor-pointer">‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`px-3 py-1.5 rounded-lg text-sm ${page === i ? "bg-[#00c853] text-white" : "border border-[#e2e8f0]"} cursor-pointer`}>{i + 1}</button>
            ))}
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-sm disabled:opacity-40 cursor-pointer">›</button>
          </div>
        </div>
      )}
    </div>
  );
}

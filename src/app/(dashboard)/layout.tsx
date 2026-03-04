import Sidebar from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-[240px] min-h-screen bg-[#f8fafc] pt-[60px] lg:pt-0">
        {children}
      </main>
    </div>
  );
}

import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex min-h-0 overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="crm-main min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-5 md:px-8 md:py-7 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
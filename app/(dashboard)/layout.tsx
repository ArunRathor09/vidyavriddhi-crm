import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="crm-main flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
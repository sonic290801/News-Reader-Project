import { SidebarNavLinks, BottomNavLinks } from "@/components/nav/NavLinks";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-16 hover:w-48 transition-all duration-200
                      bg-slate-900 border-r border-slate-800 shrink-0 overflow-hidden group fixed top-0 bottom-0 z-40">
        <div className="flex flex-col gap-1 p-2 mt-6">
          <SidebarNavLinks />
        </div>
      </nav>

      {/* Spacer for fixed sidebar */}
      <div className="hidden md:block w-16 shrink-0" />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 min-h-screen">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800
                      flex items-center justify-around h-16 z-50">
        <BottomNavLinks />
      </nav>
    </div>
  );
}

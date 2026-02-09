"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, MessageSquare, HardDrive, Plus, FileText, FolderPlus, BrainCircuit, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, loadingMessage, toast, hideToast, initialize } = useAppStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    initialize(); // Load settings from Preferences
    import('@capacitor/core').then(c => {
      setIsMobile(c.Capacitor.isNativePlatform());
    });
  }, []);
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const navItems = [
    { name: 'Drive', href: '/drive', icon: HardDrive },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
  ];

  const createNewDoc = async () => {
    // Create a temporary file or just navigate to a new doc route
    const id = Date.now().toString();
    const filename = `Untitled-${id}.md`;
    router.push(`/editor?path=${encodeURIComponent(filename)}`);
    setNewMenuOpen(false);
    setSidebarOpen(false);
  };

  const createNewFolder = async () => {
    // Logic to trigger modal in Drive... 
    // For now let's just alert or rely on Drive page logic
    // A better way: Global store trigger? 
    // Simplicity: Redirect to drive and focus input?
    router.push('/drive?action=new_folder');
    setNewMenuOpen(false);
    setSidebarOpen(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-dvh bg-zinc-950 text-zinc-200 font-sans overflow-hidden">
      {/* Mobile Header */}
      {!pathname?.startsWith('/chat') && (
        <div className="md:hidden flex-none bg-zinc-950 border-b border-zinc-900 flex items-center px-4 z-50 justify-between pt-[var(--safe-top)] h-[calc(4rem+var(--safe-top))]">
          <div className="flex items-center gap-2 font-semibold text-white">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 hover:bg-zinc-800 rounded-lg">
              <Menu className="w-5 h-5 text-zinc-400" />
            </button>
            <span className="tracking-tight">Think</span>
          </div>
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 w-64 bg-zinc-950 border-r border-zinc-900 transform transition-transform duration-200 z-50 md:relative md:translate-x-0 flex flex-col shadow-2xl md:shadow-none pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* ... sidebar content ... */}
        <div className="p-4 h-16 flex items-center border-b border-zinc-900/50 justify-between">
          <div className="flex items-center gap-3 font-semibold text-xl tracking-tight text-white">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            Think
          </div>
          {/* Close button for mobile inside sidebar */}
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-zinc-500 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative mb-6">
            <button
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              data-testid="nav-new-button"
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-4 py-3 rounded-xl font-medium shadow-sm transition active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>New</span>
            </button>

            <AnimatePresence>
              {newMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 p-1"
                >
                  <button
                    onClick={createNewDoc}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    New Document
                  </button>
                  <button
                    onClick={createNewFolder}
                    data-testid="nav-new-folder"
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition"
                  >
                    <FolderPlus className="w-4 h-4 text-yellow-400" />
                    New Folder
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`nav-${item.name.toLowerCase()}-link`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition duration-200",
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-blue-500" : "text-zinc-500")} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Storage Bar Removed */}
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}

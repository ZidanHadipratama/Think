"use client"

import { useEffect, useState, useRef } from "react";
import { Folder, FileText, MoreVertical, Grid, List as ListIcon, Search, ChevronRight, Loader2, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface DriveItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
}

export default function DrivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newItemName, setNewItemName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Check for actions
  useEffect(() => {
    if (searchParams.get('action') === 'new_folder') {
      setIsCreatingFolder(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/drive?path=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      if (data.items) {
        const sorted = data.items.sort((a: DriveItem, b: DriveItem) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'folder' ? -1 : 1;
        });
        setItems(sorted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const openItem = (item: DriveItem) => {
    if (item.type === 'folder') {
      setCurrentPath(item.path);
    } else {
      router.push(`/doc/${item.path}`);
    }
  }

  const navigateUp = (index: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  }

  async function createFolder() {
    if (!newItemName) return;
    await fetch('/api/drive', {
      method: 'POST',
      body: JSON.stringify({ folderPath: `${currentPath ? currentPath + '/' : ''}${newItemName}` })
    });
    setNewItemName("");
    setIsCreatingFolder(false);
    fetchItems();
    router.replace('/drive'); // Clear param
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Toolbar */}
      <div className="h-16 border-b border-zinc-900 flex items-center px-6 justify-between shrink-0 bg-zinc-950/50 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center text-sm text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800/50">
            <button
              onClick={() => setCurrentPath("")}
              className={cn("hover:text-zinc-200 transition", !currentPath && "text-zinc-200 font-medium")}
            >
              Drive
            </button>
            {breadcrumbs.map((part, i) => (
              <div key={i} className="flex items-center">
                <ChevronRight className="w-4 h-4 mx-1 opacity-50" />
                <button
                  onClick={() => navigateUp(i)}
                  className="hover:text-zinc-200 transition font-medium text-zinc-200"
                >
                  {part}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded transition", viewMode === 'list' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded transition", viewMode === 'grid' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6" onClick={() => setIsCreatingFolder(false)}>
        {isCreatingFolder && (
          <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl max-w-md animate-in fade-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
            <label className="text-xs font-medium text-zinc-500 mb-2 block">New Folder Name</label>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                placeholder="Untitled Folder"
                onKeyDown={e => e.key === 'Enter' && createFolder()}
              />
              <button onClick={createFolder} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition">Create</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading files...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-2xl">
            <Folder className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">This folder is empty</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            viewMode === 'grid'
              ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              : "grid-cols-1"
          )}>
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={item.path}
                  onDoubleClick={(e) => { e.stopPropagation(); openItem(item); }}
                  onClick={(e) => { e.stopPropagation(); openItem(item); }}
                  className={cn(
                    "group relative border border-transparent hover:border-zinc-800 rounded-2xl transition-all cursor-pointer",
                    viewMode === 'grid'
                      ? "flex flex-col aspect-[1/1] p-4 items-center justify-between bg-zinc-900/20 hover:bg-zinc-900 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1"
                      : "flex items-center p-3 gap-4 bg-zinc-900/10 hover:bg-zinc-900 group"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center rounded-2xl transition-colors duration-300",
                    viewMode === 'grid' ? "w-16 h-16 mb-2" : "w-10 h-10"
                  )}>
                    {item.type === 'folder' ? (
                      <Folder className={cn(
                        "text-yellow-500/80 fill-yellow-500/20",
                        viewMode === 'grid' ? "w-full h-full" : "w-6 h-6",
                      )} strokeWidth={1.5} />
                    ) : (
                      <FileText className={cn(
                        "text-blue-500/80 fill-blue-500/20",
                        viewMode === 'grid' ? "w-full h-full" : "w-6 h-6",
                      )} strokeWidth={1.5} />
                    )}
                  </div>

                  <div className={cn("min-w-0 flex-1", viewMode === 'grid' ? "w-full text-center" : "")}>
                    <div className="truncate text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                      {item.name}
                    </div>
                    <div className="text-xs text-zinc-600 mt-1">
                      {item.type === 'folder' ? 'Folder' : 'Markdown'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

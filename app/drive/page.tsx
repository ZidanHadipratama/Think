"use client"

import { Suspense, useEffect, useState, useRef } from "react";
import { Folder, FileText, MoreVertical, Grid, List as ListIcon, Search, ChevronRight, Loader2, ArrowUp, Copy, Trash2, Edit2, MessageSquare, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import * as ContextMenu from '@radix-ui/react-context-menu';

interface DriveItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
}

function DriveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lastVisitedPath, setLastVisitedPath, setIsLoading, showToast, toggleContextFile } = useAppStore();

  // Initialize with last visited path (relative to drive root)
  const initializePath = () => {
    if (!lastVisitedPath) return "";
    let p = lastVisitedPath;
    if (p.startsWith("/drive")) p = p.substring(6);
    if (p.startsWith("/")) p = p.substring(1);
    return p;
  };
  const [currentPath, setCurrentPath] = useState(initializePath());
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newItemName, setNewItemName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [activeItem, setActiveItem] = useState<DriveItem | null>(null);

  // Rename State
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Check for actions
  useEffect(() => {
    if (searchParams.get('action') === 'new_folder') {
      setIsCreatingFolder(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  // Sync to store
  useEffect(() => {
    setLastVisitedPath(currentPath);
  }, [currentPath, setLastVisitedPath]);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/drive?path=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      if (data.items) {
        // Re-enable sorting but stick to simple name sort for stability
        const sorted = data.items.sort((a: DriveItem, b: DriveItem) => {
          // Folders first
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setItems(sorted);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error("Error fetching drive items:", e);
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
    setIsLoading(true, "Creating folder...");
    try {
      await fetch('/api/drive', {
        method: 'POST',
        body: JSON.stringify({ folderPath: `${currentPath ? currentPath + '/' : ''}${newItemName}` })
      });
      setNewItemName("");
      setIsCreatingFolder(false);
      await fetchItems();
      showToast({ title: "Folder created", type: 'success' });
      router.replace('/drive');
    } catch {
      showToast({ title: "Failed to create folder", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  // --- Action Handlers ---

  const handleDuplicate = async (item: DriveItem) => {
    setIsLoading(true, "Duplicating...");
    try {
      // Read file content first (if file)
      if (item.type === 'folder') {
        showToast({ title: "Duplicating folders not supported yet", type: 'info' });
        return;
      }

      const res = await fetch(`/api/file?path=${encodeURIComponent(item.path)}`);
      const data = await res.json();

      const dir = item.path.split('/').slice(0, -1).join('/');
      const newName = `Copy of ${item.name}`;
      const newPath = dir ? `${dir}/${newName}` : newName;

      await fetch('/api/file', {
        method: 'POST',
        body: JSON.stringify({ filePath: newPath, content: data.content })
      });

      await fetchItems();
      showToast({ title: "File duplicated", type: 'success' });
    } catch (e) {
      showToast({ title: "Failed to duplicate", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (item: DriveItem) => {
    // Confirm? For now direct
    setIsLoading(true, "Deleting...");
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(item.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchItems();
        showToast({ title: "Item deleted", type: 'success' });
      } else {
        throw new Error("Failed");
      }
    } catch {
      showToast({ title: "Failed to delete", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenamePrepare = (item: DriveItem) => {
    setActiveItem(item);
    setRenameValue(item.name);
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = async () => {
    if (!activeItem || renameValue === activeItem.name) {
      setRenameDialogOpen(false);
      return;
    }
    setIsLoading(true, "Renaming...");
    try {
      const dir = activeItem.path.split('/').slice(0, -1).join('/');
      const newPath = dir ? `${dir}/${renameValue}` : renameValue;

      await fetch('/api/file', {
        method: 'PATCH',
        body: JSON.stringify({ oldPath: activeItem.path, newPath })
      });
      setRenameDialogOpen(false);
      await fetchItems();
      showToast({ title: "Renamed successfully", type: 'success' });
    } catch {
      showToast({ title: "Failed to rename", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToContext = (item: DriveItem) => {
    if (item.type === 'folder') return;
    toggleContextFile(item);
    showToast({ title: "Added to Chat Context", description: item.name, type: 'success' });
    // Optional: Redirect? User said "context for chat", maybe just adding is enough or ask.
    // Plan said: "Click Chat -> Redirect".
    router.push('/chat');
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">

      {/* Rename Dialog Overlay */}
      <AnimatePresence>
        {renameDialogOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4 text-zinc-200">Rename</h3>
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 mb-4 focus:border-blue-500 outline-none"
                onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setRenameDialogOpen(false)} className="px-3 py-1.5 text-zinc-400 hover:text-white">Cancel</button>
                <button onClick={handleRenameSubmit} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500">Save</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

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
                data-testid="new-folder-input"
                onKeyDown={e => e.key === 'Enter' && createFolder()}
              />
              <button onClick={createFolder} data-testid="create-folder-confirm" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition">Create</button>
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
                <ContextMenu.Root key={item.path}>
                  <ContextMenu.Trigger asChild>
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onDoubleClick={(e) => { e.stopPropagation(); openItem(item); }}
                      onClick={(e) => { e.stopPropagation(); openItem(item); }}
                      data-testid="drive-item"
                      className={cn(
                        "group relative border border-transparent hover:border-zinc-800 rounded-2xl transition-all cursor-pointer select-none",
                        viewMode === 'grid'
                          ? "flex flex-col aspect-[1/1] p-4 items-center justify-between bg-zinc-900/20 hover:bg-zinc-900 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1"
                          : "flex items-center p-3 gap-4 bg-zinc-900/10 hover:bg-zinc-900 group"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center rounded-2xl transition-colors duration-300 pointer-events-none",
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

                      <div className={cn("min-w-0 flex-1 pointer-events-none", viewMode === 'grid' ? "w-full text-center" : "")}>
                        <div className="truncate text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                          {item.name}
                        </div>
                        <div className="text-xs text-zinc-600 mt-1">
                          {item.type === 'folder' ? 'Folder' : 'Markdown'}
                        </div>
                      </div>
                    </motion.div>
                  </ContextMenu.Trigger>

                  <ContextMenu.Portal>
                    <ContextMenu.Content className="w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                      <ContextMenu.Label className="text-xs text-zinc-500 px-2 py-1.5 font-medium">
                        {item.name}
                      </ContextMenu.Label>

                      {item.type === 'file' && (
                        <ContextMenu.Item onSelect={() => handleAddToContext(item)} className="flex items-center gap-2 px-2 py-1.5 text-sm text-blue-400 hover:bg-blue-500/10 rounded-lg cursor-pointer outline-none mb-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>Chat with this file</span>
                        </ContextMenu.Item>
                      )}

                      <ContextMenu.Item onSelect={() => handleDuplicate(item)} className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg cursor-pointer outline-none">
                        <Copy className="w-4 h-4" />
                        <span>Duplicate</span>
                      </ContextMenu.Item>

                      <ContextMenu.Item onSelect={() => handleRenamePrepare(item)} className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg cursor-pointer outline-none">
                        <Edit2 className="w-4 h-4" />
                        <span>Rename</span>
                      </ContextMenu.Item>

                      <ContextMenu.Separator className="h-px bg-zinc-800 my-1" />

                      <ContextMenu.Item onSelect={() => handleDelete(item)} className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer outline-none">
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DrivePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Drive...</div>}>
      <DriveContent />
    </Suspense>
  );
}

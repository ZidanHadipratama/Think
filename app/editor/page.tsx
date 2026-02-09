"use client"

// Dynamically import BlockNote to avoid SSR issues
import dynamic from "next/dynamic";
import { useEffect, useState, use, Suspense, useRef } from "react";
import { Loader2, ArrowLeft, MoreHorizontal, MessageSquare, Clock, Star, FileText, Copy, FileDown, MessageCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import * as Popover from "@radix-ui/react-popover";

export const dynamicParams = false;

// We import the editor component from the previous location (or move it later)
// For now, assuming app/doc/[...path]/editor.tsx is accessible or we duplicate/move it.
// I'll import it relatively. Note: imports must be correct.
// Since we are in app/editor/page.tsx, and old one was app/doc/[...path]/editor.tsx
// It's cleaner to move editor.tsx to components/editor.tsx or similar.
// But for this step I will reference the existing one if possible, or create a local wrapper.
// Let's rely on moving editor.tsx to app/editor/editor.tsx for cleanliness.

const Editor = dynamic(() => import("./editor"), { ssr: false });

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPath = searchParams.get('path');
  
  // Handle case where path is null (shouldn't happen via links but can manually)
  const path = rawPath || "";
  
  // Extract filename from path
  const filename = path.split('/').pop()?.replace('.md', '') || "Untitled";

  // Store for navigation and context
  const { toggleContextFile } = useAppStore();

  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(filename);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Ref to track latest content for save-on-exit
  const contentRef = useRef<string>("");

  useEffect(() => {
    import('@capacitor/core').then(c => {
        setIsMobile(c.Capacitor.isNativePlatform());
    });
  }, []);

  useEffect(() => {
    if (!path) {
        setLoading(false);
        return;
    }

    async function loadFile() {
        try {
            let content = "";
            if (isMobile) {
                const { mobileFilesystem } = await import('@/lib/mobile/filesystem');
                content = await mobileFilesystem.readFile(path);
            } else {
                const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
                const data = await res.json();
                content = data.content !== undefined ? data.content : "";
            }
            setInitialContent(content);
            contentRef.current = content; // Init ref
        } catch (e) {
            console.error(e);
            setInitialContent(""); 
            contentRef.current = "";
        } finally {
            setLoading(false);
        }
    }

    loadFile();
  }, [path, isMobile]);

  // Update title when path changes (if navigated)
  useEffect(() => {
    setTitle(filename);
  }, [filename]);

  const handleRename = async () => {
    if (title === filename) return;
    try {
      const directory = path.split('/').slice(0, -1).join('/');
      const newPath = directory ? `${directory}/${title}.md` : `${title}.md`;

      if (isMobile) {
          const { mobileFilesystem } = await import('@/lib/mobile/filesystem');
          // Rename logic manually: Read, Write New, Delete Old
          const content = contentRef.current; 
          await mobileFilesystem.writeFile(newPath, content);
          await mobileFilesystem.deleteFile(path);
          router.replace(`/editor?path=${encodeURIComponent(newPath)}`);
      } else {
          const res = await fetch('/api/file', {
            method: 'PATCH',
            body: JSON.stringify({ oldPath: path, newPath })
          });
          if (res.ok) {
            router.replace(`/editor?path=${encodeURIComponent(newPath)}`);
          } else {
            console.error("Rename failed");
            setTitle(filename);
          }
      }
    } catch (e) {
      console.error(e);
      setTitle(filename);
    }
  };

  const handleSave = async (markdown: string) => {
    setSaving(true);
    contentRef.current = markdown; // Update ref
    // Update local state so rename has latest
    setInitialContent(markdown);
    try {
      if (isMobile) {
          const { mobileFilesystem } = await import('@/lib/mobile/filesystem');
          await mobileFilesystem.writeFile(path, markdown);
      } else {
          await fetch('/api/file', {
            method: 'POST',
            body: JSON.stringify({ filePath: path, content: markdown })
          });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Action Menu Handlers
  const handleBack = async () => {
    // Force save before exit
    if (isMobile && contentRef.current) {
       try {
          const { mobileFilesystem } = await import('@/lib/mobile/filesystem');
          await mobileFilesystem.writeFile(path, contentRef.current);
       } catch (e) { console.error("Exit save failed", e); }
    }
    router.push('/drive');
  };

  const handleCopy = async () => {
    if (initialContent === null) return;

    const directory = path.split('/').slice(0, -1).join('/');
    const newName = `Copy of ${filename}`;
    const newPath = directory ? `${directory}/${newName}.md` : `${newName}.md`;

    if (isMobile) {
        const { mobileFilesystem } = await import('@/lib/mobile/filesystem');
        await mobileFilesystem.writeFile(newPath, initialContent);
        router.push(`/editor?path=${encodeURIComponent(newPath)}`);
    } else {
        await fetch('/api/file', {
            method: 'POST',
            body: JSON.stringify({ filePath: newPath, content: initialContent })
        });
        router.push(`/editor?path=${encodeURIComponent(newPath)}`);
    }
  };

  const handleChatWithFile = () => {
    const item = { name: filename, path: path, type: 'file' as const };
    toggleContextFile(item);
    router.push('/chat');
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-zinc-500"><Loader2 className="animate-spin w-6 h-6" /></div>
  }

  if (!path) {
      return <div className="flex h-full items-center justify-center text-zinc-500">No document selected</div>
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 print:bg-white print:text-black">
      {/* Notion-style Transparent Header - Hidden in Print */}
      <div className="h-12 flex items-center px-3 justify-between sticky top-0 bg-zinc-950 z-20 transition-all duration-200 print:hidden">
        <div className="flex items-center gap-1 text-sm text-zinc-500">
          <button onClick={handleBack} data-testid="doc-back-button" className="p-1 hover:bg-zinc-800 rounded transition text-zinc-400">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 px-2 py-1 hover:bg-zinc-800 rounded cursor-pointer transition">
            <span className="truncate max-w-[150px]">{filename}</span>
          </div>
          {saving && <span className="text-xs text-zinc-600 animate-pulse ml-2">Saving...</span>}
        </div>

        <div className="flex items-center gap-1 text-zinc-400">
          <button className="p-1 hover:bg-zinc-800 rounded transition text-sm">Edited just now</button>

          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger asChild>
              <button className="p-1 hover:bg-zinc-800 rounded transition"><MoreHorizontal className="w-4 h-4" /></button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200" sideOffset={5}>
                <button onClick={handleCopy} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2">
                  <Copy className="w-4 h-4" /> Make a copy
                </button>
                <button onClick={() => window.print()} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2">
                  <FileDown className="w-4 h-4" /> Export PDF
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button onClick={handleChatWithFile} className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Chat with this file
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto pb-32 print:pb-0">
          <div className="px-12 pt-12 print:px-0 print:pt-0">
            {/* Icon & Title Area */}
            <div className="group mb-8 print:mb-4">
              <div className="w-20 h-20 -ml-1 flex items-center justify-center text-5xl hover:bg-zinc-800 rounded-lg cursor-pointer transition select-none print:hidden">
                📄
              </div>
              <input
                className="w-full text-5xl font-bold bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-600 mt-4 leading-tight print:text-black"
                placeholder="Untitled"
                data-testid="doc-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleRename}
              />
            </div>

            <div className="mt-4" data-testid="doc-editor">
              <Editor
                initialContent={initialContent || ""}
                onChange={handleSave}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
    return (
        <Suspense fallback={<div className="flex h-full items-center justify-center text-zinc-500">Loading Editor...</div>}>
            <EditorContent />
        </Suspense>
    )
}

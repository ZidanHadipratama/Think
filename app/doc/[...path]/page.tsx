"use client"

// Dynamically import BlockNote to avoid SSR issues
import dynamic from "next/dynamic";
import { useEffect, useState, use } from "react";
import { Loader2, ArrowLeft, MoreHorizontal, MessageSquare, Clock, Star, FileText, Copy, FileDown, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import * as Popover from "@radix-ui/react-popover";

const Editor = dynamic(() => import("./editor"), { ssr: false });

export default function DocPage({ params }: { params: Promise<{ path: string[] }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const path = resolvedParams.path.map(decodeURIComponent).join('/');
  // Extract filename from path
  const filename = path.split('/').pop()?.replace('.md', '') || "Untitled";

  // Store for navigation and context
  const { lastVisitedPath, toggleContextFile } = useAppStore();

  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(filename);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Load content
    fetch(`/api/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.content !== undefined) {
          setInitialContent(data.content);
        } else {
          setInitialContent(""); // Empty file
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        // If file not found, assume new empty file
        setInitialContent("");
        setLoading(false);
      });
  }, [path]);

  const handleRename = async () => {
    if (title === filename) return;
    try {
      const directory = path.split('/').slice(0, -1).join('/');
      const newPath = directory ? `${directory}/${title}.md` : `${title}.md`;

      const res = await fetch('/api/file', {
        method: 'PATCH',
        body: JSON.stringify({ oldPath: path, newPath })
      });

      if (res.ok) {
        // successful rename
        // Redirect to new path
        router.replace(`/doc/${newPath}`);
      } else {
        console.error("Rename failed");
        setTitle(filename); // Revert on failure
      }
    } catch (e) {
      console.error(e);
      setTitle(filename);
    }
  };

  const handleSave = async (markdown: string) => {
    setSaving(true);
    try {
      await fetch('/api/file', {
        method: 'POST',
        body: JSON.stringify({ filePath: path, content: markdown })
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Action Menu Handlers
  const handleBack = () => {
    // Navigate back to the last visited folder in Drive
    // Construct URL: /drive (root) or /api/drive does listing, but page is /drive/folder?
    // Our DrivePage handles 'currentPath' state internally unless we pass param?
    // Wait, DrivePage in previous step initialized 'currentPath' from 'lastVisitedPath'.
    // So simply navigating to /drive should work!
    router.push('/drive');
  };

  const handleCopy = async () => {
    // Create a copy logic
    // Simplest: Read current content, Write to "Copy of..."
    if (initialContent === null) return;

    const directory = path.split('/').slice(0, -1).join('/');
    const newName = `Copy of ${filename}`;
    const newPath = directory ? `${directory}/${newName}.md` : `${newName}.md`;

    await fetch('/api/file', {
      method: 'POST',
      body: JSON.stringify({ filePath: newPath, content: initialContent }) // Use initialContent or get current editor state? Initial is safer for now.
    });
    router.push(`/doc/${newPath}`);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleChatWithFile = () => {
    // Add to context and go to chat
    // Need to construct a FileItem/DriveItem object
    // We know path and name.
    const item = { name: filename, path: path, type: 'file' as const };
    toggleContextFile(item);
    router.push('/chat');
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-zinc-500"><Loader2 className="animate-spin w-6 h-6" /></div>
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
                <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2">
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
              {/* Print-only icon alternative if needed, or just skip */}

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

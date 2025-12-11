"use client"

// Dynamically import BlockNote to avoid SSR issues
import dynamic from "next/dynamic";
import { useEffect, useState, use } from "react";
import { Loader2, ArrowLeft, MoreHorizontal, MessageSquare, Clock, Star, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const Editor = dynamic(() => import("./editor"), { ssr: false });

export default function DocPage({ params }: { params: Promise<{ path: string[] }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const path = resolvedParams.path.map(decodeURIComponent).join('/');
  // Extract filename from path
  const filename = path.split('/').pop()?.replace('.md', '') || "Untitled";

  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(filename);

  useEffect(() => {
    // Load content
    fetch(`/api/file?path=${encodeURIComponent(path)}`)
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

  if (loading) {
    return <div className="flex h-full items-center justify-center text-zinc-500"><Loader2 className="animate-spin w-6 h-6" /></div>
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200">
      {/* Notion-style Transparent Header */}
      <div className="h-12 flex items-center px-3 justify-between sticky top-0 bg-zinc-950 z-20 transition-all duration-200">
        <div className="flex items-center gap-1 text-sm text-zinc-500">
          <button onClick={() => router.back()} className="p-1 hover:bg-zinc-800 rounded transition text-zinc-400">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 px-2 py-1 hover:bg-zinc-800 rounded cursor-pointer transition">
            <span className="truncate max-w-[150px]">{filename}</span>
          </div>
          {saving && <span className="text-xs text-zinc-600 animate-pulse ml-2">Saving...</span>}
        </div>

        <div className="flex items-center gap-1 text-zinc-400">
          <button className="p-1 hover:bg-zinc-800 rounded transition text-sm">Edited just now</button>
          <button className="p-1 hover:bg-zinc-800 rounded transition"><Star className="w-4 h-4" /></button>
          <button className="p-1 hover:bg-zinc-800 rounded transition"><MoreHorizontal className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto pb-32">
          {/* Cover Image Placeholder */}
          <div className="group relative h-48 -mt-12 mb-8 hidden hover:block opacity-0 group-hover:opacity-100 transition">
            {/* We could add logic to actually add cover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-xs font-medium text-white pointer-events-none">
              Add Cover
            </div>
          </div>

          <div className="px-12 pt-12">
            {/* Icon & Title Area */}
            <div className="group mb-8">
              <div className="w-20 h-20 -ml-1 flex items-center justify-center text-5xl hover:bg-zinc-800 rounded-lg cursor-pointer transition select-none">
                📄
              </div>
              <input
                className="w-full text-5xl font-bold bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-600 mt-4 leading-tight"
                placeholder="Untitled"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleRename}
              />
            </div>

            <div className="mt-4">
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

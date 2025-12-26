"use client"

import { useState } from "react";
import { Copy, Edit2, ChevronLeft, ChevronRight, Check, X, Loader2, RefreshCw, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from "framer-motion";

export interface Message {
  id: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  type?: string;
  tool_name?: string;
  parent_id?: number | null;
  created_at?: number;
}

interface ChatMessageProps {
  message: Message;
  siblingCount: number;
  currentSiblingIndex: number; // 1-based
  onBranchSwitch: (direction: 'prev' | 'next') => void;
  onEdit: (newContent: string) => void;
  isLast: boolean;
  loading: boolean;
}

export function ChatMessage({
  message,
  siblingCount,
  currentSiblingIndex,
  onBranchSwitch,
  onEdit,
  isLast,
  loading
}: ChatMessageProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit(editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  // Skip rendering pure tool use/results
  if (message.role === 'tool' || message.type === 'tool_use') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative flex gap-4 p-4 rounded-xl transition-colors mb-2",
        message.role === 'user' ? "bg-zinc-900" : "hover:bg-zinc-900/30",
        isEditing ? "ring-1 ring-blue-500/50 bg-zinc-900/50" : ""
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-1",
        message.role === 'user' ? "bg-zinc-800" : "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-900/20"
      )}>
        {message.role === 'user' ? (
          <div className="w-4 h-4 bg-zinc-500 rounded-full" />
        ) : (
          <>
            {loading && isLast ? (
               <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
               <div className="w-4 h-4 rounded-full bg-white" />
            )}
          </>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {/* Author Name */}
        <div className="flex items-center gap-2 h-5">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            {message.role === 'user' ? 'You' : 'Think'}
          </span>
        </div>

        {/* Content Area */}
        <div className="text-base leading-relaxed text-zinc-300">
          {isEditing ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-200 outline-none focus:border-blue-500/50 resize-y min-h-[100px] font-mono text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Save & Branch
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className="prose prose-invert prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={cn("bg-zinc-800 px-1 py-0.5 rounded text-sm text-zinc-200", className)} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions (Always visible or low opacity) */}
        {!isEditing && (
          <div className="flex items-center gap-4 mt-1 select-none">
             {/* Branch Navigation */}
             {siblingCount > 1 && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium">
                <button 
                  onClick={() => onBranchSwitch('prev')}
                  disabled={currentSiblingIndex <= 1}
                  className="hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition p-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="tabular-nums">{currentSiblingIndex}/{siblingCount}</span>
                <button 
                  onClick={() => onBranchSwitch('next')}
                  disabled={currentSiblingIndex >= siblingCount}
                  className="hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition p-1"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
               {message.role === 'user' && (
                <button
                  onClick={() => { setIsEditing(true); setEditContent(message.content); }}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 p-2 rounded-lg transition"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="sr-only">Edit</span>
                </button>
              )}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 p-2 rounded-lg transition"
                title="Copy"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                <span className="sr-only">Copy</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
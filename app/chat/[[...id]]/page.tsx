"use client"

import { useEffect, useState, useRef, use } from "react";
import { Send, Save, FilePlus, Loader2, MessageSquare, Plus, Check, PanelLeftClose, PanelLeftOpen, ArrowUp, FileText, ChevronDown, Monitor, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
}

export default function ChatPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id?.[0]; // Optional ID
  const router = useRouter();

  // Global State
  const { selectedFile, setSelectedFile } = useAppStore();

  // Local State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState("gemini-1.5-flash");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  // Close sidebar on mobile initially, responsive logic handled by CSS classes mostly but need state sync
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  // Fetch recent chats
  useEffect(() => {
    fetch('/api/chats_proxy')
      .then(res => res.json())
      .then(data => setChats(data.chats || []))
      .catch(err => console.error(err));
  }, [sessionId]);

  // Load Chat History if ID present
  useEffect(() => {
    if (sessionId) {
      setLoading(true);
      fetch(`/api/chats_proxy?id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages) setMessages(data.messages);
          setLoading(false);
        })
        .catch(e => setLoading(false));
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Context
      let contextData = null;
      if (selectedFile) {
        const res = await fetch(`/api/file?path=${encodeURIComponent(selectedFile.path)}`);
        const data = await res.json();
        if (data.content) {
          contextData = { filename: selectedFile.name, content: data.content };
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: [...messages, userMsg],
          context: contextData,
          model: model // Send selected model
        })
      });
      const data = await res.json();

      if (data.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);

        if (!sessionId && data.session_id) {
          router.push(`/chat/${data.session_id}`);
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error communicating with Thinking Engine." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-200 overflow-hidden font-sans relative">

      {/* Mobile Backdrop for Sidebar */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: -20 }}
            animate={{ width: 260, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -20 }}
            className="fixed md:relative inset-y-0 left-0 border-r border-zinc-900 bg-zinc-950 flex flex-col z-50 h-full shadow-2xl md:shadow-none"
          >
            <div className="p-4 h-16 flex items-center border-b border-zinc-900/50 justify-between shrink-0">
              <div className="flex items-center gap-2 font-semibold text-lg tracking-tight text-white">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <span>History</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen(false);
                }}
                className="md:hidden p-2 text-zinc-500 hover:text-white"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col min-h-0">
              <button
                onClick={() => { router.push('/chat'); if (window.innerWidth < 768) setSidebarOpen(false); }}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-4 py-3 rounded-xl font-medium shadow-sm transition active:scale-95 mb-6"
              >
                <Plus className="w-5 h-5" />
                <span>New Chat</span>
              </button>

              <div className="flex-1 overflow-y-auto space-y-1">
                {chats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => { router.push(`/chat/${chat.id}`); if (window.innerWidth < 768) setSidebarOpen(false); }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition duration-200 flex items-center gap-3",
                      sessionId === chat.id
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                    )}
                  >
                    <MessageSquare className={cn("w-4 h-4 flex-shrink-0", sessionId === chat.id ? "text-blue-500" : "text-zinc-600")} />
                    <span className="truncate">{chat.title || "Untitled Chat"}</span>
                  </button>
                ))}
                {chats.length === 0 && (
                  <div className="text-zinc-600 text-xs text-center p-4 mt-4">No history yet</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-zinc-950 h-full overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-zinc-900 flex items-center px-4 justify-between bg-zinc-950/80 backdrop-blur z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400">
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded-lg text-sm font-medium text-zinc-300 transition"
              >
                <span>{model === 'gemini-1.5-flash' ? 'Gemini Flash' : 'Gemini Pro'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>
              {modelMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setModelMenuOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                    <button
                      onClick={() => { setModel('gemini-1.5-flash'); setModelMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center justify-between"
                    >
                      <span className={model === 'gemini-1.5-flash' ? 'text-blue-400' : ''}>Gemini Flash</span>
                      {model === 'gemini-1.5-flash' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                    <button
                      onClick={() => { setModel('gemini-1.5-pro'); setModelMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center justify-between"
                    >
                      <span className={model === 'gemini-1.5-pro' ? 'text-purple-400' : ''}>Gemini Pro</span>
                      {model === 'gemini-1.5-pro' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {selectedFile && (
              <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 pl-2 pr-1 py-0.5 rounded-full border border-blue-500/20">
                <FileText className="w-3 h-3" />
                <span className="max-w-[100px] truncate">{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)} className="p-0.5 hover:bg-blue-500/20 rounded-full ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-60">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-zinc-800">
                <MessageSquare className="w-8 h-8 text-zinc-400" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-300 mb-2">What can I help with?</h2>
              <p className="max-w-md text-center text-sm">
                I can assist with writing, coding, or analyzing files from your Drive.
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto pb-4">
              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i}
                  className={cn(
                    "flex gap-4 p-4 rounded-xl",
                    msg.role === 'user' ? "bg-zinc-900" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-1",
                    msg.role === 'user' ? "bg-zinc-800" : "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-900/20"
                  )}>
                    {msg.role === 'user' ? (
                      <div className="w-4 h-4 bg-zinc-500 rounded-full" />
                    ) : (
                      <Loader2 className={cn("w-4 h-4 text-white", loading && i === messages.length - 1 && loading ? "animate-spin" : "opacity-0 absolute")} />
                    )}
                    {msg.role === 'assistant' && !(loading && i === messages.length - 1) && (
                      <div className="w-4 h-4 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 text-sm leading-relaxed whitespace-pre-wrap pt-2">
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4 p-4 rounded-xl"
                >
                  <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex-shrink-0 flex items-center justify-center mt-1">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="h-4 w-24 bg-zinc-900 rounded animate-pulse" />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 md:p-6 bg-zinc-950">
          <div className="max-w-3xl mx-auto relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg focus-within:ring-1 focus-within:ring-blue-600/50 transition">
            <textarea
              autoFocus
              className="w-full bg-transparent border-none outline-none text-zinc-200 px-4 py-4 pr-12 text-sm resize-none h-auto min-h-[56px] max-h-48 scrollbar-hide"
              placeholder="Ask anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="absolute bottom-3 right-3 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-zinc-600">
            Thinking can make mistakes. Check important information.
          </div>
        </div>
      </div>
    </div>
  );
}

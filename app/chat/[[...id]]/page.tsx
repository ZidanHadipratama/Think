"use client"

import { useEffect, useState, useRef, use, useMemo, useCallback } from "react";
import { Loader2, MessageSquare, Plus, PanelLeftClose, PanelLeftOpen, ArrowUp, FileText, ChevronDown, Monitor, X, Paperclip, Sparkles, HardDrive, Trash2, Edit } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, Message } from "@/components/chat/chat-message";

// --- Types ---

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
}

interface DriveItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
}

interface ContextMenu {
  chatId: string;
  x: number;
  y: number;
}

// --- Helper: Tree Logic ---

function buildTreeIndex(messages: Message[]) {
  const map: Record<number, Message> = {};
  const childrenMap: Record<number | string, number[]> = {}; // 'root' for top-level

  messages.forEach(m => {
    map[m.id] = m;
    const pid = m.parent_id ?? 'root';
    if (!childrenMap[pid]) childrenMap[pid] = [];
    childrenMap[pid].push(m.id);
  });

  return { map, childrenMap };
}

function getThreadFromHead(headId: number | null, messageMap: Record<number, Message>): Message[] {
  if (headId === null) return [];
  const thread: Message[] = [];
  let curr: number | null | undefined = headId;
  
  while (curr !== null && curr !== undefined && messageMap[curr]) {
    thread.unshift(messageMap[curr]);
    curr = messageMap[curr].parent_id;
  }
  return thread;
}

// Find the "latest" leaf node starting from a specific node (DFS to find most recently created descendant)
function findLatestLeaf(startNodeId: number, childrenMap: Record<number | string, number[]>, messageMap: Record<number, Message>): number {
  let currentId = startNodeId;
  while (true) {
    const children = childrenMap[currentId];
    if (!children || children.length === 0) {
      return currentId;
    }
    // Default strategy: Follow the last child (chronologically usually the newest branch)
    // We could optimize this by storing 'last_active_child' in DB, but for now 'last created' is a good heuristic
    currentId = children[children.length - 1];
  }
}

export default function ChatPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id?.[0];
  const router = useRouter();

  // Global State
  const { selectedContextFiles, setSelectedContextFiles, toggleContextFile } = useAppStore();

  // Tree State
  const [messageMap, setMessageMap] = useState<Record<number, Message>>({});
  const [childrenMap, setChildrenMap] = useState<Record<number | string, number[]>>({});
  const [headId, setHeadId] = useState<number | null>(null);

  // UI State
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState("gemini-1.5-flash");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'discuss' | 'write'>('discuss');

  // File Picker
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [filePickerPath, setFilePickerPath] = useState("");
  const [filePickerItems, setFilePickerItems] = useState<DriveItem[]>([]);
  const [filePickerLoading, setFilePickerLoading] = useState(false);
  
  // Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // Derived State
  const currentThread = useMemo(() => getThreadFromHead(headId, messageMap), [headId, messageMap]);
  const msgContainerRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Initial Sidebar Close on Mobile
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  // Global Context Menu Close
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Auto Scroll
  useEffect(() => {
    if (msgContainerRef.current) {
      msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight;
    }
  }, [currentThread.length, loading, headId]); // Scroll on new messages or thread switch

  // Fetch Chat List
  useEffect(() => {
    fetch('/api/chats_proxy')
      .then(res => res.json())
      .then(data => setChats(data.chats || []))
      .catch(console.error);
  }, [sessionId, loading]);

  // Load Chat History (Full Tree)
  useEffect(() => {
    if (sessionId) {
      setLoading(true);
      // We use the db_inspector style or update chats_proxy to return full list
      // For now, assuming API returns flat list of all messages
      fetch(`/api/chats_proxy?id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages) {
             const msgs = data.messages as Message[];
             const { map, childrenMap: cmap } = buildTreeIndex(msgs);
             setMessageMap(map);
             setChildrenMap(cmap);
             
             // Default Head: The very last message in the array (chronological end)
             // or stick to current if valid? Better to jump to end on load.
             if (msgs.length > 0) {
               setHeadId(msgs[msgs.length - 1].id);
             } else {
               setHeadId(null);
             }
          }
          setLoading(false);
        })
        .catch(e => setLoading(false));
    } else {
      setMessageMap({});
      setChildrenMap({});
      setHeadId(null);
      setSelectedContextFiles([]);
    }
    setChatMode('discuss');
  }, [sessionId]);

  // File Picker Fetch
  useEffect(() => {
    if (filePickerOpen) {
      setFilePickerLoading(true);
      fetch(`/api/drive?path=${encodeURIComponent(filePickerPath)}`)
        .then(res => res.json())
        .then(data => {
          setFilePickerItems(data.items || []);
          setFilePickerLoading(false);
        })
        .catch(() => setFilePickerLoading(false));
    }
  }, [filePickerOpen, filePickerPath]);

  // --- Handlers ---

  const handleBranchSwitch = useCallback((messageId: number, direction: 'prev' | 'next') => {
    const msg = messageMap[messageId];
    if (!msg) return;
    
    const pid = msg.parent_id ?? 'root';
    const siblings = childrenMap[pid] || [];
    const currentIndex = siblings.indexOf(messageId);
    
    if (currentIndex === -1) return;
    
    const nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex >= 0 && nextIndex < siblings.length) {
      const siblingId = siblings[nextIndex];
      // When switching branch, we want to go to the TIP of that branch, not just the sibling
      const newHeadId = findLatestLeaf(siblingId, childrenMap, messageMap);
      setHeadId(newHeadId);
    }
  }, [childrenMap, messageMap]);

  async function handleRenameChat(chatId: string) {
    const newTitle = prompt("Enter new chat title:", chats.find(c => c.id === chatId)?.title);
    if (newTitle && newTitle.trim()) {
      await fetch(`/api/chats_proxy?id=${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle.trim()! } : c));
    }
  }

  async function handleDeleteChat(chatId: string) {
    if (confirm("Delete this chat?")) {
      await fetch(`/api/chats_proxy?id=${chatId}`, { method: 'DELETE' });
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (sessionId === chatId) router.push('/chat');
    }
  }

  async function sendMessage(contentOverride?: string, parentIdOverride?: number | null) {
    const contentToSend = contentOverride || input;
    if (!contentToSend.trim() || loading) return;

    // Determine Parent ID
    const effectiveParentId = parentIdOverride !== undefined ? parentIdOverride : headId;
    console.log("SENDING MESSAGE:", { contentOverride, parentIdOverride, headId, effectiveParentId }); // DEBUG LOG

    if (!contentOverride) setInput("");
    setLoading(true);

    // Optimistic Update: Create a temp message node
    const tempUserMsgId = Date.now(); // Temp ID
    const tempUserMsg: Message = { 
      id: tempUserMsgId, 
      role: 'user', 
      content: contentToSend, 
      parent_id: effectiveParentId || null 
    };

    // Update Tree State Optimistically
    setMessageMap(prev => ({ ...prev, [tempUserMsgId]: tempUserMsg }));
    setChildrenMap(prev => {
      const pid = effectiveParentId ?? 'root';
      return { ...prev, [pid]: [...(prev[pid] || []), tempUserMsgId] };
    });
    setHeadId(tempUserMsgId); // Move view to this new message

    try {
      // Load Context
      let contextData = null;
      if (selectedContextFiles.length > 0) {
        const loadedFiles = await Promise.all(selectedContextFiles.map(async (file) => {
          const res = await fetch(`/api/file?path=${encodeURIComponent(file.path)}`);
          const data = await res.json();
          return { filename: file.name, content: data.content || "" };
        }));
        const combinedContent = loadedFiles.map(f => `--- FILE: ${f.filename} ---\n${f.content}\n--- END FILE ---\n`).join("\n");
        contextData = { filename: "Selected Files", content: combinedContent };
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: [{ role: 'user', content: contentToSend }], // Only send the new one, backend rebuilds history from parent_id
          parent_message_id: effectiveParentId, // CRITICAL: This enables branching
          context: contextData,
          model: model,
          mode: chatMode
        })
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let newSessionId = "";
      let buffer = "";
      
      // Temp Assistant Message
      const tempAssistantId = tempUserMsgId + 1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (!jsonStr.trim()) continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'session_id') newSessionId = data.value;
              else if (data.type === 'content') {
                assistantContent += data.value;
                
                // Live Update Assistant Message
                setMessageMap(prev => ({
                  ...prev,
                  [tempAssistantId]: {
                    id: tempAssistantId,
                    role: 'assistant',
                    content: assistantContent,
                    parent_id: tempUserMsgId
                  }
                }));
                // Ensure it's in children map
                setChildrenMap(prev => {
                  const pid = tempUserMsgId;
                  if (prev[pid]?.includes(tempAssistantId)) return prev;
                  return { ...prev, [pid]: [...(prev[pid] || []), tempAssistantId] };
                });
                setHeadId(tempAssistantId);
              }
            } catch (e) { console.warn(e); }
          }
        }
      }

      // After streaming, we should ideally re-fetch to get real IDs from DB
      // But for now, we can leave the temp IDs until next reload or force a reload
      // A silent re-fetch is better
      if (sessionId || newSessionId) {
         fetch(`/api/chats_proxy?id=${sessionId || newSessionId}`)
            .then(res => res.json())
            .then(data => {
              if (data.messages) {
                 const { map, childrenMap: cmap } = buildTreeIndex(data.messages);
                 setMessageMap(map);
                 setChildrenMap(cmap);
                 // We need to find the "real" ID that replaced our temp assistant ID
                 // Heuristic: Find latest leaf from the same parent path
                 const realHead = findLatestLeaf(effectiveParentId || 0, cmap, map); // Simple Fallback
                 if (data.messages.length > 0) {
                    setHeadId(data.messages[data.messages.length - 1].id);
                 }
              }
            });
      }

      if (!sessionId && newSessionId) router.push(`/chat/${newSessionId}`);

    } catch (e) {
      console.error(e);
      // Handle Error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-zinc-950 text-zinc-200 overflow-hidden font-sans">
      
      {/* Context Menu (Renaming/Deleting Chats) */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-32 z-[100]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => { handleRenameChat(contextMenu.chatId); setContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700">
              <Edit className="w-4 h-4" /> <span>Rename</span>
            </button>
            <button onClick={() => { handleDeleteChat(contextMenu.chatId); setContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700">
              <Trash2 className="w-4 h-4" /> <span>Delete</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Picker Overlay */}
      <AnimatePresence>
        {filePickerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFilePickerOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] z-10">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="font-semibold text-lg">Select Context</h3>
                <button onClick={() => setFilePickerOpen(false)} className="p-1 hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-zinc-500" /></button>
              </div>
               {filePickerPath !== "" && (
                  <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2 text-sm text-zinc-400">
                    <button onClick={() => setFilePickerPath("")} className="hover:text-white">Home</button>
                    <span>/</span>
                    <button onClick={() => setFilePickerPath("")} className="hover:text-white">...</button>
                  </div>
                )}
              <div className="flex-1 overflow-y-auto p-2">
                {filePickerLoading ? <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div> : (
                  <div className="space-y-1">
                    {filePickerItems.map(item => {
                      const isSelected = selectedContextFiles.find(f => f.path === item.path);
                      return (
                        <button key={item.path} onClick={() => item.type === 'folder' ? setFilePickerPath(item.path) : toggleContextFile(item)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg text-left group">
                          {item.type === 'folder' ? <Folder className="w-5 h-5 text-blue-400" /> : <FileText className="w-5 h-5 text-zinc-400" />}
                          <span className="flex-1 truncate text-zinc-300 group-hover:text-white">{item.name}</span>
                          {item.type === 'file' && <div className={cn("w-5 h-5 rounded-full border border-zinc-600 flex items-center justify-center", isSelected && "bg-blue-600 border-blue-600")}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ width: 0, opacity: 0, x: -20 }} animate={{ width: 260, opacity: 1, x: 0 }} exit={{ width: 0, opacity: 0, x: -20 }} className="fixed md:relative inset-y-0 left-0 border-r border-zinc-900 bg-zinc-950 flex flex-col z-50 h-full">
            <div className="p-4 h-16 flex items-center border-b border-zinc-900/50 justify-between shrink-0">
              <div className="flex items-center gap-2 font-semibold text-lg text-white"><MessageSquare className="w-5 h-5 text-blue-500" /><span>History</span></div>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-zinc-500"><PanelLeftClose className="w-5 h-5" /></button>
            </div>
            <div className="p-4 flex-1 flex flex-col min-h-0">
               <div className="md:hidden mb-4"><button onClick={() => router.push('/drive')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 text-zinc-300 font-medium"><HardDrive className="w-5 h-5" /><span>Go to Drive</span></button></div>
              <button onClick={() => { router.push('/chat'); if (window.innerWidth < 768) setSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-4 py-3 rounded-xl font-medium mb-6"><Plus className="w-5 h-5" /><span>New Chat</span></button>
              <div className="flex-1 overflow-y-auto space-y-1">
                {chats.map(chat => (
                  <button key={chat.id} onClick={() => { router.push(`/chat/${chat.id}`); if (window.innerWidth < 768) setSidebarOpen(false); }} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ chatId: chat.id, x: e.clientX, y: e.clientY }); }} className={cn("w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition flex items-center gap-3", sessionId === chat.id ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200")}>
                    <MessageSquare className={cn("w-4 h-4 flex-shrink-0", sessionId === chat.id ? "text-blue-500" : "text-zinc-600")} />
                    <span className="truncate flex-1">{chat.title || "Untitled Chat"}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative bg-zinc-950 h-full min-h-0 overflow-hidden">
        <div className="h-14 border-b border-zinc-900 flex items-center px-4 justify-between bg-zinc-950/80 backdrop-blur z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400"><PanelLeftOpen className="w-5 h-5" /></button>
            <span className="font-semibold text-zinc-200">{sessionId ? chats.find(c => c.id === sessionId)?.title || "Chat" : "New Conversation"}</span>
          </div>
        </div>

        {/* Message List */}
        <div ref={msgContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth min-h-[40dvh]">
          {currentThread.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-60">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-zinc-800"><Monitor className="w-8 h-8 text-zinc-400" /></div>
              <h2 className="text-2xl font-semibold text-zinc-300 mb-2">How can I help you today?</h2>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto pb-4">
              {currentThread.map((msg, i) => {
                 const pid = msg.parent_id ?? 'root';
                 const siblings = childrenMap[pid] || [];
                 const siblingIndex = siblings.indexOf(msg.id) + 1;
                 const isLast = i === currentThread.length - 1;

                 return (
                   <ChatMessage
                     key={msg.id}
                     message={msg}
                     siblingCount={siblings.length}
                     currentSiblingIndex={siblingIndex}
                     onBranchSwitch={(dir) => handleBranchSwitch(msg.id, dir)}
                     onEdit={(newContent) => sendMessage(newContent, msg.parent_id)} // Save Edit: Send new msg with SAME parent
                     isLast={isLast}
                     loading={loading && isLast}
                   />
                 );
              })}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-zinc-950">
          <div className="max-w-3xl mx-auto">
             {selectedContextFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedContextFiles.map(file => (
                  <span key={file.path} className="flex items-center gap-1.5 text-xs font-medium text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                    <FileText className="w-3 h-3" /> {file.name} <button onClick={() => toggleContextFile(file)} className="hover:text-white ml-1"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg focus-within:ring-1 focus-within:ring-blue-600/50 transition flex flex-col">
              <textarea
                autoFocus
                disabled={loading}
                className={cn("w-full bg-transparent border-none outline-none text-zinc-200 px-4 py-4 text-sm resize-none h-auto min-h-[56px] max-h-48 scrollbar-hide", loading && "opacity-50")}
                placeholder={loading ? "Waiting for response..." : "Ask anything..."}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!loading) sendMessage(); } }}
              />
              <div className="px-3 pb-3 pt-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <button onClick={() => setFilePickerOpen(true)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400" title="Add Context"><Paperclip className="w-4 h-4" /></button>
                   <div className="relative">
                    <button onClick={() => setModelMenuOpen(!modelMenuOpen)} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-zinc-800 rounded-lg text-xs font-medium text-zinc-400">
                      <Sparkles className="w-3.5 h-3.5" /> <span>{model === 'gemini-1.5-flash' ? 'Flash' : 'Pro'}</span> <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                    {modelMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setModelMenuOpen(false)} />
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                          <button onClick={() => { setModel('gemini-1.5-flash'); setModelMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex justify-between"><span className={model === 'gemini-1.5-flash' ? 'text-blue-400' : ''}>Flash</span></button>
                          <button onClick={() => { setModel('gemini-1.5-pro'); setModelMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex justify-between"><span className={model === 'gemini-1.5-pro' ? 'text-purple-400' : ''}>Pro</span></button>
                        </div>
                      </>
                    )}
                   </div>
                   <div className="h-4 w-px bg-zinc-800 mx-1" />
                   <div className="flex bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-800">
                      <button onClick={() => setChatMode('discuss')} className={cn("px-2 py-1 rounded-md text-xs font-medium transition", chatMode === 'discuss' ? "bg-zinc-700 text-white" : "text-zinc-500")}>Discuss</button>
                      <button onClick={() => setChatMode('write')} className={cn("px-2 py-1 rounded-md text-xs font-medium transition", chatMode === 'write' ? "bg-blue-600/20 text-blue-400" : "text-zinc-500")}>Write</button>
                   </div>
                </div>
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading} className={cn("p-2 rounded-lg transition text-white", !input.trim() || loading ? "bg-zinc-800 text-zinc-600" : "bg-zinc-700 hover:bg-zinc-600")}><ArrowUp className="w-4 h-4" /></button>
              </div>
            </div>
             <div className="text-center mt-2 text-xs text-zinc-600">Thinking can make mistakes. Check important information.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
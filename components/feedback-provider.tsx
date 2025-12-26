"use client"

import { useAppStore } from "@/lib/store";
import { Loader2, CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function FeedbackProvider() {
  const { isLoading, loadingMessage, toast, hideToast } = useAppStore();

  return (
    <>
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              {loadingMessage && (
                <span className="text-sm font-medium text-zinc-300">{loadingMessage}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[100] max-w-sm w-full"
          >
            <div className={cn(
              "bg-zinc-900 border p-4 rounded-xl shadow-2xl flex gap-3 items-start relative overflow-hidden",
              toast.type === 'success' ? "border-green-900/50" :
                toast.type === 'error' ? "border-red-900/50" : "border-zinc-800"
            )}>
              {/* Accent Line */}
              <div className={cn("absolute left-0 top-0 bottom-0 w-1",
                toast.type === 'success' ? "bg-green-500" :
                  toast.type === 'error' ? "bg-red-500" : "bg-blue-500"
              )} />

              <div className="mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-semibold text-zinc-200">{toast.title}</h3>
                {toast.description && (
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{toast.description}</p>
                )}
              </div>

              <button onClick={hideToast} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

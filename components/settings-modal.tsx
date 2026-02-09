import { useState, useEffect } from "react";
import { Preferences } from '@capacitor/preferences';
import { useAppStore } from "@/lib/store";
import { X, Key, Save, Loader2, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { apiKey, setApiKey, geminiFlashModel, setGeminiFlashModel, geminiProModel, setGeminiProModel } = useAppStore();
  const [inputKey, setInputKey] = useState("");
  const [inputFlash, setInputFlash] = useState("");
  const [inputPro, setInputPro] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Load current key
      if (apiKey) setInputKey(apiKey);
      else {
        Preferences.get({ key: 'google_api_key' }).then(res => {
          if (res.value) setInputKey(res.value);
        });
      }

      // Load models
      if (geminiFlashModel) setInputFlash(geminiFlashModel);
      else {
          Preferences.get({ key: 'gemini_flash_model' }).then(res => {
              if (res.value) setInputFlash(res.value);
              else setInputFlash("gemini-1.5-flash");
          });
      }

      if (geminiProModel) setInputPro(geminiProModel);
      else {
          Preferences.get({ key: 'gemini_pro_model' }).then(res => {
              if (res.value) setInputPro(res.value);
              else setInputPro("gemini-1.5-pro");
          });
      }
    }
  }, [open, apiKey, geminiFlashModel, geminiProModel]);

  const handleSave = async () => {
    setLoading(true);
    await Preferences.set({ key: 'google_api_key', value: inputKey });
    setApiKey(inputKey);

    await Preferences.set({ key: 'gemini_flash_model', value: inputFlash || "gemini-1.5-flash" });
    setGeminiFlashModel(inputFlash || "gemini-1.5-flash");

    await Preferences.set({ key: 'gemini_pro_model', value: inputPro || "gemini-1.5-pro" });
    setGeminiProModel(inputPro || "gemini-1.5-pro");

    setLoading(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-500" /> Settings
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                    <Key className="w-4 h-4" /> Google API Key
                </label>
                <input 
                  type="password" 
                  value={inputKey} 
                  onChange={e => setInputKey(e.target.value)} 
                  placeholder="AIzaSy..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 outline-none focus:border-blue-500/50 text-sm"
                />
                <p className="text-xs text-zinc-600 mt-2">
                  Required for the AI to function on mobile. 
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500 hover:underline ml-1">Get a key</a>
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> Model Configuration
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Flash Model Name</label>
                        <input 
                        type="text" 
                        value={inputFlash} 
                        onChange={e => setInputFlash(e.target.value)} 
                        placeholder="gemini-1.5-flash"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 outline-none focus:border-blue-500/50 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Pro Model Name</label>
                        <input 
                        type="text" 
                        value={inputPro} 
                        onChange={e => setInputPro(e.target.value)} 
                        placeholder="gemini-1.5-pro"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 outline-none focus:border-blue-500/50 text-sm"
                        />
                    </div>
                </div>
              </div>

              <button 
                onClick={handleSave} 
                disabled={loading || !inputKey.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
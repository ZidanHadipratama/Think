import { create } from 'zustand';

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
}

interface AppState {
  currentPath: string; // Current folder path in Drive
  setCurrentPath: (path: string) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  selectedContextFiles: FileItem[]; // Assuming DriveItem is FileItem based on usage
  setSelectedContextFiles: (files: FileItem[]) => void;
  toggleContextFile: (file: FileItem) => void;

  lastVisitedPath: string;
  setLastVisitedPath: (path: string) => void;

  refreshTrigger: number;
  triggerRefresh: () => void;

  // Feedback System
  isLoading: boolean;
  loadingMessage: string | null;
  setIsLoading: (loading: boolean, message?: string) => void;

  toast: { title: string; description?: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (toast: { title: string; description?: string; type?: 'success' | 'error' | 'info' }) => void;
  hideToast: () => void;

  apiKey: string | null;
  setApiKey: (key: string | null) => void;

  geminiFlashModel: string;
  setGeminiFlashModel: (model: string) => void;
  geminiProModel: string;
  setGeminiProModel: (model: string) => void;

  initialize: () => Promise<void>;
}

import { Preferences } from '@capacitor/preferences';

export const useAppStore = create<AppState>((set) => ({
  currentPath: '',
  setCurrentPath: (path) => set({ currentPath: path }),

  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  selectedContextFiles: [],
  setSelectedContextFiles: (files) => set({ selectedContextFiles: files }),
  toggleContextFile: (file) => set((state) => {
    const exists = state.selectedContextFiles.find(f => f.path === file.path);
    if (exists) {
      return { selectedContextFiles: state.selectedContextFiles.filter(f => f.path !== file.path) };
    } else {
      return { selectedContextFiles: [...state.selectedContextFiles, file] };
    }
  }),

  lastVisitedPath: "/drive", // Default to root
  setLastVisitedPath: (path) => set({ lastVisitedPath: path }),

  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),

  isLoading: false,
  loadingMessage: null,
  setIsLoading: (loading, message) => set({ isLoading: loading, loadingMessage: message || null }),

  toast: null,
  showToast: (toast) => {
    set({ toast: { ...toast, type: toast.type || 'info' } });
    // Auto dismiss
    setTimeout(() => {
      set({ toast: null });
    }, 3000);
  },
  hideToast: () => set({ toast: null }),

  apiKey: null,
  setApiKey: (key) => set({ apiKey: key }),

  geminiFlashModel: "gemini-1.5-flash",
  setGeminiFlashModel: (model) => set({ geminiFlashModel: model }),
  geminiProModel: "gemini-1.5-pro",
  setGeminiProModel: (model) => set({ geminiProModel: model }),

  initialize: async () => {
    try {
      const key = await Preferences.get({ key: 'google_api_key' });
      if (key.value) set({ apiKey: key.value });

      const flash = await Preferences.get({ key: 'gemini_flash_model' });
      if (flash.value) set({ geminiFlashModel: flash.value });

      const pro = await Preferences.get({ key: 'gemini_pro_model' });
      if (pro.value) set({ geminiProModel: pro.value });
    } catch (e) {
      console.error("Failed to initialize store from preferences", e);
    }
  }
}));


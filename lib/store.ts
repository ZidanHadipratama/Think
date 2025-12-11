import { create } from 'zustand';

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
}

interface AppState {
  currentPath: string; // Current folder path in Drive
  setCurrentPath: (path: string) => void;

  selectedFile: FileItem | null; // File user wants to talk about
  setSelectedFile: (file: FileItem | null) => void;

  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPath: '',
  setCurrentPath: (path) => set({ currentPath: path }),

  selectedFile: null,
  setSelectedFile: (file) => set({ selectedFile: file }),

  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));

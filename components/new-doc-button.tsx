import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function NewDocButton() {
  const router = useRouter();

  const createNewDoc = () => {
    const id = Math.random().toString(36).slice(2, 7);
    const filename = `Untitled-${id}.md`;
    router.push(`/editor?path=${encodeURIComponent(filename)}`);
  };

  return (
    <button
      onClick={createNewDoc}
      className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-900/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-50 md:hidden mb-[var(--safe-bottom)]"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}

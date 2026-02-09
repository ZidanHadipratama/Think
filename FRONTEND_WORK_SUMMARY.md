# Frontend Work Summary

**Project Overview:**
"Think" is an AI-powered conversational workspace with a "Dual-Brain" architecture. The frontend is a sophisticated **Hybrid Next.js Application** that serves as the universal interface for both the SaaS Web Platform and the Offline-First Android App. It is designed to be "Environment Agnostic," dynamically switching its data sources and execution engines based on the underlying platform (Web vs. Capacitor) without changing the UI code.

**Role:** Frontend Engineer
**Tech:** React (Next.js 15), TypeScript, Tailwind CSS, Zustand, Framer Motion, Capacitor.js, Lucide Icons.

## What I Built
I built the "Face" and "Nervous System" of the AI agent, creating a responsive, high-performance interface that handles complex message trees, manages local/remote state synchronization, and provides a seamless "Native" experience on mobile devices.

## What I Did (The Code)

### 1. Hybrid Client Architecture (Web vs. Mobile)
*   **Runtime Switching:** Implemented a robust "Dependency Injection" pattern within React components (`useEffect` checks `Capacitor.isNativePlatform()`).
    *   **Web Mode:** The UI makes standard REST API calls (`fetch('/api/chat')`) to the Node.js backend.
    *   **Mobile Mode:** The UI uses dynamic imports (`await import('@/lib/mobile/agent')`) to load the "Brain" directly into the browser's JavaScript thread, bypassing the network entirely.
*   **Result:** Achieved 100% code reuse. The exact same `<ChatPage />` component runs in the cloud and offline on a phone.

### 2. Tree-Based Chat Interface
*   **Visualizing Non-Linear History:** Unlike standard chat UIs (linear lists), I built a custom **Graph Renderer** capable of displaying and navigating conversation branches.
    *   **Logic:** Implemented a client-side tree traversal algorithm (`buildTreeIndex`, `getThreadFromHead`) that converts the flat message database into a renderable thread.
    *   **Branching UX:** Added "Edit" and "Branch Navigation" (Left/Right arrows) controls to every message bubble, allowing users to explore alternative conversation paths seamlessly.

### 3. "Agency" & Context Management UI
*   **File Context Picker:** Built a dedicated "Drive" overlay that allows users to select specific files (`.md`, `.ts`, etc.) to "feed" into the AI's context window.
*   **Optimistic UI Patterns:** Implemented "Optimistic Updates" for message sending. The UI immediately renders a temporary user message and a "Thinking" placeholder node before the AI (or Server) confirms receipt, ensuring the app feels "instant" even on slow networks.

### 4. Advanced Message Rendering
*   **Rich Text & Code:** Integrated `react-markdown` with `react-syntax-highlighter` to render complex AI outputs, including formatted code blocks with copy-paste functionality.
*   **Streaming Support:** Built a custom stream parser (Server-Sent Events) that updates the message content character-by-character as the AI "thinks," providing immediate visual feedback.

### 5. Mobile-First & Safe Areas
*   **Capacitor Integration:** Optimized the layout for mobile viewports using CSS variables (`--safe-top`, `--safe-bottom`) to respect notches and home indicators.
*   **Touch Optimizations:** Implemented swipeable drawers and touch-friendly click targets using `Framer Motion` for native-like gestures and transitions.

---

## Self-Critique (For Interviews)

### ✅ What I did well
1.  **Separation of Concerns:** The UI components are completely decoupled from the data source. The `ChatPage` doesn't know if the answer came from a Cloud API or a local SQLite database.
2.  **Complex State Management:** Successfully managed a complex "Tree State" (Message Map + Children Map) along with global app state (Settings, Context Files) using **Zustand**, keeping the React component tree clean of prop-drilling.
3.  **UX Polish:** The transitions (Sidebar, Modals) feel fluid and "Native" due to careful tuning of `Framer Motion` springs.
4.  **Error Handling:** The UI gracefully handles API failures and missing keys (e.g., prompting for an API Key on mobile) without crashing.

### ⚠️ What I need to improve (The Bad)
1.  **Large Component File:** The main `client-page.tsx` is becoming a "God Component" (~600 lines). It mixes Tree Logic, Data Fetching, and UI Rendering. I should extract the "Chat Logic" into a custom hook (`useChatTree`).
2.  **Prop Drilling in Messages:** The `ChatMessage` component receives too many props (`onEdit`, `onBranchSwitch`, `siblingCount`...). I should consider using a Context Provider for the Message List.
3.  **Performance on Long Chats:** The Tree Reconstruction (`buildTreeIndex`) runs on every render/update. For chats with 1000+ messages, this might block the main thread. I should memoize this heavy computation or move it to a Web Worker.
4.  **Accessibility (a11y):** While I used semantic HTML buttons, I haven't fully tested keyboard navigation for the complex "Branch Switching" controls.

---

## Resume Bullet Points (Simple Version)

*   Built a **Hybrid Next.js Frontend** that runs as both a SaaS Web App and an Offline-First Android App (Capacitor), achieving 100% code reuse.
*   Designed a **Tree-Based Chat UI** enabling users to edit messages and navigate conversation branches, similar to Git version control.
*   Implemented **Optimistic UI** patterns and real-time **Streaming** (Server-Sent Events) for a zero-latency conversational experience.
*   Created a "File Agency" interface allowing users to dynamically select and inject local files into the AI's context window.
*   Optimized mobile performance and UX using **Zustand** for state management and **Framer Motion** for native-like gestures.

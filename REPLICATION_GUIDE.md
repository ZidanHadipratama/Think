# Think App - Feature & Replication Guide

This document outlines the core features, architecture, and workflows of the "Think" AI Workspace to assist in replicating it for a new project.

## 1. Core Concept
The system is a **"Serverless" AI Developer Agent** designed to run on both **Web (Server-Side)** and **Mobile (Client-Side)**. It differs from standard chatbots by giving the AI "Agency"—a persistent file system ("Drive") where it can read, write, and manage files to perform complex tasks like coding or document generation.

**Tech Stack:** Next.js (React), Tailwind CSS, SQLite (Better-SQLite3 / Capacitor), LangChain, Google Gemini API.

---

## 2. Feature Modules

### 2.1. Dual-Runtime AI Engine (`route.ts` vs `agent.ts`)
*   **Purpose:** Allow the app to function as a SaaS (Web) and an offline-first Native App (Mobile) sharing one UI.
*   **Feature: Web Mode (Next.js API)**
    *   **Logic:** Standard request/response. The client POSTs to `/api/chat`, the server connects to Gemini, executes tools on the server's disk, and streams the response back.
*   **Feature: Mobile Mode (In-Browser Agent)**
    *   **Logic:** When running on a device, the app bypasses the API. It uses a "Mobile Agent" (`lib/mobile/agent.ts`) running directly in the JavaScript bundle. This agent connects to Gemini from the phone and uses Capacitor Plugins to access the phone's storage and database.

### 2.2. Tree-Based Conversation History (`lib/db.ts`)
*   **Purpose:** Support non-linear conversations (Branching).
*   **Feature: Message Branching**
    *   **Logic:** Instead of a linear list, messages are stored as a Tree. Each message has a `parent_id`.
    *   **Workflow:** When a user edits a message or regenerates a response, a *new* sibling node is created pointing to the same parent. The UI can then traverse "Left/Right" to see different versions of the conversation.
*   **Feature: Recursive Thread Reconstruction**
    *   **Logic:** A recursive SQL query (CTE) is used to fetch a single conversation "thread" from a specific leaf node back to the root, ignoring unrelated branches.

### 2.3. Sandboxed File System "The Drive" (`lib/ai/tools.ts`)
*   **Purpose:** Give the AI a workspace to perform actual work.
*   **Feature: Tool-Use (Function Calling)**
    *   **Logic:** The AI is equipped with `list_files`, `read_file`, `write_file`, and `delete_file` tools. It can autonomously decide to invoke these tools based on the user's prompt (e.g., "Create a file called script.py").
*   **Feature: Security Sandbox**
    *   **Logic:** All file operations are restricted to a specific `drive_data` directory. Path traversal attacks (e.g., `../../etc/passwd`) are blocked by validating resolved paths against the root `drive_data` path.
*   **Feature: Context Selection**
    *   **Logic:** Users can "Select" specific files from the drive. These files are read and injected into the System Prompt as context (`<Document name='...'>... content ...</Document>`) before sending the request to the AI.

### 2.4. Smart Context Compression (`context_manager.ts`)
*   **Purpose:** Handle long conversations without hitting token limits or high costs.
*   **Feature: Background Summarization**
    *   **Logic:** A secondary, cheaper AI model (Gemini Flash) runs periodically to analyze the chat history. It extracts a structured JSON summary (User Goal, Constraints, Decisions) which is stored in the `chat` table.
*   **Feature: Dynamic System Prompt**
    *   **Logic:** This summary is injected into the System Prompt for every new turn. This allows the AI to "remember" the project goal even if the explicit messages have drifted out of the context window.

### 2.5. Real-Time Streaming
*   **Purpose:** Provide instant feedback during long generation tasks.
*   **Feature: Custom SSE (Web)**
    *   **Logic:** Implemented a `ReadableStream` in Next.js to push Server-Sent Events (SSE) for text chunks, tool execution starts, and tool results.
*   **Feature: Callback System (Mobile)**
    *   **Logic:** Since mobile doesn't use the API, it passes an `onStream` callback function to the agent, which updates the React state in real-time as chunks arrive.

---

## 3. Architecture & Best Practices

### A. The "Dual-Brain" Abstraction
*   **Implementation:** The UI (`client-page.tsx`) detects the platform (`Capacitor.isNativePlatform()`).
    *   If Native: Dynamically imports `MobileDB` and `MobileAgent`.
    *   If Web: Uses `fetch('/api/chat')`.
*   **Why:** This allows a single codebase to serve two completely different deployment targets (SaaS vs. App Store) without code duplication in the UI layer.

### B. Optimistic UI Updates
*   **Implementation:** When a user sends a message, the UI immediately creates a temporary "User Message" node in the local state before the network request even starts.
*   **Why:** Makes the app feel incredibly responsive. The temporary ID is swapped for the real DB ID once the persistence layer confirms the save.

### C. Write-Ahead Logging (WAL) for SQLite
*   **Implementation:** `db.pragma('journal_mode = WAL');`
*   **Why:** SQLite defaults to locking the entire file on write. WAL mode allows concurrent readers and writers, which is crucial when the AI is streaming a response (writing) while the UI is polling for updates (reading).

### D. Direct Tool Binding
*   **Implementation:** Using `llm.bindTools([tools])` from LangChain.
*   **Why:** Instead of manually parsing prompt text for commands, we leverage the LLM's native function-calling API to get structured, reliable JSON arguments for file operations.

---

## 4. Replication Steps

1.  **Setup & Database:**
    *   Initialize a Next.js project.
    *   Set up SQLite (using `better-sqlite3`). Create `chat` and `message` tables. Crucially, add a `parent_id` column to `message` to support tree history.
2.  **File System Tools:**
    *   Create a `drive_data` folder.
    *   Write functions `listFiles`, `readFile`, `writeFile` using Node.js `fs`. Wrap them as LangChain `tool` objects with Zod schemas.
3.  **The API Route (Web):**
    *   Create an endpoint that accepts `messages` and `parent_id`.
    *   Load the thread using a recursive SQL query.
    *   Initialize `ChatGoogleGenerativeAI` with the tools.
    *   Run the LangChain loop: `llm.invoke` -> Check for `tool_calls` -> Execute Tools -> Loop again if needed.
    *   Stream the output using `ReadableStream`.
4.  **The Frontend:**
    *   Build a Chat UI that renders a list of messages.
    *   Implement "Branching" UI (Left/Right arrows) that switches the `headId` (the ID of the last message being viewed) and re-fetches the thread.
    *   Add a Sidebar file explorer that lists the contents of `drive_data`.
5.  **Context Management (Advanced):**
    *   Add a "Summarization" step that runs after every few user messages.
    *   Store the summary in the `chat` table and prepend it to the System Prompt.

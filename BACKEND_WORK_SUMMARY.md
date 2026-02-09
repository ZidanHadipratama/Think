# Backend Work Summary

**Project Overview:**
"Think" is an AI-powered conversational workspace that functions as a "Sandboxed Developer Agent." Unlike standard chatbots, it possesses a dedicated local file system and "Agency"—the ability to create, read, and manage files. It is architected to run in two distinct environments: as a Web Application (Node.js/Next.js) and as an offline-first Native Mobile App (Capacitor/Android), sharing the same logic but swapping the underlying runtime engines ("Dual-Brain" architecture).

**Role:** Backend Engineer
**Tech:** Node.js, Next.js API Routes, SQLite (Better-SQLite3 / Capacitor SQLite), Google Gemini AI, LangChain, Capacitor.js.

## What I Built
I built the "Brain" and "Memory" of the AI agent, creating a system that allows the AI to remember conversation branches (Tree-Based History), manage a sandboxed file system, and stream real-time responses across both Web and Mobile platforms.

## What I Did (The Code)

### 1. Dual-Runtime Architecture (Web vs. Mobile)
*   **Abstraction Layer:** I designed the system to run on two completely different backends.
    *   **Web Mode:** Uses standard Node.js `fs` and `better-sqlite3` running on a server.
    *   **Mobile Mode:** Uses a custom "Mobile Agent" (`lib/mobile/agent.ts`) that replicates the server logic client-side, using Native Plugins for FileSystem and Database access.
*   **Result:** The exact same UI code works for both the web SaaS and the native Android app without changes.

### 2. The AI Agent & Streaming
*   **Server-Side Streaming:** Implemented a custom `ReadableStream` in the Next.js API Route (`/api/chat`) to stream AI tokens to the client in real-time, preventing timeouts during long generation tasks.
*   **Tool Use Integration:** Wired up Google Gemini with custom tools (`read_file`, `write_file`, `list_files`). The agent can decide when to write code to disk versus just talking to the user.
*   **Context Injection:** Built a `ContextManager` that dynamically constructs the prompt. It injects "Active Files" (files the user selected) and a "Session Summary" into the system prompt so the AI understands the current workspace state.

### 3. Tree-Based Message History (Not Linear)
*   **Data Structure:** Unlike most chat apps that use a simple list, I implemented a **Tree Structure** for messages.
    *   Each message has a `parent_id`.
    *   This allows users to "Edit" a previous message or "Regenerate" a response without losing the old history.
*   **Recursive Queries:** Wrote complex SQL queries (Recursive Common Table Expressions) in `lib/db.ts` to reconstruct a conversation thread from any "leaf" node back to the root.

### 4. Smart Context Compression
*   **The Problem:** Long conversations hit the AI's token limit (context window) and get expensive.
*   **The Solution:** I built a background "Summarization Loop."
    *   Every few turns, a secondary, cheaper AI model (Gemini Flash) reads the recent chat and updates a JSON Summary (User Goal, Key Decisions, Constraints).
    *   This summary is fed back to the main AI, allowing it to "remember" early details without re-reading the entire chat history.

### 5. Local Database Implementation
*   **SQLite:** Chose SQLite for zero-latency, local data storage.
*   **WAL Mode:** Enabled Write-Ahead Logging (`WAL`) to handle concurrent reads/writes without locking the database, ensuring smooth streaming performance.

---

## Self-Critique (For Interviews)

### ✅ What I did well
1.  **Architecture:** The "Dual-Brain" abstraction is robust. It allowed us to ship a Native App without building a separate backend API or syncing logic.
2.  **Performance:** Using `ReadableStream` and `async/await` properly ensures the UI feels instant, even when the AI is generating large blocks of code.
3.  **Complex Data Modeling:** The Tree-Based history is complex to implement but provides a significantly better user experience (Versioning) than standard chatbots.
4.  **Cost Efficiency:** The "Summarization Loop" saves significant API costs and latency by reducing the context size sent to the main model.

### ⚠️ What I need to improve (The Bad)
1.  **Monolithic Controller:** My main API route (`processChatRequest` in `route.ts`) is too large (~200 lines). It handles validation, database writes, AI streaming, and error handling all in one place. I should refactor this into smaller services.
2.  **Fragile Migrations:** My database migration logic (`lib/db.ts`) is manual and risky. I use `CREATE TABLE IF NOT EXISTS` and `try-catch` blocks to add columns. I should use a proper migration tool like **Knex.js** or **Prisma** to handle schema changes safely.
3.  **Security Sandboxing:** While I check if file paths start with the allowed directory, there are no resource quotas (e.g., max file size, max disk usage). A malicious prompt could technically fill up the user's disk.
4.  **No Testing:** I haven't written unit tests for the complex Recursive SQL queries. If I touch that code, I'm afraid of breaking the message tree.

---

## Resume Bullet Points (Simple Version)

*   Architected a "Dual-Runtime" AI backend that runs on both **Node.js Server** (Web) and **Native Android** (Offline), sharing 90% of the logic.
*   Implemented a **Tree-Based** conversation history using Recursive SQL (SQLite) to support message branching and versioning.
*   Built a **Streaming AI Agent** using LangChain and Next.js API Routes that can Read/Write files to a sandboxed local file system.
*   Optimized AI Token usage by building a "Context Compression" system that automatically summarizes long conversations into structured JSON.
*   Designed a local-first architecture using **SQLite** with WAL mode to ensure high-performance, low-latency data access.

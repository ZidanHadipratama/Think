# Migration Plan: Think App to Mobile (Capacitor)

This plan details the steps to convert the "Think" Next.js application from a **Server-Side Architecture** (Node.js + API Routes) to a **Client-Side/Offline-First Architecture** suitable for Android/iOS via Capacitor.

## Core Strategy
We will move the "Brain" (AI Logic), "Memory" (Database), and "Hands" (Filesystem) from the Server (API Routes) to the Client (Browser/Device).

- **Current:** UI -> API Route -> Server DB/FS -> LLM
- **Target:** UI -> Client Agent -> Device DB/FS -> LLM

## Phase 1: Dependencies & Configuration

1.  **Install Capacitor Core**
    - `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
    - `npx cap init`

2.  **Install Native Plugins**
    - **Filesystem:** `npm install @capacitor/filesystem`
    - **Database:** `npm install @capacitor-community/sqlite`
    - **Preferences (Env Vars/Settings):** `npm install @capacitor/preferences`

## Phase 2: Client-Side Infrastructure (The "Backend" on the Phone)

We need to create a `lib/mobile/` directory to house the client-side equivalents of our server libraries.

### 1. Database Layer (`lib/mobile/db.ts`)
- **Goal:** Replace `lib/db.ts` (better-sqlite3).
- **Implementation:**
    - Initialize `@capacitor-community/sqlite`.
    - Port the Schema creation (`CREATE TABLE...`) to run on app launch.
    - Port `db_get_thread`, `db_append_message`, `db_list_chats` to use the async native plugin API instead of synchronous `better-sqlite3`.

### 2. Filesystem Layer (`lib/mobile/filesystem.ts`)
- **Goal:** Replace `fs` (Node.js).
- **Implementation:**
    - Create a wrapper around `@capacitor/filesystem`.
    - Implement `listFiles(path)`, `readFile(path)`, `writeFile(path)`, `deleteFile(path)`.
    - Map the concept of `drive_data/` to the device's `Documents` or `Data` directory.

### 3. AI Tools (`lib/mobile/tools.ts`)
- **Goal:** Re-create the LangChain tools to use the mobile filesystem.
- **Implementation:**
    - Create `mobileListFilesTool`, `mobileReadFileTool`, etc.
    - These tools will call `lib/mobile/filesystem.ts` instead of `fs`.

## Phase 3: The Client-Side Agent

### 1. Agent Logic (`lib/mobile/agent.ts`)
- **Goal:** Port `app/api/chat/route.ts` to the client.
- **Implementation:**
    - Create a function `runAgent({ messages, model, mode })`.
    - **Context Management:** Move `ContextManager` logic here.
    - **Summarization:** Move the summarization loop here.
    - **Execution:** Instead of streaming SSE (Server Sent Events), this function will accept a `callback` to stream text updates directly to the UI state.
    - **Direct LLM Call:** Use `ChatGoogleGenerativeAI` directly from the client. **Note:** This requires the API Key to be available on the client (User Settings or Build Config).

## Phase 4: UI Refactoring

### 1. Settings Page
- **Goal:** Allow user to input Google API Key.
- **Implementation:** Create a simple modal or page to save the API key to `@capacitor/preferences`.

### 2. Main Chat Page (`app/chat/[[...id]]/page.tsx`)
- **Goal:** Make it "Hybrid".
- **Implementation:**
    - Check context: `if (Capacitor.isNativePlatform()) { ... }`
    - **Loading History:**
        - Native: Call `MobileDB.getHistory(id)`.
        - Web: Call `fetch('/api/chats_proxy...')`.
    - **Sending Messages:**
        - Native: Call `MobileAgent.runAgent(...)`.
        - Web: Call `fetch('/api/chat', ...)` (Keep existing behavior for web dev).
    - **File Picker:**
        - Native: Call `MobileFS.listFiles()`.
        - Web: Call `fetch('/api/drive...')`.

## Phase 5: Build & Test

1.  **Build Web Assets:** `npm run build` & `npm run export` (Next.js Static Export is usually required for Capacitor, or specific `next.config.js` tweaks).
2.  **Sync to Native:** `npx cap sync`.
3.  **Run Android:** `npx cap open android`.

## Summary of Modified/Created Files

| File | Status | Description |
| :--- | :--- | :--- |
| `lib/mobile/db.ts` | **NEW** | Client-side SQLite manager. |
| `lib/mobile/filesystem.ts` | **NEW** | Client-side Filesystem manager. |
| `lib/mobile/tools.ts` | **NEW** | LangChain tools for Mobile. |
| `lib/mobile/agent.ts` | **NEW** | The "Brain" running in the browser. |
| `app/chat/[[...id]]/page.tsx` | **MODIFY** | Switch between API (Web) and Agent (Mobile). |
| `components/settings-modal.tsx` | **NEW** | To input API Key on phone. |
| `lib/store.ts` | **MODIFY** | Add state for API Key. |
| `next.config.ts` | **MODIFY** | Enable static export (output: 'export'). |

## Risks & Considerations
- **Environment Variables:** `.env` keys are NOT secure in the client. The user must input their own API Key, or you must embed it (insecure) only for personal builds.
- **Next.js Image Optimization:** Does not work in Static Export. Must use unoptimized images.
- **SQLite Initialization:** Native databases take a moment to open. The UI needs a "Loading" state on startup.
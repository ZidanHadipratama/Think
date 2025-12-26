# Think - An AI-Powered Conversational Workspace

This is a Next.js application that combines a powerful conversational AI with a local file system, creating an intelligent agent capable of thinking, reasoning, and acting within a sandboxed digital workspace.

The AI can be instructed to perform tasks like summarizing documents, writing new content, and managing files, all through a natural chat interface.

## Core Features

- **Conversational AI:** Chat with a powerful Google Gemini model to ask questions, brainstorm ideas, and get assistance with tasks.
- **File System Agency:** The AI is equipped with tools to interact with a dedicated `drive_data` directory. You can instruct it to list files, read documents, write new files, and even delete files and folders.
- **Safety Modes:** The AI operates in two distinct modes to prevent accidents:
    - **Discuss Mode (Default):** A safe, read-only mode where the AI can only list and read files.
    - **Write Mode:** An advanced mode that grants the AI permission to create, update, and delete files.
- **Context Compression Layer:** For long conversations, the AI maintains a continuously updated summary of the session (`user_goal`, `constraints`, `decisions_made`, etc.). This summary is fed back to the model each turn, ensuring it stays on track without needing to re-process the entire chat history, saving tokens and improving focus.
- **Dynamic Chat Titling:** The chat title is automatically updated based on the AI's understanding of your goal from the session summary.
- **Chat Management:** Right-click on any chat in the history to open a context menu to **Rename** or **Delete** the session.
- **Configurable Persona:** The AI's core persona, rules, and operating principles are defined in a plain text file (`prompt.txt`) and can be easily modified without changing any code.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **AI:** [Google Gemini](https://deepmind.google/technologies/gemini/) via [LangChain.js](https://js.langchain.com/)
- **Database:** Local [SQLite](https://www.sqlite.org/index.html) via `better-sqlite3`
- **UI:** [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en) (v18 or later)
- `npm` (comes with Node.js)

### 1. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### 2. Environment Variables

Create a local environment file by copying the example:

```bash
cp .env.example .env.local
```

Open `.env.local` and add your Google API Key, which is required for the AI to function. You can get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).

```
GOOGLE_API_KEY="YOUR_API_KEY_HERE"
```

### 3. Running the Development Server

Start the application in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- **/app/api/chat/route.ts**: The core backend logic for the AI agent, including the summarization layer and main execution loop.
- **/app/chat/**: The main frontend UI for the chat interface and sidebar.
- **/lib/ai/**: Contains the AI's capabilities.
    - `tools.ts`: Defines the file system tools (e.g., `listFilesTool`, `readFileTool`).
    - `context_manager.ts`: Constructs the message history and context to be sent to the model.
- **/lib/db.ts**: Manages the SQLite database schema, connections, and all CRUD functions for chats and messages.
- **/drive_data/**: The sandboxed workspace for the AI. All user-generated files and the database (`think.db`) are stored here. **This directory is the only place the AI can read from or write to.**
- **prompt.txt**: A plain text file defining the AI's core persona and system prompt. Edit this to change how the AI behaves.
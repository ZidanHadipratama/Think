# Feature Plan: Branching Conversations (Tree-Based Chat)

## **Goal**
Implement a "Branching Conversation" feature that allows users to:
1.  **Copy** message content.
2.  **Edit** their previous queries.
3.  **Switch Branches:** Editing a message creates a new "branch" of the conversation history. Users can navigate between these branches (e.g., "Version 1 of 3") to explore different conversation paths without losing previous context.

---

## **Architecture Changes**

### **1. Database Schema (`lib/db.ts`)**
- **New Column:** `parent_id` (INTEGER) in the `message` table.
    - References `message.id`.
    - `NULL` for the very first message in a chat.
- **Why?** This transforms the chat history from a linear list into a **Tree** (Directed Acyclic Graph).
- **Migration:** Existing messages must be linked sequentially (ID `N` points to ID `N-1`) to preserve current history.

### **2. Backend Logic (`lib/db.ts` & `app/api/chat/`)**
- **Querying History (`db_get_thread`):**
    - **Old:** `SELECT * FROM message WHERE chat_id = ?` (Flat list).
    - **New:** We need a recursive Common Table Expression (CTE) or a loop to fetch the *specific path* from a "Leaf Node" (the latest message in the current view) back to the "Root".
    - *Alternative (Simpler):* Fetch all messages for the chat and reconstruct the tree in JavaScript/TypeScript to filter the current thread. (Better for SQLite performance with small chat sizes).
- **Appending Messages:**
    - New API parameter: `parent_message_id`.
    - When the AI replies, it attaches to the last user message's ID.

### **3. Frontend State (`app/chat/[[...id]]/page.tsx`)**
- **State Structure:**
    - Instead of just `messages: Message[]`, we need `messageTree` (all messages) and `currentLeafId` (the pointer to the end of the current conversation).
    - `derivedMessages`: A computed list of messages derived by tracing `currentLeafId` back to the root.
- **UI Components:**
    - **Edit Mode:** A UI to modify a user message.
    - **Branch Switcher:** Small navigation (`< 2/3 >`) on messages that have multiple children (siblings).

---

## **Implementation Steps**

### **Phase 1: Database & Backend Core**
- [ ] **Schema Migration:** Add `parent_id` column to `message` table.
- [ ] **Data Migration Script:** Link existing messages sequentially (Message `i` parent is Message `i-1`).
- [ ] **Update `db_append_message`:** Accept `parent_id`.
- [ ] **Create `db_get_messages_by_chat`:** Fetch all messages (raw) to let frontend/backend logic build the tree.
- [ ] **Create `db_get_leaf_messages`:** (Optional) Helper to find the "tips" of the branches.

### **Phase 2: Backend API Updates**
- [ ] **Refactor `POST /api/chat`:**
    - Accept `parent_message_id` in the request body.
    - Use `parent_message_id` to fetch the specific context (history trace) for the LLM.
    - Append the new User Message and AI Response linked to that `parent_message_id`.
- [ ] **Refactor `GET /api/chats_proxy`:** Ensure it returns the full tree or a format the frontend can parse.

### **Phase 3: Frontend Logic (The Hard Part)**
- [ ] **Tree Reconstruction:** Utility function to turn a flat list of `[id, parent_id, ...]` into a traversable structure or simply a "Get Thread" helper.
- [ ] **Navigation Logic:** "Editing" a message doesn't update it; it creates a NEW message with the same `parent_id` as the original.
- [ ] **Visuals:** Render the linear thread based on `currentLeafId`.

### **Phase 4: UI Components**
- [ ] **Copy Button:** Simple clipboard action.
- [ ] **Edit Button:** Enters edit mode. Saving triggers the "New Branch" logic.
- [ ] **Branch Navigation:** Component to switch between sibling messages.

---

## **Progress Tracking**

- [ ] Phase 1: Database & Backend Core
- [ ] Phase 2: Backend API Updates
- [ ] Phase 3: Frontend Logic
- [ ] Phase 4: UI Components

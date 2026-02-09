import Database from 'better-sqlite3';
import path from 'path';
import { Chat, Message } from './types';

export type { Chat, Message };

const DRIVE_ROOT = path.join(process.cwd(), "drive_data");
const DB_PATH = path.join(DRIVE_ROOT, "think.db");

// Initialize DB (synchronous in better-sqlite3)
const db = new Database(DB_PATH, { verbose: console.log });
db.pragma('journal_mode = WAL');

// Recreate tables if they don't exist (Migration logic)

// Recreate tables if they don't exist (Migration logic)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at REAL,
      updated_at REAL,
      summary TEXT
    );
    CREATE TABLE IF NOT EXISTS message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at REAL,
      type TEXT DEFAULT 'text',
      tool_call_id TEXT,
      tool_name TEXT,
      tool_args TEXT,
      parent_id INTEGER,
      FOREIGN KEY(chat_id) REFERENCES chat(id),
      FOREIGN KEY(parent_id) REFERENCES message(id)
    );
  `);
  
  // Migration: Add summary column if missing
  try {
    db.exec('ALTER TABLE chat ADD COLUMN summary TEXT');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) console.error("Failed to add summary column:", e);
  }

  // Migration: Add parent_id column if missing
  let parentIdExists = false;
  try {
    const tableInfo = db.prepare("PRAGMA table_info(message)").all() as any[];
    parentIdExists = tableInfo.some(col => col.name === 'parent_id');
    
    if (!parentIdExists) {
      console.log("Migrating database: Adding parent_id to message table...");
      db.exec('ALTER TABLE message ADD COLUMN parent_id INTEGER REFERENCES message(id)');
      
      // DATA MIGRATION: Link existing messages sequentially
      // For each chat, we want to link id N to id N-1
      const chats = db.prepare("SELECT id FROM chat").all() as {id: string}[];
      
      const updateStmt = db.prepare("UPDATE message SET parent_id = ? WHERE id = ?");
      
      for (const chat of chats) {
        const messages = db.prepare("SELECT id FROM message WHERE chat_id = ? ORDER BY id ASC").all(chat.id) as {id: number}[];
        
        let prevId: number | null = null;
        for (const msg of messages) {
          if (prevId !== null) {
            updateStmt.run(prevId, msg.id);
          }
          prevId = msg.id;
        }
      }
      console.log("Migration complete: Linked existing messages.");
    }
  } catch (e: any) {
    console.error("Failed to migrate parent_id:", e);
  }

} catch (err) {
  console.error("Failed to initialize database tables:", err);
}

// --- CRUD Operations ---

export function db_list_chats(): Chat[] {
  const stmt = db.prepare('SELECT * FROM chat ORDER BY updated_at DESC');
  return stmt.all() as Chat[];
}

// Fetch all messages for a chat (raw flat list) - used for tree reconstruction
export function db_get_messages_flat(chat_id: string): Message[] {
  const stmt = db.prepare('SELECT * FROM message WHERE chat_id = ? ORDER BY id ASC');
  return stmt.all(chat_id) as Message[];
}

// Get the conversation thread ending at a specific message (Leaf -> Root)
// Returns array ordered chronologically (Root -> Leaf)
export function db_get_thread(leaf_id: number): Message[] {
  const stmt = db.prepare(`
    WITH RECURSIVE thread(id, chat_id, role, content, created_at, type, tool_call_id, tool_name, tool_args, parent_id) AS (
      SELECT id, chat_id, role, content, created_at, type, tool_call_id, tool_name, tool_args, parent_id
      FROM message WHERE id = ?
      UNION ALL
      SELECT m.id, m.chat_id, m.role, m.content, m.created_at, m.type, m.tool_call_id, m.tool_name, m.tool_args, m.parent_id
      FROM message m
      JOIN thread t ON m.id = t.parent_id
    )
    SELECT * FROM thread ORDER BY id ASC;
  `);
  return stmt.all(leaf_id) as Message[];
}

// Legacy support / Simple linear fetch (deprecated for tree view, but useful for basic history)
export function db_get_history(chat_id: string): Message[] {
  return db_get_messages_flat(chat_id);
}

export function db_create_chat(chat_id: string, title?: string) {
  const now = Date.now() / 1000;
  const exists = db.prepare('SELECT id FROM chat WHERE id = ?').get(chat_id);

  if (!exists) {
    const stmt = db.prepare('INSERT INTO chat (id, title, updated_at) VALUES (?, ?, ?)');
    stmt.run(chat_id, title || "New Chat", now);
  } else if (title) {
    const stmt = db.prepare('UPDATE chat SET title = ?, updated_at = ? WHERE id = ?');
    stmt.run(title, now, chat_id);
  } else {
    const stmt = db.prepare('UPDATE chat SET updated_at = ? WHERE id = ?');
    stmt.run(now, chat_id);
  }
}

export function db_append_message(
  chat_id: string,
  role: string,
  content: string,
  type: string = "text",
  tool_call_id?: string,
  tool_name?: string,
  tool_args?: string,
  parent_id?: number | null // New Parameter
): number {
  const now = Date.now() / 1000;

  const exists = db.prepare('SELECT id FROM chat WHERE id = ?').get(chat_id);
  if (!exists) {
    const title = (role === 'user' ? content.slice(0, 30) : "New Chat");
    db_create_chat(chat_id, title);
  } else {
    db_create_chat(chat_id); 
  }

  const stmt = db.prepare(`
        INSERT INTO message (chat_id, role, content, created_at, type, tool_call_id, tool_name, tool_args, parent_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

  const info = stmt.run(
    chat_id,
    role,
    content,
    now,
    type,
    tool_call_id || null,
    tool_name || null,
    tool_args || null,
    parent_id !== undefined ? parent_id : null
  );
  
  return info.lastInsertRowid as number;
}

export function db_delete_chat(chat_id: string) {
  // Use a transaction to ensure both operations succeed or fail together
  const delete_transaction = db.transaction(() => {
    // Delete all messages associated with the chat
    db.prepare('DELETE FROM message WHERE chat_id = ?').run(chat_id);
    // Delete the chat itself
    db.prepare('DELETE FROM chat WHERE id = ?').run(chat_id);
  });
  delete_transaction();
}

export function db_update_chat_title(chat_id: string, new_title: string) {
  const now = Date.now() / 1000;
  const stmt = db.prepare('UPDATE chat SET title = ?, updated_at = ? WHERE id = ?');
  stmt.run(new_title, now, chat_id);
}

export function db_get_chat_summary(chat_id: string): object | null {
  const stmt = db.prepare('SELECT summary FROM chat WHERE id = ?');
  const row = stmt.get(chat_id) as { summary: string | null } | undefined;
  if (row && row.summary) {
    try {
      return JSON.parse(row.summary);
    } catch {
      return null;
    }
  }
  return null;
}

export function db_update_chat_summary(chat_id: string, summary: object) {
  const stmt = db.prepare('UPDATE chat SET summary = ? WHERE id = ?');
  stmt.run(JSON.stringify(summary), chat_id);
}

export { db };
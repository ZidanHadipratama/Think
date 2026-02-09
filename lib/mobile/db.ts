import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'think_mobile_db';

let sqlite: SQLiteConnection | null = null;
let db: SQLiteDBConnection | null = null;

async function initDB() {
  if (db) return db;

  sqlite = new SQLiteConnection(CapacitorSQLite);
  
  // Check if we can create a connection
  const ret = await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

  if (ret.result && isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false);
  } else {
    db = await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  }

  await db.open();

  // Schema Migration
  const schema = `
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
  `;
  
  await db.execute(schema);
  
  return db;
}

export const MobileDB = {
  async init() {
    return await initDB();
  },

  async listChats() {
    const _db = await initDB();
    const res = await _db.query('SELECT * FROM chat ORDER BY updated_at DESC');
    return res.values || [];
  },

  async getMessagesFlat(chatId: string) {
    const _db = await initDB();
    const res = await _db.query('SELECT * FROM message WHERE chat_id = ? ORDER BY id ASC', [chatId]);
    return res.values || [];
  },

  async getThread(leafId: number) {
    const _db = await initDB();
    // Recursive CTE support in SQLite depends on version, but usually supported on mobile
    const query = `
    WITH RECURSIVE thread(id, chat_id, role, content, created_at, type, tool_call_id, tool_name, tool_args, parent_id) AS (
      SELECT id, chat_id, role, content, created_at, type, tool_call_id, tool_name, tool_args, parent_id
      FROM message WHERE id = ?
      UNION ALL
      SELECT m.id, m.chat_id, m.role, m.content, m.created_at, m.type, m.tool_call_id, m.tool_name, m.tool_args, m.parent_id
      FROM message m
      JOIN thread t ON m.id = t.parent_id
    )
    SELECT * FROM thread ORDER BY id ASC;
    `;
    const res = await _db.query(query, [leafId]);
    return res.values || [];
  },

  async createChat(chatId: string, title?: string) {
    const _db = await initDB();
    const now = Date.now() / 1000;
    
    // Check exist
    const check = await _db.query('SELECT id FROM chat WHERE id = ?', [chatId]);
    if (check.values && check.values.length > 0) {
       if (title) {
         await _db.run('UPDATE chat SET title = ?, updated_at = ? WHERE id = ?', [title, now, chatId]);
       } else {
         await _db.run('UPDATE chat SET updated_at = ? WHERE id = ?', [now, chatId]);
       }
    } else {
       await _db.run('INSERT INTO chat (id, title, updated_at) VALUES (?, ?, ?)', [chatId, title || "New Chat", now]);
    }
  },

  async appendMessage(
    chatId: string,
    role: string,
    content: string,
    type: string = "text",
    toolCallId?: string,
    toolName?: string,
    toolArgs?: string,
    parentId?: number | null
  ) {
    const _db = await initDB();
    const now = Date.now() / 1000;

    // Ensure chat exists
    const check = await _db.query('SELECT id FROM chat WHERE id = ?', [chatId]);
    if (!check.values || check.values.length === 0) {
       const title = (role === 'user' ? content.slice(0, 30) : "New Chat");
       await this.createChat(chatId, title);
    } else {
       await this.createChat(chatId);
    }

    const res = await _db.run(`
        INSERT INTO message (chat_id, role, content, created_at, type, tool_call_id, tool_name, tool_args, parent_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      chatId,
      role,
      content,
      now,
      type,
      toolCallId || null,
      toolName || null,
      toolArgs || null,
      parentId !== undefined ? parentId : null
    ]);

    // get last id
    const lastId = await _db.query('SELECT last_insert_rowid() as id');
    return lastId.values?.[0]?.id as number;
  },

  async deleteChat(chatId: string) {
    const _db = await initDB();
    await _db.run('DELETE FROM message WHERE chat_id = ?', [chatId]);
    await _db.run('DELETE FROM chat WHERE id = ?', [chatId]);
  },
  
  async updateChatTitle(chatId: string, title: string) {
    const _db = await initDB();
    const now = Date.now() / 1000;
    await _db.run('UPDATE chat SET title = ?, updated_at = ? WHERE id = ?', [title, now, chatId]);
  },

  async getChatSummary(chatId: string) {
    const _db = await initDB();
    const res = await _db.query('SELECT summary FROM chat WHERE id = ?', [chatId]);
    if (res.values && res.values.length > 0 && res.values[0].summary) {
        try {
            return JSON.parse(res.values[0].summary);
        } catch { return null; }
    }
    return null;
  },

  async updateChatSummary(chatId: string, summary: object) {
    const _db = await initDB();
    await _db.run('UPDATE chat SET summary = ? WHERE id = ?', [JSON.stringify(summary), chatId]);
  }
};

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'drive_data', 'think.db');
const db = new Database(dbPath);

const latestChat = db.prepare('SELECT * FROM chat ORDER BY updated_at DESC LIMIT 1').get();

if (!latestChat) {
  console.log("No chats found.");
} else {
  console.log("=== LATEST CHAT METADATA ===");
  console.log(JSON.stringify(latestChat, null, 2));

  const messages = db.prepare('SELECT * FROM message WHERE chat_id = ? ORDER BY id ASC').all(latestChat.id);
  
  console.log("\n=== MESSAGES ===");
  // Print messages in a simplified format to spot issues, but keep key fields
  messages.forEach((m: any) => {
    console.log(`\n[${m.id}] ${m.role} (${m.type})`);
    if (m.content) console.log(`Content: ${m.content}`);
    if (m.tool_call_id) console.log(`Tool Call ID: ${m.tool_call_id}`);
    if (m.tool_name) console.log(`Tool Name: ${m.tool_name}`);
    if (m.tool_args) console.log(`Tool Args: ${m.tool_args}`);
  });
}


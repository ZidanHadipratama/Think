import { db_create_chat, db_append_message, db_get_thread } from './lib/db';
import { v4 as uuidv4 } from 'uuid';

const chatId = uuidv4();
console.log(`Creating Test Chat: ${chatId}`);

// 1. Create Root Message
// parent_id is explicitly null for the first message
const rootMsgId = db_append_message(chatId, 'user', 'Root Message (A)', 'text', undefined, undefined, undefined, null);
console.log(`Created Root Message (A): ID ${rootMsgId}`);

// 2. Create First Branch (B) -> Reply to A
const branchB_Id = db_append_message(chatId, 'assistant', 'Reply B (Child of A)', 'text', undefined, undefined, undefined, rootMsgId);
console.log(`Created Reply (B): ID ${branchB_Id} (Parent: ${rootMsgId})`);

// 3. Create Second Branch (C) -> Reply to A (Fork!)
const branchC_Id = db_append_message(chatId, 'assistant', 'Reply C (Child of A - Fork)', 'text', undefined, undefined, undefined, rootMsgId);
console.log(`Created Reply (C): ID ${branchC_Id} (Parent: ${rootMsgId})`);

// 4. Verify Threads
const threadB = db_get_thread(branchB_Id);
const threadC = db_get_thread(branchC_Id);

console.log(`
--- Thread Ending in B (Length: ${threadB.length}) ---`);
threadB.forEach(m => console.log(`[${m.id}] ${m.content}`));

console.log(`
--- Thread Ending in C (Length: ${threadC.length}) ---`);
threadC.forEach(m => console.log(`[${m.id}] ${m.content}`));

if (threadB.length === 2 && threadC.length === 2 && threadB[1].content.includes('B') && threadC[1].content.includes('C')) {
  console.log("\n✅ SUCCESS: Branching logic is working correctly in DB.");
} else {
  console.error("\n❌ FAILED: Threads did not form correctly.");
}

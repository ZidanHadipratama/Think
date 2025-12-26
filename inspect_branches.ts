import { db_get_messages_flat } from './lib/db';

const chatId = '0711aa93-801c-404c-a7a0-89b37cf0cbae';
const messages = db_get_messages_flat(chatId);

console.log(`--- Inspecting Branches for Chat: ${chatId} ---`);

// 1. Group by Parent ID
const childrenMap: Record<string, any[]> = {};
messages.forEach(m => {
  const pid = m.parent_id !== null ? String(m.parent_id) : 'ROOT';
  if (!childrenMap[pid]) childrenMap[pid] = [];
  childrenMap[pid].push(m);
});

// 2. Detect Branches
let branchCount = 0;
Object.entries(childrenMap).forEach(([pid, children]) => {
  if (children.length > 1) {
    branchCount++;
    console.log(`
🔀 BRANCH DETECTED at Parent ${pid}:`);
    children.forEach(c => console.log(`   - [ID ${c.id}] (${c.role}): ${c.content.substring(0, 50)}...`));
  }
});

if (branchCount === 0) {
  console.log("\nNo branches found. This chat is linear.");
} else {
  console.log(`
Found ${branchCount} branching points.`);
}

console.log("\n--- Full Message List ---");
messages.forEach(m => {
  console.log(`[ID ${m.id}] Parent: ${m.parent_id} | Role: ${m.role}`);
});

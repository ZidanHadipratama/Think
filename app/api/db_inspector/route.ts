import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chat_id');

    if (chatId) {
      // detailed view for a specific chat
      const chat_stmt = db.prepare("SELECT * FROM chat WHERE id = ?");
      const chat = chat_stmt.get(chatId);

      if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }

      const messages_stmt = db.prepare("SELECT * FROM message WHERE chat_id = ? ORDER BY id ASC");
      const messages = messages_stmt.all(chatId);

      return NextResponse.json({
        type: 'chat_detail',
        chat: chat,
        messages: messages
      });
    } else {
      // List view
      const chats_stmt = db.prepare("SELECT * FROM chat ORDER BY updated_at DESC LIMIT 50");
      const chats = chats_stmt.all();

      return NextResponse.json({
        type: 'chat_list',
        count: chats.length,
        chats: chats
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

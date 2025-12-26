import { NextRequest, NextResponse } from "next/server";
import { db_list_chats, db_get_history, db_delete_chat, db_update_chat_title } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('id');

    if (sessionId) {
      const history = db_get_history(sessionId);
      return NextResponse.json({ messages: history });
    } else {
      const chats = db_list_chats();
      return NextResponse.json({ chats });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json({ error: "Missing chat ID" }, { status: 400 });
    }

    db_delete_chat(sessionId);
    return NextResponse.json({ message: "Chat deleted successfully" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('id');
    const { title } = await req.json();

    if (!sessionId || !title) {
      return NextResponse.json({ error: "Missing chat ID or title" }, { status: 400 });
    }

    db_update_chat_title(sessionId, title);
    return NextResponse.json({ message: "Chat renamed successfully" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to rename chat" }, { status: 500 });
  }
}

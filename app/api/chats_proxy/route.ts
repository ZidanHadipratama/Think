import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('id');
    const url = sessionId
      ? `http://127.0.0.1:8000/chats/${sessionId}`
      : `http://127.0.0.1:8000/chats`;

    const pythonRes = await fetch(url);
    if (!pythonRes.ok) throw new Error("Backend Error");
    const data = await pythonRes.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}

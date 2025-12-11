import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Proxy to Python Backend
    const pythonRes = await fetch("http://127.0.0.1:8000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!pythonRes.ok) {
      throw new Error(`Python backend error: ${pythonRes.statusText}`);
    }

    const data = await pythonRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Chat Error:", err);
    return NextResponse.json({
      role: 'assistant',
      content: "Error connecting to AI service. Please ensure the Python backend is running."
    }, { status: 500 });
  }
}

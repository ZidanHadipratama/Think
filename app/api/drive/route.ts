import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DRIVE_ROOT = path.join(process.cwd(), "drive_data");

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const relPath = searchParams.get("path") || "";

  // Prevent traversal
  if (relPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const dirPath = path.join(DRIVE_ROOT, relPath);

  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const items = entries
      .filter(entry => !entry.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "folder" : "file",
        path: path.join(relPath, entry.name),
      }));

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: "Directory not found or error reading" }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderPath } = body;

    if (!folderPath) {
      return NextResponse.json({ error: "Folder path required" }, { status: 400 });
    }

    if (folderPath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fullPath = path.join(DRIVE_ROOT, folderPath);
    await fs.mkdir(fullPath, { recursive: true });

    return NextResponse.json({ success: true, path: folderPath });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}

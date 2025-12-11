import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DRIVE_ROOT = path.join(process.cwd(), "drive_data");

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const relPath = searchParams.get("path");

  if (!relPath || relPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const filePath = path.join(DRIVE_ROOT, relPath);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filePath, content } = body;

    if (!filePath || filePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fullPath = path.join(DRIVE_ROOT, filePath);

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, content, "utf-8");

    return NextResponse.json({ success: true, path: filePath });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { oldPath, newPath } = body;

    if (!oldPath || !newPath || oldPath.includes("..") || newPath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fullOldPath = path.join(DRIVE_ROOT, oldPath);
    const fullNewPath = path.join(DRIVE_ROOT, newPath);

    // Check if old exists
    try {
      await fs.access(fullOldPath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check if new already exists (don't overwrite silently?)
    // For simplicity, let's allow overwrite or maybe fs.rename just overwrites.
    // fs.rename(oldPath, newPath)

    await fs.rename(fullOldPath, fullNewPath);

    return NextResponse.json({ success: true, oldPath, newPath });

  } catch (err) {
    return NextResponse.json({ error: "Failed to rename file" }, { status: 500 });
  }
}

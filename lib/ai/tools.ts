import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";

const DRIVE_ROOT = path.join(process.cwd(), "drive_data");

// Helper: Ensure we don't escape DRIVE_ROOT
function getSafePath(relPath: string): string {
  // Basic sanitization
  let cleanPath = relPath.trim();
  if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);

  const fullPath = path.join(DRIVE_ROOT, cleanPath);

  // Prevent traversal
  if (!fullPath.startsWith(DRIVE_ROOT)) {
    throw new Error(`Access denied: ${relPath} is outside the allowed directory.`);
  }
  return fullPath;
}

export const listFilesTool = tool(
  async ({ path: relPath = "." }: { path?: string }) => {
    try {
      const targetPath = getSafePath(relPath);

      if (!fs.existsSync(targetPath)) return `Error: Path '${relPath}' does not exist.`;
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) return `Error: '${relPath}' is not a directory.`;

      const generateTree = (currentPath: string, indent: string = ""): string => {
        const items = fs.readdirSync(currentPath);
        if (items.length === 0) return "";

        let output = "";
        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          try {
            const itemStats = fs.statSync(itemPath);
            const isDir = itemStats.isDirectory();

            output += `${indent}${isDir ? "[DIR] " : "[FILE] "}${item}\n`;

            if (isDir) {
              output += generateTree(itemPath, indent + "  ");
            }
          } catch {
            // Ignore inaccessible files/dirs
          }
        }
        return output;
      };

      const tree = generateTree(targetPath);
      return tree.trim() || "Directory is empty.";

    } catch (error: any) {
      return `Error listing files: ${error.message}`;
    }
  },
  {
    name: "list_files",
    description: "List files and directories in a tree-like format from the given path. Use '.' for the root directory.",
    schema: z.object({
      path: z.string().optional().describe("The directory path to list (relative to the drive root). Defaults to '.'"),
    }),
  }
);

export const readFileTool = tool(
  async ({ path: relPath }: { path: string }) => {
    try {
      const targetPath = getSafePath(relPath);
      if (!fs.existsSync(targetPath)) return `Error: File '${relPath}' not found.`;

      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) return `Error: '${relPath}' is a directory, not a file.`;

      // Binary check (rudimentary)
      const ext = path.extname(targetPath).toLowerCase();
      const binaryExts = ['.db', '.png', '.jpg', '.jpeg', '.zip', '.exe', '.pdf'];
      if (binaryExts.includes(ext)) {
        return `Error: Cannot read binary file '${relPath}'.`;
      }

      const content = fs.readFileSync(targetPath, 'utf-8');
      return content;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  },
  {
    name: "read_file",
    description: "Read the content of a text file.",
    schema: z.object({
      path: z.string().describe("The path of the file to read."),
    }),
  }
);

export const writeToFileTool = tool(
  async ({ path: relPath, content }: { path: string, content: string }) => {
    try {
      const targetPath = getSafePath(relPath);

      // Ensure parent directory exists
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(targetPath, content, 'utf-8');
      return `Successfully wrote to ${relPath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  },
  {
    name: "write_file",
    description: "Write content to a file. Overwrites if exists.",
    schema: z.object({
      path: z.string().describe("The file path to write to."),
      content: z.string().describe("The textual content to write."),
    }),
  }
);

export const deleteFileTool = tool(
  async ({ path: relPath }: { path: string }) => {
    try {
      const targetPath = getSafePath(relPath);
      if (!fs.existsSync(targetPath)) return `Error: Path '${relPath}' does not exist.`;

      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        return `Successfully deleted directory ${relPath}`;
      } else {
        fs.unlinkSync(targetPath);
        return `Successfully deleted file ${relPath}`;
      }
    } catch (error: any) {
      return `Error deleting: ${error.message}`;
    }
  },
  {
    name: "delete_file",
    description: "Delete a file or directory. Be careful.",
    schema: z.object({
      path: z.string().describe("The path to delete."),
    }),
  }
);

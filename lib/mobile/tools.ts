import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mobileFilesystem } from "./filesystem";

export const mobileListFilesTool = tool(
  async ({ path: relPath = "." }: { path?: string }) => {
    try {
      const items = await mobileFilesystem.listFiles(relPath);
      if (items.length === 0) return "Directory is empty.";

      // recursive tree generation not easily done with flat list, 
      // but for now let's just list the current dir content or implement rudimentary recursion if needed
      // To keep it simple and safe for mobile perf, we might just list the target dir
      
      let output = "";
      for (const item of items) {
          output += `[${item.type === 'folder' ? 'DIR' : 'FILE'}] ${item.name}\n`;
      }
      return output.trim();
    } catch (error: any) {
      return `Error listing files: ${error.message}`;
    }
  },
  {
    name: "list_files",
    description: "List files and directories in the current directory.",
    schema: z.object({
      path: z.string().optional().describe("The directory path to list (relative to drive root). Defaults to '.'"),
    }),
  }
);

export const mobileReadFileTool = tool(
  async ({ path: relPath }: { path: string }) => {
    try {
      const content = await mobileFilesystem.readFile(relPath);
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

export const mobileWriteToFileTool = tool(
  async ({ path: relPath, content }: { path: string, content: string }) => {
    try {
      await mobileFilesystem.writeFile(relPath, content);
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

export const mobileDeleteFileTool = tool(
  async ({ path: relPath }: { path: string }) => {
    try {
      await mobileFilesystem.deleteFile(relPath);
      return `Successfully deleted ${relPath}`;
    } catch (error: any) {
      return `Error deleting: ${error.message}`;
    }
  },
  {
    name: "delete_file",
    description: "Delete a file or directory.",
    schema: z.object({
      path: z.string().describe("The path to delete."),
    }),
  }
);

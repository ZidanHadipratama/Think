import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const ROOT_FOLDER = 'drive_data';

// Helper to ensure the root folder exists
async function ensureRoot() {
  try {
    await Filesystem.stat({
      path: ROOT_FOLDER,
      directory: Directory.Documents,
    });
  } catch (e) {
    // If not found, create it
    await Filesystem.mkdir({
      path: ROOT_FOLDER,
      directory: Directory.Documents,
      recursive: true,
    });
  }
}

// Ensure root exists on load
ensureRoot();

export const mobileFilesystem = {
  async listFiles(relPath: string = '.') {
    await ensureRoot();
    const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    const finalPath = `${ROOT_FOLDER}/${cleanPath === '.' ? '' : cleanPath}`;

    try {
      const res = await Filesystem.readdir({
        path: finalPath,
        directory: Directory.Documents,
      });

      // Format to match our app's expected interface
      // native result is { files: FileInfo[] }
      // FileInfo = { name, type, size, mtime, uri }
      // We want { name, type: 'file' | 'folder', path }
      
      return res.files.map(f => ({
        name: f.name,
        type: (f.type === 'directory' ? 'folder' : 'file') as 'folder' | 'file',
        path: `${cleanPath === '.' ? '' : cleanPath + '/'}${f.name}`
      }));
    } catch (e) {
      console.error("MobileFS List Error:", e);
      return [];
    }
  },

  async readFile(relPath: string) {
    await ensureRoot();
    const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    const finalPath = `${ROOT_FOLDER}/${cleanPath}`;

    try {
      const res = await Filesystem.readFile({
        path: finalPath,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return res.data as string;
    } catch (e) {
      throw new Error(`File not found: ${relPath}`);
    }
  },

  async writeFile(relPath: string, content: string) {
    await ensureRoot();
    const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    const finalPath = `${ROOT_FOLDER}/${cleanPath}`;

    // Ensure parent dir exists (simple recursive mkdir for parent)
    const parentDir = finalPath.substring(0, finalPath.lastIndexOf('/'));
    if (parentDir && parentDir !== ROOT_FOLDER) {
        try {
            await Filesystem.mkdir({
                path: parentDir,
                directory: Directory.Documents,
                recursive: true
            });
        } catch (e) {
            // Ignore if already exists
        }
    }

    await Filesystem.writeFile({
      path: finalPath,
      directory: Directory.Documents,
      data: content,
      encoding: Encoding.UTF8,
      recursive: true // actually only works for mkdir in some versions, but writeFile creates file
    });
  },

  async deleteFile(relPath: string) {
    await ensureRoot();
    const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    const finalPath = `${ROOT_FOLDER}/${cleanPath}`;

    await Filesystem.deleteFile({
      path: finalPath,
      directory: Directory.Documents,
    });
  }
};

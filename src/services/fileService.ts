import fs from 'fs';
import path from 'path';

/**
 * Attempts to read a PDF from local disk storage.
 * Checks the driveFileId as a literal path, resolved path, and under uploads/.
 * Returns the file buffer if found, or null if not available locally.
 */
export function tryReadLocalFile(driveFileId: string): Buffer | null {
  const candidatePaths = [
    driveFileId,
    path.resolve(driveFileId),
    path.join(process.cwd(), 'uploads', driveFileId),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return fs.readFileSync(candidate);
      }
    } catch {
      // path doesn't exist or isn't readable, continue
    }
  }

  return null;
}

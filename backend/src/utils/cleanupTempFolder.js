import fs from 'node:fs/promises';

export async function cleanupTempFolder(folderPath) {
  if (!folderPath) return;
  await fs.rm(folderPath, { recursive: true, force: true });
}

import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

export function filterImageFiles(files: string[], extensions: string[]) {
  const allowed = new Set(extensions.map((item) => item.toLowerCase()))
  return files.filter((file) => allowed.has(extname(file).toLowerCase()))
}

export function getImageMimeType(file: string) {
  switch (extname(file).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

export async function collectImageFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const nextPath = join(root, entry.name)
    if (entry.isDirectory()) return collectImageFiles(nextPath)
    return [nextPath]
  }))
  return nested.flat()
}

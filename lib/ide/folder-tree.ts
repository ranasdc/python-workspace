/**
 * Folders inside folders, for every IDE at once.
 *
 * Storage is flat: each folder row names its parent and each file names its
 * folder. Everything that needs the nested shape goes through this module — a
 * pupil's workspace, a teacher's library, the class view and distribution —
 * so they cannot disagree about what a tree looks like.
 *
 * Nothing here knows which IDE it is working for. Callers scope their rows by
 * `language` before handing them over, so an IDE added to the registry nests
 * its folders the day it ships, with no change in this file.
 */

/**
 * How many folders deep a tree may go. A top-level folder is level 1.
 *
 * Deep enough for course / unit / lesson / task with one to spare, and shallow
 * enough that the narrow file panel can still show a name at the bottom level.
 */
export const MAX_FOLDER_DEPTH = 5

export type FolderRecord = {
  id: number
  parentId: number | null
  name: string
}

export type FiledRecord = {
  folderId: number | null
}

export type FolderNode<TFolder, TFile> = TFolder & {
  /** 1 for a top-level folder. */
  depth: number
  folders: FolderNode<TFolder, TFile>[]
  files: TFile[]
}

type Tree<TFile> = { files: TFile[]; folders: Tree<TFile>[] }

/**
 * Turn flat rows into a nested tree. Input order is kept at every level, so
 * rows sorted by name come back sorted by name.
 */
export function buildFolderTree<TFolder extends FolderRecord, TFile extends FiledRecord>(
  folders: TFolder[],
  files: TFile[],
): { folders: FolderNode<TFolder, TFile>[]; rootFiles: TFile[] } {
  const rootFiles: TFile[] = []
  const filesIn = new Map<number, TFile[]>()
  for (const file of files) {
    if (file.folderId === null) {
      rootFiles.push(file)
      continue
    }
    const bucket = filesIn.get(file.folderId)
    if (bucket) bucket.push(file)
    else filesIn.set(file.folderId, [file])
  }

  const known = new Set(folders.map((f) => f.id))
  const childrenOf = new Map<number, TFolder[]>()
  const topLevel: TFolder[] = []
  for (const folder of folders) {
    const parentId = folder.parentId
    // A folder whose parent is not in this set is shown at the top rather than
    // dropped: losing sight of a folder also loses sight of the work inside it.
    if (parentId === null || parentId === folder.id || !known.has(parentId)) {
      topLevel.push(folder)
      continue
    }
    const bucket = childrenOf.get(parentId)
    if (bucket) bucket.push(folder)
    else childrenOf.set(parentId, [folder])
  }

  const placed = new Set<number>()
  const place = (folder: TFolder, depth: number): FolderNode<TFolder, TFile> => {
    placed.add(folder.id)
    const node: FolderNode<TFolder, TFile> = {
      ...folder,
      depth,
      folders: [],
      files: filesIn.get(folder.id) ?? [],
    }
    for (const child of childrenOf.get(folder.id) ?? []) {
      if (!placed.has(child.id)) node.folders.push(place(child, depth + 1))
    }
    return node
  }

  const roots = topLevel.map((folder) => place(folder, 1))

  // Folders that point at each other in a loop have no top-level member, so
  // nothing above reaches them. Nothing in the product can create that, but a
  // tree that silently hid them would hide their files too.
  for (const folder of folders) {
    if (!placed.has(folder.id)) roots.push(place(folder, 1))
  }

  return { folders: roots, rootFiles }
}

/**
 * A folder's id followed by the id of every folder beneath it.
 *
 * Parents always come before their children, which is the order distribution
 * needs: a pupil's copy of a folder must exist before anything is put in it.
 */
export function subtreeFolderIds(folders: FolderRecord[], folderId: number): number[] {
  const childrenOf = new Map<number, number[]>()
  for (const folder of folders) {
    if (folder.parentId === null) continue
    const bucket = childrenOf.get(folder.parentId)
    if (bucket) bucket.push(folder.id)
    else childrenOf.set(folder.parentId, [folder.id])
  }

  const ids: number[] = []
  const seen = new Set<number>()
  const queue = [folderId]
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    queue.push(...(childrenOf.get(id) ?? []))
  }
  return ids
}

/** How deep a folder sits: 1 at the top level, 0 if it is not in `folders`. */
export function folderDepth(folders: FolderRecord[], folderId: number): number {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const seen = new Set<number>()
  let depth = 0
  let current = byId.get(folderId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    depth += 1
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return depth
}

/** Whether a folder at this depth may be given a subfolder. */
export function canHoldSubfolder(depth: number): boolean {
  return depth < MAX_FOLDER_DEPTH
}

/** Shown wherever the depth limit is refused, so the wording stays in one place. */
export const FOLDER_DEPTH_MESSAGE = `Folders can be nested up to ${MAX_FOLDER_DEPTH} levels deep.`

/** Every file in these folders and the folders inside them. */
export function filesInTree<TFile>(nodes: Tree<TFile>[]): TFile[] {
  return nodes.flatMap((node) => [...node.files, ...filesInTree(node.folders)])
}

/** Files in a folder, counting the ones in its subfolders. */
export function countFilesDeep<TFile>(node: Tree<TFile>): number {
  return node.files.length + node.folders.reduce((sum, child) => sum + countFilesDeep(child), 0)
}

type NamedTree = { id: number; name: string; depth: number; folders: NamedTree[] }

/**
 * Every folder in the tree with its full path, parents before children. Used
 * where a folder has to be picked from a list rather than a tree.
 */
export function folderPaths(
  nodes: NamedTree[],
  parentPath = "",
): { id: number; path: string; depth: number }[] {
  return nodes.flatMap((node) => {
    const path = parentPath ? `${parentPath} / ${node.name}` : node.name
    return [{ id: node.id, path, depth: node.depth }, ...folderPaths(node.folders, path)]
  })
}

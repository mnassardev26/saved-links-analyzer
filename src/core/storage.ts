import { categorizeItem } from "./categorizer"
import { stableItemId } from "./normalize"
import type { SavedItem, SavedItemDraft, SavedItemUpdate } from "./types"

const STORAGE_KEY = "saved_links_analyzer_items"

type StoredItems = Record<string, SavedItem>

export async function getStoredItems(): Promise<StoredItems> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const value = result[STORAGE_KEY]
  return isStoredItems(value) ? value : {}
}

export async function setStoredItems(items: StoredItems): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: items })
}

export async function mergeDrafts(drafts: SavedItemDraft[]): Promise<SavedItem[]> {
  const stored = await getStoredItems()
  const now = new Date().toISOString()

  for (const draft of drafts) {
    const id = stableItemId(draft.canonicalUrl)
    const existing = stored[id]
    const analysis = categorizeItem(draft)

    stored[id] = {
      ...draft,
      id,
      title: firstUseful(existing?.title, draft.title),
      description: firstUseful(existing?.description, draft.description),
      thumbnailUrl: firstUseful(existing?.thumbnailUrl, draft.thumbnailUrl),
      sourceName: firstUseful(existing?.sourceName, draft.sourceName),
      itemType: firstUseful(existing?.itemType, draft.itemType),
      videoDuration: firstUseful(existing?.videoDuration, draft.videoDuration),
      category: existing?.category ?? analysis.category,
      keywords: existing?.keywords?.length ? existing.keywords : analysis.keywords,
      notes: existing?.notes ?? "",
      favorite: existing?.favorite ?? false,
      collectedAt: existing?.collectedAt ?? draft.collectedAt,
      updatedAt: now
    }
  }

  await setStoredItems(stored)
  return Object.values(stored)
}

export async function updateItems(ids: string[], update: SavedItemUpdate): Promise<SavedItem[]> {
  const stored = await getStoredItems()
  const now = new Date().toISOString()

  for (const id of ids) {
    if (!stored[id]) {
      continue
    }

    stored[id] = {
      ...stored[id],
      ...update,
      updatedAt: now
    }
  }

  await setStoredItems(stored)
  return Object.values(stored)
}

export async function deleteItems(ids: string[]): Promise<SavedItem[]> {
  const stored = await getStoredItems()

  for (const id of ids) {
    delete stored[id]
  }

  await setStoredItems(stored)
  return Object.values(stored)
}

export async function clearItems(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

function firstUseful(current?: string, next?: string): string | undefined {
  if (current && current.trim().length > 0) {
    return current
  }

  if (next && next.trim().length > 0) {
    return next
  }

  return undefined
}

function isStoredItems(value: unknown): value is StoredItems {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

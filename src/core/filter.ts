import { hostnameFromUrl } from "./normalize"
import type { SavedCategory, SavedItem } from "./types"

export type ItemFilters = {
  query: string
  category: "all" | SavedCategory
  itemType: string
  source: string
  collectedRange: "all" | "today" | "week" | "month"
  hasThumbnail: boolean
  hasDuration: boolean
  favoriteOnly: boolean
  missingMetadataOnly: boolean
}

export type SortKey = "collectedAt" | "title" | "sourceName" | "category"

export const DEFAULT_FILTERS: ItemFilters = {
  query: "",
  category: "all",
  itemType: "all",
  source: "all",
  collectedRange: "all",
  hasThumbnail: false,
  hasDuration: false,
  favoriteOnly: false,
  missingMetadataOnly: false
}

export function filterItems(items: SavedItem[], filters: ItemFilters): SavedItem[] {
  const query = filters.query.trim().toLowerCase()

  return items.filter((item) => {
    if (filters.category !== "all" && item.category !== filters.category) {
      return false
    }

    if (filters.itemType !== "all" && (item.itemType ?? "Unknown") !== filters.itemType) {
      return false
    }

    const source = (item.sourceName ?? hostnameFromUrl(item.url)) || "Unknown"

    if (filters.source !== "all" && source !== filters.source) {
      return false
    }

    if (!matchesCollectedRange(item.collectedAt, filters.collectedRange)) {
      return false
    }

    if (filters.hasThumbnail && !item.thumbnailUrl) {
      return false
    }

    if (filters.hasDuration && !item.videoDuration) {
      return false
    }

    if (filters.favoriteOnly && !item.favorite) {
      return false
    }

    if (filters.missingMetadataOnly && item.title && item.description && item.thumbnailUrl) {
      return false
    }

    if (!query) {
      return true
    }

    return [
      item.title,
      item.url,
      item.description,
      item.sourceName,
      item.category,
      item.itemType,
      item.keywords.join(" ")
    ].filter(Boolean).join(" ").toLowerCase().includes(query)
  })
}

function matchesCollectedRange(collectedAt: string, range: ItemFilters["collectedRange"]): boolean {
  if (range === "all") {
    return true
  }

  const collected = Date.parse(collectedAt)

  if (Number.isNaN(collected)) {
    return false
  }

  const ageMs = Date.now() - collected
  const dayMs = 24 * 60 * 60 * 1000

  if (range === "today") {
    return ageMs <= dayMs
  }

  if (range === "week") {
    return ageMs <= 7 * dayMs
  }

  return ageMs <= 30 * dayMs
}

export function sortItems(items: SavedItem[], sortKey: SortKey): SavedItem[] {
  return [...items].sort((left, right) => {
    if (sortKey === "collectedAt") {
      return right.collectedAt.localeCompare(left.collectedAt)
    }

    return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""))
  })
}

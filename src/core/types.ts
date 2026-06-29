export const CATEGORY_OPTIONS = [
  "Learning",
  "Work/Career",
  "Business/Money",
  "Food",
  "Health/Fitness",
  "Entertainment",
  "Travel",
  "Shopping",
  "Social/Personal",
  "Other"
] as const

export type SavedCategory = (typeof CATEGORY_OPTIONS)[number]

export type SavedPlatform = "facebook"

export type ScanStatus = "idle" | "scanning" | "paused" | "stopped" | "limit_reached" | "unsupported_page"

export type ScanSnapshot = {
  status: ScanStatus
  sessionCount: number
  totalKnown: number
  message: string
}

export type UnsaveStatus = "removed" | "couldnt_remove"

export type UnsaveResult = {
  canonicalUrl: string
  status: UnsaveStatus
  message?: string
}

export type SavedItemDraft = {
  platform: SavedPlatform
  url: string
  canonicalUrl: string
  title?: string
  description?: string
  thumbnailUrl?: string
  sourceName?: string
  itemType?: string
  videoDuration?: string
  collectedAt: string
}

export type SavedItem = SavedItemDraft & {
  id: string
  category: SavedCategory
  keywords: string[]
  notes: string
  favorite: boolean
  updatedAt: string
}

export type SavedItemUpdate = Partial<Pick<SavedItem, "category" | "notes" | "favorite">>

export type ExtensionMessage =
  | { type: "SCAN_VISIBLE" }
  | { type: "START_AUTO_SCAN"; maxItems: number }
  | { type: "STOP_AUTO_SCAN" }
  | { type: "GET_SCAN_STATUS" }
  | { type: "RESET_SCAN_SESSION" }
  | { type: "UNSAVE_ITEMS"; canonicalUrls: string[] }
  | { type: "SAVED_ITEMS_FOUND"; payload: SavedItemDraft[] }

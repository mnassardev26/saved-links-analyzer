import { describe, expect, it } from "vitest"

import { categorizeItem } from "../src/core/categorizer"
import { itemsToCsv } from "../src/core/csv"
import { DEFAULT_FILTERS, filterItems } from "../src/core/filter"
import { normalizeSavedUrl, stableItemId } from "../src/core/normalize"
import type { SavedItem } from "../src/core/types"

describe("normalizeSavedUrl", () => {
  it("unwraps Facebook redirect links and removes tracking params", () => {
    const result = normalizeSavedUrl(
      "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2Fguide%3Futm_source%3Dfb%26fbclid%3Dabc"
    )

    expect(result).toBe("https://example.com/guide")
  })

  it("creates stable ids for equivalent canonical URLs", () => {
    expect(stableItemId("https://example.com/a")).toBe(stableItemId("https://example.com/a"))
  })
})

describe("categorizeItem", () => {
  it("categorizes learning content from title and description", () => {
    expect(categorizeItem({
      url: "https://example.com/post",
      title: "How to learn TypeScript",
      description: "A practical tutorial"
    }).category).toBe("Learning")
  })

  it("falls back to Other when no rule matches", () => {
    expect(categorizeItem({
      url: "https://example.com/post",
      title: "Untitled item"
    }).category).toBe("Other")
  })
})

describe("filterItems", () => {
  it("filters by query, category, and favorite", () => {
    const items = [makeItem({ id: "1", title: "React tutorial", category: "Learning", favorite: true })]

    expect(filterItems(items, {
      ...DEFAULT_FILTERS,
      query: "react",
      category: "Learning",
      favoriteOnly: true
    })).toHaveLength(1)
  })

  it("filters by thumbnail and duration availability", () => {
    const items = [
      makeItem({ id: "1", thumbnailUrl: "https://example.com/a.jpg", videoDuration: "02:09" }),
      makeItem({ id: "2", thumbnailUrl: undefined, videoDuration: undefined })
    ]

    expect(filterItems(items, {
      ...DEFAULT_FILTERS,
      hasThumbnail: true,
      hasDuration: true
    })).toHaveLength(1)
  })
})

describe("itemsToCsv", () => {
  it("escapes commas and quotes for Excel-compatible CSV", () => {
    const csv = itemsToCsv([makeItem({ title: "A title, with comma", description: "Quote \"here\"" })])

    expect(csv).toContain("\"A title, with comma\"")
    expect(csv).toContain("\"Quote \"\"here\"\"\"")
    expect(csv.split("\n")[0]).toContain("duration")
  })
})

function makeItem(overrides: Partial<SavedItem> = {}): SavedItem {
  return {
    id: "item_1",
    platform: "facebook",
    url: "https://example.com/post",
    canonicalUrl: "https://example.com/post",
    title: "Example",
    description: "Example description",
    thumbnailUrl: undefined,
    sourceName: "Example Source",
    itemType: "Post",
    category: "Other",
    keywords: [],
    notes: "",
    favorite: false,
    collectedAt: "2026-06-26T00:00:00.000Z",
    updatedAt: "2026-06-26T00:00:00.000Z",
    ...overrides
  }
}

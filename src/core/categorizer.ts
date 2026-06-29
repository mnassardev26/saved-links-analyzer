import type { SavedCategory, SavedItemDraft } from "./types"

type CategoryRule = {
  category: SavedCategory
  needles: string[]
}

const RULES: CategoryRule[] = [
  {
    category: "Learning",
    needles: ["learn", "tutorial", "guide", "course", "docs", "documentation", "research", "explained", "how to"]
  },
  {
    category: "Work/Career",
    needles: ["job", "career", "hiring", "interview", "resume", "linkedin", "portfolio", "productivity"]
  },
  {
    category: "Business/Money",
    needles: ["startup", "business", "marketing", "sales", "revenue", "invest", "stock", "crypto", "saas", "pricing"]
  },
  {
    category: "Food",
    needles: ["recipe", "cook", "meal", "restaurant", "protein", "nutrition", "calories", "keto", "food"]
  },
  {
    category: "Health/Fitness",
    needles: ["gym", "fitness", "workout", "exercise", "running", "cardio", "stretch", "health", "sleep"]
  },
  {
    category: "Entertainment",
    needles: ["movie", "music", "game", "gaming", "funny", "meme", "reel", "video", "watch"]
  },
  {
    category: "Travel",
    needles: ["travel", "flight", "hotel", "vacation", "city", "trip", "visa"]
  },
  {
    category: "Shopping",
    needles: ["shop", "deal", "sale", "marketplace", "price", "buy", "product", "store"]
  },
  {
    category: "Social/Personal",
    needles: ["friend", "family", "event", "birthday", "group", "community", "personal"]
  }
]

export function categorizeItem(item: Pick<SavedItemDraft, "url" | "title" | "description" | "sourceName" | "itemType">): {
  category: SavedCategory
  keywords: string[]
} {
  const text = [
    item.url,
    item.title,
    item.description,
    item.sourceName,
    item.itemType
  ].filter(Boolean).join(" ").toLowerCase()

  const keywords: string[] = []

  for (const rule of RULES) {
    for (const needle of rule.needles) {
      if (text.includes(needle)) {
        keywords.push(needle)
      }
    }

    if (keywords.length > 0) {
      return {
        category: rule.category,
        keywords: Array.from(new Set(keywords))
      }
    }
  }

  return {
    category: "Other",
    keywords: []
  }
}

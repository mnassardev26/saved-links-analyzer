import type { SavedItem } from "./types"

const HEADERS = [
  "platform",
  "category",
  "title",
  "url",
  "source",
  "type",
  "duration",
  "description",
  "keywords",
  "favorite",
  "notes",
  "collected_at"
]

export function itemsToCsv(items: SavedItem[]): string {
  const rows = items.map((item) => [
    item.platform,
    item.category,
    item.title ?? "",
    item.url,
    item.sourceName ?? "",
    item.itemType ?? "",
    item.videoDuration ?? "",
    item.description ?? "",
    item.keywords.join(", "),
    item.favorite ? "yes" : "no",
    item.notes,
    item.collectedAt
  ])

  return [HEADERS, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll("\"", "\"\"")}"`
  }

  return value
}

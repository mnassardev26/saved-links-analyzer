import type { PlasmoCSConfig } from "plasmo"

import { normalizeSavedUrl } from "../src/core/normalize"
import type { ExtensionMessage, SavedItemDraft, ScanSnapshot, ScanStatus, UnsaveResult } from "../src/core/types"

export const config: PlasmoCSConfig = {
  matches: ["https://www.facebook.com/saved*"],
  all_frames: false,
  run_at: "document_idle"
}

let autoScanActive = false
let sessionSeen = new Set<string>()
let lastSnapshot: ScanSnapshot = snapshot("idle", "Ready to scan the current Facebook saved page.")
let maxItems = 1000
let emptyScrolls = 0

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "SCAN_VISIBLE") {
    const items = scanVisible()
    publishItems(items)
    sendResponse({ ...lastSnapshot, sessionCount: sessionSeen.size })
    return false
  }

  if (message.type === "START_AUTO_SCAN") {
    startAutoScan(message.maxItems)
    sendResponse(lastSnapshot)
    return false
  }

  if (message.type === "STOP_AUTO_SCAN") {
    stopAutoScan("Scan stopped.", "stopped")
    sendResponse(lastSnapshot)
    return false
  }

  if (message.type === "GET_SCAN_STATUS") {
    sendResponse(lastSnapshot)
    return false
  }

  if (message.type === "RESET_SCAN_SESSION") {
    autoScanActive = false
    sessionSeen = new Set<string>()
    emptyScrolls = 0
    lastSnapshot = snapshot("idle", "Scan data cleared. Ready to scan again.")
    sendResponse(lastSnapshot)
    return false
  }

  if (message.type === "UNSAVE_ITEMS") {
    void unsaveItems(message.canonicalUrls).then((results) => sendResponse({ results }))
    return true
  }

  return false
})

function startAutoScan(limit: number): void {
  if (!isSupportedPage()) {
    lastSnapshot = snapshot("unsupported_page", "Open facebook.com/saved to scan saved items.")
    return
  }

  autoScanActive = true
  sessionSeen = new Set<string>()
  maxItems = Math.max(1, limit)
  emptyScrolls = 0
  lastSnapshot = snapshot("scanning", "Scanning visible saved items.")
  void scanLoop()
}

async function scanLoop(): Promise<void> {
  while (autoScanActive) {
    const before = sessionSeen.size
    const items = scanVisible()
    publishItems(items)

    if (sessionSeen.size >= maxItems) {
      stopAutoScan(`Session limit of ${maxItems} items reached.`, "limit_reached")
      return
    }

    emptyScrolls = sessionSeen.size === before ? emptyScrolls + 1 : 0

    if (emptyScrolls >= 5) {
      stopAutoScan("No more new saved items were found.", "stopped")
      return
    }

    window.scrollBy({ top: Math.max(720, window.innerHeight * 0.85), behavior: "smooth" })
    lastSnapshot = snapshot("scanning", `Scanning saved items. Found ${sessionSeen.size}.`)
    await delay(1400)
  }
}

function stopAutoScan(message: string, status: ScanStatus): void {
  autoScanActive = false
  lastSnapshot = snapshot(status, message)
}

function scanVisible(): SavedItemDraft[] {
  if (!isSupportedPage()) {
    lastSnapshot = snapshot("unsupported_page", "Open facebook.com/saved to scan saved items.")
    return []
  }

  const items: SavedItemDraft[] = []
  const cards = findCandidateCards()

  for (const card of cards) {
    const item = parseCard(card)

    if (!item || sessionSeen.has(item.canonicalUrl)) {
      continue
    }

    if (sessionSeen.size >= maxItems) {
      break
    }

    sessionSeen.add(item.canonicalUrl)
    items.push(item)
  }

  lastSnapshot = snapshot(autoScanActive ? "scanning" : "idle", `Found ${sessionSeen.size} saved items this session.`)
  return items
}

function findCandidateCards(): HTMLElement[] {
  const cards = new Map<Element, HTMLElement>()

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const normalized = normalizeSavedUrl(anchor.href, window.location.origin)

    if (!normalized || !isLikelySavedContentUrl(normalized)) {
      return
    }

    const card = closestMeaningfulCard(anchor)

    if (card) {
      cards.set(card, card)
    }
  })

  return Array.from(cards.values())
}

async function unsaveItems(canonicalUrls: string[]): Promise<UnsaveResult[]> {
  const results: UnsaveResult[] = []

  for (const canonicalUrl of canonicalUrls) {
    const card = findCardByCanonicalUrl(canonicalUrl)

    if (!card) {
      results.push({
        canonicalUrl,
        status: "couldnt_remove",
        message: "Couldn’t find this saved item on the current Facebook page."
      })
      continue
    }

    const removed = await tryUnsaveCard(card)

    results.push({
      canonicalUrl,
      status: removed ? "removed" : "couldnt_remove",
      message: removed
        ? "Removed from Facebook Saved."
        : "Couldn’t find Facebook’s remove control. Open the item on Facebook and try again."
    })
  }

  return results
}

function findCardByCanonicalUrl(canonicalUrl: string): HTMLElement | null {
  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const normalized = normalizeSavedUrl(anchor.href, window.location.origin)

    if (normalized === canonicalUrl) {
      return closestMeaningfulCard(anchor)
    }
  }

  return null
}

async function tryUnsaveCard(card: HTMLElement): Promise<boolean> {
  const directControl = findRemoveControl(card)

  if (directControl) {
    directControl.click()
    await delay(600)
    return true
  }

  const menuButton = findMenuButton(card)

  if (!menuButton) {
    return false
  }

  menuButton.click()
  await delay(500)

  const menuControl = findRemoveControl(document.body)

  if (!menuControl) {
    return false
  }

  menuControl.click()
  await delay(700)
  return true
}

function findRemoveControl(root: ParentNode): HTMLElement | null {
  return clickableElements(root).find((element) => {
    const label = controlLabel(element)
    return /\b(remove from saved|remove from collection|unsave|remove saved|remove)\b/i.test(label)
  }) ?? null
}

function findMenuButton(root: ParentNode): HTMLElement | null {
  return clickableElements(root).find((element) => {
    const label = controlLabel(element)
    return /\b(more|actions|options|menu)\b/i.test(label) || label === "•••" || label === "..."
  }) ?? null
}

function clickableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, [role='button'], a[role='button'], div[aria-label], span[aria-label]"))
    .filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null)
}

function controlLabel(element: HTMLElement): string {
  return compactText([
    element.getAttribute("aria-label") ?? "",
    element.getAttribute("title") ?? "",
    element.innerText ?? ""
  ].join(" ")).toLowerCase()
}

function parseCard(card: HTMLElement): SavedItemDraft | null {
  const anchors = Array.from(card.querySelectorAll<HTMLAnchorElement>("a[href]"))
  const contentAnchor = anchors.find((anchor) => {
    const normalized = normalizeSavedUrl(anchor.href, window.location.origin)
    return Boolean(normalized && isLikelySavedContentUrl(normalized))
  })

  if (!contentAnchor) {
    return null
  }

  const canonicalUrl = normalizeSavedUrl(contentAnchor.href, window.location.origin)

  if (!canonicalUrl) {
    return null
  }

  const image = Array.from(card.querySelectorAll<HTMLImageElement>("img[src]"))
    .find((img) => img.naturalWidth > 48 || img.width > 48)

  const textBlocks = compactText(card.innerText).split("\n").filter(Boolean)
  const itemType = inferItemType(canonicalUrl, textBlocks.join(" "))
  const rawTitle = firstUseful([
    contentAnchor.getAttribute("aria-label") ?? undefined,
    compactText(contentAnchor.innerText),
    textBlocks[0]
  ])
  const videoDuration = isVideoItem(itemType) ? findDuration([rawTitle, ...textBlocks]) : undefined
  const title = normalizeTitle(rawTitle, itemType, videoDuration)
  const description = firstUseful(textBlocks.filter((line) => line !== rawTitle && line !== title && line !== videoDuration).slice(0, 3))
  const sourceName = inferSourceName(textBlocks)

  return {
    platform: "facebook",
    url: contentAnchor.href,
    canonicalUrl,
    title,
    description,
    thumbnailUrl: image?.src,
    sourceName,
    itemType,
    videoDuration,
    collectedAt: new Date().toISOString()
  }
}

function closestMeaningfulCard(anchor: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = anchor

  for (let depth = 0; current && depth < 8; depth += 1) {
    const text = compactText(current.innerText)
    const links = current.querySelectorAll("a[href]").length
    const images = current.querySelectorAll("img[src]").length

    if (text.length > 20 && (links > 1 || images > 0)) {
      return current
    }

    current = current.parentElement
  }

  return anchor.closest<HTMLElement>("[role='article'], [data-pagelet], div")
}

function isLikelySavedContentUrl(url: string): boolean {
  if (url.includes("/saved") || url.includes("/login") || url.includes("/settings")) {
    return false
  }

  return (
    url.includes("/posts/") ||
    url.includes("/videos/") ||
    url.includes("/watch/") ||
    url.includes("/reel/") ||
    url.includes("/photo.php") ||
    url.includes("/permalink/") ||
    url.includes("/marketplace/") ||
    !new URL(url).hostname.endsWith("facebook.com")
  )
}

function inferItemType(url: string, text: string): string {
  const haystack = `${url} ${text}`.toLowerCase()

  if (haystack.includes("/reel/")) return "Reel"
  if (haystack.includes("/watch/") || haystack.includes("/videos/")) return "Video"
  if (haystack.includes("/marketplace/")) return "Marketplace"
  if (haystack.includes("/photo.php")) return "Photo"
  if (!url.includes("facebook.com")) return "External link"
  return "Post"
}

function normalizeTitle(rawTitle: string | undefined, itemType: string, videoDuration?: string): string | undefined {
  if (rawTitle && rawTitle !== videoDuration) {
    return rawTitle
  }

  if (videoDuration && isVideoItem(itemType)) {
    return "Untitled video"
  }

  return rawTitle
}

function findDuration(values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const match = value?.match(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/)

    if (match) {
      return match[0]
    }
  }

  return undefined
}

function isVideoItem(itemType: string): boolean {
  return itemType === "Video" || itemType === "Reel"
}

function inferSourceName(lines: string[]): string | undefined {
  return lines.find((line) => {
    const value = line.trim()
    return value.length >= 2 && value.length <= 80 && !/saved|shared|like|comment/i.test(value)
  })
}

function publishItems(items: SavedItemDraft[]): void {
  if (!items.length) {
    return
  }

  chrome.runtime.sendMessage({
    type: "SAVED_ITEMS_FOUND",
    payload: items
  } satisfies ExtensionMessage).catch(() => {
    // Side panel may be closed or extension may be reloading.
  })
}

function snapshot(status: ScanStatus, message: string): ScanSnapshot {
  return {
    status,
    sessionCount: sessionSeen.size,
    totalKnown: sessionSeen.size,
    message
  }
}

function isSupportedPage(): boolean {
  return window.location.hostname === "www.facebook.com" && window.location.pathname.startsWith("/saved")
}

function compactText(value?: string): string {
  return (value ?? "").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/[ \t]+/g, " ").trim()
}

function firstUseful(values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0)?.trim()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

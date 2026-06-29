const TRACKING_PARAMS = [
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "igshid"
]

export function normalizeSavedUrl(value: string, base = "https://www.facebook.com"): string | null {
  try {
    const url = new URL(value, base)

    if (url.hostname === "l.facebook.com" || url.pathname === "/l.php") {
      const target = url.searchParams.get("u")
      if (target) {
        return normalizeSavedUrl(target, base)
      }
    }

    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param)
    }

    url.hash = ""

    if (url.hostname.endsWith("facebook.com")) {
      url.hostname = "www.facebook.com"
    }

    return url.toString()
  } catch {
    return null
  }
}

export function stableItemId(canonicalUrl: string): string {
  let hash = 0

  for (let index = 0; index < canonicalUrl.length; index += 1) {
    hash = (hash << 5) - hash + canonicalUrl.charCodeAt(index)
    hash |= 0
  }

  return `item_${Math.abs(hash).toString(36)}`
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

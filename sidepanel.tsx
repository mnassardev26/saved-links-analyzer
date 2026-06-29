import ArticleIcon from "@mui/icons-material/Article"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import CloseIcon from "@mui/icons-material/Close"
import DownloadIcon from "@mui/icons-material/Download"
import FacebookIcon from "@mui/icons-material/Facebook"
import FavoriteIcon from "@mui/icons-material/Favorite"
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder"
import FilterAltIcon from "@mui/icons-material/FilterAlt"
import MovieIcon from "@mui/icons-material/Movie"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import SearchIcon from "@mui/icons-material/Search"
import SettingsIcon from "@mui/icons-material/Settings"
import StopIcon from "@mui/icons-material/Stop"
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography
} from "@mui/material"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { downloadCsv, itemsToCsv } from "./src/core/csv"
import { DEFAULT_FILTERS, filterItems, sortItems, type ItemFilters, type SortKey } from "./src/core/filter"
import { hostnameFromUrl } from "./src/core/normalize"
import { clearItems, deleteItems, getStoredItems, mergeDrafts, updateItems } from "./src/core/storage"
import {
  CATEGORY_OPTIONS,
  type ExtensionMessage,
  type SavedCategory,
  type SavedItem,
  type SavedItemDraft,
  type ScanSnapshot,
  type UnsaveResult
} from "./src/core/types"
import { theme } from "./src/ui/theme"

type UiUnsaveStatus = "unsaving" | "removed" | "couldnt_remove"

const DEFAULT_SCAN: ScanSnapshot = {
  status: "idle",
  sessionCount: 0,
  totalKnown: 0,
  message: "Open facebook.com/saved, then scan visible items or auto-scroll to collect more."
}

function SidePanel() {
  const [items, setItems] = useState<SavedItem[]>([])
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS)
  const [sortKey, setSortKey] = useState<SortKey>("collectedAt")
  const [scan, setScan] = useState<ScanSnapshot>(DEFAULT_SCAN)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [feedback, setFeedback] = useState("")
  const [maxItems, setMaxItems] = useState(1000)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [confirmBulkUnsave, setConfirmBulkUnsave] = useState(false)
  const [confirmClearScans, setConfirmClearScans] = useState(false)
  const [unsaveStates, setUnsaveStates] = useState<Record<string, UiUnsaveStatus>>({})

  useEffect(() => {
    void hydrate()

    const listener = (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (message.type === "SAVED_ITEMS_FOUND") {
        void handleItemsFound(message.payload).then(sendResponse)
        return true
      }

      return false
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(""), 4200)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  useEffect(() => {
    if (scan.status !== "scanning") return
    const interval = window.setInterval(() => void refreshScanStatus(), 1500)
    return () => window.clearInterval(interval)
  }, [scan.status])

  const filtered = useMemo(() => sortItems(filterItems(items, filters), sortKey), [items, filters, sortKey])
  const pageItems = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  const selectedItems = filtered.filter((item) => selected.has(item.id))
  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const pageStart = filtered.length === 0 ? 0 : page * rowsPerPage + 1
  const pageEnd = Math.min(filtered.length, (page + 1) * rowsPerPage)
  const categoryCounts = useMemo(() => {
    return CATEGORY_OPTIONS.map((category) => ({
      category,
      count: items.filter((item) => item.category === category).length
    })).filter((entry) => entry.count > 0).sort((left, right) => right.count - left.count)
  }, [items])
  const topCategories = categoryCounts.slice(0, 4)
  const itemTypes = uniqueOptions(items.map((item) => item.itemType ?? "Unknown"))
  const sources = uniqueOptions(items.map((item) => (item.sourceName ?? hostnameFromUrl(item.url)) || "Unknown"))
  const allPageSelected = pageItems.length > 0 && pageItems.every((item) => selected.has(item.id))
  const hasActiveAdvancedFilters = filters.itemType !== "all" ||
    filters.source !== "all" ||
    filters.collectedRange !== "all" ||
    filters.hasThumbnail ||
    filters.hasDuration

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(pageCount - 1)
    }
  }, [page, pageCount])

  async function hydrate(): Promise<void> {
    const stored = await getStoredItems()
    setItems(Object.values(stored))
    await refreshScanStatus()
  }

  async function refreshScanStatus(): Promise<void> {
    const response = await sendToActiveTab({ type: "GET_SCAN_STATUS" })
    if (isScanSnapshot(response)) {
      setScan(response)
    }
  }

  async function handleItemsFound(drafts: SavedItemDraft[]): Promise<void> {
    const updated = await mergeDrafts(drafts)
    setItems(updated)
    setFeedback(`Imported ${drafts.length} saved item${drafts.length === 1 ? "" : "s"}.`)
  }

  async function handleScanVisible(): Promise<void> {
    const response = await sendToActiveTab({ type: "SCAN_VISIBLE" })
    if (isScanSnapshot(response)) {
      setScan(response)
      setFeedback(response.message)
    } else {
      setFeedback("Open facebook.com/saved before scanning.")
    }
  }

  async function handleAutoScanToggle(): Promise<void> {
    const message: ExtensionMessage = scan.status === "scanning"
      ? { type: "STOP_AUTO_SCAN" }
      : { type: "START_AUTO_SCAN", maxItems }
    const response = await sendToActiveTab(message)

    if (isScanSnapshot(response)) {
      setScan(response)
      setFeedback(response.message)
    } else {
      setFeedback("Open facebook.com/saved before scanning.")
    }
  }

  async function handleToggleFavorite(item: SavedItem): Promise<void> {
    const updated = await updateItems([item.id], { favorite: !item.favorite })
    setItems(updated)
  }

  async function handleUnsave(targets: SavedItem[]): Promise<void> {
    if (!targets.length) return

    const ids = targets.map((item) => item.id)
    setUnsaveStates((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, "unsaving" as const]))
    }))

    const response = await sendToActiveTab({
      type: "UNSAVE_ITEMS",
      canonicalUrls: targets.map((item) => item.canonicalUrl)
    })

    const results = isUnsaveResponse(response)
      ? response.results
      : targets.map((item) => ({
          canonicalUrl: item.canonicalUrl,
          status: "couldnt_remove" as const,
          message: "Open facebook.com/saved and make sure the saved item is visible."
        }))

    const removedIds = targets
      .filter((item) => results.some((result) => result.canonicalUrl === item.canonicalUrl && result.status === "removed"))
      .map((item) => item.id)
    const failedIds = targets
      .filter((item) => results.some((result) => result.canonicalUrl === item.canonicalUrl && result.status === "couldnt_remove"))
      .map((item) => item.id)

    setUnsaveStates((current) => ({
      ...current,
      ...Object.fromEntries(removedIds.map((id) => [id, "removed" as const])),
      ...Object.fromEntries(failedIds.map((id) => [id, "couldnt_remove" as const]))
    }))

    if (removedIds.length) {
      window.setTimeout(() => {
        void deleteItems(removedIds).then((updated) => {
          setItems(updated)
          setSelected((current) => {
            const next = new Set(current)
            removedIds.forEach((id) => next.delete(id))
            return next
          })
        })
      }, 900)
    }

    if (failedIds.length) {
      setFeedback("Couldn’t find Facebook’s remove control for some items. Open the item on Facebook and try again.")
    } else {
      setFeedback(`Unsaved ${removedIds.length} item${removedIds.length === 1 ? "" : "s"} from Facebook.`)
    }
  }

  async function handleClearScannedData(): Promise<void> {
    await clearItems()
    await sendToActiveTab({ type: "RESET_SCAN_SESSION" })
    setItems([])
    setSelected(new Set())
    setUnsaveStates({})
    setFilters(DEFAULT_FILTERS)
    setSortKey("collectedAt")
    setPage(0)
    setScan(DEFAULT_SCAN)
    setConfirmClearScans(false)
    setSettingsOpen(false)
    setFeedback("Cleared scanned items. You can rescan facebook.com/saved now.")
  }

  function handleExport(scope: "filtered" | "selected"): void {
    const exportItems = scope === "selected" ? selectedItems : filtered
    const csv = itemsToCsv(exportItems)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`saved-links-${scope}-${stamp}.csv`, csv)
    setFeedback(`Exported ${exportItems.length} item${exportItems.length === 1 ? "" : "s"}.`)
  }

  function toggleSelected(id: string): void {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePageSelection(): void {
    setSelected((current) => {
      const next = new Set(current)
      if (allPageSelected) pageItems.forEach((item) => next.delete(item.id))
      else pageItems.forEach((item) => next.add(item.id))
      return next
    })
  }

  function updateFilter<K extends keyof ItemFilters>(key: K, value: ItemFilters[K]): void {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(0)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: "linear-gradient(rgba(37, 99, 235, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 99, 235, 0.025) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
        pb: selected.size ? 11 : 8
      }}>
        <Stack>
          {feedback && <Alert severity="info" sx={{ borderRadius: 0 }}>{feedback}</Alert>}

          <Section>
            <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontSize={15} fontWeight={800}>
                  {items.length ? `${items.length.toLocaleString()} items collected locally` : "Ready to scan Facebook Saved"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                  Filtered {filtered.length.toLocaleString()} · Selected {selected.size.toLocaleString()} · {scan.status.replaceAll("_", " ")}
                </Typography>
              </Box>
              <Tooltip title="Settings">
                <IconButton size="small" onClick={() => setSettingsOpen((open) => !open)}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close">
                <IconButton size="small" onClick={() => window.close()}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {settingsOpen && (
              <Stack spacing={1.25} sx={{ mb: 1.5, p: 1.25, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "rgba(255,255,255,0.68)" }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Auto-scan limit"
                    type="number"
                    size="small"
                    value={maxItems}
                    onChange={(event) => setMaxItems(Math.max(1, Number(event.target.value) || 1))}
                    sx={{ flex: 1 }}
                  />
                  <FormControl size="small" sx={{ width: 118 }}>
                    <Select
                      value={String(rowsPerPage)}
                      onChange={(event) => {
                        setRowsPerPage(Number(event.target.value))
                        setPage(0)
                      }}
                      renderValue={(value) => `${value} rows`}
                    >
                      {[10, 25, 50, 100].map((value) => (
                        <MenuItem key={value} value={String(value)}>{value} rows</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Button color="error" variant="outlined" size="small" onClick={() => setConfirmClearScans(true)}>
                  Clear scanned items
                </Button>
              </Stack>
            )}
            <Stack direction="row" spacing={1}>
              <Button fullWidth startIcon={<SearchIcon />} variant="outlined" onClick={handleScanVisible} sx={scanButtonSx}>Scan visible</Button>
              <Button
                fullWidth
                startIcon={scan.status === "scanning" ? <StopIcon /> : <PlayArrowIcon />}
                variant="contained"
                color={scan.status === "scanning" ? "error" : "primary"}
                onClick={handleAutoScanToggle}
                sx={scanButtonSx}
              >
                {scan.status === "scanning" ? "Stop" : "Auto-scan"}
              </Button>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
              <PulseDot active={scan.status === "scanning"} />
              <Typography variant="caption" color="text.secondary" noWrap>{scan.message}</Typography>
            </Stack>
          </Section>

          <Section>
            <TextField
              fullWidth
              placeholder="Search saved items"
              size="small"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <Stack direction="row" spacing={0.75} sx={{ mt: 1, overflowX: "auto", pb: 0.25 }}>
              <Button
                size="small"
                startIcon={<FilterAltIcon />}
                variant={hasActiveAdvancedFilters ? "contained" : "outlined"}
                sx={pillButtonSx}
                onClick={() => setFilterOpen(true)}
              >
                Filter
              </Button>
              <Button
                size="small"
                variant={filters.favoriteOnly ? "contained" : "outlined"}
                color={filters.favoriteOnly ? "secondary" : "inherit"}
                sx={pillButtonSx}
                onClick={() => updateFilter("favoriteOnly", !filters.favoriteOnly)}
              >
                Favorites
              </Button>
              <Button
                size="small"
                variant={filters.missingMetadataOnly ? "contained" : "outlined"}
                color={filters.missingMetadataOnly ? "secondary" : "inherit"}
                sx={pillButtonSx}
                onClick={() => updateFilter("missingMetadataOnly", !filters.missingMetadataOnly)}
              >
                Missing info
              </Button>
            </Stack>
          </Section>

          <Section>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 800 }}>Category</Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <CategoryChip label="All" count={items.length} active={filters.category === "all"} onClick={() => updateFilter("category", "all")} />
              {topCategories.map((entry) => (
                <CategoryChip
                  key={entry.category}
                  label={shortCategory(entry.category)}
                  count={entry.count}
                  active={filters.category === entry.category}
                  onClick={() => updateFilter("category", entry.category)}
                />
              ))}
              {categoryCounts.length > topCategories.length && (
                <Chip clickable size="small" label="More" variant="outlined" onClick={() => setFilterOpen(true)} sx={{ borderRadius: 999 }} />
              )}
            </Stack>
          </Section>

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(255,255,255,0.54)" }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Checkbox size="small" checked={allPageSelected} indeterminate={!allPageSelected && pageItems.some((item) => selected.has(item.id))} onChange={togglePageSelection} />
                <Typography variant="body2" color="text.secondary">Select all</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">{filtered.length.toLocaleString()} items</Typography>
            </Stack>

            {pageItems.map((item) => (
              <SavedItemRow
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                unsaveStatus={unsaveStates[item.id]}
                onSelect={() => toggleSelected(item.id)}
                onFavorite={() => void handleToggleFavorite(item)}
                onUnsave={() => void handleUnsave([item])}
              />
            ))}

            {!pageItems.length && (
              <Typography color="text.secondary" sx={{ py: 4, px: 2, textAlign: "center" }}>
                No saved items match the current filters.
              </Typography>
            )}
          </Box>

          <Stack spacing={0.75} sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              {pageStart}-{pageEnd} of {filtered.length.toLocaleString()}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Button fullWidth size="small" variant="outlined" startIcon={<ChevronLeftIcon />} disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</Button>
              <Chip size="small" label={`${page + 1} / ${pageCount}`} sx={{ minWidth: 68, borderRadius: 999 }} />
              <Button fullWidth size="small" variant="contained" endIcon={<ChevronRightIcon />} disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</Button>
            </Stack>
          </Stack>
        </Stack>

        <BottomActions
          selectedCount={selected.size}
          onExportFiltered={() => handleExport("filtered")}
          onExportSelected={() => handleExport("selected")}
          onUnsaveSelected={() => setConfirmBulkUnsave(true)}
        />

        <FilterDrawer
          open={filterOpen}
          filters={filters}
          sortKey={sortKey}
          itemTypes={itemTypes}
          sources={sources}
          categoryCounts={categoryCounts}
          onClose={() => setFilterOpen(false)}
          onFilterChange={updateFilter}
          onSortChange={setSortKey}
          onReset={() => {
            setFilters(DEFAULT_FILTERS)
            setSortKey("collectedAt")
            setPage(0)
          }}
        />

        <Dialog open={confirmBulkUnsave} onClose={() => setConfirmBulkUnsave(false)}>
          <DialogTitle>Unsave {selected.size} item{selected.size === 1 ? "" : "s"} from Facebook?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will use Facebook’s visible remove controls on the current saved page. Items not visible on the page may fail.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmBulkUnsave(false)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                setConfirmBulkUnsave(false)
                void handleUnsave(selectedItems)
              }}
            >
              Unsave
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmClearScans} onClose={() => setConfirmClearScans(false)}>
          <DialogTitle>Clear all scanned items?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This clears the local scanned list and resets the current scan session. It does not unsave anything from Facebook.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmClearScans(false)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void handleClearScannedData()}>
              Clear and rescan
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  )
}

function Section({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(255,255,255,0.72)" }}>
      {children}
    </Box>
  )
}

function PulseDot({ active }: { active: boolean }) {
  return (
    <Box sx={{
      width: 7,
      height: 7,
      borderRadius: "50%",
      bgcolor: active ? "success.main" : "text.disabled",
      animation: active ? "sla-pulse 1.4s ease-in-out infinite" : "none",
      "@keyframes sla-pulse": {
        "0%, 100%": { opacity: 0.45, transform: "scale(0.92)" },
        "50%": { opacity: 1, transform: "scale(1.2)" }
      }
    }} />
  )
}

function CategoryChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <Chip
      clickable
      size="small"
      color={active ? "primary" : "default"}
      variant={active ? "filled" : "outlined"}
      label={`${label} ${count}`}
      onClick={onClick}
      sx={{ borderRadius: 999 }}
    />
  )
}

function FilterDrawer({
  open,
  filters,
  sortKey,
  itemTypes,
  sources,
  categoryCounts,
  onClose,
  onFilterChange,
  onSortChange,
  onReset
}: {
  open: boolean
  filters: ItemFilters
  sortKey: SortKey
  itemTypes: string[]
  sources: string[]
  categoryCounts: Array<{ category: SavedCategory; count: number }>
  onClose: () => void
  onFilterChange: <K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) => void
  onSortChange: (sortKey: SortKey) => void
  onReset: () => void
}) {
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "86vh" } }}>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={800}>Filter saved items</Typography>
          <Button size="small" onClick={onReset}>Reset</Button>
        </Stack>
        <Stack direction="row" spacing={1}>
          <FilterSelect label="Category" value={filters.category} onChange={(value) => onFilterChange("category", value as ItemFilters["category"])}>
            <MenuItem value="all">All categories</MenuItem>
            {categoryCounts.map((entry) => <MenuItem key={entry.category} value={entry.category}>{entry.category} ({entry.count})</MenuItem>)}
          </FilterSelect>
          <FilterSelect label="Sort" value={sortKey} onChange={(value) => onSortChange(value as SortKey)}>
            <MenuItem value="collectedAt">Newest</MenuItem>
            <MenuItem value="title">Title</MenuItem>
            <MenuItem value="sourceName">Source</MenuItem>
            <MenuItem value="category">Category</MenuItem>
          </FilterSelect>
        </Stack>
        <Stack direction="row" spacing={1}>
          <FilterSelect label="Type" value={filters.itemType} onChange={(value) => onFilterChange("itemType", value)}>
            <MenuItem value="all">All types</MenuItem>
            {itemTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
          </FilterSelect>
          <FilterSelect label="Collected" value={filters.collectedRange} onChange={(value) => onFilterChange("collectedRange", value as ItemFilters["collectedRange"])}>
            <MenuItem value="all">Any time</MenuItem>
            <MenuItem value="today">Last 24 hours</MenuItem>
            <MenuItem value="week">Last 7 days</MenuItem>
            <MenuItem value="month">Last 30 days</MenuItem>
          </FilterSelect>
        </Stack>
        <FilterSelect label="Source" value={filters.source} onChange={(value) => onFilterChange("source", value)}>
          <MenuItem value="all">All sources</MenuItem>
          {sources.map((source) => <MenuItem key={source} value={source}>{source}</MenuItem>)}
        </FilterSelect>
        <Stack>
          <FormControlLabel control={<Switch checked={filters.hasThumbnail} onChange={(event) => onFilterChange("hasThumbnail", event.target.checked)} />} label="Has thumbnail" />
          <FormControlLabel control={<Switch checked={filters.hasDuration} onChange={(event) => onFilterChange("hasDuration", event.target.checked)} />} label="Has duration" />
          <FormControlLabel control={<Switch checked={filters.favoriteOnly} onChange={(event) => onFilterChange("favoriteOnly", event.target.checked)} />} label="Favorites only" />
          <FormControlLabel control={<Switch checked={filters.missingMetadataOnly} onChange={(event) => onFilterChange("missingMetadataOnly", event.target.checked)} />} label="Missing metadata" />
        </Stack>
        <Button variant="contained" onClick={onClose}>Apply filters</Button>
      </Stack>
    </Drawer>
  )
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <FormControl size="small" fullWidth>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
      <Select value={value} onChange={(event) => onChange(String(event.target.value))}>
        {children}
      </Select>
    </FormControl>
  )
}

function SavedItemRow({
  item,
  selected,
  unsaveStatus,
  onSelect,
  onFavorite,
  onUnsave
}: {
  item: SavedItem
  selected: boolean
  unsaveStatus?: UiUnsaveStatus
  onSelect: () => void
  onFavorite: () => void
  onUnsave: () => void
}) {
  const title = displayTitle(item)
  const meta = itemMeta(item)

  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={1.25}
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: selected ? "action.selected" : "rgba(255,255,255,0.62)",
        transition: "background-color 160ms ease, opacity 160ms ease",
        opacity: unsaveStatus === "removed" ? 0.55 : 1,
        "&:hover": { bgcolor: "action.hover" }
      }}
    >
      <Checkbox size="small" checked={selected} onChange={onSelect} sx={{ mt: -0.25 }} />
      <Avatar variant="rounded" src={item.thumbnailUrl} sx={{ width: 48, height: 48, bgcolor: "background.default", color: "text.secondary" }}>
        <FallbackIcon itemType={item.itemType} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={800} noWrap>{title}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">{meta}</Typography>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 0.75 }}>
          <ButtonLink onClick={() => chrome.tabs.create({ url: item.url })} icon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>Open</ButtonLink>
          <ButtonLink onClick={onFavorite} icon={item.favorite ? <FavoriteIcon sx={{ fontSize: 14 }} /> : <FavoriteBorderIcon sx={{ fontSize: 14 }} />}>
            {item.favorite ? "Favorited" : "Favorite"}
          </ButtonLink>
          <ButtonLink danger disabled={unsaveStatus === "unsaving" || unsaveStatus === "removed"} onClick={onUnsave}>
            {unsaveLabel(unsaveStatus)}
          </ButtonLink>
        </Stack>
      </Box>
    </Stack>
  )
}

function ButtonLink({ children, icon, danger, disabled, onClick }: { children: ReactNode; icon?: ReactNode; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Button
      size="small"
      variant="text"
      disabled={disabled}
      startIcon={icon}
      onClick={onClick}
      sx={{
        minWidth: 0,
        p: 0,
        fontSize: 12,
        fontWeight: 800,
        color: danger ? "error.main" : "primary.main",
        "& .MuiButton-startIcon": { mr: 0.35 }
      }}
    >
      {children}
    </Button>
  )
}

function BottomActions({ selectedCount, onExportFiltered, onExportSelected, onUnsaveSelected }: {
  selectedCount: number
  onExportFiltered: () => void
  onExportSelected: () => void
  onUnsaveSelected: () => void
}) {
  return (
    <Stack sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 4, bgcolor: "rgba(255,255,255,0.94)", borderTop: 1, borderColor: "divider", p: 1.5, boxShadow: "0 -6px 16px rgba(15, 23, 42, 0.08)" }}>
      {selectedCount === 0 ? (
        <Button fullWidth startIcon={<DownloadIcon />} variant="contained" onClick={onExportFiltered}>Export filtered</Button>
      ) : (
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">{selectedCount} selected</Typography>
          <Stack direction="row" spacing={1}>
            <Button fullWidth startIcon={<DownloadIcon />} variant="outlined" onClick={onExportSelected}>Export selected</Button>
            <Button fullWidth color="error" variant="contained" onClick={onUnsaveSelected}>Unsave selected</Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}

function FallbackIcon({ itemType }: { itemType?: string }) {
  if (itemType === "Video" || itemType === "Reel") return <MovieIcon fontSize="small" />
  if (itemType === "External link") return <ArticleIcon fontSize="small" />
  return <FacebookIcon fontSize="small" />
}

function displayTitle(item: SavedItem): string {
  if (item.videoDuration && item.title === item.videoDuration && (item.itemType === "Video" || item.itemType === "Reel")) {
    return "Untitled video"
  }

  return item.title?.trim() || (item.itemType === "Video" || item.itemType === "Reel" ? "Untitled video" : item.url)
}

function itemMeta(item: SavedItem): string {
  return [
    item.itemType ?? "Post",
    "Facebook",
    item.category,
    item.videoDuration ? `${item.videoDuration} duration` : undefined,
    item.sourceName && item.sourceName !== item.title ? item.sourceName : undefined
  ].filter(Boolean).join(" · ")
}

function unsaveLabel(status?: UiUnsaveStatus): string {
  if (status === "unsaving") return "Unsaving..."
  if (status === "removed") return "Removed"
  if (status === "couldnt_remove") return "Couldn’t remove"
  return "Unsave"
}

function shortCategory(category: SavedCategory): string {
  const map: Partial<Record<SavedCategory, string>> = {
    "Work/Career": "Work",
    "Business/Money": "Money",
    "Health/Fitness": "Health",
    "Social/Personal": "Social"
  }

  return map[category] ?? category
}

const pillButtonSx = {
  borderRadius: 999,
  height: 32,
  fontSize: 12,
  whiteSpace: "nowrap",
  flexShrink: 0
} as const

const scanButtonSx = {
  minHeight: 40,
  whiteSpace: "nowrap",
  ".MuiButton-startIcon": {
    mr: 0.75
  }
} as const

async function sendToActiveTab(message: ExtensionMessage): Promise<unknown> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]

  if (!tab?.id) return undefined

  try {
    return await chrome.tabs.sendMessage(tab.id, message)
  } catch {
    return undefined
  }
}

function isScanSnapshot(value: unknown): value is ScanSnapshot {
  return typeof value === "object" && value !== null && "status" in value && "message" in value
}

function isUnsaveResponse(value: unknown): value is { results: UnsaveResult[] } {
  return typeof value === "object" &&
    value !== null &&
    "results" in value &&
    Array.isArray((value as { results?: unknown }).results)
}

function uniqueOptions(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b)).slice(0, 100)
}

export default SidePanel

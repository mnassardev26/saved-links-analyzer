# Chrome Web Store Privacy Tab

## Single Purpose Description

Saved Links Analyzer helps users scan, organize, search, categorize, favorite, remove, and export items from their Facebook Saved list. It runs only on Facebook Saved pages and stores scanned saved-link metadata locally in Chrome extension storage so users can manage their saved-link library from the side panel.

## Permission Justifications

sidePanel:
The extension uses Chrome's side panel to show the saved-link organizer next to Facebook Saved. Users scan, filter, favorite, export, clear, and manage saved items from this side panel.

storage:
The extension uses Chrome local storage to save scanned saved-link metadata, user-selected categories, notes, favorite status, and scan state on the user's device. This data is not sent to a backend service.

Host permission:
Access to `https://www.facebook.com/*` is required so the content script can run on Facebook Saved pages, read saved-item metadata visible to the signed-in user, and interact with visible Facebook remove controls only when the user requests an unsave action.

## Remote Code

Select:
No, I am not using Remote code

Justification:
Saved Links Analyzer does not load or execute remote JavaScript or WebAssembly. All executable code is bundled inside the extension package. External image URLs from Facebook may be displayed as saved-item thumbnails, but no remote scripts or remotely hosted modules are executed.

## Data Usage

Select:
Website content

Reason:
The extension reads saved-item text, titles, links, thumbnails, source names, and related metadata visible on Facebook Saved pages. This data is stored locally in Chrome extension storage and can be cleared by the user.

Do not select unless Google specifically asks for a broader interpretation:
Web history

Reason:
The extension does not access Chrome browsing history or monitor visited pages. It only reads saved links visible on Facebook Saved pages.

## Required Certifications

Check all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy Policy URL

Use:
https://github.com/mnassardev26/saved-links-analyzer/blob/main/PRIVACY.md

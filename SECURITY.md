# Security

Sanitas is a local-first Chrome extension.

## Security Model

Sanitas is designed to keep sensitive restore data inside the browser session.

Key boundaries:

- `chrome.storage.local` stores harmless preferences only.
- `chrome.storage.session` stores temporary sensitive mappings and workspace data.
- The service worker owns session storage access.
- Content scripts do not directly read `chrome.storage.session`.
- Restored real data stays inside Sanitas.
- Sanitas does not auto-submit anything to ChatGPT.

## Permissions

Sanitas uses minimal permissions.

It does not request:

- `<all_urls>`
- Cookies
- History
- Downloads
- `webRequest`
- Identity
- Tabs
- `activeTab`
- Scripting

The content script is scoped to:

```txt
https://chatgpt.com/*
```

## No Tracking

Sanitas does not include:

- Telemetry
- Analytics
- Advertising
- Remote scripts
- Backend data collection

## Manual ChatGPT Workflow

Sanitas does not expose direct Insert or Capture buttons.

The user manually copies sanitized output into ChatGPT and manually pastes placeholder replies back into Sanitas.

Sanitas never inserts restored real data into ChatGPT.

## Clear Session

Clicking `Clear` removes:

- Placeholder mappings.
- Workspace text.
- Session custom terms.
- Session DSN rules.

After clearing, old placeholders can no longer be restored.

## Safe Test Data

Use only dummy examples when testing Sanitas.

Safe examples:

- `user@example.com`
- `example.test`
- `192.0.2.10`
- `Ahmed Khan`

Do not test with real logs, real customer data, real emails, real tokens, real IPs, or real secrets.

## Report Issues

Use the project support page:

`https://notice.seryalda.com/sanitas-data-sanitizer/support/`

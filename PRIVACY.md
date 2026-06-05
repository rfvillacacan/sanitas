# Privacy

Sanitas is designed to process text locally in the browser.

## What Sanitas Does

Sanitas helps replace sensitive values with placeholders before you manually use text with ChatGPT. It can also restore known placeholders locally inside the Sanitas panel.

## No Backend

Sanitas does not run a backend service.

Sanitas does not:

- Sell data.
- Run analytics.
- Use telemetry.
- Send your text to a Sanitas server.
- Use remote scripts.
- Use `chrome.storage.sync`.

## Local Preferences

Sanitas stores harmless preferences in `chrome.storage.local`, such as:

- Whether the panel is enabled.
- Floating window position and size.
- Collapsed side-tab position.
- Selected mode.
- Theme.
- Detector toggles.
- Whether session custom terms are enabled.

These settings do not include your sensitive text or restore mappings.

## Session Data

Sanitas stores working data only in `chrome.storage.session` through the extension service worker.

Session data may include:

- Placeholder mappings.
- Input and output workspace text.
- Session custom terms.
- Session DSN rules.

This data is temporary browser-session data and is cleared when you click `Clear`.

## ChatGPT Boundary

Sanitas does not automatically submit prompts to ChatGPT.

Sanitas does not insert restored real data into ChatGPT.

The workflow is manual:

1. You copy sanitized placeholder text from Sanitas.
2. You manually paste it into ChatGPT.
3. You manually copy a placeholder response back into Sanitas.
4. Sanitas restores known placeholders locally.

## Custom Terms and DSN Rules

Custom terms and DSN rules may be sensitive. Sanitas stores active custom terms and DSN rules only in `chrome.storage.session`.

Sanitas does not store custom terms or DSN rule contents in `chrome.storage.local`.

## Hosted Pages

Sanitas documentation pages are hosted at:

- Homepage: `https://notice.seryalda.com/sanitas-data-sanitizer/`
- Privacy: `https://notice.seryalda.com/sanitas-data-sanitizer/privacy/`
- Support: `https://notice.seryalda.com/sanitas-data-sanitizer/support/`

The DSN Template Guide opened from the extension is a packaged local HTML help page. It does not send DSN JSON or workspace text to a server.

# Sanitas - The Data Sanitizer

Sanitas is a Chrome extension that helps you sanitize sensitive text before using ChatGPT. It replaces detected values with placeholders such as `[[EMAIL_0001]]` and restores those placeholders locally when you paste a response back into Sanitas.

Sanitas is local-first:

- No backend.
- No analytics or telemetry.
- No automatic ChatGPT submission.
- No direct Insert or Capture buttons.
- Sensitive mappings are kept only in the browser session.
- Users manually copy sanitized text into ChatGPT and manually paste placeholder replies back into Sanitas.

## Download

1. Open the GitHub repository:
   `https://github.com/rfvillacacan/sanitas`
2. Click `Code`.
3. Click `Download ZIP`.
4. Extract the ZIP file to a folder you can find later.
5. Open the extracted folder and confirm it contains `manifest.json`.

## Install in Chrome

1. Open Google Chrome.
2. Go to:
   `chrome://extensions/`
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select the extracted Sanitas folder, the folder that contains `manifest.json`.
6. Confirm Sanitas appears in the Chrome extensions list.

## Enable Sanitas

1. Click the Chrome extensions icon.
2. Open `Sanitas - The Data Sanitizer`.
3. Turn Sanitas `ON`.
4. Open or refresh:
   `https://chatgpt.com/`
5. The Sanitas floating window should appear.

If the window is collapsed, click the vertical `Sanitas` side tab to expand it. You can drag the side tab up or down if it covers page content.

## Use Real -> Dummy

Use this mode before sending text to ChatGPT.

1. Select `Real -> Dummy`.
2. Paste or type text into the `Input` box.
3. Sanitas automatically writes sanitized output in the `Output` box.
4. Click `Copy`.
5. Manually paste the sanitized output into ChatGPT.
6. Review the prompt yourself.
7. Send it manually only if you choose.

Example input:

```txt
User Ahmed Khan from ahmed.khan@example.com failed login from 192.0.2.10.
```

Example sanitized output:

```txt
User Ahmed Khan from [[EMAIL_0001]] failed login from [[IPV4_0001]].
```

## Use Dummy -> Real

Use this mode after ChatGPT replies with placeholders.

1. Copy the ChatGPT response that contains Sanitas placeholders.
2. Select `Dummy -> Real` in Sanitas.
3. Paste the placeholder response into the `Input` box.
4. Sanitas automatically restores known placeholders in the `Output` box.
5. Copy the restored output only if you need it locally.

Sanitas does not insert restored real data back into ChatGPT.

## Clear Session

Click `Clear` when you are done.

Clear Session removes:

- Placeholder mappings.
- Workspace text.
- Session custom terms.
- Session DSN rules.

After clearing, old placeholders can no longer be restored.

## Options

Open the Sanitas popup and click `Options`.

You can adjust:

- Floating window size and theme.
- Detector toggles.
- Session custom terms.
- Session-only DSN rules.

Custom terms and DSN rules may be sensitive, so Sanitas stores active values only for the current browser session.

## Troubleshooting

If Sanitas does not appear on ChatGPT:

1. Confirm Sanitas is turned `ON` in the popup.
2. Refresh `https://chatgpt.com/`.
3. Confirm the extension is enabled at `chrome://extensions/`.
4. Remove and load the unpacked folder again if Chrome shows a manifest error.

If Chrome says the folder is invalid:

1. Make sure you selected the folder that contains `manifest.json`.
2. Do not select the parent Downloads folder.
3. Do not select the ZIP file itself. Extract it first.

## Privacy

See `PRIVACY.md`.

## Security

See `SECURITY.md`.

## DSN Rules

See `docs/sanitas-dsn-rules.md` for the safe custom rule format.

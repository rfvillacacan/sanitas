# Sanitas DSN Template Guide

DSN templates create safe JSON rules without raw regex. Active rules are stored only for the current browser session after you validate and apply them.

Use dummy examples while testing. Do not put production logs, customer data, real tokens, real emails, or real IPs into examples or screenshots.

## Workflow

1. Open the Sanitas floating window.
2. Select the `DSN Rules` tab.
3. Insert a template or the full safe example.
4. Edit the JSON using safe literal values.
5. Click `Validate Rules`.
6. Click `Apply to Current Session`.
7. Return to the `Text` tab and use `Clean` to test the rule.
8. Click `Clear` when done to remove mappings, custom terms, DSN rules, and workspace text.

## literal_terms

Detects exact words or phrases.

Example match:

```txt
Project Titan
```

Example output:

```txt
[[CUSTOM_TERM_0001]]
```

Common options:

- `terms`: literal strings to detect.
- `case_sensitive`: `true` or `false`.
- `match_word_boundary`: avoids matching inside longer words when `true`.
- `placeholder_type`: placeholder family, such as `CUSTOM_TERM`.

## labeled_value

Detects a value after a trusted label.

Example match:

```txt
DB_PASS=SafeDummyValue
```

Example output:

```txt
DB_PASS=[[DATABASE_SECRET_0001]]
```

Common options:

- `labels`: trusted labels such as `DB_PASS`.
- `separators`: separators such as `=` or `:`.
- `value_mode`: `until_whitespace`, `until_line_end`, or `quoted_value`.
- `placeholder_type`: placeholder family, such as `DATABASE_SECRET`.

## prefix_token

Detects tokens that start with a known prefix.

Example match:

```txt
sk_test_ABCDEF1234567890
```

Example output:

```txt
[[API_KEY_0001]]
```

Common options:

- `prefixes`: safe prefixes such as `sk_test_`.
- `min_length`: minimum token length after the prefix.
- `max_length`: maximum token length.
- `allowed_chars`: allowed token character family.
- `placeholder_type`: placeholder family, such as `API_KEY`.

## structured_id

Detects IDs with a predictable structure.

Example match:

```txt
DOC-INT-445566
```

Example output:

```txt
[[DOCUMENT_ID_0001]]
```

Common options:

- `prefixes`: required ID prefixes such as `DOC-INT-`.
- `segments`: ordered literal, digits, alpha, alnum, or hex segments.
- `placeholder_type`: placeholder family, such as `DOCUMENT_ID`.

## context_value

Detects weak values only when a trusted context label appears nearby.

Example match:

```txt
CVV: 123
```

Example output:

```txt
CVV: [[CARD_SECURITY_CODE_0001]]
```

Common options:

- `context_labels`: trusted labels such as `CVV`.
- `separators`: separators such as `:` or `=`.
- `value_kind`: `digits`, `alnum`, `token`, `date_mm_yy`, or `date_mm_yyyy`.
- `min_length` and `max_length`: value bounds.
- `placeholder_type`: placeholder family, such as `CARD_SECURITY_CODE`.

## Safety Rules

- Raw regex is not supported.
- Fields such as `regex`, `pattern`, `flags`, executable code, and remote update URLs are rejected.
- DSN contents must not be stored in `chrome.storage.local`.
- Applied DSN rules are cleared by Clear Session.

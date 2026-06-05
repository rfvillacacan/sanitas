# Sanitas DSN Rules

DSN means Detection Specification Notation. It is Sanitas' safe JSON rule format for adding current-session custom detection rules without giving users raw regex execution.

For template-button usage, examples, and common options, see [DSN Template Guide](dsn-template-guide.md).

Raw regex import is not allowed. DSN rules are validated against a strict allowlist schema, and unsafe fields such as `pattern`, `regex`, `flags`, `script`, `code`, `eval`, `function`, remote URLs, and similar executable or remote-update fields are rejected.

## Workflow

1. Open Sanitas Options.
2. Go to Custom DSN Rules.
3. Use Load DSN JSON File to place a local `.json` file into the textarea.
4. Use the template buttons if you want a safe starting point.
5. Edit the JSON directly in the textarea.
6. Use Pretty Format JSON when you want readable indentation.
7. Click Validate Rules.
8. If valid, click Apply to Current Session.
9. Use Backup / Export Rules to download the current textarea content.
10. Use Clear Session Rules to remove active DSN rules from the current browser session.

Applying rules does not store them in `chrome.storage.local`. Active DSN rules are stored only in `chrome.storage.session` through the service worker and are cleared by Clear Session.

## Editor Helpers

The Options page DSN editor includes these safe helper controls:

- Insert literal_terms template
- Insert labeled_value template
- Insert prefix_token template
- Insert structured_id template
- Insert context_value template
- Insert full example ruleset
- Pretty Format JSON
- Reset to Safe Example

Template buttons insert valid DSN JSON using dummy values only. If the textarea is empty, single-rule template buttons create a complete one-rule ruleset. If the textarea contains valid DSN JSON, single-rule template buttons append a rule to the existing `rules` array. Insert full example ruleset and Reset to Safe Example use a custom Sanitas modal before replacing non-empty editor text.

Pretty Format JSON only parses and formats the textarea content. It does not apply or store rules. Apply to Current Session always validates first; invalid DSN JSON is not stored.

## Base Schema

```json
{
  "schema_version": "1.0",
  "dsn_type": "sanitas_safe_rules",
  "ruleset_id": "company-rules",
  "name": "Company Rules",
  "version": "1.0.0",
  "description": "Safe custom detection rules for Sanitas.",
  "rules": [
    {
      "id": "PROJECT_NAMES",
      "type": "literal_terms",
      "enabled": true,
      "placeholder_type": "CUSTOM_TERM",
      "priority": 500,
      "terms": ["Project Titan", "Acme Corp"],
      "case_sensitive": false
    }
  ]
}
```

Required top-level fields:

- `schema_version`
- `dsn_type`
- `ruleset_id`
- `version`
- `rules`

Optional top-level fields:

- `name`
- `description`

Required rule fields:

- `id`
- `type`
- `enabled`
- `placeholder_type`

Common optional rule fields:

- `priority`
- `description`
- `case_sensitive`
- `max_matches`

`placeholder_type` must match `^[A-Z][A-Z0-9_]{1,39}$`.

## Supported Rule Types

### literal_terms

Detects literal terms such as project names, customer names, or internal code names.

```json
{
  "id": "PROJECT_NAMES",
  "type": "literal_terms",
  "enabled": true,
  "placeholder_type": "CUSTOM_TERM",
  "priority": 500,
  "terms": ["Project Titan", "Acme Corp"],
  "case_sensitive": false,
  "match_word_boundary": true
}
```

Terms are matched literally. Regex-looking characters are treated as normal text.

### labeled_value

Detects a value after a trusted label and separator. Sanitas replaces only the value.

```json
{
  "id": "DB_PASSWORD",
  "type": "labeled_value",
  "enabled": true,
  "placeholder_type": "DB_PASSWORD",
  "priority": 900,
  "labels": ["DB_PASS", "DB_PASSWORD"],
  "separators": ["=", ":"],
  "value_mode": "until_whitespace",
  "case_sensitive": false
}
```

Example:

```txt
DB_PASS=SuperSecretPassword!2026
```

becomes:

```txt
DB_PASS=[[DB_PASSWORD_0001]]
```

Supported `value_mode` values:

- `until_whitespace`
- `until_line_end`
- `quoted_value`
- `token`

### prefix_token

Detects tokens with known literal prefixes.

```json
{
  "id": "STRIPE_KEY",
  "type": "prefix_token",
  "enabled": true,
  "placeholder_type": "STRIPE_KEY",
  "priority": 950,
  "prefixes": ["sk_live_", "sk_test_"],
  "min_length": 20,
  "max_length": 120,
  "allowed_chars": "alpha_num_underscore_dash"
}
```

Supported `allowed_chars` values:

- `alpha_num`
- `alpha_num_dash`
- `alpha_num_underscore`
- `alpha_num_underscore_dash`
- `base64url`
- `hex`
- `token_safe`

### structured_id

Detects fixed-format IDs from known prefixes and controlled segments.

```json
{
  "id": "CONFIDENTIAL_DOC_ID",
  "type": "structured_id",
  "enabled": true,
  "placeholder_type": "CONFIDENTIAL_ID",
  "priority": 700,
  "prefixes": ["DOC-INT-"],
  "segments": [
    {
      "kind": "digits",
      "min": 4,
      "max": 12
    }
  ]
}
```

Supported segment kinds:

- `digits`
- `alpha`
- `alnum`
- `hex`
- `literal`

### context_value

Detects weak values only when a trusted context label exists.

```json
{
  "id": "CVV",
  "type": "context_value",
  "enabled": true,
  "placeholder_type": "CVV",
  "priority": 850,
  "context_labels": ["CVV", "CVC", "Security Code"],
  "separators": [":", "="],
  "value_kind": "digits",
  "min_length": 3,
  "max_length": 4
}
```

`123` alone is not detected. `CVV: 123` is detected.

Supported `value_kind` values:

- `digits`
- `date_mm_yy`
- `date_mm_yyyy`
- `token`
- `alnum`

## Safe Template Library

The built-in templates use reserved dummy values only:

- `Project Titan`
- `Acme Corp`
- `DB_PASS`
- `sk_test_`
- `DOC-INT-`
- `CVV`

Full example:

```json
{
  "schema_version": "1.0",
  "dsn_type": "sanitas_safe_rules",
  "ruleset_id": "sanitas-safe-example",
  "name": "Sanitas Safe Example Rules",
  "version": "1.0.0",
  "description": "Safe dummy DSN examples for local session testing.",
  "rules": [
    {
      "id": "PROJECT_NAMES",
      "type": "literal_terms",
      "enabled": true,
      "placeholder_type": "CUSTOM_TERM",
      "priority": 500,
      "terms": ["Project Titan", "Acme Corp"],
      "case_sensitive": false,
      "match_word_boundary": true
    },
    {
      "id": "DB_PASSWORD",
      "type": "labeled_value",
      "enabled": true,
      "placeholder_type": "DATABASE_SECRET",
      "priority": 900,
      "labels": ["DB_PASS"],
      "separators": ["=", ":"],
      "value_mode": "until_whitespace",
      "case_sensitive": false
    },
    {
      "id": "TEST_API_KEY",
      "type": "prefix_token",
      "enabled": true,
      "placeholder_type": "API_KEY",
      "priority": 950,
      "prefixes": ["sk_test_"],
      "min_length": 16,
      "max_length": 120,
      "allowed_chars": "alpha_num_underscore_dash",
      "case_sensitive": true
    },
    {
      "id": "INTERNAL_DOCUMENT_ID",
      "type": "structured_id",
      "enabled": true,
      "placeholder_type": "DOCUMENT_ID",
      "priority": 700,
      "prefixes": ["DOC-INT-"],
      "segments": [
        {
          "kind": "digits",
          "min": 4,
          "max": 12
        }
      ],
      "case_sensitive": true
    },
    {
      "id": "CARD_SECURITY_CODE",
      "type": "context_value",
      "enabled": true,
      "placeholder_type": "CARD_SECURITY_CODE",
      "priority": 850,
      "context_labels": ["CVV"],
      "separators": [":", "="],
      "value_kind": "digits",
      "min_length": 3,
      "max_length": 4,
      "case_sensitive": false
    }
  ]
}
```

The generated templates do not include `pattern`, `regex`, `flags`, `capture_group`, executable fields, remote URLs, or dynamic script fields.

## Storage and Security Model

- Active DSN rules are stored only in `chrome.storage.session`.
- The service worker owns all DSN session access.
- The options page communicates with the service worker by message.
- DSN summaries show only safe metadata: `hasDsnRules`, `rulesetCount`, `enabledRuleCount`, `ruleTypes`, and `placeholderTypes`.
- Summaries do not show terms, labels, prefixes, company names, or detected values.
- `chrome.storage.local` must not store imported DSN rules or textarea content.
- Clear Session clears active DSN rules, mappings, custom terms, workspace text, and output state.

## Limitations

- No raw regex rules.
- No JavaScript or remote-update rules.
- No visual rule builder in this version.
- DSN rules are session-only in this version.
- Users should export a backup if they want to keep a ruleset outside the current session.

Future versions may add an optional visual builder, reviewed bundled internal rules, or an encrypted persistent DSN vault. Developer-only regex mode remains disabled by default unless separately designed and approved.

# Translation backlog

`en.json` is the source of truth for the key set. The other ten locales lag
behind it. This directory holds one **worksheet per language**, so each can go
to a different native speaker independently.

Current state: **567 untranslated keys**, 0 dead keys.

| Language | Keys | Worksheet |
|---|---|---|
| Arabic | 60 | [`worksheets/ar.md`](worksheets/ar.md) |
| German | 60 | [`worksheets/de.md`](worksheets/de.md) |
| Spanish | 60 | [`worksheets/es.md`](worksheets/es.md) |
| French | 60 | [`worksheets/fr.md`](worksheets/fr.md) |
| Hindi | 60 | [`worksheets/hi.md`](worksheets/hi.md) |
| Japanese | 60 | [`worksheets/ja.md`](worksheets/ja.md) |
| Portuguese | 60 | [`worksheets/pt.md`](worksheets/pt.md) |
| Russian | 60 | [`worksheets/ru.md`](worksheets/ru.md) |
| Chinese | 60 | [`worksheets/zh.md`](worksheets/zh.md) |
| Tamil | 27 | [`worksheets/ta.md`](worksheets/ta.md) |

Tamil is the smallest and has no dead keys, so it is the cheapest to close out.

Untranslated keys fall back to English at runtime (`fallbackLng: 'en'`), so a
language being incomplete is a quality problem, not a broken build. Nothing
renders as a raw key name.

### By namespace

`register` (23) is the largest and the most customer-facing. `dashboard` (13)
and `confirmation` (9) follow. Each worksheet has a short note per namespace
about tone, so a reviewer spends attention on wording rather than mechanics.

## What is deliberately excluded

The `admin` namespace (254 keys) is **not** in the worksheets. Every `/admin/*`
route is role-gated to `role === 'admin'` and the admin chrome never renders
the language selector, so the admin console is an English-only internal tool.
This is the `EXEMPT_NAMESPACES` list in `frontend/scripts/i18n-parity.mjs`;
remove it if the admin portal is ever meant to be localised.

## Workflow

**1. Generate the worksheets** (after any change to `en.json`):

```bash
cd frontend
npm run i18n:parity:worksheets
```

**2. Hand a worksheet to a native speaker.** They fill in the `Translation`
column only. Each worksheet restates the rules, but the short version:

- Keep every `{{placeholder}}` exactly as written. They are substituted at
  runtime, so a renamed or dropped one renders literally in the UI.
- Do not translate product names, codes or units (`CyraCode`, `API`, `UPI`, `km`).
- Translate each plural/variant row separately rather than reusing one string.
- Blanks are fine. A partially finished worksheet is safe to apply.

**3. Apply the returned worksheet:**

```bash
cd frontend
node scripts/apply-i18n-worksheet.mjs ar ../i18n/worksheets/ar.md --dry-run
node scripts/apply-i18n-worksheet.mjs ar ../i18n/worksheets/ar.md
```

Always `--dry-run` first. The script refuses to write unless every translation
carries the same interpolation placeholders as its English source, the result
still parses, and no unrelated key moved. A rejected row blocks the whole write
rather than landing a half-broken string.

**4. Re-record the baseline and check the result:**

```bash
npm run i18n:parity          # what is still outstanding
npm run i18n:parity:write    # shrink the baseline
npm run i18n:parity:worksheets
npm test
```

## Guardrails

`src/__tests__/i18n/locale-parity.test.js` runs in CI. It does **not** require
the gap to be zero — that would have been red on arrival for a pre-existing
problem. It asserts the gap has not *grown* past
`locale-parity-baseline.json`:

- A new key added to `en.json` and not translated fails the suite, naming the key.
- A key a locale carries that `en.json` dropped fails the suite.
- Translating existing debt shrinks the baseline and keeps everything green.

So the debt can only get smaller, and new copy cannot quietly ship untranslated.
Re-recording the baseline with `npm run i18n:parity:write` is the one way to
widen the allowance, which is why it is a separate explicit command rather than
something the test does for you.

## Why these files are edited with scripts

The locale files are CRLF, UTF-8 without BOM, and contain hand-formatted quirks
(a stray trailing comma in `footer`, for one). A `JSON.stringify` rewrite
silently reformats all of them and buries the real change in the diff, so
`apply-i18n-worksheet.mjs` edits line-wise and verifies that every other key is
byte-identical. Keep it that way if you touch these files by hand.

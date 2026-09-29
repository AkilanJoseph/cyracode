# ta.json — translation worksheet

Language: **Tamil** · Missing keys: **27**

Fill in the `Translation` column and hand the file back. Do not edit the `Key` or
`English source` columns. Leave a row blank to skip it; blanks fall back to English
at runtime, so skipping is safe and non-blocking.

## Rules

- **Keep every `{{placeholder}}` exactly as written.** These are substituted at runtime;
  renaming or dropping one shows the user a raw placeholder.
- Do not translate text that is a product name, code, or unit (`CyraCode`, `API`, `UPI`, `km`).
- Preserve the trailing `?` / `!` / `:` style of the English source where the language uses them.
- Do not add HTML tags or line breaks unless the English source has them.
- One variant per row: if the English source is keyed per plural or per variant,
  translate each row separately rather than reusing a single translation.

## `dashboard`

> Count/plural strings are already keyed per variant — translate each row, do not merge them.

| Key | English source | Placeholders | Translation |
|---|---|---|---|
| `dashboard.api_code_label` | CyraCode | — | |
| `dashboard.api_code_placeholder` | e.g. TestHome | — | |
| `dashboard.api_key_hint` | Client keys are issued and managed by an administrator in the Admin Portal. | — | |
| `dashboard.api_key_label` | API key | — | |
| `dashboard.api_key_placeholder` | Paste the key issued by your administrator | — | |
| `dashboard.api_lookup_err_auth` | Invalid or missing API key (401). | — | |
| `dashboard.api_lookup_err_denied` | This client is not authorized for the address lookup API (403) — ask an admin to grant access. | — | |
| `dashboard.api_lookup_err_generic` | Lookup failed — please try again later. | — | |
| `dashboard.api_lookup_err_notfound` | CyraCode not found. | — | |
| `dashboard.api_result_title` | Authorized lookup result | — | |
| `dashboard.btn_lookup` | Look Up Address | — | |
| `dashboard.client_tools_desc` | Call the authorized CyraCode address lookup using the API key issued to you. | — | |
| `dashboard.client_tools_title` | Client API Lookup | — | |

## `errors`

> Validation messages. Prefer what the user should do next over what went wrong.

| Key | English source | Placeholders | Translation |
|---|---|---|---|
| `errors.name_no_longer_available` | This name is no longer available. Please select another name. | — | |

## `landing`

> Marketing copy on the public page. Longest strings in the set — check they fit the layout.

| Key | English source | Placeholders | Translation |
|---|---|---|---|
| `landing.mode_dashboard_desc` | Go to your dashboard without registering a location | — | |
| `landing.mode_dashboard_title` | Dashboard | — | |

## `register`

> Customer-facing. Tone should match the rest of the register flow, which uses short imperative labels. Keep any units/abbreviations as-is.

| Key | English source | Placeholders | Translation |
|---|---|---|---|
| `register.auto_generate_btn` | Auto Generate My Code | — | |
| `register.auto_generate_hint` | We'll create 10 unique names from your profile and a mix of fun themes — nature, space, myth, tech and more. | — | |
| `register.auto_generate_title` | Your personalized CyraCode name | — | |
| `register.chosen_label` | Your chosen CyraCode | — | |
| `register.generate_more` | Generate Another Set | — | |
| `register.select_suggestion_first` | Select one of the suggested names first | — | |
| `register.step_personalized_code` | Name & Location | — | |
| `register.suggestions_empty` | Click “Auto Generate My Code” to get 10 unique name ideas. | — | |
| `register.suggestions_hint` | These were just checked against the database — all available right now. Pick your favorite. | — | |
| `register.suggestions_loading` | Creating your personalized names… | — | |
| `register.suggestions_title` | Here are your personalized names | — | |

# IELTS question type coverage

This document defines how official IELTS Listening / Academic Reading question families map to the simulator JSON schema.

## Listening

| IELTS family | Simulator type | Status |
|---|---|---|
| Multiple choice — one answer | `mcq-single` | Supported |
| Multiple choice — choose TWO/THREE | `mcq-multi` | Supported; `maxSelect` is respected |
| Matching | `matching` | Supported |
| Plan / map / diagram labelling with an option bank | `map-labeling` | Supported |
| Form completion | `inline-gap` | Supported |
| Note completion | `inline-gap` | Supported |
| Table completion | `inline-gap` | Supported |
| Flow-chart completion | `inline-gap` | Supported |
| Summary completion | `inline-gap` | Supported |
| Sentence completion | `gap-fill` | Supported |
| Short-answer questions | `short-answer` | Supported |

## Academic Reading

| IELTS family | Simulator type | Status |
|---|---|---|
| Multiple choice — one answer | `mcq-single` | Supported |
| Multiple choice — multiple answers | `mcq-multi` | Supported |
| Identifying information (TRUE/FALSE/NOT GIVEN) | `tfng` | Supported |
| Identifying writer's views/claims (YES/NO/NOT GIVEN) | `ynng` | Supported |
| Matching information | `matching` | Supported |
| Matching headings | `matching-headings` | Supported |
| Matching features | `matching` | Supported |
| Matching sentence endings | `matching` | Supported |
| Sentence completion | `gap-fill` | Supported |
| Summary completion | `inline-gap` | Supported |
| Note completion | `inline-gap` | Supported |
| Table completion | `inline-gap` | Supported |
| Flow-chart completion | `inline-gap` | Supported |
| Diagram label completion — free text | `diagram-completion` | Added in V2 |
| Short-answer questions | `short-answer` | Supported |

## Layout notes

- `inline-gap` preserves arbitrary trusted HTML structure and replaces `{{n}}` with a live answer input, so forms, notes, tables and flow charts do not need separate logical question types.
- `diagram-completion` is distinct from `map-labeling`: the former accepts typed words/numbers; the latter chooses labels from a supplied option bank.
- `matching` deliberately covers several official labels because their scoring model is the same: each prompt maps to a shared answer bank.
- There is no separate logical `ordering` type in the IELTS schema used by this simulator. A drag/drop ordering-looking interface should be encoded according to the underlying matching relationship.
- Private-bank media should use `bank://assets/...`; the question-bank loader resolves those paths to authenticated in-memory blob URLs.

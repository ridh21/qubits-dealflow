# Read-only assistant

Ask DealFlow360 a question in plain English and get an answer out of the
database. *"How many quotations are pending approval?"* becomes SQL, runs against
Postgres, and comes back as a sentence — with the query it ran shown underneath.

It cannot create, update or delete anything. That is enforced by a Postgres role,
not by a prompt.

## Shape

One FastAPI microservice (`services/assistant`) holds the agent, reached only
through an auth-checked Next.js route.

| Piece | What it is | Where | Port |
| --- | --- | --- | --- |
| Postgres | existing dev database (`compose.dev.yml`) | Docker | 55432 |
| `assistant-api` | FastAPI: `/query`, `/health` | Docker | 8000 |
| LLM | OpenCode gateway, `gpt-5.5` | hosted API | — |
| Widget | `src/components/assistant/*`, in the internal shell | Next.js | 3000 |

```
Widget (bubble, bottom-right)
  │  POST /api/assistant/query      ← Next.js route handler, checks the internal session
  ▼
assistant-api :8000  /query
  │
  ├── LangGraph ReAct agent ── OpenCode gateway (writes the SQL)
  │        │
  │        └── query_database tool ── guard ── Postgres, as dealflow_readonly
  ▼
{ answer, sql }
```

## How read-only is actually enforced

A system prompt is a request, not a constraint, and the thing writing the SQL is
the untrusted part. So there are three layers, and only the first is load-bearing:

1. **The Postgres role.** `prisma/sql/readonly-role.sql` creates
   `dealflow_readonly` with `SELECT` and nothing else — no INSERT/UPDATE/DELETE,
   no DDL, no `CREATE` on `public` — plus `default_transaction_read_only = on`
   and a 15s `statement_timeout`. The assistant connects as this role and never
   as the application role. A fully jailbroken model still cannot write a row.
2. **The statement guard** (`app/readonly.py`). Rejects anything that is not a
   single `SELECT`/`WITH`, after stripping comments, string literals and quoted
   identifiers — so `WHERE "action" = 'DELETE'` is allowed and
   `/* x */ UPDATE ...` is not. Also caps result rows. It exists so a bad
   attempt becomes an error message the model can correct, rather than a
   Postgres permission fault mid-answer.
3. **The prompt** tells the model it is read-only, which mostly keeps it from
   trying in the first place.

`GET /health` reports `database.user` and `database.readOnly`, because pointing
the service at the application role is the one misconfiguration that silently
removes layer 1.

Access control is inherited from the app: the FastAPI service binds to
`127.0.0.1` and `/api/assistant/query` calls `requireInternal()` before
forwarding. The widget is mounted only in the internal shell — a customer-portal
version would need row-level scoping the agent does not have.

## Running it

```bash
pnpm assistant:up      # build + start the agent on top of the dev database
pnpm assistant:grant   # create the SELECT-only role (first run, and after migrations)
pnpm dev               # the Next.js app, as usual
```

Open any internal page and click the bubble in the bottom-right.

**Re-run `pnpm assistant:grant` after every `prisma migrate`.** `ALTER DEFAULT
PRIVILEGES` only covers tables created after it was set, so a migration adds
tables the role cannot read until the grants are refreshed.

### Health checks

```bash
curl -s localhost:8000/health | jq   # expect database.user = dealflow_readonly, readOnly = true
pnpm assistant:logs
```

Ask the agent directly, bypassing the browser:

```bash
curl -s localhost:8000/query \
  -H 'content-type: application/json' \
  -H "x-assistant-key: $ASSISTANT_SERVICE_KEY" \
  -d '{"question":"How many quotations are pending approval?"}' | jq
```

### Tests

```bash
pnpm assistant:test    # the SQL guard: what it accepts, and what it must not
```

## Where the schema knowledge comes from

`app/schema_digest.py` introspects `information_schema` on first use and builds a
compact one-line-per-table digest — 50 tables, 34 enums, foreign keys as arrows.
It is generated rather than hand-written because a hand-written schema goes stale
at the first migration, and a stale schema produces confidently wrong SQL.

What introspection *cannot* say lives in `app/prompt.py`: that `*Minor` columns
are paise (divide by 100), that `*Bp` columns are basis points, that
`Invoice.balanceMinor` is already net of payments and credit notes, that
outstanding and overdue are different questions, and which joins define pipeline
and revenue. Those are the things the model otherwise gets wrong by a factor
of 100.

The soft-delete rule sits between the two. Which tables carry `deletedAt` is
*derived* (`soft_deleted_tables()`) and pasted into the prompt as an explicit
list of 17 names, because a model asked to work it out from the column lists
guesses — and adds `"deletedAt" IS NULL` to `"Quotation"`, which has no such
column, costing a failed query and a retry on almost every question.

## Model selection and fallback

The gateway at `LLM_BASE_URL` multiplexes several upstream providers, and a
model stops working the moment its provider's daily quota is spent. Two distinct
failure modes, both observed while building this:

- **Pruned from the catalogue.** `/v1/models` went from 41 entries to 6 within a
  minute; `opencode-go/deepseek-v4-flash` simply vanished. `candidate_models()`
  filters against the live listing so these are skipped without wasting a call.
- **Listed but dead.** `xai/grok-4.6` stayed in the catalogue while returning
  `503 no_account_available` on every request. Listing is therefore only a hint,
  and the real protection is the retry loop in `graph.answer()`: on a 429/5xx it
  moves to the next model and the caller never sees the failure.

Non-capacity errors (a malformed request, a 400) are re-raised rather than
retried — falling back on those would just repeat the same mistake three times.

`GET /health` reports `model.configured` and `model.usable` (the live-filtered
candidate list), so you can see what it will actually reach for.

| Variable | Default | Why you'd change it |
| --- | --- | --- |
| `LLM_MODEL` | `gpt-5.5` | Fastest of the models this gateway serves (~6-7s per question). |
| `LLM_FALLBACK_MODELS` | `gpt-5.4-mini,xai/grok-4.6,opencode-go/deepseek-v4-flash` | Tried in order when the primary is out of capacity. |
| `ASSISTANT_MAX_RESULT_ROWS` | 30 | Ceiling on rows handed back to the model. |

## Verified behaviour

Checked against the seeded dev database:

- `dealflow_readonly` reads (`SELECT COUNT(*) FROM "Quotation"` → 42) but cannot write.
  `DELETE` and `CREATE TABLE` are refused twice over: by the read-only transaction default,
  and — with that default explicitly turned off inside a writable transaction — by
  `permission denied for table Quotation` / `permission denied for schema public`.
- "How many quotations are pending approval?" → "3 quotations are pending approval." (6.7s)
- "Which sales rep owns the most quotations?" → "Rahul Verma owns the most quotations,
  with 17 quotations." (7.2s, one query joining `Quotation` to `User`)
- "Delete every quotation" → *"I can only look things up in the database; I can't delete
  or modify quotations."* (2.5s, no query run)
- `/query` without `x-assistant-key` is refused with 401.

## History: the voice mode that was removed

This started as a voice assistant (LiveKit SFU + Silero VAD + Whisper STT +
Kokoro TTS + an agent worker) and was cut back to text. The pipeline did work
end to end, but it needed five extra containers and three pinned-version
landmines to stay working:

- `livekit-agents` 1.8.0 changed how `AgentSession` wires room audio into the
  STT node and broke transcription **silently** — the agent joined, greeted, and
  never heard anything. Only 1.6.5 worked.
- STT model choice dominated everything: `small.en` took ~9s per utterance on
  Docker CPU, `tiny.en` ~1.3s, hosted Groq ~0.7s.
- `useTrackVolume` defaults to `cloneTrack: false`, which points a Web Audio
  analyser at the same `MediaStreamTrack` the `<audio>` element is playing.
  Chrome renders that contention as high-pitched distortion.
- A stable room name per user meant refreshing the page rejoined an existing
  room whose agent had already closed its session — present, but deaf. LiveKit
  only dispatches an agent when a room is *created*, so the fix was one room per
  connection.

None of that is in the tree any more. If voice is ever wanted again, the
reference implementation is at `../voice-agent` and the notes above are the
traps to expect.

# Tasks — add-restaurant-pods

## 1. Schema & domain types

- [x] 1.1 Migration `supabase/migrations/<ts>_pulse_restaurant_pods.sql`: ADD COLUMN `pulses.seats_cap int`, `pulses.count_needed_by timestamptz`, `pulses.table_called_at timestamptz`; ADD COLUMN `pulse_responses.party_size int NOT NULL DEFAULT 0` (CHECK 0–3); CREATE `pulse_pods` + `pulse_pod_members` per design D4 (incl. unique one-pod-per-participant-per-pulse index)
- [x] 1.2 Extend `lib/pulse/types.ts`: pulse venue-fact fields, `partySize` on responses, `Pod`/`PodMember` rows, `PublicPulsePod`, headcount block on `PublicPulse` (verify: `npm run test` type-checks)
- [x] 1.3 Add `POD_NOUN` (and derived copy strings — no "RSVP", no "crew" in defaults) to `lib/pulse/copy.ts`

## 2. Repo layer + unit tests (PGlite)

- [x] 2.1 `repo.ts`: create-pulse accepts venue facts; respond accepts/updates `party_size`; reads return party sizes
- [x] 2.2 `repo.ts`: pod CRUD — open (owner auto-member), join-moves (atomic leave+join), leave, owner-only edit/delete, seats-full refusal, seats-below-members refusal, over-pulse rejection; every pod write bumps pulse `version`
- [x] 2.3 Headcount + snapshot reads: headcount Σ(1+party) over non-out; locked count over `updated_at <= count_needed_by`; after-count split; table-called idempotent set
- [x] 2.4 `repo.test.ts` coverage for every scenario in both spec deltas (run with `TEST_DATABASE_URL` + `--no-file-parallelism`, POOL_MAX=1)

## 3. Serialize + API routes

- [x] 3.1 `serialize.ts`: headcount block (people/guests/cap/cutoff/locked/afterCount/tableCalled) + `pods[]` (display names + member status/ETA only; nothing about podless participants)
- [x] 3.2 Create route (`/api/pulse/pulses`): accept optional `seatsCap`/`countNeededBy` with validation (positive; cutoff sane vs. window)
- [x] 3.3 Respond route (`/api/pulse/pulse-response`): accept optional `partySize` 0–3
- [x] 3.4 New routes `POST /api/pulse/pod` (open/edit/delete) and `POST /api/pulse/pod-member` (join/leave) with owner/self authorization per spec
- [x] 3.5 Table-called route or action on the state write path — anyone-with-link, idempotent

## 4. UI — both trees, both breakpoints

- [x] 4.1 `CreateForm.client.tsx`: optional "Table for" stepper + "Count needed by" picker (collapsed behind a single "reservation?" disclosure; unset = today's form)
- [x] 4.2 `Pulse.client.tsx` join flow: one-tap `in` unchanged; inline "anyone with you?" chips (Just me/+1/+2/+3) editable on own row
- [x] 4.3 Headcount meter + roster `+N` chips + soft-overflow line + locked-count chip + table-called toggle
- [x] 4.4 Pods section: pod cards (kind glyph, label, seats, member avatars, join/hop-in), "open a pod" sheet (kind/label/seats), owner edit/delete, move-confirmation copy
- [x] 4.5 Day-of grouping: pod rows render grouped ETA/here context from member statuses
- [x] 4.6 Verify mobile (~390px) AND desktop (≥1100px) trees; no flame motif outside hero; density at 3/12/50 scale
- [x] 4.7 Update `/p/s/preview` with venue-facts + pods fixture states so the whole workflow reviews without DB writes

## 5. Verification

- [x] 5.1 `npm run test` green; `npm run lint:web` clean; `npm run build:web` clean
- [x] 5.2 Hands-on browser run of the six-screen workflow (create with facts → join +1 → meter/overflow → open pod → join moves → day-of grouping) on both breakpoints
- [x] 5.3 Guardrail sweep: no new notification path introduced (grep sms/notify in the diff), no "RSVP" copy, pod noun only via copy constant

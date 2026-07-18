-- Dash/around/reconnect read-path indexes (speed-up-loading change).
--
-- pulses.created_by: pulsesForParticipant and dashPlansForCreator filter by creator alone; the
-- only existing index containing created_by is the composite idempotency unique (crew_id first),
-- which cannot serve this direction — every dash read seq-scans pulses without this.
create index if not exists pulses_created_by_idx
  on pulse.pulses (created_by);

-- crew_members.participant_id: the crew-overlap self-joins in who's-around (peopleAround) and
-- reconnect (staleCrewMates) enter the PK (crew_id, participant_id) from the participant side,
-- which the PK cannot serve — reverse-direction lookups seq-scan crew_members without this.
create index if not exists crew_members_participant_idx
  on pulse.crew_members (participant_id);

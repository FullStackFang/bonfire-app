-- Live Pulse B-test metrics. Run ad hoc; nothing else reads these. Funnel rows live in pulse.events
-- (kinds: open, name_set, status_set, spark_create, container_create, spark_wrap).

-- 1. PRIMARY: time-to-first-status — from a participant's first link open to their first status_set.
--    The thesis claim is "under ten seconds"; this is the distribution that tests it.
with firsts as (
  select participant_id,
         min(at) filter (where kind = 'open')       as first_open,
         min(at) filter (where kind = 'status_set') as first_status
  from pulse.events
  where participant_id is not null
  group by participant_id
)
select count(*) filter (where first_status is not null)                            as reached_status,
       count(*)                                                                    as opened,
       round(avg(extract(epoch from (first_status - first_open)))::numeric, 1)     as avg_secs,
       percentile_cont(0.5) within group (order by extract(epoch from (first_status - first_open))) as median_secs
from firsts
where first_open is not null and first_status is not null and first_status >= first_open;

-- 2. Sparks-per-container (does a board generate repeated micro-events, or sit idle?).
select c.name,
       count(s.id)                                              as sparks_total,
       count(s.id) filter (where s.closed_at is null and s.expires_at > now()) as sparks_live,
       c.created_at::date
from pulse.containers c
left join pulse.sparks s on s.container_id = c.id
group by c.id, c.name, c.created_at
order by sparks_total desc;

-- 3. Participants-per-spark distribution (does a spark "read as alive at 3–4"?).
with per_spark as (
  select s.id, s.title, s.container_id is not null as in_container,
         (select count(*) from pulse.spark_participation p where p.spark_id = s.id) as participants,
         (select count(*) from pulse.spark_participation p where p.spark_id = s.id and p.status = 'here') as made_it
  from pulse.sparks s
)
select participants, count(*) as sparks, sum(made_it) as total_made_it
from per_spark
group by participants
order by participants;

-- 4. Funnel counts by kind (sanity / drop-off at a glance).
select kind, count(*) as n, count(distinct participant_id) as distinct_participants
from pulse.events
group by kind
order by n desc;

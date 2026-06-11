-- Asker B-test metrics (spec v3.0). Run ad hoc; nothing else reads these.

-- 1. PRIMARY: struck hangs that happened (>=2 'here'), per circle per ISO week
select c.name, to_char(e.happens_at at time zone 'America/New_York', 'IYYY-"W"IW') as week,
       count(*) as hangs_happened
from asker.events e
join asker.circles c on c.id = e.circle_id
where (select count(*) from asker.attendance a where a.event_id = e.id and a.state = 'here') >= 2
group by 1, 2 order by 1, 2;

-- 2. PRIMARY: exit-poll incrementality (target: >=50% answering "no")
select c.name,
       count(*) filter (where not x.would_have_happened) as said_no,
       count(*) as total,
       round(100.0 * count(*) filter (where not x.would_have_happened) / nullif(count(*), 0), 0) as pct_incremental
from asker.exit_polls x
join asker.events e on e.id = x.event_id
join asker.circles c on c.id = e.circle_id
group by 1;

-- 3. Reply rate per round (is the asker heard? <40% by week 2 = iterate cadence/verbs)
select c.name, r.verb_emoji, r.proposed_at::date,
       (select count(*) from asker.replies rep where rep.round_id = r.id) as replies,
       (select count(*) from asker.members m where m.circle_id = c.id) as members,
       r.state
from asker.rounds r join asker.circles c on c.id = r.circle_id
where r.state <> 'queued'
order by r.proposed_at;

-- 4. Silent-expiry rate (liquidity health; expect high early, falling)
select c.name,
       count(*) filter (where r.state = 'expired') as expired,
       count(*) filter (where r.state = 'struck') as struck,
       round(100.0 * count(*) filter (where r.state = 'expired')
             / nullif(count(*) filter (where r.state in ('expired','struck')), 0), 0) as pct_expired
from asker.rounds r join asker.circles c on c.id = r.circle_id
group by 1;

-- 5. Hold rate (flake disease: held / holds opened; <50% = tighten windows)
select c.name,
       count(*) filter (where e.hold_decided_at is not null and e.state <> 'fell_through') as held,
       count(*) filter (where e.hold_opened_at is not null) as holds_opened
from asker.events e join asker.circles c on c.id = e.circle_id
group by 1;

-- 6. later -> in conversion (two-tenses value): later-nudged members who ended up confirmed/here
select
  count(*) filter (where exists (
    select 1 from asker.events e
    join asker.attendance a on a.event_id = e.id and a.member_id = l.member_id
    where e.round_id = l.context_id and a.state in ('confirmed','here')
  )) as converted,
  count(*) as nudged
from (select distinct member_id, context_id from asker.sms_log
      where kind = 'later_nudge' and status = 'sent') l;

-- 7. Strike concentration (same two people eating the product? tune K / composition)
select c.name, m.name as member,
       count(*) as times_in,
       round(100.0 * count(*) / nullif(sum(count(*)) over (partition by c.id), 0), 0) as pct_of_all_ins
from asker.attendance a
join asker.events e on e.id = a.event_id
join asker.circles c on c.id = e.circle_id
join asker.members m on m.id = a.member_id
where a.state in ('in','confirmed','omw','here')
group by c.id, c.name, m.name order by c.name, times_in desc;

-- 8. Places-tab opens (the free map-pull signal)
select c.name, count(*) as opens, count(distinct p.member_id) as distinct_members
from asker.page_views p
join asker.members m on m.id = p.member_id
join asker.circles c on c.id = m.circle_id
where p.page = 'places'
group by 1;

-- 9. SMS volume by kind per NY day (budget sanity)
select (sent_at at time zone 'America/New_York')::date as ny_day, kind, count(*)
from asker.sms_log group by 1, 2 order by 1, 2;

-- 10. Circle coverage (joined members; compare to chat headcount in the run log)
select c.name, count(m.id) as joined from asker.circles c
left join asker.members m on m.circle_id = c.id group by 1;

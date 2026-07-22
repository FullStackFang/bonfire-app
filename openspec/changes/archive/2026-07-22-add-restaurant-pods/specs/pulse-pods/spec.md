# pulse-pods

> "Pod" is a provisional noun. Every user-visible instance SHALL render through a single copy constant so a product rename never touches logic. DB object names keep `pod`.

## ADDED Requirements

### Requirement: A pulse can host pods
A pod SHALL belong to exactly one pulse and carry: a kind (`car` | `walk` | `meetup` | `other`), a length-capped label, an optional positive `seats` capacity (null = uncapped), an owner participant, and a tap-to-join member set. The owner SHALL be a member from creation. Pods SHALL be optional chrome: a pulse with zero pods renders exactly as before this capability.

#### Scenario: Zero pods, zero change
- **WHEN** a pulse has no pods
- **THEN** its views render with only the "open a pod" affordance and no pods section content

### Requirement: Opening a pod is egalitarian
Any participant identity on the pulse link SHALL be able to open a pod while the pulse is upcoming or live — no host or creator privilege exists. Tier-0 (unverified, appless) participants SHALL be able to open and join pods.

#### Scenario: A tier-0 guest opens a car pod
- **WHEN** an unverified link visitor with only a display name opens a pod (kind car, 4 seats)
- **THEN** the pod is created with them as owner-member and appears to all viewers on their next poll

### Requirement: One pod at a time, join moves you
A participant SHALL be a member of at most one pod per pulse. Joining a pod while a member of another SHALL atomically move the membership (leave + join), and the mover's own view SHALL state the move. Leaving a pod SHALL only ever be done by the member themselves. An over pulse SHALL reject pod writes.

#### Scenario: Joining a second pod moves the member
- **WHEN** a member of "Dana's car" taps join on the walking pod
- **THEN** they leave Dana's car and appear in the walking pod in one operation, and both rosters are correct on every viewer's next poll

### Requirement: Seat capacity is the only hard limit
When a pod has `seats` set, a join that would exceed it SHALL be refused with a full-pod response; uncapped pods SHALL always accept joins. This is the single hard capacity anywhere in the pulse system — pod seats are a physical fact, and the refusal SHALL carry no waitlist or notification.

#### Scenario: A full car refuses a fifth rider
- **WHEN** a pod with 4 seats has 4 members and another participant taps join
- **THEN** the join is refused as full and the participant's pulse response is unaffected

### Requirement: Owner-only edit and disband
Only the pod's owner SHALL edit its label or seats or delete it. Editing seats below current member count SHALL be refused. Deleting SHALL disband the pod — memberships are removed and no notification of any kind is sent.

#### Scenario: A non-owner cannot edit
- **WHEN** a member who is not the owner attempts to change a pod's seats
- **THEN** the write is rejected and the pod is unchanged

### Requirement: Pods ride the pulse state and its polling
Pods and memberships SHALL be serialized inside the existing pulse state payload (no separate read endpoint), exposing per member only their display name and their existing pulse status/ETA — never a phone, and never any signal about participants who joined no pod. Every pod write SHALL bump the pulse's `version` so existing ETag polling picks it up.

#### Scenario: A pod join appears via the normal poll
- **WHEN** a participant joins a pod and another viewer's ETag poll fires
- **THEN** the second viewer receives a changed payload containing the updated pod roster

#### Scenario: Podless participants leak nothing
- **WHEN** a pulse has 12 in and 7 of them are in pods
- **THEN** the payload carries no list, count, or flag identifying the 5 who are in no pod beyond their absence from pod rosters

### Requirement: Day-of ETA context is derived, not stored
The live view SHALL group members' existing statuses/ETAs by pod (e.g. a car "10 min out · ~4 people" from its members' `on_my_way` ETAs and member count, or "4 here now" when members are `here`). This grouping SHALL be a read-time join over existing response data — no new status writes, timers, or location data of any kind.

#### Scenario: A rolling car reads as a group
- **WHEN** a 4-member pod's owner is on_my_way with a 10-minute ETA
- **THEN** the pod row renders the ETA with the member count, with no new data written

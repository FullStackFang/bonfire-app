# pulse-save-prompt

## Purpose

The Partiful-style, always-skippable encouragement to attach a phone after an anonymous create or join — the "Save your pulse" delivery step and the "Save your spot" guest-join line — so the actor's work persists across devices. Never gates the underlying act.

## Requirements

### Requirement: Save-your-pulse step on delivery
After an unverified participant creates a standalone pulse, the delivery screen SHALL lead with a skippable save step that offers to attach a phone: a name field (only when the participant has no display name), a phone field, and the shared 6-digit SMS verification. It SHALL reuse the existing verify flow (`useVerifyFlow`) and SHALL carry a plain-language privacy reassurance. The copy-link and open-pulse actions SHALL remain available as a secondary "just grab the link" escape. This step SHALL never block delivery: the pulse already exists and its link works whether or not the participant verifies.

#### Scenario: Unverified creator sees the save step
- **WHEN** an unverified participant drops a standalone pulse
- **THEN** the delivery screen presents a "Save your pulse" step offering phone verification (plus a name field if they have no display name), with the copy-link and open-pulse actions still reachable below it

#### Scenario: Creator skips saving
- **WHEN** a creator on the save step chooses to just grab the link instead of verifying
- **THEN** they can copy the message and open the pulse, no phone is attached, and the pulse remains theirs on this device under the cookie identity

#### Scenario: Creator saves the pulse
- **WHEN** a creator completes phone verification from the save step
- **THEN** the pulse persists to their phone identity (surviving on any device where they verify that number) and the delivery screen reflects the saved state

#### Scenario: Already-verified creator sees no save step
- **WHEN** an already-verified participant drops a pulse
- **THEN** no save step is shown and the delivery screen presents only the delivery actions

### Requirement: Save-your-spot line on guest join
After an unverified guest sets their first status on a pulse, the pulse detail SHALL surface a single, soft, dismissible prompt offering to save their spot by attaching a phone, opening the same verify flow. Setting or changing status SHALL remain fully usable with cookie-only identity and SHALL NOT be gated by this prompt. Once dismissed or once the guest verifies, the prompt SHALL NOT reappear for that pulse.

#### Scenario: Anonymous guest joins and is offered to save
- **WHEN** an unverified guest opens a pulse link and sets a status for the first time
- **THEN** the status is recorded under their cookie identity and one soft "Save your spot" line appears offering phone verification

#### Scenario: Guest dismisses the save line
- **WHEN** a guest dismisses the save line without verifying
- **THEN** the line disappears, does not reappear for that pulse, and the guest's status remains recorded

#### Scenario: Status tap is never gated
- **WHEN** an unverified guest sets or changes their status
- **THEN** the change succeeds with no verification wall, regardless of whether the save line has been shown or dismissed

#### Scenario: Verified guest sees no save line
- **WHEN** a guest who is already verified sets a status
- **THEN** no save line is shown

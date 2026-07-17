# plan-coordination

## MODIFIED Requirements

### Requirement: AI proposes candidate options
The app SHALL, on plan creation, generate a small ranked set of candidate options (times and/or places) from the intent plus available context (the opener's known people, past venues, coarse locale), returned as validated structured data — never free prose parsed at runtime. Each option SHALL carry its time and/or place and a short rationale. The model SHALL be reached through a configurable model gateway (a `provider/model` selection resolved from configuration, not hardcoded), so the provider or model can change without a code change. Generation SHALL degrade to a deterministic default set drawn from context — never a hard failure of plan creation — when any of the following occur: no gateway credential is available, the gateway or provider errors or times out, a spend/budget limit is reached, or a rate limit is hit.

#### Scenario: Options are proposed
- **WHEN** a plan is created from an intent and a gateway credential is available
- **THEN** the opener sees a short ranked list of candidate options, each with a time and/or place and a one-line reason

#### Scenario: No gateway credential configured
- **WHEN** a plan is created and no gateway credential (API key or platform OIDC token) is present
- **THEN** the plan is still created and shows a small set of sensible default options — the gateway is never called

#### Scenario: Proposer failure degrades gracefully
- **WHEN** option generation errors or times out
- **THEN** the plan is still created and shows deterministic default options rather than an error

#### Scenario: Budget or rate limit degrades gracefully
- **WHEN** the gateway reports a spend/budget limit (402) or a rate limit (429)
- **THEN** the plan is still created with deterministic default options, and no error surfaces to the opener

#### Scenario: Model is selected by configuration
- **WHEN** the configured model is changed (a different gateway `provider/model` slug)
- **THEN** subsequent proposals use the new model with no code change

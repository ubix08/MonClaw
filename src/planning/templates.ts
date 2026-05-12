export const TASK_PLAN_TEMPLATE = `# Task Plan: {{TITLE}}

## Goal
{{GOAL}}

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [ ] Understand intent and constraints
- [ ] Identify key requirements
- [ ] Document findings in findings.md
- **Status:** in_progress

### Phase 2: Planning & Structure
- [ ] Define technical approach
- [ ] Create project structure
- [ ] Document decisions with rationale
- **Status:** pending

### Phase 3: Implementation
- [ ] Execute plan step by step
- [ ] Build incrementally
- [ ] Test as you go
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] Verify all requirements met
- [ ] Fix any issues found
- [ ] Document test results in progress.md
- **Status:** pending

### Phase 5: Delivery
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Update MISSION.md if milestone advanced
- **Status:** pending

## Key Questions
1.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |
`

export const FINDINGS_TEMPLATE = `# Findings

## Research Findings
-

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
-
`

export const PROGRESS_TEMPLATE = `# Progress Log

## Session: {{DATE}}

### Phase 1: Requirements & Discovery
- **Status:** in_progress
- **Started:** {{TIMESTAMP}}
- Actions taken:
  -
- Files created/modified:
  -

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
|      |       |          |        |        |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
|           |       | 1       |            |
`

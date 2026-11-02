# CURSOR MASTER PROMPT — LLM CONFIGURATION, RESEARCH EVALUATION AND STRICT $50 BUDGET CONTROL

## PROJECT CONTEXT

You are working on an existing RAG-assisted entrepreneurship education and business-plan development platform.

Repository:
https://github.com/canaydinn/chatbot-project

The platform will support a 10-week controlled educational research study involving approximately 100 students.

Students progressively develop a single integrated business plan. The experimental group uses a RAG-based learning assistant, while the control group follows the approved non-AI learning procedure.

The platform must support weekly assignments, persistent conversations, versioned submissions, independent evaluation, research logging, and blinded human expert assessment.

**IMPORTANT: Do not rebuild the project from scratch. First inspect the existing repository, architecture, authentication, database, API routes, deployment environment, and current AI integration. Preserve working functionality.**

## 1. FIXED LLM EVALUATOR CONFIGURATION

Configure two independent final business-plan evaluators:

**Evaluator A**
- Provider: OpenAI
- Target model: GPT-5.4
- Environment variable: OPENAI_EVALUATOR_MODEL
- Role: Independent research evaluator

**Evaluator B**
- Provider: Anthropic
- Target model: Claude Sonnet 5.5
- Environment variable: ANTHROPIC_EVALUATOR_MODEL
- Role: Independent research evaluator

Verify the exact provider API model identifiers, availability, pricing, and compatibility before implementation.

Do not silently substitute models. If a requested model is unavailable, report the issue and request administrator approval.

Store the exact model identifier and version used for every evaluation.

The evaluators must:

1. Evaluate the same final business-plan submission.
2. Use the same frozen eight-dimensional analytical rubric.
3. Use equivalent evaluation instructions.
4. Operate independently.
5. Never access each other's scores.
6. Never access experimental group assignments.
7. Never access student identities or RAG chat histories.
8. Return structured criterion-level scores and rationales.
9. Store evaluation metadata for reproducibility.

Use the following final rubric:

- Problem–Value Logic: 15%
- Evidence Quality: 15%
- Market Realism: 15%
- Commercialization and Revenue Model: 15%
- Operational Feasibility: 10%
- Financial Feasibility: 15%
- Risk and Assumption Management: 5%
- Cross-Sectional Coherence: 10%

Each criterion uses a behaviorally anchored 0–4 scoring scale.

The total score is calculated deterministically by the backend, not by trusting the LLM's arithmetic.

## 2. STRICT GLOBAL API BUDGET

Set the total research API budget to:

**USD 50.00**

This is a shared global budget covering:

- All 10-week RAG coaching conversations.
- All AI-generated formative feedback.
- All weekly LLM rubric assessments.
- V0–V1 evaluations for Weeks 1, 5, and 9.
- Pre-test and transfer-test LLM evaluations.
- Both independent final LLM evaluators.
- All embedding API calls, if paid embeddings are used.
- Retries, testing calls, and any other billable LLM operations.

Do not interpret $50 as an evaluation-only budget.

Do not allow separate provider budgets to exceed the global cap.

Implement a centralized BudgetManager service with persistent usage accounting.

All billable AI requests must pass through this service.

## 3. INITIAL BUDGET ALLOCATION

Use the following provisional budget allocation:

| Category | Budget |
|---|---:|
| 10-week RAG coaching | $30.00 |
| Weekly formative and V0–V1 evaluations | $6.00 |
| Pre-test and transfer-test evaluation | $4.00 |
| Final GPT-5.4 and Claude Sonnet 5.5 evaluations | $6.00 |
| Embeddings, retries and contingency | $4.00 |
| TOTAL | $50.00 |

These allocations are provisional planning limits, not guaranteed actual costs.

Before deployment, estimate expected token usage using verified current API pricing and representative sample documents.

If the proposed usage cannot fit within the budget, do not pretend it can.

Report the expected shortfall and recommend concrete reductions in request volume, token consumption, retrieval size, or non-evaluator model cost.

The two independent final evaluators must remain GPT-5.4 and Claude Sonnet 5.5 unless explicitly approved otherwise.

## 4. COST-EFFICIENT RAG COACHING

The RAG coaching model does not need to be the same model as the two final evaluators.

Inspect existing model integrations and recommend a low-cost model suitable for Turkish educational dialogue.

Use a separate configurable model:

RAG_COACH_MODEL

Optimize usage by:

- Limiting retrieved context size.
- Avoiding unnecessary conversation-history retransmission.
- Using compact rolling conversation summaries.
- Applying sensible maximum output tokens.
- Caching repeated knowledge retrieval and embeddings.
- Using local embeddings when technically appropriate.
- Restricting repeated requests with identical content.
- Preventing recursive or uncontrolled agent calls.
- Using fixed retrieval top-k limits.
- Avoiding expensive reasoning models for routine student interactions.

Do not sacrifice required educational functionality or research traceability merely to reduce token usage.

Preserve complete student interaction logs in the authorized research database even when only summarized context is sent to the LLM.

## 5. STUDENT USAGE QUOTAS

Implement configurable per-student and per-week AI quotas.

Suggested starting configuration:

- Maximum 5 RAG coaching requests per student per week.
- Maximum 10 weeks.
- Approximately 100 students.
- Maximum 5,000 coaching requests if all quotas are used.

These are initial limits and must be validated against realistic token costs.

Do not count local form editing, document saving, or non-AI application actions against AI request quotas.

Display remaining AI requests to students.

Do not display monetary research costs to students.

Allow authorized instructors to adjust quotas before a study phase starts.

Log quota changes and preserve the effective policy for each participant and week.

Avoid changing quotas differentially between participants within the same experimental condition.

## 6. HARD BUDGET ENFORCEMENT

Implement server-side budget enforcement with database-backed atomic reservations.

Before each API request:

1. Identify the provider, model, operation and estimated token consumption.
2. Load the current verified pricing configuration.
3. Estimate the maximum permitted request cost.
4. Check remaining global and category budgets.
5. Atomically reserve sufficient budget.
6. Reject the request if sufficient budget is unavailable.
7. Execute the API call.
8. Record actual provider usage.
9. Reconcile the reservation against actual cost.
10. Release unused reserved budget.

Use transaction-safe concurrency control to prevent simultaneous requests from overspending the cap.

Account for provider-side minimum charges, cached-token pricing, retries, and unexpected output usage.

Reserve against a conservative maximum cost, not merely the average estimated cost.

Set explicit input/output token limits and request timeouts.

Do not automatically retry paid requests without checking budget availability.

Prevent duplicate evaluations using idempotency keys.

If provider billing data is delayed or a cost cannot be bounded reliably, stop new billable requests and require administrator review.

**Never claim an absolute provider billing guarantee solely from application-side budget controls.**

Recommend provider-side billing alerts and spending controls wherever available.

## 7. BUDGET ALERTS AND EMERGENCY SHUTDOWN

Create the following thresholds:

- 50% usage ($25): informational notification.
- 80% usage ($40): administrator warning.
- 90% usage ($45): critical warning.
- 100% usage ($50): block all new billable AI requests.

Provide an administrator-only emergency stop control.

When the budget is exhausted:

- Preserve all existing student work.
- Keep non-AI application functions operational.
- Disable new billable RAG and evaluation calls.
- Queue unfinished evaluations only if explicitly approved.
- Do not silently switch to another paid provider.
- Show students a neutral service availability message.
- Log the interruption for research integrity analysis.

## 8. RESEARCH EVALUATION WORKFLOW

Final evaluation:

- Approximately 100 anonymized business plans.
- GPT-5.4 evaluates each plan independently.
- Claude Sonnet 5.5 evaluates each plan independently.
- Approximately 200 LLM evaluations in total.

Human validation:

- Select 40 plans using the predefined stratified sampling protocol.
- Assign the same 40 plans to three independent experts.
- Experts evaluate through a blinded in-app interface.
- Export anonymized scores for statistical analysis.

The student must not see numerical research scores during the intervention.

Do not use the RAG coaching model's feedback as an independent final evaluation.

Store:

- evaluation_id
- anonymized_plan_id
- evaluator_provider
- exact_model_id
- rubric_version
- prompt_version
- criterion_scores
- weighted_total
- rationale
- input_tokens
- output_tokens
- estimated_cost_usd
- actual_cost_usd
- evaluation_timestamp
- evaluation_status

## 9. RESEARCH AND COST DASHBOARD

Create an instructor-only dashboard displaying:

- Total approved budget.
- Actual recorded spend.
- Outstanding reserved budget.
- Remaining available budget.
- Spend by provider.
- Spend by model.
- Spend by research operation.
- Spend by study week.
- Total coaching requests.
- Total completed evaluations.
- Pending evaluations.
- Estimated cost of completing remaining research activities.
- Budget exhaustion forecast.

Never expose API keys or provider credentials to the frontend.

## 10. DATABASE DESIGN

Inspect the current database before proposing migrations.

Implement or adapt the following logical entities:

- ai_model_configs
- ai_pricing_versions
- ai_budget_policies
- ai_budget_reservations
- ai_usage_events
- ai_request_quotas
- ai_request_idempotency
- evaluation_runs
- evaluation_scores
- research_audit_events

Use decimal-safe monetary calculations, preferably integer micro-USD units.

Do not use floating-point arithmetic for budget enforcement.

Store pricing effective dates and preserve historical prices for cost auditing.

## 11. CONFIGURATION

Provide environment-based configuration for:

OPENAI_API_KEY
ANTHROPIC_API_KEY
OPENAI_EVALUATOR_MODEL
ANTHROPIC_EVALUATOR_MODEL
RAG_COACH_MODEL
GLOBAL_AI_BUDGET_USD=50
RAG_COACH_BUDGET_USD=30
WEEKLY_EVALUATION_BUDGET_USD=6
TRANSFER_EVALUATION_BUDGET_USD=4
FINAL_EVALUATION_BUDGET_USD=6
AI_CONTINGENCY_BUDGET_USD=4
MAX_RAG_REQUESTS_PER_STUDENT_PER_WEEK=5

All API keys must remain server-side.

Do not commit secrets or real environment files to Git.

## 12. TESTING REQUIREMENTS

Write automated tests for:

1. Budget reservation and reconciliation.
2. Concurrent requests near the global limit.
3. Budget exhaustion and recovery.
4. Provider API errors and timeouts.
5. Duplicate evaluation prevention.
6. Token-limit enforcement.
7. Quota reset between study weeks.
8. Correct separation of research groups.
9. Blinded evaluator inputs.
10. Immutable evaluation records.
11. Missing or unavailable requested model IDs.
12. Pricing changes during the study.
13. Failure to obtain reliable usage data.
14. Preservation of student work when AI services are suspended.

## 13. IMPLEMENTATION PROCESS

First inspect the existing repository.

Then produce:

A. Current architecture audit.

B. Verified availability and API model IDs for GPT-5.4 and Claude Sonnet 5.5.

C. Current provider pricing and estimated costs.

D. A realistic 10-week token budget simulation for approximately 100 students.

E. Recommended low-cost RAG coaching model.

F. Database migration plan.

G. BudgetManager design.

H. Evaluation workflow architecture.

I. Security and research integrity risks.

J. Phased implementation plan.

**Do not begin major code changes until the architecture, model availability, cost simulation, and implementation plan have been reviewed and approved.**

The $50 global cap and the two selected independent evaluator model families are fixed research requirements.

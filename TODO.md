# Repository Refactoring TODO

A focused set of pragmatic refactors to reduce duplication, fix correctness issues, and improve maintainability. Each section includes rationale, impact, and actionable steps.

---

# 1) Single Source of Truth for Prompt Component Registry

Rationale:
- Components are registered in two places: `template-builder/template-processor.ts` and `template-builder/component-registry.ts`. This duplication invites drift and defects.

Impact:
- Fewer “why isn’t my component showing up?” moments.
- Clear place to add/rename components.

Actionable Steps:
- Make `PromptTemplateBuilder` reuse `promptComponents` from `template-builder/component-registry.ts`.
- Remove the internal, duplicated registry in `template-processor.ts`.
- Verify all template builds (single-shot, chunk-analysis, consolidation) resolve components from the shared registry.
- Ensure `getComponentContent()` remains the only helper used by chunking code to fetch component content.

Acceptance:
- Only one code path defines the component registry.
- Adding/removing a component requires changes in a single file.

---

# 2) Correct CLI Path Resolution for Linux

Rationale:
- `getCliPath()` returns an OSX binary path on Linux. This is a correctness bug and user-hostile.

Impact:
- Linux users can run the CLI without manual surgery.

Actionable Steps:
- Update `src/utils/PlatformUtils.ts#getCliPath`:
  - `win32` → `cli/bin/win-x64/dotnet-flow.exe`
  - `darwin` (`arm64` vs `x64`) → `cli/bin/osx-arm64` or `cli/bin/osx-x64`
  - `linux` → `cli/bin/linux-x64` (or add per-arch if available)
  - For unsupported platforms, throw an explicit error.
- If Linux binaries aren’t yet shipped, fail fast with a clear message pointing to docs.

Acceptance:
- Path is correct for Windows/Mac/Linux.
- Linux failure is explicit when binaries aren’t available.

---

# 3) Replace Global RateLimiter Singleton with Instance Per Provider

Rationale:
- `RateLimiter.getInstance()` is global and reused accidentally across contexts. This causes unexpected throughput coupling.

Impact:
- Predictable concurrency per provider; easier to reason about performance and throttling.

Actionable Steps:
- Refactor `providers/RateLimiter.ts` to a regular class (remove static singleton).
- Instantiate `new RateLimiter(1)` directly in `BedrockProvider` (and in any future provider needing rate limiting).
- Ensure no remaining references to `getInstance`.

Acceptance:
- No static/global instance remains.
- Tests/behavior confirm concurrency is scoped to each provider.

---

# 4) Clarify Provider Initialization (Bedrock) and Error Ordering

Rationale:
- `BedrockProvider.initialize()` sets `initialized = true` without a model, but `isInitialized()` returns false because `client` is null. Command error handling checks `isInitialized()` before “no model selected,” producing confusing messages.

Impact:
- Users get the right, actionable message (“Select a model”) instead of “No AI provider available.”

Actionable Steps:
- In `DocumentThisCommand.setupExecutionContext()`:
  - Check `provider` exists.
  - Check `provider.currentModelId` is non-empty (error: “Select AI model”).
  - Then check `provider.isInitialized()` (error: “Provider not initialized”).
- Optionally rework `BedrockProvider.isInitialized()` semantics to reflect readiness vs. client availability, but the ordering fix above is sufficient.

Acceptance:
- When no model is selected, users see the clear “Select AI model” guidance.

---

# 5) Normalize Combined Model Setting Parsing/Formatting

Rationale:
- The combined setting (`dotnetFlow.model`) is parsed and written in multiple places with inconsistent whitespace and token handling, causing subtle mismatches (e.g., current selection not marked).

Impact:
- Consistent UX when selecting and persisting models.

Actionable Steps:
- Create a small helper (e.g., `providers/modelSetting.ts`):
  - `parseCombinedModel(value: string): { providerId: string; modelToken: string } | null`
  - `formatCombinedModel(providerId: string, modelNameOrId: string): string`
- Use it in:
  - `providers/index.ts#initializeProviderSystem`
  - `commands/SelectModelCommand`
  - `extension.ts#migrateDeprecatedSettings`
- Normalize on read (trim both sides), write without padding spaces around the pipe (use `provider|model` consistently).

Acceptance:
- The selection checkmark appears reliably in “Select Model”.
- Config always stores a normalized `provider|model` value.

---

# 6) Extract a `TraceService` to Deduplicate CLI Trace Generation

Rationale:
- `DocumentThisCommand` and `TraceCommand` both build near-identical CLI arguments and run the same CLI; changes will duplicate everywhere.

Impact:
- One change point for CLI invocation and arguments.
- Commands remain focused on presentation and orchestration.

Actionable Steps:
- Create `src/services/TraceService.ts`:
  - `generateTrace(cli, config, extensionPath, solutionUri, className, methodName, verbosity: 'graph' | 'graph,code', extraArgs: string[])`
- Replace inline CLI invocations in:
  - `DocumentThisCommand.generateCodeTrace`
  - `TraceCommand.generateTrace`
- Keep responsibility boundaries:
  - `TraceService` builds args and returns stdout.
  - Commands decide verbosity/flags.

Acceptance:
- Both commands call the same shared service.
- No inlined flag assembly remains in commands.

---

# 7) Demote or Gate Verbose Model Logging and Remove Unused Parameter

Rationale:
- `logBuiltInModelDetails` logs noisy info at activation and takes a `providerRegistry` it doesn’t use.

Impact:
- Cleaner logs; easier troubleshooting signal-to-noise.

Actionable Steps:
- Remove the unused `providerRegistry` parameter.
- Change logs to `logger.debug` or guard behind a debug setting (e.g., `dotnetFlow.debug.logModels`).
- Keep failure logs as `error`.

Acceptance:
- Activation logs are quiet unless debug is enabled.
- Function signature aligns with usage.

---

# 8) BuiltInTokenManager: Clean Partial Model Mapping and Prefer Live Limits

Rationale:
- Partial mappings reference models not in `MODEL_LIMITS` (e.g., `'gpt-4-turbo'`), which is misleading. VS Code APIs sometimes expose `maxInputTokens` directly.

Impact:
- More accurate token budgeting and fewer surprises.

Actionable Steps:
- Either:
  - Add proper entries to `MODEL_LIMITS` for partials you intend to support, or
  - Remove dead branches and rely on defaults for unknown models.
- When available, prefer `currentModel.maxInputTokens` over static guesses.
- Document how estimation behaves (fallback ratio) for visibility.

Acceptance:
- `getMaxInputTokens` and `getMaxOutputTokens` return realistic values.
- No unmatched “partial” branches linger.

---

# 9) Align CLI Error Messaging and Decide Fate of `cliBuild`

Rationale:
- `CliService` mentions `dotnetFlow.cliBuild`, but CLI path now flows through `getCliPath()`; message is misleading. If `cliBuild` is an override, wire it end-to-end; otherwise, remove it.

Impact:
- Users get actionable error messages.

Actionable Steps:
- Decide:
  - Keep `cliBuild` as a user override? If yes, have `ConfigService.getCliPath()` read and resolve it, falling back to platform default.
  - If no, remove `cliBuild` from config types and messages.
- Update `CliService` ENOENT error to explain missing platform binary or mispackaging, and point to docs.

Acceptance:
- Error text reflects reality and helps users fix issues.
- No dead configuration knobs.

---

# 10) Small Consistency/Quality Nits

Rationale:
- Paper cuts that reduce confusion and incidental complexity.

Actionable Steps:
- `commands/SelectModelCommand`:
  - When computing current selection, trim tokens around `|` before comparison so the checkmark is correct.
- `providers/index.ts#initializeProviderSystem`:
  - When falling back to built-in, write a normalized combined value (use helper from #5), not `'built-in | '`.
- `core/BaseCommand.providerActions`:
  - Import command IDs from `config/ConfigConstants` instead of hardcoding.
- `extension.ts#migrateDeprecatedSettings`:
  - Use the same normalize/format helpers from #5; avoid writing combined values with inconsistent spacing.
- `prompts/index.ts#getProviderDisplayName`:
  - Consider pulling display names from the provider catalog for consistency (avoid drifting strings).

Acceptance:
- No ad-hoc strings for command IDs/config keys.
- Combined model values are consistently formatted across the codebase.

---

# Suggested Execution Order

1) #1 Component registry consolidation (small blast radius, high win)
2) #2 Linux CLI path fix (correctness)
3) #3 RateLimiter instance per provider (untangle global state)
4) #4 Provider initialization/error ordering (user-facing correctness)
5) #5 Combined model parse/format helper and normalization
6) #6 Extract TraceService to dedupe CLI invocations
7) #7 Logging cleanups
8) #8 Token manager realism
9) #9 CLI error alignment and config decision
10) #11 Nits and polish

---

# Acceptance Checklist

- [x] All component resolution goes through one registry.
- [x] Linux CLI path resolves correctly or fails with a clear message.
- [x] No global/singleton `RateLimiter`; Bedrock uses a local instance.
- [x] “Select a model” error shows up in the right situations.
- [x] Combined model values are consistently parsed/written.
- [ ] CLI invocation code lives in a single service.
- [ ] Model logging is quiet by default; debug-gated when needed.
- [ ] BuiltIn token limits rely on live info when available; static mappings are clean.
- [ ] CLI errors guide users to the right fix; `cliBuild` is either supported or removed.
- [ ] Minor consistency issues addressed.

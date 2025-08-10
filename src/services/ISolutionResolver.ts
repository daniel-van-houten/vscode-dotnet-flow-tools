import * as vscode from 'vscode';

/**
 * Describes how a solution was chosen for a given document.
 *
 * - 'project-membership': Found the nearest project (e.g. .csproj) for the document and matched it to a solution that includes it.
 * - 'configured-default': Used a user-configured default solution for the workspace folder.
 * - 'user-selection': The user selected a solution via a QuickPick prompt.
 * - 'nearest-solution': Chose the solution file with the shortest directory distance to the document when membership was inconclusive.
 * - 'workspace-default': Fallback to the first solution found in the active workspace folder.
 * - 'fallback': Final catch-all when no better resolution strategy applied.
 */
export type ResolutionStrategy =
  | 'project-membership'
  | 'configured-default'
  | 'user-selection'
  | 'nearest-solution'
  | 'workspace-default'
  | 'fallback';

/**
 * Options controlling solution resolution behavior.
 */
export interface SolutionResolverOptions {
  /**
   * Whether to show a prompt when multiple candidate solutions exist or when no clear winner can be determined.
   * Default: true
   */
  allowPrompt?: boolean;

  /**
   * Whether to remember the user's selection for future resolutions in the same workspace folder.
   * Default: true
   */
  rememberChoice?: boolean;

  /**
   * Whether to prefer a user-configured default solution for the workspace folder when available.
   * Default: true
   */
  preferConfiguredDefault?: boolean;

  /**
   * Optional cancellation token for resolving operations.
   */
  cancellationToken?: vscode.CancellationToken;
}

/**
 * The result of resolving a solution for a given document/URI.
 */
export interface SolutionResolution {
  /**
   * The resolved solution (.sln) file URI.
   */
  solution: vscode.Uri;

  /**
   * The workspace folder that contains the document and the solution.
   */
  workspaceFolder: vscode.WorkspaceFolder;

  /**
   * The nearest project file (e.g., .csproj) discovered while resolving, if any.
   */
  projectUri?: vscode.Uri;

  /**
   * Strategy used to determine the solution.
   */
  strategy: ResolutionStrategy;

  /**
   * Whether the result originated from an in-memory cache for faster lookups.
   */
  fromCache: boolean;

  /**
   * When a prompt was necessary, the set of candidate solutions considered.
   */
  candidates?: vscode.Uri[];
}

/**
 * Service interface for resolving the correct .NET solution and workspace folder for a given document/URI.
 *
 * Implementations should:
 * - Prefer project membership (match nearest project to solutions that include it).
 * - Scope search to the workspace folder containing the document.
 * - Use a user-configured default solution when available (opt-in).
 * - Prompt the user on ambiguity (opt-in) and optionally remember the choice.
 * - Cache parsed solution metadata and remembered selections to minimize prompts.
 */
export interface ISolutionResolver {
  /**
   * Resolve the appropriate solution and workspace folder for the given text document.
   */
  resolveForDocument(
    document: vscode.TextDocument,
    options?: SolutionResolverOptions
  ): Promise<SolutionResolution>;

  /**
   * Resolve the appropriate solution and workspace folder for the given URI.
   */
  resolveForUri(
    uri: vscode.Uri,
    options?: SolutionResolverOptions
  ): Promise<SolutionResolution>;

  /**
   * Clear internal caches (parsed solutions, remembered selections).
   * - 'all': clear everything
   * - 'folder': clear cache entries for the active folder only (if provided)
   * - WorkspaceFolder: clear for the specific folder
   */
  clearCache(scope?: 'all' | 'folder' | vscode.WorkspaceFolder): void;
}

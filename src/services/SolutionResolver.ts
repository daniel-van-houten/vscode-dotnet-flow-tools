import * as vscode from "vscode";
import * as path from "node:path";
import { FILE_PATTERNS } from "../config/ConfigConstants";
import { ResourceNotFoundError } from "../core/ErrorTypes";
import {
  ISolutionResolver,
  SolutionResolution,
  SolutionResolverOptions,
  ResolutionStrategy,
} from "./ISolutionResolver";

/**
 * Resolve the correct .sln for a given document/URI using:
 * 1) Remembered selection (workspaceState)
 * 2) Configured default (dotnetFlow.defaultSolution)
 * 3) Project membership (nearest *.csproj/*.fsproj contained in solution)
 * 4) QuickPick fallback (optional)
 * 5) Nearest solution heuristic
 */
export class SolutionResolver implements ISolutionResolver {
  // Cache parsed solution -> project absolute paths
  private readonly slnProjectCache = new Map<string, Set<string>>();

  // Remembered selections per workspace folder path
  private readonly rememberedSelectionKeyPrefix = "solutionResolver.selection";

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveForDocument(
    document: vscode.TextDocument,
    options?: SolutionResolverOptions,
  ): Promise<SolutionResolution> {
    return this.resolveForUri(document.uri, options);
  }

  async resolveForUri(
    uri: vscode.Uri,
    options?: SolutionResolverOptions,
  ): Promise<SolutionResolution> {
    const allowPrompt = options?.allowPrompt !== false;
    const rememberChoice = options?.rememberChoice !== false;
    const preferConfiguredDefault = options?.preferConfiguredDefault !== false;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      throw new ResourceNotFoundError(
        "File is not within a workspace folder",
        "workspace-folder",
      );
    }

    // Enumerate .slns within the active workspace folder only
    const solutions = await this.findSolutionsInFolder(workspaceFolder);
    if (solutions.length === 0) {
      throw new ResourceNotFoundError(
        "Solution (.sln) not found in the active workspace folder",
        "solution",
      );
    }

    // 1) Remembered selection (workspaceState)
    const remembered = this.getRememberedSelection(workspaceFolder);
    if (remembered) {
      const matched = this.findMatchingSolutionByPath(solutions, remembered);
      if (matched) {
        return {
          solution: matched,
          workspaceFolder,
          strategy: "user-selection",
          fromCache: true,
        };
      }
    }

    // 2) Configured default (setting)
    if (preferConfiguredDefault) {
      const configured = await this.getConfiguredDefaultSolution(
        workspaceFolder,
        solutions,
      );
      if (configured) {
        return {
          solution: configured,
          workspaceFolder,
          strategy: "configured-default",
          fromCache: false,
        };
      }
    }

    // 3) Project membership
    const projectUri = await this.findNearestProjectFile(
      uri,
      workspaceFolder,
      options?.cancellationToken,
    );
    if (projectUri) {
      const candidates = await this.filterSolutionsByProjectMembership(
        solutions,
        projectUri,
      );

      if (candidates.length === 1) {
        return {
          solution: candidates[0],
          workspaceFolder,
          projectUri,
          strategy: "project-membership",
          fromCache: false,
        };
      }

      if (candidates.length > 1) {
        if (allowPrompt) {
          const picked = await this.promptForSolution(
            workspaceFolder,
            uri,
            candidates,
          );
          if (!picked) {
            throw new vscode.CancellationError();
          }

          if (rememberChoice) {
            const remember = await this.promptRememberSelection();
            if (remember) {
              this.rememberSelection(workspaceFolder, picked);
            }
          }

          return {
            solution: picked,
            workspaceFolder,
            projectUri,
            strategy: "user-selection",
            fromCache: false,
            candidates,
          };
        }

        // No prompts allowed -> nearest solution heuristic
        const nearest = this.pickNearestSolution(uri, candidates);
        return {
          solution: nearest,
          workspaceFolder,
          projectUri,
          strategy: "nearest-solution",
          fromCache: false,
          candidates,
        };
      }
    }

    // 4) No membership or 0 candidates -> prompt among all solutions or pick nearest
    if (allowPrompt) {
      const picked = await this.promptForSolution(
        workspaceFolder,
        uri,
        solutions,
      );
      if (!picked) {
        throw new vscode.CancellationError();
      }

      if (rememberChoice) {
        const remember = await this.promptRememberSelection();
        if (remember) {
          this.rememberSelection(workspaceFolder, picked);
        }
      }

      return {
        solution: picked,
        workspaceFolder,
        projectUri,
        strategy: "user-selection",
        fromCache: false,
        candidates: solutions,
      };
    }

    // 5) Nearest solution heuristic
    const nearest = this.pickNearestSolution(uri, solutions);
    return {
      solution: nearest,
      workspaceFolder,
      projectUri,
      strategy: "nearest-solution",
      fromCache: false,
      candidates: solutions,
    };
  }

  clearCache(scope?: "all" | "folder" | vscode.WorkspaceFolder): void {
    if (!scope || scope === "all") {
      this.slnProjectCache.clear();
      // Do not wipe remembered selections globally unless explicitly desired.
      return;
    }

    if (scope === "folder") {
      const folder =
        vscode.window.activeTextEditor &&
        vscode.workspace.getWorkspaceFolder(
          vscode.window.activeTextEditor.document.uri,
        );

      if (!folder) {
        return;
      }

      this.clearFolderEntries(folder);
      return;
    }

    // scope is a specific workspace folder
    this.clearFolderEntries(scope);
  }

  // -------- Internal helpers --------

  private clearFolderEntries(folder: vscode.WorkspaceFolder): void {
    // Clear solution cache entries for solutions under this folder
    const prefix = canonicalPath(folder.uri.fsPath) + path.sep;
    for (const slnPath of Array.from(this.slnProjectCache.keys())) {
      if (slnPath.startsWith(prefix)) {
        this.slnProjectCache.delete(slnPath);
      }
    }

    // Clear remembered selection
    this.forgetSelection(folder);
  }

  private async findSolutionsInFolder(
    folder: vscode.WorkspaceFolder,
  ): Promise<vscode.Uri[]> {
    const pattern = new vscode.RelativePattern(folder, FILE_PATTERNS.SOLUTION);
    return vscode.workspace.findFiles(pattern);
  }

  private async getConfiguredDefaultSolution(
    folder: vscode.WorkspaceFolder,
    solutions: vscode.Uri[],
  ): Promise<vscode.Uri | undefined> {
    const config = vscode.workspace.getConfiguration("dotnetFlow", folder);
    const configured = (config.get<string>("defaultSolution") || "").trim();
    if (!configured) {
      return undefined;
    }

    // Try absolute path match
    const absoluteConfigured = canonicalPath(
      path.isAbsolute(configured)
        ? configured
        : path.join(folder.uri.fsPath, configured),
    );

    const matchedAbsolute = this.findMatchingSolutionByPath(
      solutions,
      absoluteConfigured,
    );
    if (matchedAbsolute) {
      return matchedAbsolute;
    }

    // Try by file name match
    const byName = solutions.find(
      (s) => path.basename(s.fsPath) === path.basename(configured),
    );
    return byName;
  }

  private findMatchingSolutionByPath(
    solutions: vscode.Uri[],
    targetPath: string,
  ): vscode.Uri | undefined {
    const target = canonicalPath(targetPath);
    return solutions.find((s) => canonicalPath(s.fsPath) === target);
  }

  private getRememberedSelection(
    folder: vscode.WorkspaceFolder,
  ): string | undefined {
    const key = this.makeRememberKey(folder);
    return this.context.workspaceState.get<string>(key);
  }

  private rememberSelection(
    folder: vscode.WorkspaceFolder,
    solution: vscode.Uri,
  ): void {
    const key = this.makeRememberKey(folder);
    this.context.workspaceState.update(key, canonicalPath(solution.fsPath));
  }

  private forgetSelection(folder: vscode.WorkspaceFolder): void {
    const key = this.makeRememberKey(folder);
    this.context.workspaceState.update(key, undefined);
  }

  private makeRememberKey(folder: vscode.WorkspaceFolder): string {
    return `${this.rememberedSelectionKeyPrefix}:${canonicalPath(folder.uri.fsPath)}`;
  }

  private async findNearestProjectFile(
    uri: vscode.Uri,
    folder: vscode.WorkspaceFolder,
    token?: vscode.CancellationToken,
  ): Promise<vscode.Uri | undefined> {
    const folderRoot = canonicalPath(folder.uri.fsPath);
    let currentDir = canonicalPath(path.dirname(uri.fsPath));

    while (currentDir.startsWith(folderRoot)) {
      if (token?.isCancellationRequested) {
        throw new vscode.CancellationError();
      }

      const entries = await this.safeReadDirectory(vscode.Uri.file(currentDir));
      const project = entries.find(
        ([name, type]) =>
          type === vscode.FileType.File &&
          (name.toLowerCase().endsWith(".csproj") ||
            name.toLowerCase().endsWith(".fsproj")),
      );

      if (project) {
        return vscode.Uri.file(path.join(currentDir, project[0]));
      }

      const parent = canonicalPath(path.dirname(currentDir));
      if (parent === currentDir) {
        break;
      }
      currentDir = parent;
    }

    return undefined;
  }

  private async safeReadDirectory(
    uri: vscode.Uri,
  ): Promise<[string, vscode.FileType][]> {
    try {
      return await vscode.workspace.fs.readDirectory(uri);
    } catch {
      return [];
    }
  }

  private async filterSolutionsByProjectMembership(
    solutions: vscode.Uri[],
    projectUri: vscode.Uri,
  ): Promise<vscode.Uri[]> {
    const projectPath = canonicalPath(projectUri.fsPath);
    const candidates: vscode.Uri[] = [];

    for (const sln of solutions) {
      const projectSet = await this.getProjectsForSolution(sln);
      if (projectSet.has(projectPath)) {
        candidates.push(sln);
      }
    }

    return candidates;
  }

  private async getProjectsForSolution(
    slnUri: vscode.Uri,
  ): Promise<Set<string>> {
    const key = canonicalPath(slnUri.fsPath);
    if (this.slnProjectCache.has(key)) {
      return this.slnProjectCache.get(key)!;
    }

    const bytes = await vscode.workspace.fs.readFile(slnUri);
    const text = Buffer.from(bytes).toString("utf8");
    const projects = parseSolutionProjects(text, path.dirname(slnUri.fsPath));
    const canonical = new Set(
      Array.from(projects).map((p) => canonicalPath(p)),
    );

    this.slnProjectCache.set(key, canonical);
    return canonical;
  }

  private pickNearestSolution(
    referenceUri: vscode.Uri,
    solutions: vscode.Uri[],
  ): vscode.Uri {
    // Choose solution with shortest relative path length from the document's directory
    const baseDir = path.dirname(referenceUri.fsPath);
    let best: vscode.Uri = solutions[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const s of solutions) {
      const rel = path.relative(baseDir, s.fsPath);
      const score = rel.split(path.sep).length;
      if (score < bestScore) {
        best = s;
        bestScore = score;
      }
    }

    return best;
  }

  private async promptForSolution(
    folder: vscode.WorkspaceFolder,
    referenceUri: vscode.Uri,
    candidates: vscode.Uri[],
  ): Promise<vscode.Uri | undefined> {
    const items = candidates
      .map((u) => ({
        label: path.basename(u.fsPath),
        description:
          path.relative(folder.uri.fsPath, path.dirname(u.fsPath)) || ".",
        detail: canonicalPath(u.fsPath),
        uri: u,
      }))
      // Stable order by depth then name for nicer UX
      .sort((a, b) => {
        const aDepth = a.detail.split(path.sep).length;
        const bDepth = b.detail.split(path.sep).length;
        if (aDepth !== bDepth) {
          return aDepth - bDepth;
        }
        return a.label.localeCompare(b.label);
      });

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: `Select the solution to use for ${path.basename(referenceUri.fsPath)}`,
      ignoreFocusOut: true,
    });

    return picked?.uri;
  }

  private async promptRememberSelection(): Promise<boolean> {
    const answer = await vscode.window.showInformationMessage(
      "Remember this solution for this workspace folder?",
      { modal: true },
      "Yes",
      "No",
    );
    return answer === "Yes";
  }
}

// -------- Utility helpers --------

function canonicalPath(p: string): string {
  const normalized = path.resolve(p);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/**
 * Parse project paths from a .sln file content.
 * Looks for lines like:
 *   Project("{GUID}") = "Name", "relative\\path\\to\\project.csproj", "{GUID}"
 */
function parseSolutionProjects(slnText: string, slnDir: string): Set<string> {
  const result = new Set<string>();
  const projectRegex =
    /Project\("\{[0-9A-Fa-f-]+\}"\)\s*=\s*"[^"]+",\s*"([^"]+)",\s*"\{[0-9A-Fa-f-]+\}"/g;

  let match: RegExpExecArray | null;
  while ((match = projectRegex.exec(slnText)) !== null) {
    const relPathRaw = match[1];
    // Convert Windows-style backslashes to native separator for resolution
    const relPath = relPathRaw.replace(/\\/g, path.sep);
    const abs = path.resolve(slnDir, relPath);
    result.add(abs);
  }

  return result;
}

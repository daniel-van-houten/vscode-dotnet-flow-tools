import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Utility for loading external content files
 */
export class ContentLoader {
  private static cache = new Map<string, string>();
  private static extensionPath: string | null = null;

  /**
   * Initialize the content loader with extension context
   */
  static initialize(context: vscode.ExtensionContext): void {
    this.extensionPath = context.extensionPath;
  }

  /**
   * Load content from a markdown file with caching
   */
  static loadContent(filename: string): string {
    if (this.cache.has(filename)) {
      return this.cache.get(filename)!;
    }

    if (!this.extensionPath) {
      // For tests and development, provide fallback content
      console.warn(
        `ContentLoader not initialized - using fallback content for ${filename}`,
      );
      return this.getFallbackContent(filename);
    }

    try {
      const contentDir = path.join(this.extensionPath, "content");
      const filePath = path.join(contentDir, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      this.cache.set(filename, content);
      return content;
    } catch (error) {
      console.warn(`Failed to load content file: ${filename}`, error);
      console.warn(
        `Attempted path: ${path.join(this.extensionPath, "content", filename)}`,
      );
      return `<!-- Content file ${filename} not found -->`;
    }
  }

  /**
   * Get fallback content for testing when extension path is not available
   */
  static getFallbackContent(filename: string): string {
    const fallbacks: Record<string, string> = {
      "base-instructions.md": `# Base Instructions\n\nYou are tasked with creating comprehensive business process documentation.\n\n## Requirements\n- Write in clear, business-friendly language\n- Focus on business logic and rules\n- Include process flows and decision points`,
    };

    return fallbacks[filename] || `<!-- Fallback content for ${filename} -->`;
  }

  /**
   * Clear the content cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Preload all content files
   */
  static preloadContent(): void {
    if (!this.extensionPath) {
      throw new Error(
        "ContentLoader not initialized. Call ContentLoader.initialize(context) first.",
      );
    }

    try {
      const contentDir = path.join(this.extensionPath, "content");
      const files = fs.readdirSync(contentDir);
      files
        .filter((f) => f.endsWith(".md"))
        .forEach((file) => {
          this.loadContent(file);
        });
    } catch (error) {
      console.warn("Failed to preload content files", error);
    }
  }
}

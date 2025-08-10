import * as fs from "node:fs";
import { platform, arch } from "node:process";
import { ConfigurationError } from "../core/ErrorTypes";

export interface PlatformInfo {
  platform: string;
  arch: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
}

export function getPlatformInfo(): PlatformInfo {
  return {
    platform,
    arch,
    isWindows: platform === "win32",
    isMacOS: platform === "darwin",
    isLinux: platform === "linux",
  };
}

export function getCliPath(extensionPath: string): string {
  const platformInfo = getPlatformInfo();

  let candidate: string;

  if (platformInfo.isWindows) {
    candidate = `${extensionPath}/cli/bin/win-x64/dotnet-flow.exe`;
  } else if (platformInfo.isMacOS) {
    candidate =
      platformInfo.arch === "arm64"
        ? `${extensionPath}/cli/bin/osx-arm64/dotnet-flow`
        : `${extensionPath}/cli/bin/osx-x64/dotnet-flow`;
  } else if (platformInfo.isLinux) {
    if (platformInfo.arch === "x64") {
      candidate = `${extensionPath}/cli/bin/linux-x64/dotnet-flow`;
    } else {
      throw new ConfigurationError(
        `Unsupported Linux architecture: ${platformInfo.arch}. Only linux-x64 is currently supported.`,
      );
    }
  } else {
    throw new ConfigurationError(
      `Unsupported platform: ${platformInfo.platform}`,
    );
  }

  if (!fs.existsSync(candidate)) {
    const platformLabel = `${platformInfo.platform}/${platformInfo.arch}`;
    throw new ConfigurationError(
      `CLI binary not found for ${platformLabel}. Expected at: ${candidate}. If you're on Linux, ensure the extension includes the correct binary for your architecture. See the extension README for details.`,
    );
  }

  return candidate;
}

import { platform, arch } from 'node:process';

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
    isWindows: platform === 'win32',
    isMacOS: platform === 'darwin',
    isLinux: platform === 'linux'
  };
}

export function getCliPath(extensionPath: string): string {
  const platformInfo = getPlatformInfo();
  
  if (platformInfo.isWindows) {
    return `${extensionPath}/cli/bin/win-x64/dotnet-flow.exe`;
  } else if (platformInfo.isMacOS) {
    // Check if it's Apple Silicon (arm64) or Intel (x64)
    if (platformInfo.arch === 'arm64') {
      return `${extensionPath}/cli/bin/osx-arm64/dotnet-flow`;
    } else {
      return `${extensionPath}/cli/bin/osx-x64/dotnet-flow`;
    }
  } else {
    // For Linux or other platforms, fallback to x64
    // You might want to add linux-x64 support later
    return `${extensionPath}/cli/bin/osx-x64/dotnet-flow`;
  }
}

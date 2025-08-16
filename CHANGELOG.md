# Changelog

## [0.1.3]
### Changed
- Switched to a framework-dependent CLI executed via the `dotnet` host across all platforms, eliminating architecture mismatch errors (e.g., 0x8007000B) and VM/emulation issues.
- Now requires .NET 8+ Runtime or SDK on all platforms.
- Improved CLI error messages when .NET is missing or the required runtime is not found.
- Simplified packaging to ship the framework-dependent DLL only.

## [0.1.2]
### Added
- LaTeX guidance to prompts.

### Fixed
- Traces stopping at interfaces.
- Symbol misses in MediatR chains.

## [0.1.0]
### Added
- GPT-5 as a model option.

### Changed
- Improved prompt templates resulting in better documentation.
- Improved presentation and guidance when certain exceptions occur.

### Fixed
- Issues when multiple solution files are present in a workspace.

## [0.0.4]
### Added
- Option to use Claude 3.5 via Amazon Bedrock.

### Changed
- Limited Built-in provider model list to realistically usable models.
- Optimized input limits for built-in models.
- Improved error messaging.

### Fixed
- Bedrock provider initializing before it was selected.

## [0.0.3]
### Changed
- Documentation updates.

## [0.0.2]
### Fixed
- Windows compatibility issues with Unicode symbols in CLI output.

## [0.0.1]
### Added
- Initial release with core documentation generation.
- Support for built-in and AWS Bedrock AI providers.
- Multiple trace generation strategies.
- Smart chunking for large codebases.
- Business context integration.

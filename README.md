# Dotnet Flow Tools (Beta)

**Transform .NET code into clear, readable documentation**

Dotnet Flow Tools is a Visual Studio Code extension that bridges the gap between technical .NET code and business understanding. It analyzes your .NET codebase and generates comprehensive documentation that explains what your code does in business terms, making it invaluable for developers, business analysts, and technical writers.

## 🚀 Features

### 📝 Document This
Generate comprehensive business documentation from any C# method with a single command. The extension:
- Analyzes method dependencies and call chains
- Creates business-friendly explanations of technical processes
- Includes relevant examples based on your business domain
- Supports intelligent chunking for large codebases

### 🔍 Trace This (Multiple Options)
Visualize code execution flows with different levels of detail:
- **All Traces**: Complete detailed analysis including all dependencies
- **Methods Only**: Focus on method calls and business logic flow
- **MediatR Only**: Specialized tracing filtering to only MediatR command/query handlers

### 🤖 AI Model Support
- **Built-in Provider**: Uses VSCode's built-in language models
- **AWS Bedrock**: Support for Claude, Titan, and other Bedrock models
- **Smart Model Selection**: Easy switching between different AI providers

### 🧠 Intelligent Processing
- **Smart Chunking**: Automatically handles large codebases by breaking them into manageable chunks
- **Business Context**: Customizable domain context for generating relevant examples
- **Progress Tracking**: Real-time feedback during documentation generation

## 📋 Requirements

- **.NET Solution**: Your project must contain a `.sln` solution file
- **C# Projects**: Extension activates automatically when working with C# files
- **AI Provider**: Either built-in VSCode language models or AWS Bedrock access

## 🎯 Getting Started

### 1. Install the Extension
Install "Dotnet Flow Tools" Extension

### 2. Configure AI Model
1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `DotnetFlowTools: Select AI Model`
3. Choose between built-in or Bedrock provider
4. Select your preferred model
* The above steps can also be done in the VS Code Settings UI

### 3. Set Business Context (Optional but Recommended)
1. Open VS Code Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "dotnet flow"
3. Add your business domain context in the `Business Context` field. This helps generate accurate examples in the docs. 

### 4. Generate Your First Documentation
1. Open a C# file in a .NET solution
2. Place your cursor inside any method
3. Right-click and select `Dotnet Flow Tools > Document This`
4. Wait for the AI to generate comprehensive documentation

## ⚙️ Configuration

### Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `dotnetFlow.provider` | AI model provider (`built-in` or `bedrock`) | `built-in` |
| `dotnetFlow.modelId` | Selected AI model ID | _(set via command)_ |
| `dotnetFlow.businessContext` | Business domain context for better examples | _(empty)_ |
| `dotnetFlow.awsProfile` | AWS profile for Bedrock provider | `default` |
| `dotnetFlow.awsRegion` | AWS region for Bedrock provider | `us-east-1` |

### Business Context Examples
Provide context about your domain to get more relevant documentation:

```
E-commerce platform specializing in B2B wholesale operations. 
Key concepts: purchase orders, supplier catalogs, bulk pricing, 
inventory management, and multi-tier customer accounts.
```

```
Healthcare management system for clinics. Focus on patient 
records, appointment scheduling, billing workflows, and 
HIPAA compliance requirements.
```

## 🎮 Usage

### Document This Command
1. **Navigate** to any C# method in your solution
2. **Position** your cursor inside the method
3. **Right-click** and select `Dotnet Flow Tools > Document This`
4. **Review** the generated markdown documentation that opens automatically

### Trace Commands
Generate code execution traces for analysis:

- **Trace This: All** - Complete detailed trace with all dependencies
- **Trace This: Methods Only** - Simplified trace focusing on method calls
- **Trace This: MediatR Only** - Specialized for MediatR request handlers

### Context Menu Integration
When working with C# files, right-click anywhere to access:
```
Dotnet Flow Tools
├── Document This
└── Trace This
    ├── All
    ├── Methods Only
    └── MediatR Only
```

## 🔧 AI Provider Setup

### Built-in Provider (Recommended for Getting Started)
1. Run `DotnetFlowTools: Select AI Model`
2. Choose "Built-in Provider"
3. Select from available VSCode language models
4. Start generating documentation immediately

> **⚠️ Token Usage Warning**: This extension can consume significant tokens, especially when processing large codebases or using the "Document This" feature on complex methods. If you're using GitHub Copilot's built-in provider, monitor your token usage carefully as it may impact your quota or billing.

### AWS Bedrock Provider
1. **Install AWS Toolkit**: Install the AWS Toolkit for Visual Studio Code extension
2. **Configure AWS Credentials**: Set up your AWS profile with Bedrock access
3. **Configure Extension**:
   - Set `dotnetFlow.provider` to `bedrock`
   - Set `dotnetFlow.awsProfile` to your AWS profile name
   - Set `dotnetFlow.awsRegion` to your preferred region
4. **Select Model**: Run `DotnetFlowTools: Select AI Model` and choose a Bedrock model

#### Supported Bedrock Models
- **Claude 3/4 (Anthropic)**: Excellent for detailed technical documentation

## 💡 Tips and Best Practices

### When to Use Different Trace Types
- **All Traces**: Use for comprehensive analysis of complex business processes
- **Methods Only**: Best for understanding high-level workflow and business logic
- **MediatR Only**: Perfect for CQRS architectures and command/query patterns

### Writing Effective Business Context
- **Be Specific**: Include industry-specific terms and concepts
- **Include Key Entities**: Mention important business objects and their relationships
- **Describe Workflows**: Explain common business processes in your domain
- **Keep It Concise**: Aim for 2-4 sentences that capture your domain essence

### Working with Large Codebases
- The extension automatically detects when chunking is needed
- You'll be prompted before processing large traces
- Chunked processing provides better quality results for complex code
- Each chunk is processed intelligently to maintain context

### Optimizing Results
- **Position Matters**: Place your cursor in the most relevant method for your use case
- **Business Context**: Always configure business context for domain-specific examples
- **Method Selection**: Choose methods that represent complete business workflows
- **Review Output**: Generated documentation opens in both text and preview modes

## 🚨 Troubleshooting

### Common Issues
- **"No solution found"**: Ensure your workspace contains a `.sln` file
- **"Put cursor inside a method"**: Make sure your cursor is positioned within a C# method
- **"No AI provider available"**: Configure an AI model using the Select AI Model command
- **"AWS credentials not found"**: Set up AWS profile with Bedrock permissions

### Getting Help
- Check the VS Code Output panel for detailed error messages
- Ensure your .NET solution builds successfully
- Verify AI provider configuration and permissions

## 📝 Output Examples

The extension generates markdown documentation that includes:
- **Business Purpose**: What the method accomplishes in business terms
- **Process Flow**: Step-by-step explanation of the business process
- **Key Dependencies**: Important services and data sources involved
- **Business Rules**: Logic and validation rules explained clearly
- **Example Scenarios**: Real-world usage examples based on your business context

## 🔄 Release Notes

### 1.0.3
- Fixed Windows compatibility issues with Unicode symbols in CLI output

### 0.0.1
- Initial release with core documentation generation
- Support for built-in and AWS Bedrock AI providers
- Multiple trace generation strategies
- Smart chunking for large codebases
- Business context integration

**Enjoy transforming your .NET code into clear business documentation!**

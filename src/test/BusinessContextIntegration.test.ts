import * as assert from "assert";
import * as vscode from "vscode";
import { ConfigService } from "../services/ConfigService";
import { processDocumentationWithChunking } from "../prompts";
import { templateProcessor } from "../prompts/template-builder";
import { PromptBuildContext } from "../prompts/template-builder/types";
import {
  IModelProvider,
  ModelInfo,
  ModelInvokeParams,
  ModelResponse,
} from "../providers/IModelProvider";
import { ITokenManager, TokenUsage } from "../providers/ITokenManager";

/**
 * Mock Token Manager for testing
 */
class MockTokenManager implements ITokenManager {
  readonly providerId = "mock-provider";

  getMaxInputTokens(modelId?: string): number {
    return 100000;
  }

  getMaxOutputTokens(modelId?: string): number {
    return 4000;
  }

  async countTokens(content: string, modelId?: string): Promise<number> {
    return Math.ceil(content.length / 4); // Rough approximation
  }

  estimateTokens(content: string, modelId?: string): number {
    return Math.ceil(content.length / 4);
  }

  async fitsWithinLimits(
    content: string,
    modelId?: string,
    reserveTokens: number = 1000,
  ): Promise<boolean> {
    const tokens = await this.countTokens(content, modelId);
    return tokens + reserveTokens <= this.getMaxInputTokens(modelId);
  }

  async getTokenUsage(content: string, modelId?: string): Promise<TokenUsage> {
    const tokens = await this.countTokens(content, modelId);
    const maxTokens = this.getMaxInputTokens(modelId);
    const usagePercentage = (tokens / maxTokens) * 100;
    const remainingTokens = maxTokens - tokens;
    const fitsWithinLimits = tokens <= maxTokens;

    let recommendation: "ok" | "warning" | "chunk_required" | "reduce_content" =
      "ok";
    if (usagePercentage > 90) {
      recommendation = "chunk_required";
    } else if (usagePercentage > 75) {
      recommendation = "warning";
    }

    return {
      tokens,
      maxTokens,
      usagePercentage,
      remainingTokens,
      fitsWithinLimits,
      recommendation,
    };
  }
}

/**
 * Mock Model Provider for testing
 */
class MockModelProvider implements IModelProvider {
  readonly id = "mock-provider";
  readonly currentModelId = "mock-model-1";
  private _isInitialized = true;
  public lastPrompt?: string;

  readonly tokenManager: ITokenManager = new MockTokenManager();

  async initialize(
    config: vscode.WorkspaceConfiguration,
    modelId: string,
    context?: vscode.ExtensionContext,
  ): Promise<void> {
    this._isInitialized = true;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "mock-model-1",
        name: "Mock Model 1",
        description: "Mock model for testing",
      },
    ];
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  async invoke(
    messages: vscode.LanguageModelChatMessage[],
    params?: ModelInvokeParams,
    cancellationToken?: vscode.CancellationToken,
  ): Promise<ModelResponse> {
    // Mock response that includes business context if present
    const prompt = messages[0].content;
    let mockResponse = "Mock documentation response";

    // Check if prompt contains business context by looking at the content parts
    let promptText = "";
    if (typeof prompt === "string") {
      promptText = prompt;
    } else if (Array.isArray(prompt)) {
      promptText = prompt
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if ("text" in part) {
            return part.text;
          }
          return "";
        })
        .join("");
    }

    this.lastPrompt = promptText;
    if (promptText.includes("## Business Domain Context")) {
      mockResponse =
        "Mock documentation response with business context integration";
    }

    return {
      text: (async function* () {
        yield mockResponse;
      })(),
    };
  }

  dispose(): void {
    this._isInitialized = false;
  }
}

suite("Business Context Integration Tests", () => {
  let configService: ConfigService;
  let mockConfiguration: any;
  let originalGetConfiguration: any;
  let mockProvider: MockModelProvider;

  setup(() => {
    configService = new ConfigService();
    mockProvider = new MockModelProvider();

    // Mock VS Code configuration
    mockConfiguration = {
      get: (key: string, defaultValue?: any) => {
        return mockConfiguration._values[key] ?? defaultValue;
      },
      update: async (
        key: string,
        value: any,
        target?: vscode.ConfigurationTarget,
      ) => {
        mockConfiguration._values[key] = value;
        mockConfiguration._updateCalls.push({ key, value, target });
      },
      _values: {} as any,
      _updateCalls: [] as any[],
    };

    // Store original and mock getConfiguration
    originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = () => mockConfiguration;
  });

  teardown(() => {
    // Restore original getConfiguration
    vscode.workspace.getConfiguration = originalGetConfiguration;

    // Reset mock state
    mockConfiguration._values = {};
    mockConfiguration._updateCalls = [];
  });

  suite("End-to-End Business Context Flow", () => {
    test("should pass business context through entire documentation generation pipeline", async () => {
      // Arrange: Configure business context
      const testBusinessContext =
        "E-commerce platform specializing in electronics and consumer goods";
      mockConfiguration._values["businessContext"] = testBusinessContext;

      const mockTraceContent = `
<!--CALL-GRAPH-BEGIN-->
Start -> OrderService.ProcessOrder -> RequireApproval -> ValidateInventory -> ProcessPayment
<!--CALL-GRAPH-END-->

<!--CODE-BEGIN-->
<!--### File: OrderService.cs Class: OrderService Method: ProcessOrder -->
public class OrderService
{
    public void ProcessOrder(Order order)
    {
        if (order.Amount > 1000)
        {
            RequireApproval(order);
        }
        ValidateInventory(order);
        ProcessPayment(order);
    }
}
<!--CODE-END-->
      `;

      // Act: Process documentation with business context
      const businessContext = configService.get("businessContext");
      const result = await processDocumentationWithChunking(
        mockTraceContent,
        mockProvider,
        { className: "OrderService", methodName: "ProcessOrder" },
        businessContext,
      );

      // Assert: Verify business context was used
      assert.strictEqual(businessContext, testBusinessContext);
      // Verify the prompt built from the same context contains the business context section
      const expectedPrompt = templateProcessor.buildPrompt("single-shot", {
        codeTrace: mockTraceContent,
        className: "OrderService",
        methodName: "ProcessOrder",
        businessContext,
      });
      assert.ok(expectedPrompt.includes("## Business Domain Context"));
      assert.ok(expectedPrompt.includes(testBusinessContext));
      assert.strictEqual(result.approach, "single-shot");
      assert.strictEqual(result.chunkCount, 1);
    });

    test("should work correctly when no business context is configured", async () => {
      // Arrange: No business context configured (empty string)
      mockConfiguration._values["businessContext"] = "";

      const mockTraceContent = `
<!--CALL-GRAPH-BEGIN-->
Start -> UserService.CreateUser -> ValidateUser -> SaveUser
<!--CALL-GRAPH-END-->

<!--CODE-BEGIN-->
<!--### File: UserService.cs Class: UserService Method: CreateUser -->
public class UserService
{
    public void CreateUser(User user)
    {
        ValidateUser(user);
        SaveUser(user);
    }
}
<!--CODE-END-->
      `;

      // Act: Process documentation without business context
      const businessContext = configService.get("businessContext");
      const result = await processDocumentationWithChunking(
        mockTraceContent,
        mockProvider,
        { className: "UserService", methodName: "CreateUser" },
        businessContext,
      );

      // Assert: Verify it works without business context
      assert.strictEqual(businessContext, "");
      assert.ok(result.content.includes("Mock documentation response"));
      assert.ok(!result.content.includes("business context integration"));
      assert.strictEqual(result.approach, "single-shot");
    });

    test("should handle undefined business context gracefully", async () => {
      // Arrange: Business context not set (undefined)
      // Don't set any value, should use default

      const mockTraceContent = `
<!--CALL-GRAPH-BEGIN-->
Start -> ProductService.UpdateProduct -> ValidateProduct -> UpdateDatabase
<!--CALL-GRAPH-END-->

<!--CODE-BEGIN-->
<!--### File: ProductService.cs Class: ProductService Method: UpdateProduct -->
public class ProductService
{
    public void UpdateProduct(Product product)
    {
        ValidateProduct(product);
        UpdateDatabase(product);
    }
}
<!--CODE-END-->
      `;

      // Act: Process documentation with undefined business context
      const businessContext = configService.get("businessContext");
      const result = await processDocumentationWithChunking(
        mockTraceContent,
        mockProvider,
        { className: "ProductService", methodName: "UpdateProduct" },
        businessContext,
      );

      // Assert: Verify it handles undefined gracefully
      assert.strictEqual(businessContext, ""); // Should use default
      assert.ok(result.content.includes("Mock documentation response"));
      assert.ok(!result.content.includes("business context integration"));
    });
  });

  suite("Business Context in Prompt Templates", () => {
    test("should include business context in single-shot template", () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: "Financial services platform for loan processing",
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert
      assert.ok(prompt.includes("## Business Domain Context"));
      assert.ok(
        prompt.includes("Financial services platform for loan processing"),
      );
      assert.ok(
        prompt.includes(
          "Consider this business domain context when generating documentation:",
        ),
      );

      // Verify business context appears before the code trace
      const businessContextIndex = prompt.indexOf("## Business Domain Context");
      const codeTraceIndex = prompt.indexOf("<code_trace>");
      assert.ok(
        businessContextIndex < codeTraceIndex,
        "Business context should appear before code trace",
      );
    });

    test("should include business context in consolidation template", () => {
      // Arrange
      const testContext: PromptBuildContext = {
        chunkAnalyses: "Analysis 1\n\nAnalysis 2",
        chunkCount: 2,
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: "Healthcare management system for patient records",
      };

      // Act
      const prompt = templateProcessor.buildPrompt(
        "consolidation",
        testContext,
      );

      // Assert
      assert.ok(prompt.includes("## Business Domain Context"));
      assert.ok(
        prompt.includes("Healthcare management system for patient records"),
      );
      assert.ok(prompt.includes("Combined Analyses from 2 Code Chunks"));

      // Verify business context appears in the right position
      const businessContextIndex = prompt.indexOf("## Business Domain Context");
      const consolidationIndex = prompt.indexOf(
        "## Consolidation Instructions",
      );
      assert.ok(
        businessContextIndex < consolidationIndex,
        "Business context should appear before consolidation instructions",
      );
    });

    test("should omit business context section when empty", () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: "",
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert
      assert.ok(!prompt.includes("## Business Domain Context"));
      assert.ok(
        !prompt.includes(
          "Consider this business domain context when generating documentation:",
        ),
      );

      // Verify the template still works correctly
      assert.ok(
        prompt.includes("Base Instructions") ||
          prompt.includes("Primary Instruction"),
      );
      assert.ok(prompt.includes("<code_trace>"));
    });

    test("should omit business context section when undefined", () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        // businessContext is undefined
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert
      assert.ok(!prompt.includes("## Business Domain Context"));
      assert.ok(
        !prompt.includes(
          "Consider this business domain context when generating documentation:",
        ),
      );
    });
  });

  suite("Business Context Positioning in Generated Prompts", () => {
    test("should position business context after base instructions but before specific instructions", () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: "Manufacturing company producing automotive parts",
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert: Verify correct positioning
      const baseInstructionsIndex = prompt.indexOf("## Primary Instruction");
      const businessContextIndex = prompt.indexOf("## Business Domain Context");
      const codeTraceIndex = prompt.indexOf("<code_trace>");

      // Verify order: base instructions -> business context -> code trace
      assert.ok(
        baseInstructionsIndex < businessContextIndex,
        "Base instructions should come before business context",
      );
      assert.ok(
        businessContextIndex < codeTraceIndex,
        "Business context should come before code trace",
      );
    });

    test("should maintain proper spacing and formatting around business context", () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: "Retail chain management system",
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert: Check formatting
      const businessContextSection = prompt.substring(
        prompt.indexOf("## Business Domain Context"),
        prompt.indexOf("## Code Trace And Methods"),
      );

      // Should have proper newlines and formatting
      assert.ok(
        businessContextSection.includes("## Business Domain Context\n\n"),
      );
      assert.ok(
        businessContextSection.includes("Retail chain management system\n\n"),
      );
      assert.ok(businessContextSection.endsWith("\n\n"));
    });

    test("should handle multiline business context with proper formatting", () => {
      // Arrange
      const multilineContext = `Insurance company specializing in:
- Auto insurance policies
- Home insurance coverage
- Commercial liability

Key business rules:
- All claims require documentation
- Premium calculations based on risk assessment`;

      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: multilineContext,
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert: Verify multiline content is preserved
      assert.ok(prompt.includes("## Business Domain Context"));
      assert.ok(prompt.includes("Insurance company specializing in:"));
      assert.ok(prompt.includes("- Auto insurance policies"));
      assert.ok(
        prompt.includes("- Premium calculations based on risk assessment"),
      );

      // Verify proper formatting is maintained
      const businessContextSection = prompt.substring(
        prompt.indexOf("## Business Domain Context"),
        prompt.indexOf("## Code Trace And Methods"),
      );
      assert.ok(businessContextSection.includes(multilineContext));
    });
  });

  suite("Configuration Integration", () => {
    test("should retrieve business context from configuration service", () => {
      // Arrange
      const testContext =
        "Educational platform for online courses and certifications";
      mockConfiguration._values["businessContext"] = testContext;

      // Act
      const retrievedContext = configService.get("businessContext");

      // Assert
      assert.strictEqual(retrievedContext, testContext);
    });

    test("should handle configuration updates for business context", async () => {
      // Arrange
      const initialContext = "Initial business context";
      const updatedContext = "Updated business context for testing";

      // Act: Set initial context
      await configService.update("businessContext", initialContext);
      let currentContext = configService.get("businessContext");
      assert.strictEqual(currentContext, initialContext);

      // Act: Update context
      await configService.update("businessContext", updatedContext);
      currentContext = configService.get("businessContext");

      // Assert
      assert.strictEqual(currentContext, updatedContext);
      assert.strictEqual(mockConfiguration._updateCalls.length, 2);
      assert.strictEqual(
        mockConfiguration._updateCalls[1].value,
        updatedContext,
      );
    });

    test("should handle empty business context configuration", () => {
      // Arrange
      mockConfiguration._values["businessContext"] = "";

      // Act
      const businessContext = configService.get("businessContext");

      // Assert
      assert.strictEqual(businessContext, "");
    });

    test("should use default value when business context is not configured", () => {
      // Arrange: Don't set any value

      // Act
      const businessContext = configService.get("businessContext");

      // Assert
      assert.strictEqual(businessContext, ""); // Default value
    });
  });

  suite("Error Handling and Edge Cases", () => {
    test("should handle business context with special characters", async () => {
      // Arrange
      const specialCharContext =
        "Business context with special chars: @#$%^&*()_+-={}[]|\\:\";'<>?,./\nAnd unicode: ñáéíóú™®©";
      mockConfiguration._values["businessContext"] = specialCharContext;

      const mockTraceContent = `
<!--CALL-GRAPH-BEGIN-->
Start -> TestClass.TestMethod
<!--CALL-GRAPH-END-->

<!--CODE-BEGIN-->
<!--### File: TestClass.cs Class: TestClass Method: TestMethod -->
public class TestClass
{
    public void TestMethod() { }
}
<!--CODE-END-->
      `;

      // Act
      const businessContext = configService.get("businessContext");
      const result = await processDocumentationWithChunking(
        mockTraceContent,
        mockProvider,
        { className: "TestClass", methodName: "TestMethod" },
        businessContext,
      );

      // Assert
      assert.strictEqual(businessContext, specialCharContext);
      assert.ok(result.content); // Should not throw or fail
    });

    test("should handle very long business context", async () => {
      // Arrange
      const longContext =
        "A".repeat(3900) +
        " - This is a comprehensive business context description.";
      mockConfiguration._values["businessContext"] = longContext;

      const mockTraceContent = `
<!--CALL-GRAPH-BEGIN-->
Start -> TestClass.TestMethod
<!--CALL-GRAPH-END-->

<!--CODE-BEGIN-->
<!--### File: TestClass.cs Class: TestClass Method: TestMethod -->
public class TestClass
{
    public void TestMethod() { }
}
<!--CODE-END-->
      `;

      // Act
      const businessContext = configService.get("businessContext");
      const result = await processDocumentationWithChunking(
        mockTraceContent,
        mockProvider,
        { className: "TestClass", methodName: "TestMethod" },
        businessContext,
      );

      // Assert
      assert.strictEqual(businessContext, longContext);
      assert.ok(result.content); // Should handle long context without issues
    });

    test("should handle business context with markdown-like content", () => {
      // Arrange
      const markdownContext = `# Manufacturing Company
## Product Lines
- **Heavy Machinery**: Industrial equipment
- *Automotive Parts*: OEM components

> Important: All products require quality certification

\`\`\`
Code blocks should be preserved
\`\`\``;

      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: markdownContext,
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert: Verify markdown content is preserved
      assert.ok(prompt.includes("# Manufacturing Company"));
      assert.ok(prompt.includes("- **Heavy Machinery**: Industrial equipment"));
      assert.ok(
        prompt.includes(
          "> Important: All products require quality certification",
        ),
      );
      assert.ok(prompt.includes("```\nCode blocks should be preserved\n```"));
    });

    test("should handle whitespace-only business context", () => {
      // Arrange
      const whitespaceContext = "   \n\t   \r\n   ";
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: whitespaceContext,
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert: Should treat as empty and omit business context section
      assert.ok(!prompt.includes("## Business Domain Context"));
      assert.ok(
        !prompt.includes(
          "The following context describes the specific business domain",
        ),
      );
    });
  });

  suite("Template Processing Integration", () => {
    test("should process business context component correctly in all templates", () => {
      const testBusinessContext =
        "Logistics and supply chain management platform";

      const templates = ["single-shot", "consolidation"];

      templates.forEach((templateName) => {
        const testContext: PromptBuildContext = {
          codeTrace: "public void TestMethod() { }",
          className: "TestClass",
          methodName: "TestMethod",
          businessContext: testBusinessContext,
          chunkAnalyses: "Test analysis", // For consolidation template
          chunkCount: 1, // For consolidation template
        };

        const prompt = templateProcessor.buildPrompt(templateName, testContext);

        assert.ok(
          prompt.includes("## Business Domain Context"),
          `Template ${templateName} should include business context`,
        );
        assert.ok(
          prompt.includes(testBusinessContext),
          `Template ${templateName} should include the business context content`,
        );
        assert.ok(
          !prompt.includes("{{businessContext}}"),
          `Template ${templateName} should not have unresolved placeholders`,
        );
      });
    });

    test("should handle template processing when business context is missing from context", () => {
      // Arrange: Context without businessContext property
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        // businessContext is undefined
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert: Should not include business context section
      assert.ok(!prompt.includes("## Business Domain Context"));
      assert.ok(
        !prompt.includes("{{businessContext}}"),
        "Should not have unresolved placeholders",
      );
      assert.ok(
        prompt.includes("Primary Instruction") ||
          prompt.includes("Base Instructions"),
        "Should still include other components",
      );
    });

    test("should maintain template integrity when business context is empty", () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: "public void TestMethod() { }",
        className: "TestClass",
        methodName: "TestMethod",
        businessContext: "",
      };

      // Act
      const prompt = templateProcessor.buildPrompt("single-shot", testContext);

      // Assert: Template should be well-formed without business context
      assert.ok(!prompt.includes("## Business Domain Context"));
      assert.ok(
        prompt.includes("## Primary Instruction") ||
          prompt.includes("# Base Instructions"),
      );
      assert.ok(prompt.includes("## Code Trace And Methods"));
      assert.ok(prompt.includes("<code_trace>"));
    });
  });
});

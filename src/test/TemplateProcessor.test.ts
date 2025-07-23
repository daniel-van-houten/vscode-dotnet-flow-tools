import * as assert from 'assert';
import { PromptTemplateProcessor } from '../prompts/template-builder/template-processor';
import { PromptBuildContext } from '../prompts/template-builder/types';
import { promptTemplates } from '../prompts/template-builder/templates';

suite('Template Processor Tests', () => {
  let templateProcessor: PromptTemplateProcessor;

  setup(() => {
    templateProcessor = new PromptTemplateProcessor();
  });

  suite('Business Context Component Handling', () => {
    test('should resolve businessContext placeholder in single-shot template', () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: 'public void TestMethod() { }',
        className: 'TestClass',
        methodName: 'TestMethod',
        businessContext: 'Financial services platform for loan processing'
      };

      // Act
      const prompt = templateProcessor.buildPrompt('single-shot', testContext);

      // Assert
      assert.ok(prompt.includes('## Business Domain Context'));
      assert.ok(prompt.includes('Financial services platform for loan processing'));
      assert.ok(!prompt.includes('{{businessContext}}'), 'Should not have unresolved placeholders');
    });

    test('should resolve businessContext placeholder in consolidation template', () => {
      // Arrange
      const testContext: PromptBuildContext = {
        chunkAnalyses: 'Analysis 1\n\nAnalysis 2',
        chunkCount: 2,
        className: 'TestClass',
        methodName: 'TestMethod',
        businessContext: 'Healthcare management system for patient records'
      };

      // Act
      const prompt = templateProcessor.buildPrompt('consolidation', testContext);

      // Assert
      assert.ok(prompt.includes('## Business Domain Context'));
      assert.ok(prompt.includes('Healthcare management system for patient records'));
      assert.ok(!prompt.includes('{{businessContext}}'), 'Should not have unresolved placeholders');
    });

    test('should handle empty business context in template', () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: 'public void TestMethod() { }',
        className: 'TestClass',
        methodName: 'TestMethod',
        businessContext: ''
      };

      // Act
      const prompt = templateProcessor.buildPrompt('single-shot', testContext);

      // Assert
      assert.ok(!prompt.includes('## Business Domain Context'));
      assert.ok(!prompt.includes('{{businessContext}}'), 'Should not have unresolved placeholders');
    });

    test('should handle undefined business context in template', () => {
      // Arrange
      const testContext: PromptBuildContext = {
        codeTrace: 'public void TestMethod() { }',
        className: 'TestClass',
        methodName: 'TestMethod'
        // businessContext is undefined
      };

      // Act
      const prompt = templateProcessor.buildPrompt('single-shot', testContext);

      // Assert
      assert.ok(!prompt.includes('## Business Domain Context'));
      assert.ok(!prompt.includes('{{businessContext}}'), 'Should not have unresolved placeholders');
    });

    test('should pass business context from build context to component function', () => {
      // Arrange
      const testContext: PromptBuildContext = {
        businessContext: 'E-commerce platform specializing in electronics'
      };

      // Act
      const prompt = templateProcessor.buildPrompt('single-shot', testContext);

      // Assert
      assert.ok(prompt.includes('## Business Domain Context'));
      assert.ok(prompt.includes('E-commerce platform specializing in electronics'));
      assert.ok(!prompt.includes('{{businessContext}}'), 'Should not have unresolved placeholders');
    });

    test('should validate template with businessContext component', () => {
      // Act
      const result = templateProcessor.validateTemplate('single-shot');

      // Assert
      assert.ok(result.valid);
      assert.ok(!result.missing || !result.missing.includes('businessContext'));
    });

    test('should handle businessContext in all templates', () => {
      // Test all templates that should include businessContext
      const templatesWithBusinessContext = ['single-shot', 'first-chunk', 'middle-chunk', 'consolidation'];
      
      const testContext: PromptBuildContext = {
        codeTrace: 'public void TestMethod() { }',
        className: 'TestClass',
        methodName: 'TestMethod',
        businessContext: 'Test business context',
        chunkAnalyses: 'Test analysis', // For consolidation template
        chunkCount: 1, // For consolidation template
        chunkIndex: 1, // For chunk templates
        totalChunks: 2, // For chunk templates
        previousDocument: 'Previous document' // For middle-chunk template
      };

      for (const templateName of templatesWithBusinessContext) {
        // Skip templates that don't exist in the registry
        if (!promptTemplates[templateName as keyof typeof promptTemplates]) {continue;}

        // Act
        const prompt = templateProcessor.buildPrompt(templateName, testContext);

        // Assert
        assert.ok(prompt.includes('## Business Domain Context'), `Template ${templateName} should include business context`);
        assert.ok(prompt.includes('Test business context'), `Template ${templateName} should include the business context content`);
        assert.ok(!prompt.includes('{{businessContext}}'), `Template ${templateName} should not have unresolved placeholders`);
      }
    });

    test('should handle multiline business context in templates', () => {
      // Arrange
      const multilineContext = `E-commerce platform specializing in:
- Electronics and gadgets
- Consumer electronics
- Mobile devices and accessories

Key business rules:
- All orders require payment verification
- International shipping has additional restrictions`;

      const testContext: PromptBuildContext = {
        codeTrace: 'public void TestMethod() { }',
        className: 'TestClass',
        methodName: 'TestMethod',
        businessContext: multilineContext
      };

      // Act
      const prompt = templateProcessor.buildPrompt('single-shot', testContext);

      // Assert
      assert.ok(prompt.includes('## Business Domain Context'));
      assert.ok(prompt.includes('E-commerce platform specializing in:'));
      assert.ok(prompt.includes('- Electronics and gadgets'));
      assert.ok(prompt.includes('- All orders require payment verification'));
      assert.ok(!prompt.includes('{{businessContext}}'), 'Should not have unresolved placeholders');
    });
  });
});
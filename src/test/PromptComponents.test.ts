import * as assert from 'assert';
import { promptComponents, getComponentContent } from '../prompts/template-builder/components';
import { PromptBuildContext } from '../prompts/template-builder/types';
import { PromptTemplateProcessor } from '../prompts/template-builder/template-processor';

suite('Prompt Components Tests', () => {
    suite('Business Context Component', () => {
        test('should return properly formatted content when context is provided', () => {
            const context: PromptBuildContext = {
                businessContext: 'This is a financial services platform that handles loan applications and credit assessments.'
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes('The following context describes the specific business domain'));
            assert.ok(result.includes('This is a financial services platform that handles loan applications and credit assessments.'));
            
            // Verify proper formatting with newlines
            const lines = result.split('\n');
            assert.strictEqual(lines[0], '## Business Domain Context');
            assert.strictEqual(lines[1], '');
            assert.strictEqual(lines[2], 'The following context describes the specific business domain and should inform all examples and explanations:');
            assert.strictEqual(lines[3], '');
            assert.strictEqual(lines[4], 'This is a financial services platform that handles loan applications and credit assessments.');
            assert.strictEqual(lines[5], '');
        });

        test('should return empty string when business context is empty', () => {
            const context: PromptBuildContext = {
                businessContext: ''
            };

            const result = getComponentContent('businessContext', context);

            assert.strictEqual(result, '');
        });

        test('should return empty string when business context is undefined', () => {
            const context: PromptBuildContext = {};

            const result = getComponentContent('businessContext', context);

            assert.strictEqual(result, '');
        });

        test('should return empty string when business context is null', () => {
            const context: PromptBuildContext = {
                businessContext: null as any
            };

            const result = getComponentContent('businessContext', context);

            assert.strictEqual(result, '');
        });

        test('should handle whitespace-only business context', () => {
            const context: PromptBuildContext = {
                businessContext: '   \n\t   '
            };

            const result = getComponentContent('businessContext', context);

            assert.strictEqual(result, '');
        });

        test('should handle multiline business context', () => {
            const multilineContext = `E-commerce platform specializing in:
- Electronics and gadgets
- Consumer electronics
- Mobile devices and accessories

Key business rules:
- All orders require payment verification
- International shipping has additional restrictions`;

            const context: PromptBuildContext = {
                businessContext: multilineContext
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes(multilineContext));
            
            // Verify multiline content is preserved
            assert.ok(result.includes('- Electronics and gadgets'));
            assert.ok(result.includes('- All orders require payment verification'));
        });

        test('should handle business context with special characters', () => {
            const specialCharContext = 'Business context with special chars: @#$%^&*()_+-={}[]|\\:";\'<>?,./\nAnd some unicode: ñáéíóú™®©';

            const context: PromptBuildContext = {
                businessContext: specialCharContext
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes(specialCharContext));
            assert.ok(result.includes('@#$%^&*()_+-={}[]|\\:";\'<>?,./'));
            assert.ok(result.includes('ñáéíóú™®©'));
        });

        test('should trim whitespace from business context', () => {
            const context: PromptBuildContext = {
                businessContext: '   Healthcare management system for patient records   \n\n'
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('Healthcare management system for patient records'));
            // Should not include the leading/trailing whitespace
            assert.ok(!result.includes('   Healthcare management system for patient records   \n\n'));
            
            // Verify the trimmed content is used
            const lines = result.split('\n');
            assert.strictEqual(lines[4], 'Healthcare management system for patient records');
        });

        test('should handle very long business context', () => {
            // Create a business context near the 4000 character limit
            const longContext = 'A'.repeat(3900) + ' - This is a comprehensive business context description.';

            const context: PromptBuildContext = {
                businessContext: longContext
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes(longContext));
            assert.ok(result.length > longContext.length); // Should include the formatting
        });

        test('should handle business context with markdown-like content', () => {
            const markdownContext = `# Manufacturing Company
## Product Lines
- **Heavy Machinery**: Industrial equipment
- *Automotive Parts*: OEM components
- ~~Discontinued~~: Legacy products

> Important: All products require quality certification

\`\`\`
Code blocks should be preserved
\`\`\`

[Links](http://example.com) and other markdown should be preserved.`;

            const context: PromptBuildContext = {
                businessContext: markdownContext
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes(markdownContext));
            // Verify markdown content is preserved as-is
            assert.ok(result.includes('# Manufacturing Company'));
            assert.ok(result.includes('- **Heavy Machinery**: Industrial equipment'));
            assert.ok(result.includes('> Important: All products require quality certification'));
            assert.ok(result.includes('```\nCode blocks should be preserved\n```'));
        });
    });

    suite('Business Context Component Integration', () => {
        let templateProcessor: PromptTemplateProcessor;

        setup(() => {
            templateProcessor = new PromptTemplateProcessor();
        });

        test('should integrate correctly with template processor', () => {
            const testTemplate = `Start of template
{{businessContext}}
End of template`;

            const context: PromptBuildContext = {
                businessContext: 'Insurance company processing claims and policies'
            };

            const result = templateProcessor['processTemplate'](testTemplate, context);

            assert.ok(result.includes('Start of template'));
            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes('Insurance company processing claims and policies'));
            assert.ok(result.includes('End of template'));
            
            // Verify the placeholder was replaced
            assert.ok(!result.includes('{{businessContext}}'));
        });

        test('should integrate correctly when business context is empty', () => {
            const testTemplate = `Start of template
{{businessContext}}
End of template`;

            const context: PromptBuildContext = {
                businessContext: ''
            };

            const result = templateProcessor['processTemplate'](testTemplate, context);

            assert.ok(result.includes('Start of template'));
            assert.ok(result.includes('End of template'));
            // Should not include the business context section
            assert.ok(!result.includes('## Business Domain Context'));
            assert.ok(!result.includes('{{businessContext}}'));
            
            // Should have clean formatting without extra newlines
            const lines = result.split('\n');
            const startIndex = lines.findIndex(line => line === 'Start of template');
            const endIndex = lines.findIndex(line => line === 'End of template');
            
            // Should be consecutive lines when business context is empty
            assert.strictEqual(endIndex - startIndex, 2); // Start, empty line, End
        });

        test('should work with multiple component placeholders', () => {
            const testTemplate = `{{businessContext}}

Some other content here

{{businessContext}}`;

            const context: PromptBuildContext = {
                businessContext: 'Retail chain management system'
            };

            const result = templateProcessor['processTemplate'](testTemplate, context);

            // Should replace both instances
            const contextSections = result.split('## Business Domain Context').length - 1;
            assert.strictEqual(contextSections, 2);
            
            // Verify both instances contain the same content
            assert.ok(result.includes('Retail chain management system'));
            const matches = (result.match(/Retail chain management system/g) || []).length;
            assert.strictEqual(matches, 2);
        });

        test('should handle business context with other components', () => {
            const testTemplate = `{{businessContext}}
{{singleShotNote}}
More content`;

            const context: PromptBuildContext = {
                businessContext: 'Educational platform for online courses'
            };

            const result = templateProcessor['processTemplate'](testTemplate, context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes('Educational platform for online courses'));
            assert.ok(result.includes('Note: You are receiving the complete code trace'));
            assert.ok(result.includes('More content'));
        });
    });

    suite('Component Registry Integration', () => {
        test('should have businessContext component in registry', () => {
            assert.ok('businessContext' in promptComponents);
            assert.ok(promptComponents.businessContext);
            assert.strictEqual(typeof promptComponents.businessContext.content, 'function');
        });

        test('should return component placeholder when component not found', () => {
            const result = getComponentContent('nonExistentComponent', {});
            
            assert.strictEqual(result, '{{nonExistentComponent}}');
        });

        test('should handle component with function content', () => {
            const context: PromptBuildContext = {
                businessContext: 'Test business context'
            };

            const component = promptComponents.businessContext;
            assert.strictEqual(typeof component.content, 'function');

            if (typeof component.content === 'function') {
                const result = component.content(context);
                assert.ok(result.includes('Test business context'));
            }
        });

        test('should handle component with string content', () => {
            // Test with a component that has string content (like singleShotNote)
            const result = getComponentContent('singleShotNote', {});
            
            assert.strictEqual(typeof result, 'string');
            assert.ok(result.includes('Note: You are receiving the complete code trace'));
        });
    });

    suite('Edge Cases and Error Handling', () => {
        test('should handle context with additional properties', () => {
            const context: PromptBuildContext = {
                businessContext: 'Manufacturing business context',
                className: 'TestClass',
                methodName: 'testMethod',
                chunkIndex: 1,
                totalChunks: 3,
                customProperty: 'custom value'
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes('Manufacturing business context'));
            // Should not be affected by other properties
            assert.ok(!result.includes('TestClass'));
            assert.ok(!result.includes('custom value'));
        });

        test('should handle empty context object', () => {
            const result = getComponentContent('businessContext', {});

            assert.strictEqual(result, '');
        });

        test('should handle context with only businessContext property', () => {
            const context: PromptBuildContext = {
                businessContext: 'Minimal context test'
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('## Business Domain Context'));
            assert.ok(result.includes('Minimal context test'));
        });

        test('should handle business context with only whitespace that becomes empty after trim', () => {
            const context: PromptBuildContext = {
                businessContext: '   \n   \t   \r\n   '
            };

            const result = getComponentContent('businessContext', context);

            assert.strictEqual(result, '');
        });

        test('should preserve internal whitespace while trimming edges', () => {
            const context: PromptBuildContext = {
                businessContext: '   First line\n\nSecond line with   spaces   \n\nThird line   '
            };

            const result = getComponentContent('businessContext', context);

            assert.ok(result.includes('First line\n\nSecond line with   spaces   \n\nThird line'));
            // Should not include leading/trailing whitespace
            assert.ok(!result.includes('   First line'));
            assert.ok(!result.includes('Third line   '));
        });
    });
});
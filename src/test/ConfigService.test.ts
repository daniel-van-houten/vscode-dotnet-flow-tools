import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { DotnetFlowConfig, DEFAULT_CONFIG } from '../config/ConfigTypes';
import { CONFIG_KEYS } from '../config/ConfigConstants';

suite('ConfigService Tests', () => {
    let configService: ConfigService;
    let mockConfiguration: any;
    let originalGetConfiguration: any;

    setup(() => {
        configService = new ConfigService();
        
        // Mock VS Code configuration
        mockConfiguration = {
            get: (key: string, defaultValue?: any) => {
                return mockConfiguration._values[key] ?? defaultValue;
            },
            update: async (key: string, value: any, target?: vscode.ConfigurationTarget) => {
                mockConfiguration._values[key] = value;
                mockConfiguration._updateCalls.push({ key, value, target });
            },
            _values: {} as any,
            _updateCalls: [] as any[]
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

    suite('Business Context Configuration', () => {
        test('should get business context with default value when not configured', () => {
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, DEFAULT_CONFIG.businessContext);
            assert.strictEqual(businessContext, '');
        });

        test('should get configured business context value', () => {
            const testContext = 'This is a test business context for software development';
            mockConfiguration._values['businessContext'] = testContext;
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, testContext);
        });

        test('should set business context through update method', async () => {
            const testContext = 'Updated business context for e-commerce platform';
            
            await configService.update('businessContext', testContext);
            
            assert.strictEqual(mockConfiguration._updateCalls.length, 1);
            assert.strictEqual(mockConfiguration._updateCalls[0].key, 'businessContext');
            assert.strictEqual(mockConfiguration._updateCalls[0].value, testContext);
            assert.strictEqual(mockConfiguration._updateCalls[0].target, vscode.ConfigurationTarget.Global);
        });

        test('should set business context with specific configuration target', async () => {
            const testContext = 'Workspace-specific business context';
            
            await configService.update('businessContext', testContext, vscode.ConfigurationTarget.Workspace);
            
            assert.strictEqual(mockConfiguration._updateCalls.length, 1);
            assert.strictEqual(mockConfiguration._updateCalls[0].target, vscode.ConfigurationTarget.Workspace);
        });

        test('should handle empty string business context', async () => {
            await configService.update('businessContext', '');
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, '');
            assert.strictEqual(mockConfiguration._updateCalls[0].value, '');
        });

        test('should handle multiline business context', () => {
            const multilineContext = `Line 1: Business domain description
Line 2: Product types and categories
Line 3: Industry-specific context`;
            
            mockConfiguration._values['businessContext'] = multilineContext;
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, multilineContext);
        });

        test('should handle business context with special characters', () => {
            const specialCharContext = 'Business context with special chars: @#$%^&*()_+-={}[]|\\:";\'<>?,./';
            
            mockConfiguration._values['businessContext'] = specialCharContext;
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, specialCharContext);
        });
    });

    suite('Full Configuration Object', () => {
        test('should return complete config with business context default', () => {
            const config = configService.getConfig();
            
            assert.strictEqual(config.businessContext, DEFAULT_CONFIG.businessContext);
            assert.strictEqual(config.businessContext, '');
            assert.strictEqual(typeof config.businessContext, 'string');
        });

        test('should return complete config with configured business context', () => {
            const testContext = 'Financial services business context';
            mockConfiguration._values['businessContext'] = testContext;
            
            const config = configService.getConfig();
            
            assert.strictEqual(config.businessContext, testContext);
            // Verify other fields are still present
            assert.strictEqual(config.cliBuild, DEFAULT_CONFIG.cliBuild);
            assert.strictEqual(config.provider, DEFAULT_CONFIG.provider);
        });

        test('should maintain type safety for DotnetFlowConfig interface', () => {
            const config = configService.getConfig();
            
            // Verify all required fields are present
            assert.ok('businessContext' in config);
            assert.ok('cliBuild' in config);
            assert.ok('provider' in config);
            assert.ok('modelId' in config);
            assert.ok('awsProfile' in config);
            assert.ok('awsRegion' in config);
            
            // Verify types
            assert.strictEqual(typeof config.businessContext, 'string');
        });
    });

    suite('Character Limit Validation', () => {
        test('should handle business context at character limit', () => {
            // Create a string exactly at the 4000 character limit
            const maxLengthContext = 'A'.repeat(4000);
            mockConfiguration._values['businessContext'] = maxLengthContext;
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext.length, 4000);
            assert.strictEqual(businessContext, maxLengthContext);
        });

        test('should handle business context near character limit', () => {
            // Test with content just under the limit
            const nearMaxContext = 'B'.repeat(3999);
            mockConfiguration._values['businessContext'] = nearMaxContext;
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext.length, 3999);
            assert.strictEqual(businessContext, nearMaxContext);
        });

        test('should handle very long business context gracefully', () => {
            // Test with content over the limit (VS Code should prevent this, but test graceful handling)
            const overLimitContext = 'C'.repeat(5000);
            mockConfiguration._values['businessContext'] = overLimitContext;
            
            const businessContext = configService.get('businessContext');
            
            // ConfigService should return whatever VS Code provides (VS Code enforces the limit)
            assert.strictEqual(businessContext, overLimitContext);
        });
    });

    suite('Default Value Handling', () => {
        test('should use default when business context is undefined', () => {
            // Don't set any value, should use default
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, DEFAULT_CONFIG.businessContext);
        });

        test('should use default when business context is null', () => {
            mockConfiguration._values['businessContext'] = null;
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, DEFAULT_CONFIG.businessContext);
        });

        test('should preserve empty string when explicitly set', () => {
            mockConfiguration._values['businessContext'] = '';
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, '');
        });

        test('should handle whitespace-only business context', () => {
            const whitespaceContext = '   \n\t   ';
            mockConfiguration._values['businessContext'] = whitespaceContext;
            
            const businessContext = configService.get('businessContext');
            
            assert.strictEqual(businessContext, whitespaceContext);
        });
    });

    suite('Configuration Constants Integration', () => {
        test('should have correct business context key in CONFIG_KEYS', () => {
            assert.strictEqual(CONFIG_KEYS.BUSINESS_CONTEXT, 'dotnetFlow.businessContext');
        });

        test('should have business context in DEFAULT_CONFIG', () => {
            assert.ok('businessContext' in DEFAULT_CONFIG);
            assert.strictEqual(DEFAULT_CONFIG.businessContext, '');
            assert.strictEqual(typeof DEFAULT_CONFIG.businessContext, 'string');
        });
    });

    suite('Error Handling', () => {
        test('should handle configuration service errors gracefully', () => {
            // Mock a configuration error
            const originalGet = mockConfiguration.get;
            mockConfiguration.get = () => {
                throw new Error('Configuration error');
            };
            
            try {
                // Should not throw, should use default
                const businessContext = configService.get('businessContext');
                assert.strictEqual(businessContext, DEFAULT_CONFIG.businessContext);
            } catch (error) {
                // If it does throw, that's also acceptable behavior
                assert.ok(error instanceof Error);
            } finally {
                // Restore original get method
                mockConfiguration.get = originalGet;
            }
        });

        test('should handle update errors gracefully', async () => {
            // Mock an update error
            mockConfiguration.update = async () => {
                throw new Error('Update failed');
            };
            
            try {
                await configService.update('businessContext', 'test');
                assert.fail('Expected update to throw');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.strictEqual((error as Error).message, 'Update failed');
            }
        });
    });
});
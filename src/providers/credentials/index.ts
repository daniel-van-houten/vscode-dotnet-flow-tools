import * as vscode from 'vscode';
import { AWSCredentials, AWSConfig, CredentialProvider } from './types';

class ProfileCredentialProvider implements CredentialProvider {
  constructor(private profile: string) {}

  async getCredentials(): Promise<AWSCredentials | null> {
    try {
      // In a real implementation, this would read from ~/.aws/credentials
      // For now, we'll use a simplified approach that relies on AWS SDK's fromIni
      // The actual AWS SDK integration will handle this
      return null;
    } catch (error) {
      console.error(`Failed to get credentials from profile ${this.profile}:`, error);
      return null;
    }
  }

  async hasCredentials(): Promise<boolean> {
    const creds = await this.getCredentials();
    return creds !== null;
  }

  getDisplayName(): string {
    return `AWS Profile: ${this.profile}`;
  }
}

class SecretStorageCredentialProvider implements CredentialProvider {
  constructor(private context: vscode.ExtensionContext) {}

  async getCredentials(): Promise<AWSCredentials | null> {
    try {
      const accessKeyId = await this.context.secrets.get('aws.accessKeyId');
      const secretAccessKey = await this.context.secrets.get('aws.secretAccessKey');
      const sessionToken = await this.context.secrets.get('aws.sessionToken');

      if (!accessKeyId || !secretAccessKey) {
        return null;
      }

      return {
        accessKeyId,
        secretAccessKey,
        sessionToken: sessionToken || undefined
      };
    } catch (error) {
      console.error('Failed to get credentials from secret storage:', error);
      return null;
    }
  }

  async hasCredentials(): Promise<boolean> {
    const creds = await this.getCredentials();
    return creds !== null;
  }

  getDisplayName(): string {
    return 'VS Code Secret Storage';
  }

  async storeCredentials(credentials: AWSCredentials): Promise<void> {
    await this.context.secrets.store('aws.accessKeyId', credentials.accessKeyId);
    await this.context.secrets.store('aws.secretAccessKey', credentials.secretAccessKey);
    if (credentials.sessionToken) {
      await this.context.secrets.store('aws.sessionToken', credentials.sessionToken);
    }
  }

  async clearCredentials(): Promise<void> {
    await this.context.secrets.delete('aws.accessKeyId');
    await this.context.secrets.delete('aws.secretAccessKey');
    await this.context.secrets.delete('aws.sessionToken');
  }
}

export class CredentialManager {
  private providers: CredentialProvider[] = [];

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get AWS credentials using the credential chain
   * @param config AWS configuration
   * @returns AWS credentials or null if not available
   */
  async getCredentials(config: AWSConfig): Promise<AWSCredentials | null> {
    // Clear existing providers
    this.providers = [];

    // Add profile provider if profile is specified
    if (config.profile) {
      this.providers.push(new ProfileCredentialProvider(config.profile));
    }

    // Add secret storage provider
    this.providers.push(new SecretStorageCredentialProvider(this.context));

    // Try each provider in order
    for (const provider of this.providers) {
      try {
        const credentials = await provider.getCredentials();
        if (credentials) {
          console.log(`Using credentials from: ${provider.getDisplayName()}`);
          return credentials;
        }
      } catch (error) {
        console.error(`Failed to get credentials from ${provider.getDisplayName()}:`, error);
      }
    }

    return null;
  }

  /**
   * Prompt user for AWS credentials and store them
   * @returns True if credentials were successfully stored
   */
  async promptForCredentials(): Promise<boolean> {
    const accessKeyId = await vscode.window.showInputBox({
      prompt: 'Enter your AWS Access Key ID',
      password: false,
      ignoreFocusOut: true
    });

    if (!accessKeyId) {
      return false;
    }

    const secretAccessKey = await vscode.window.showInputBox({
      prompt: 'Enter your AWS Secret Access Key',
      password: true,
      ignoreFocusOut: true
    });

    if (!secretAccessKey) {
      return false;
    }

    const sessionToken = await vscode.window.showInputBox({
      prompt: 'Enter your AWS Session Token (optional, leave blank if not using temporary credentials)',
      password: true,
      ignoreFocusOut: true
    });

    try {
      const secretProvider = new SecretStorageCredentialProvider(this.context);
      await secretProvider.storeCredentials({
        accessKeyId,
        secretAccessKey,
        sessionToken: sessionToken || undefined
      });

      vscode.window.showInformationMessage('AWS credentials have been securely stored.');
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to store credentials: ${error}`);
      return false;
    }
  }

  /**
   * Clear stored credentials
   */
  async clearCredentials(): Promise<void> {
    const secretProvider = new SecretStorageCredentialProvider(this.context);
    await secretProvider.clearCredentials();
    vscode.window.showInformationMessage('AWS credentials have been cleared.');
  }

  /**
   * Check if any credentials are available
   * @param config AWS configuration
   * @returns True if credentials are available
   */
  async hasCredentials(config: AWSConfig): Promise<boolean> {
    const credentials = await this.getCredentials(config);
    return credentials !== null;
  }
}
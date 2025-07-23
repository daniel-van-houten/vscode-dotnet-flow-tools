export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface AWSConfig {
  region: string;
  profile?: string;
  credentials?: AWSCredentials;
}

export interface CredentialProvider {
  /**
   * Get AWS credentials
   * @returns AWS credentials or null if not available
   */
  getCredentials(): Promise<AWSCredentials | null>;

  /**
   * Check if credentials are available
   * @returns True if credentials are available
   */
  hasCredentials(): Promise<boolean>;

  /**
   * Get a display name for this credential provider
   */
  getDisplayName(): string;
}
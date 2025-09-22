export interface NewRelicError {
  id: string;
  message: string;
  errorClass: string;
  timestamp: Date;
  count: number;
  userImpact: number;
  stackTrace?: string;
  attributes: Record<string, string | number | boolean | null>;
  applicationName: string;
  deploymentId?: string;
}

export interface ErrorAnalysis {
  errorId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isReleaseRelated: boolean;
  confidence: number;
  recommendation: 'rollback' | 'hotfix' | 'monitor' | 'investigate';
  reasoning: string;
  suggestedActions: string[];
  relatedErrors?: string[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  channel: string;
  text: string;
  timestamp: Date;
  platform: 'slack' | 'discord';
}

export interface BotResponse {
  text: string;
  attachments?: unknown[];
  blocks?: unknown[];
}

export interface MCPRequest {
  method: string;
  params: Record<string, unknown>;
}

export interface MCPResponse {
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface DeploymentInfo {
  id: string;
  timestamp: Date;
  version: string;
  environment: string;
  commitSha?: string;
  releaseNotes?: string;
}

export interface ConversationMessage {
  user: string;
  bot: string;
  timestamp: Date;
}

export interface NewRelicServerInterface {
  getErrorInbox(args: { timeRange?: string; applicationName?: string; limit?: number }): Promise<{ content: { type: string; text: string }[] }>;
  getDeploymentInfo(args: { applicationName?: string; timeRange?: string }): Promise<{ content: { type: string; text: string }[] }>;
  getErrorDetails(args: { errorId: string }): Promise<{ content: { type: string; text: string }[] }>;
}

import { Server } from '@modelcontextprotocol/sdk/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types';
import axios from 'axios';
import { NewRelicError, DeploymentInfo } from '../types/index';

export class NewRelicMCPServer {
  private server: Server;
  private apiKey: string;
  private accountId: string;

  constructor(apiKey: string, accountId: string) {
    this.apiKey = apiKey;
    this.accountId = accountId;
    this.server = new Server(
      {
        name: 'newrelic-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_error_inbox',
            description: 'Fetch recent errors from New Relic Error Inbox',
            inputSchema: {
              type: 'object',
              properties: {
                timeRange: {
                  type: 'string',
                  description: 'Time range for errors (e.g., "1 hour ago", "30 minutes ago")',
                  default: '1 hour ago',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of errors to return',
                  default: 50,
                },
                applicationName: {
                  type: 'string',
                  description: 'Filter by specific application name',
                },
              },
            },
          },
          {
            name: 'get_deployment_info',
            description: 'Get recent deployment information',
            inputSchema: {
              type: 'object',
              properties: {
                applicationName: {
                  type: 'string',
                  description: 'Application name to get deployments for',
                },
                timeRange: {
                  type: 'string',
                  description: 'Time range for deployments',
                  default: '24 hours ago',
                },
              },
            },
          },
          {
            name: 'get_error_details',
            description: 'Get detailed information about a specific error',
            inputSchema: {
              type: 'object',
              properties: {
                errorId: {
                  type: 'string',
                  description: 'The error ID to get details for',
                },
              },
              required: ['errorId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_error_inbox':
            return await this.getErrorInbox(args);
          case 'get_deployment_info':
            return await this.getDeploymentInfo(args);
          case 'get_error_details':
            return await this.getErrorDetails(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private async getErrorInbox(args: any) {
    const { timeRange = '1 hour ago', limit = 50, applicationName } = args;
    
    // Convert time range to NRQL format
    const since = this.parseTimeRange(timeRange);
    
    let nrql = `SELECT * FROM ErrorInbox WHERE \`timestamp\` >= ${since}`;
    if (applicationName) {
      nrql += ` AND \`appName\` = '${applicationName}'`;
    }
    nrql += ` ORDER BY timestamp DESC LIMIT ${limit}`;

    const response = await this.executeNRQL(nrql);
    
    const errors: NewRelicError[] = response.results.map((result: any) => ({
      id: result.errorId || `error_${Date.now()}_${Math.random()}`,
      message: result.message || result['error.message'] || 'Unknown error',
      errorClass: result.errorClass || result['error.class'] || 'Unknown',
      timestamp: new Date(result.timestamp),
      count: result.count || 1,
      userImpact: result.userImpact || 0,
      stackTrace: result.stackTrace,
      attributes: result,
      applicationName: result.appName || result.applicationName || 'Unknown',
      deploymentId: result.deploymentId,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            errors,
            summary: {
              totalErrors: errors.length,
              timeRange,
              applications: [...new Set(errors.map(e => e.applicationName))],
            }
          }, null, 2),
        },
      ],
    };
  }

  private async getDeploymentInfo(args: any) {
    const { applicationName, timeRange = '24 hours ago' } = args;
    
    const since = this.parseTimeRange(timeRange);
    let nrql = `SELECT * FROM Deployment WHERE \`timestamp\` >= ${since}`;
    if (applicationName) {
      nrql += ` AND \`appName\` = '${applicationName}'`;
    }
    nrql += ` ORDER BY timestamp DESC`;

    const response = await this.executeNRQL(nrql);
    
    const deployments: DeploymentInfo[] = response.results.map((result: any) => ({
      id: result.deploymentId || `deploy_${result.timestamp}`,
      timestamp: new Date(result.timestamp),
      version: result.version || result.revision || 'Unknown',
      environment: result.environment || 'production',
      commitSha: result.commitSha || result.revision,
      releaseNotes: result.description || result.changelog,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deployments,
            summary: {
              totalDeployments: deployments.length,
              timeRange,
            }
          }, null, 2),
        },
      ],
    };
  }

  private async getErrorDetails(args: any) {
    const { errorId } = args;
    
    const nrql = `SELECT * FROM ErrorInbox WHERE errorId = '${errorId}' OR \`error.fingerprint\` = '${errorId}' LIMIT 1`;
    const response = await this.executeNRQL(nrql);
    
    if (response.results.length === 0) {
      throw new Error(`Error not found: ${errorId}`);
    }

    const errorDetails = response.results[0];
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: {
              id: errorId,
              message: errorDetails.message || errorDetails['error.message'],
              errorClass: errorDetails.errorClass || errorDetails['error.class'],
              timestamp: errorDetails.timestamp,
              stackTrace: errorDetails.stackTrace,
              attributes: errorDetails,
              occurrences: errorDetails.count || 1,
            }
          }, null, 2),
        },
      ],
    };
  }

  private async executeNRQL(nrql: string) {
    const url = `https://api.newrelic.com/graphql`;
    
    const query = `
      query($accountId: Int!, $nrql: Nrql!) {
        actor {
          account(id: $accountId) {
            nrql(query: $nrql) {
              results
            }
          }
        }
      }
    `;

    const response = await axios.post(
      url,
      {
        query,
        variables: {
          accountId: parseInt(this.accountId),
          nrql,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'API-Key': this.apiKey,
        },
      }
    );

    if (response.data.errors) {
      throw new Error(`New Relic API Error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.data.actor.account.nrql;
  }

  private parseTimeRange(timeRange: string): number {
    const now = Date.now();
    const match = timeRange.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
    
    if (!match) {
      // Default to 1 hour ago
      return Math.floor((now - (60 * 60 * 1000)) / 1000);
    }

    const [, amount, unit] = match;
    const multipliers = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
    };

    const milliseconds = parseInt(amount) * multipliers[unit.toLowerCase() as keyof typeof multipliers];
    return Math.floor((now - milliseconds) / 1000);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('New Relic MCP server running on stdio');
  }
}

// Export for use in other modules
export default NewRelicMCPServer;

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

export class NewRelicMCPServer {
  constructor(apiKey, accountId) {
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

  setupHandlers() {
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
                  description: 'Filter by application name',
                },
              },
            },
          },
          {
            name: 'get_deployment_info',
            description: 'Fetch recent deployment information',
            inputSchema: {
              type: 'object',
              properties: {
                timeRange: {
                  type: 'string',
                  description: 'Time range for deployments',
                  default: '24 hours ago',
                },
                applicationName: {
                  type: 'string',
                  description: 'Filter by application name',
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

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });
  }

  async getErrorInbox(args = {}) {
    const { timeRange = '1 hour ago', limit = 50, applicationName } = args;

    try {
      const query = this.buildErrorInboxQuery(timeRange, limit, applicationName);
      const response = await this.executeNerdGraphQuery(query);
      
      const errors = this.parseErrorInboxResponse(response);
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${errors.length} errors in the last ${timeRange}:\n\n${this.formatErrors(errors)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching error inbox: ${error.message}`,
          },
        ],
      };
    }
  }

  async getDeploymentInfo(args = {}) {
    const { timeRange = '24 hours ago', applicationName } = args;

    try {
      const query = this.buildDeploymentQuery(timeRange, applicationName);
      const response = await this.executeNerdGraphQuery(query);
      
      const deployments = this.parseDeploymentResponse(response);
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${deployments.length} deployments in the last ${timeRange}:\n\n${this.formatDeployments(deployments)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching deployment info: ${error.message}`,
          },
        ],
      };
    }
  }

  async getErrorDetails(args) {
    const { errorId } = args;

    if (!errorId) {
      throw new McpError(ErrorCode.InvalidParams, 'errorId is required');
    }

    try {
      const query = this.buildErrorDetailsQuery(errorId);
      const response = await this.executeNerdGraphQuery(query);
      
      const errorDetails = this.parseErrorDetailsResponse(response);
      
      return {
        content: [
          {
            type: 'text',
            text: `Error Details for ${errorId}:\n\n${this.formatErrorDetails(errorDetails)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching error details: ${error.message}`,
          },
        ],
      };
    }
  }

  buildErrorInboxQuery(timeRange, limit, applicationName) {
    const since = this.parseTimeRange(timeRange);
    const appFilter = applicationName ? `AND appName = '${applicationName}'` : '';
    
    return `
      query {
        actor {
          account(id: ${this.accountId}) {
            nrql(query: "SELECT * FROM ErrorInbox WHERE timestamp >= ${since} ${appFilter} LIMIT ${limit}") {
              results
            }
          }
        }
      }
    `;
  }

  buildDeploymentQuery(timeRange, applicationName) {
    const since = this.parseTimeRange(timeRange);
    const appFilter = applicationName ? `AND appName = '${applicationName}'` : '';
    
    return `
      query {
        actor {
          account(id: ${this.accountId}) {
            nrql(query: "SELECT * FROM Deployment WHERE timestamp >= ${since} ${appFilter}") {
              results
            }
          }
        }
      }
    `;
  }

  buildErrorDetailsQuery(errorId) {
    return `
      query {
        actor {
          account(id: ${this.accountId}) {
            nrql(query: "SELECT * FROM ErrorInbox WHERE errorId = '${errorId}'") {
              results
            }
          }
        }
      }
    `;
  }

  async executeNerdGraphQuery(query) {
    const response = await axios.post(
      'https://api.newrelic.com/graphql',
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'API-Key': this.apiKey,
        },
      }
    );

    if (response.data.errors) {
      throw new Error(`NerdGraph query failed: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data;
  }

  parseErrorInboxResponse(response) {
    const results = response.data?.actor?.account?.nrql?.results || [];
    return results.map(result => ({
      id: result.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: result.message || 'Unknown error',
      errorClass: result.errorClass || 'UnknownError',
      timestamp: new Date(result.timestamp || Date.now()),
      count: result.count || 1,
      userImpact: result.userImpact || 0,
      stackTrace: result.stackTrace,
      attributes: result.attributes || {},
      applicationName: result.appName || 'Unknown App',
      deploymentId: result.deploymentId,
    }));
  }

  parseDeploymentResponse(response) {
    const results = response.data?.actor?.account?.nrql?.results || [];
    return results.map(result => ({
      id: result.deploymentId || `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(result.timestamp || Date.now()),
      version: result.version || 'Unknown Version',
      environment: result.environment || 'Unknown Environment',
      commitSha: result.commitSha,
      releaseNotes: result.releaseNotes,
    }));
  }

  parseErrorDetailsResponse(response) {
    const results = response.data?.actor?.account?.nrql?.results || [];
    return results[0] || null;
  }

  parseTimeRange(timeRange) {
    const now = Date.now();
    const timeRangeLower = timeRange.toLowerCase();
    
    if (timeRangeLower.includes('minute')) {
      const minutes = parseInt(timeRangeLower.match(/\d+/)?.[0] || '30');
      return now - (minutes * 60 * 1000);
    } else if (timeRangeLower.includes('hour')) {
      const hours = parseInt(timeRangeLower.match(/\d+/)?.[0] || '1');
      return now - (hours * 60 * 60 * 1000);
    } else if (timeRangeLower.includes('day')) {
      const days = parseInt(timeRangeLower.match(/\d+/)?.[0] || '1');
      return now - (days * 24 * 60 * 60 * 1000);
    }
    
    return now - (60 * 60 * 1000); // Default to 1 hour
  }

  formatErrors(errors) {
    return errors.map(error => 
      `🚨 ${error.id}: ${error.message}\n` +
      `   App: ${error.applicationName}\n` +
      `   Time: ${error.timestamp.toISOString()}\n` +
      `   Count: ${error.count}\n`
    ).join('\n');
  }

  formatDeployments(deployments) {
    return deployments.map(deploy => 
      `🚀 ${deploy.id}: ${deploy.version}\n` +
      `   Environment: ${deploy.environment}\n` +
      `   Time: ${deploy.timestamp.toISOString()}\n` +
      `   Commit: ${deploy.commitSha || 'N/A'}\n`
    ).join('\n');
  }

  formatErrorDetails(errorDetails) {
    if (!errorDetails) return 'No error details found';
    
    return `Error: ${errorDetails.message}\n` +
           `Class: ${errorDetails.errorClass}\n` +
           `App: ${errorDetails.appName}\n` +
           `Time: ${new Date(errorDetails.timestamp).toISOString()}\n` +
           `Stack Trace: ${errorDetails.stackTrace || 'N/A'}`;
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🔌 New Relic MCP Server started');
  }
}

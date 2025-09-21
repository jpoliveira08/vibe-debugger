import { NewRelicError, DeploymentInfo } from '../types/index';

export const mockErrors: NewRelicError[] = [
  {
    id: 'error_001',
    message: 'Connection timeout to database server',
    errorClass: 'DatabaseConnectionError',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    count: 45,
    userImpact: 25,
    stackTrace: `
      at DatabaseConnection.connect (db.js:123)
      at UserService.getUser (user-service.js:45)
      at AuthController.login (auth-controller.js:78)
    `,
    attributes: {
      environment: 'production',
      version: '2.1.4',
      database: 'postgres',
      timeout: '30s',
      retries: 3,
    },
    applicationName: 'web-app',
    deploymentId: 'deploy_001',
  },
  {
    id: 'error_002',
    message: 'Undefined property access: user.profile.avatar',
    errorClass: 'TypeError',
    timestamp: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
    count: 12,
    userImpact: 5,
    stackTrace: `
      at ProfileComponent.render (profile.jsx:89)
      at React.render (react.js:456)
      at App.componentDidMount (app.jsx:123)
    `,
    attributes: {
      environment: 'production',
      version: '2.1.4',
      browser: 'Chrome 120',
      userId: 'anonymous',
    },
    applicationName: 'web-app',
    deploymentId: 'deploy_001',
  },
  {
    id: 'error_003',
    message: 'Payment gateway timeout',
    errorClass: 'PaymentProcessingError',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    count: 8,
    userImpact: 60,
    stackTrace: `
      at PaymentService.processPayment (payment.js:234)
      at CheckoutController.submitOrder (checkout.js:156)
      at express.Router.post (routes.js:89)
    `,
    attributes: {
      environment: 'production',
      version: '2.1.4',
      gateway: 'stripe',
      amount: 99.99,
      currency: 'USD',
    },
    applicationName: 'web-app',
    deploymentId: 'deploy_001',
  },
  {
    id: 'error_004',
    message: 'Redis connection lost',
    errorClass: 'RedisConnectionError',
    timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    count: 156,
    userImpact: 15,
    attributes: {
      environment: 'production',
      version: '2.1.3',
      redis_host: 'cache-cluster-001',
      reconnect_attempts: 5,
    },
    applicationName: 'api-service',
    deploymentId: 'deploy_000',
  },
  {
    id: 'error_005',
    message: 'Invalid API key provided',
    errorClass: 'AuthenticationError',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    count: 3,
    userImpact: 1,
    attributes: {
      environment: 'production',
      version: '2.1.4',
      endpoint: '/api/v1/users',
      method: 'GET',
    },
    applicationName: 'api-service',
    deploymentId: 'deploy_001',
  },
];

export const mockDeployments: DeploymentInfo[] = [
  {
    id: 'deploy_001',
    timestamp: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
    version: '2.1.4',
    environment: 'production',
    commitSha: 'abc123def456',
    releaseNotes: `
      Features:
      - Added user profile avatar support
      - Improved payment processing
      - Enhanced error handling
      
      Bug Fixes:
      - Fixed database connection pooling
      - Updated Redis configuration
      - Improved API authentication
    `,
  },
  {
    id: 'deploy_000',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    version: '2.1.3',
    environment: 'production',
    commitSha: 'xyz789abc123',
    releaseNotes: `
      Bug Fixes:
      - Fixed memory leak in cache service
      - Updated database migration scripts
      - Improved logging configuration
    `,
  },
  {
    id: 'deploy_staging_001',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    version: '2.1.5-staging',
    environment: 'staging',
    commitSha: 'staging123abc',
    releaseNotes: 'Testing new features for next production release',
  },
];

export class MockNewRelicServer {
  async getErrorInbox(args: any) {
    const { timeRange = '1 hour ago', limit = 50, applicationName } = args;
    
    // Filter errors based on time range and application
    const timeRangeMs = this.parseTimeRangeToMs(timeRange);
    const cutoffTime = Date.now() - timeRangeMs;
    
    let filteredErrors = mockErrors.filter(error => 
      error.timestamp.getTime() >= cutoffTime
    );
    
    if (applicationName) {
      filteredErrors = filteredErrors.filter(error => 
        error.applicationName === applicationName
      );
    }
    
    const errors = filteredErrors.slice(0, limit);
    
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

  async getDeploymentInfo(args: any) {
    const { timeRange = '24 hours ago' } = args;
    
    const timeRangeMs = this.parseTimeRangeToMs(timeRange);
    const cutoffTime = Date.now() - timeRangeMs;
    
    const filteredDeployments = mockDeployments.filter(deployment => 
      deployment.timestamp.getTime() >= cutoffTime
    );
    
    // Note: Mock deployments don't have applicationName, so we'll return all for demo
    const deployments = filteredDeployments;
    
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

  async getErrorDetails(args: any) {
    const { errorId } = args;
    
    const error = mockErrors.find(e => e.id === errorId);
    
    if (!error) {
      throw new Error(`Error not found: ${errorId}`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: {
              id: errorId,
              message: error.message,
              errorClass: error.errorClass,
              timestamp: error.timestamp,
              stackTrace: error.stackTrace,
              attributes: error.attributes,
              occurrences: error.count,
              userImpact: error.userImpact,
              applicationName: error.applicationName,
            }
          }, null, 2),
        },
      ],
    };
  }

  private parseTimeRangeToMs(timeRange: string): number {
    const match = timeRange.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
    
    if (!match) {
      return 60 * 60 * 1000; // Default to 1 hour
    }

    const [, amount, unit] = match;
    const multipliers = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
    };

    return parseInt(amount) * multipliers[unit.toLowerCase() as keyof typeof multipliers];
  }
}

// Sample scenarios for testing and demos
export const demoScenarios = {
  criticalIssue: {
    name: 'Critical Database Issue After Deployment',
    description: 'Multiple database timeout errors after recent deployment',
    errors: [mockErrors[0], mockErrors[2]], // Database and payment errors
    deployments: [mockDeployments[0]],
    expectedRecommendation: 'rollback',
  },
  
  minorIssue: {
    name: 'Minor UI Error',
    description: 'Low-impact frontend error with minimal user impact',
    errors: [mockErrors[1]], // Profile avatar error
    deployments: [mockDeployments[0]],
    expectedRecommendation: 'hotfix',
  },
  
  preExistingIssue: {
    name: 'Pre-existing Redis Issue',
    description: 'Redis connection errors that existed before deployment',
    errors: [mockErrors[3]], // Redis error from before deployment
    deployments: [mockDeployments[0]],
    expectedRecommendation: 'monitor',
  },
  
  authenticationSpike: {
    name: 'Authentication Error Spike',
    description: 'Sudden increase in auth errors after API changes',
    errors: [mockErrors[4]], // Auth error
    deployments: [mockDeployments[0]],
    expectedRecommendation: 'investigate',
  },
};

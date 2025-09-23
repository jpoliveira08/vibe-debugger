import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';

export class ErrorAnalyzer {
  constructor(geminiApiKey, newRelicServer = null) {
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is required but not provided. Please set your Gemini API key in the .env file.');
    }
    
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: geminiApiKey,
      model: 'gemini-2.0-flash',
      temperature: 0.1,
    });
    
    this.newRelicServer = newRelicServer;

    this.analysisPrompt = PromptTemplate.fromTemplate(`
You are an expert DevOps engineer analyzing application errors after a deployment. 

CONTEXT:
Recent Errors: {errors}
Recent Deployments: {deployments}
Current Time: {currentTime}

TASK:
Analyze each error and determine:
1. Severity level (critical/high/medium/low)
2. If it's related to recent deployments
3. Recommended action (rollback/hotfix/monitor/investigate)
4. Confidence level (0-100%)
5. Reasoning for your decision
6. Suggested next steps

ANALYSIS CRITERIA:
- Critical: System down, data loss, security breach, >50% user impact
- High: Core functionality broken, significant user impact (10-50%)
- Medium: Feature degradation, minor user impact (<10%)
- Low: Edge cases, logging errors, minimal impact

- Rollback: Critical issues introduced by recent deployment
- Hotfix: High/medium issues with clear fix, deployment-related
- Monitor: New errors but low impact or unclear correlation
- Investigate: Need more data to determine root cause

IMPORTANT: Return ONLY a valid JSON array of ErrorAnalysis objects. Do not include any markdown formatting, explanations, or code blocks. Just pure JSON.

Each ErrorAnalysis object should have these fields:
- errorId: string (the error ID)
- severity: "critical" | "high" | "medium" | "low"
- isReleaseRelated: boolean
- confidence: number (0-100)
- recommendation: "rollback" | "hotfix" | "monitor" | "investigate"
- reasoning: string (explanation of your analysis)
- suggestedActions: array of strings
- relatedErrors: array of error IDs
`);

    this.conversationPrompt = PromptTemplate.fromTemplate(`
You are a helpful DevOps AI assistant helping teams troubleshoot application errors.

CONTEXT:
Current Errors: {errors}
Recent Deployments: {deployments}
Previous Analysis: {previousAnalysis}
Conversation History: {conversationHistory}

USER QUESTION: {userMessage}

INSTRUCTIONS:
1. Be conversational and helpful
2. Reference specific errors by ID when relevant
3. Provide actionable recommendations
4. If asked about rollbacks, consider error severity and deployment correlation
5. Be honest about limitations and suggest when human investigation is needed
6. Use emojis and formatting to make responses engaging

RESPONSE:
`);
  }

  async analyzeErrors(errors, deployments) {
    try {
      const formattedErrors = JSON.stringify(errors, null, 2);
      const formattedDeployments = JSON.stringify(deployments, null, 2);
      const currentTime = new Date().toISOString();

      const prompt = await this.analysisPrompt.format({
        errors: formattedErrors,
        deployments: formattedDeployments,
        currentTime: currentTime
      });

      const response = await this.llm.invoke(prompt);
      
      try {
        let content = response.content;
        
        // Remove markdown code blocks if present
        if (content.includes('```json')) {
          content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (content.includes('```')) {
          content = content.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        // Clean up any extra whitespace
        content = content.trim();
        
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', parseError);
        console.error('Raw LLM response:', response.content);
        
        // Return a fallback analysis
        return errors.map(error => ({
          errorId: error.id,
          severity: 'medium',
          isReleaseRelated: false,
          confidence: 50,
          recommendation: 'investigate',
          reasoning: 'Unable to analyze due to parsing error',
          suggestedActions: ['Manual investigation required'],
          relatedErrors: []
        }));
      }
    } catch (error) {
      console.error('Error in analyzeErrors:', error);
      throw error;
    }
  }

  async fetchRecentData(timeRange = '1 hour ago') {
    let errors = [];
    let deployments = [];

    if (this.newRelicServer) {
      try {
        console.log('🔍 ErrorAnalyzer fetching New Relic data...');
        const errorResponse = await this.newRelicServer.getErrorInbox({ timeRange, limit: 10 });
        const deployResponse = await this.newRelicServer.getDeploymentInfo({ timeRange: '24 hours ago' });
        
        console.log('📊 New Relic Error Response:', JSON.stringify(errorResponse, null, 2));
        console.log('🚀 New Relic Deploy Response:', JSON.stringify(deployResponse, null, 2));
        
        // Parse the responses
        errors = this.parseNewRelicResponse(errorResponse);
        deployments = this.parseNewRelicResponse(deployResponse);
        
        console.log(`✅ ErrorAnalyzer parsed ${errors.length} errors and ${deployments.length} deployments`);
      } catch (error) {
        console.error('❌ Error fetching New Relic data in ErrorAnalyzer:', error);
      }
    } else {
      console.log('🎭 ErrorAnalyzer using mock data (New Relic not configured)');
      // Provide mock data for testing
      errors = [
        {
          id: 'demo_error_001',
          message: 'Database connection timeout in user authentication',
          errorClass: 'TimeoutError',
          timestamp: new Date(),
          count: 15,
          userImpact: 25,
          applicationName: 'Auth Service',
          stackTrace: 'TimeoutError: Connection timed out\n    at Database.connect(db.js:45)\n    at AuthService.login(auth.js:123)'
        },
        {
          id: 'demo_error_002', 
          message: 'Failed to process payment transaction',
          errorClass: 'PaymentError',
          timestamp: new Date(Date.now() - 300000), // 5 minutes ago
          count: 3,
          userImpact: 8,
          applicationName: 'Payment Service',
          stackTrace: 'PaymentError: Invalid card details\n    at PaymentProcessor.charge(payment.js:78)'
        }
      ];
      
      deployments = [
        {
          id: 'demo_deploy_001',
          version: 'v2.1.4',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          environment: 'production',
          commitSha: 'abc123def456',
          releaseNotes: 'Bug fixes and performance improvements'
        }
      ];
    }

    return { errors, deployments };
  }

  parseNewRelicResponse(response) {
    try {
      if (response.content && response.content[0] && response.content[0].text) {
        const text = response.content[0].text;
        
        // Parse errors from the formatted text
        const errors = [];
        const deployments = [];
        
        // Look for error patterns like "🚨 error_id: message"
        const errorMatches = text.match(/🚨\s+([^:]+):\s+([^\n]+)/g);
        if (errorMatches) {
          errorMatches.forEach(match => {
            const [, id, message] = match.match(/🚨\s+([^:]+):\s+(.+)/);
            errors.push({
              id: id.trim(),
              message: message.trim(),
              errorClass: 'ParsedError',
              timestamp: new Date(),
              count: 1,
              userImpact: 0,
              applicationName: 'Unknown App'
            });
          });
        }
        
        // Look for deployment patterns like "🚀 deploy_id: version"
        const deployMatches = text.match(/🚀\s+([^:]+):\s+([^\n]+)/g);
        if (deployMatches) {
          deployMatches.forEach(match => {
            const [, id, version] = match.match(/🚀\s+([^:]+):\s+(.+)/);
            deployments.push({
              id: id.trim(),
              version: version.trim(),
              timestamp: new Date(),
              environment: 'Unknown Environment'
            });
          });
        }
        
        // If we found errors, return them; if deployments, return them
        if (errors.length > 0) return errors;
        if (deployments.length > 0) return deployments;
        
        // Fallback: only create error if we found actual errors (not "Found 0 errors")
        if (text.includes('Found') && text.includes('errors') && !text.includes('Found 0 errors')) {
          // Create a generic error entry if we can't parse specifics
          return [{
            id: `parsed_${Date.now()}`,
            message: text.substring(0, 200),
            errorClass: 'ParsedError',
            timestamp: new Date(),
            count: 1,
            userImpact: 0,
            applicationName: 'System'
          }];
        }
      }
    } catch (error) {
      console.error('Error parsing New Relic response:', error);
    }
    return [];
  }

  async handleConversation(userMessage, conversationHistory = []) {
    try {
      // Fetch fresh data from New Relic (or use mock data)
      const { errors, deployments } = await this.fetchRecentData();
      
      // Get previous analysis if we have errors
      let previousAnalysis = [];
      if (errors.length > 0) {
        try {
          previousAnalysis = await this.analyzeErrors(errors, deployments);
        } catch (analysisError) {
          console.error('Error in analysis:', analysisError);
        }
      }

      const formattedErrors = JSON.stringify(errors, null, 2);
      const formattedDeployments = JSON.stringify(deployments, null, 2);
      const formattedAnalysis = JSON.stringify(previousAnalysis, null, 2);
      const formattedHistory = conversationHistory.map(msg => 
        `User: ${msg.user}\nBot: ${msg.bot}`
      ).join('\n\n');

      const prompt = await this.conversationPrompt.format({
        errors: formattedErrors,
        deployments: formattedDeployments,
        previousAnalysis: formattedAnalysis,
        conversationHistory: formattedHistory,
        userMessage: userMessage
      });

      const response = await this.llm.invoke(prompt);
      return response.content;
    } catch (error) {
      console.error('Error in handleConversation:', error);
      return "I'm sorry, I'm having trouble analyzing the errors right now. Please try again later or check the logs for more details.";
    }
  }

  async shouldRollback(errors = null, deployments = null) {
    // If no data provided, fetch fresh data
    if (!errors || !deployments) {
      const freshData = await this.fetchRecentData();
      errors = freshData.errors;
      deployments = freshData.deployments;
    }
    
    const analysis = await this.analyzeErrors(errors, deployments);
    
    // Check if any critical errors are release-related
    const criticalReleaseErrors = analysis.filter(a => 
      a.severity === 'critical' && 
      a.isReleaseRelated && 
      a.confidence > 70
    );

    // Check if multiple high-severity errors are release-related
    const highSeverityReleaseErrors = analysis.filter(a => 
      (a.severity === 'critical' || a.severity === 'high') && 
      a.isReleaseRelated && 
      a.confidence > 60
    );

    const shouldRollback = criticalReleaseErrors.length > 0 || 
                          highSeverityReleaseErrors.length >= 3;

    return {
      shouldRollback,
      confidence: shouldRollback ? Math.max(...analysis.map(a => a.confidence)) : 0,
      reasoning: shouldRollback 
        ? `Found ${criticalReleaseErrors.length} critical and ${highSeverityReleaseErrors.length} high-severity release-related errors`
        : 'No critical release-related errors detected',
      criticalErrors: criticalReleaseErrors,
      affectedErrors: highSeverityReleaseErrors
    };
  }
}

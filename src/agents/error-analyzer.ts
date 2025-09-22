import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { NewRelicError, ErrorAnalysis, DeploymentInfo } from '../types/index';

export class ErrorAnalyzer {
  private llm: ChatOpenAI;
  private analysisPrompt: PromptTemplate;
  private conversationPrompt: PromptTemplate;

  constructor(openaiApiKey: string) {
    this.llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: 'gpt-4o',
      temperature: 0.1,
    });

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

Return your analysis as a JSON array of ErrorAnalysis objects.
`);

    this.conversationPrompt = PromptTemplate.fromTemplate(`
You are a helpful DevOps AI assistant helping teams troubleshoot application errors.

CONTEXT:
User Question: {userQuestion}
Error Data: {errorData}
Deployment Data: {deploymentData}
Previous Analysis: {previousAnalysis}

INSTRUCTIONS:
- Be conversational and helpful
- Ask clarifying questions when needed
- Provide clear, actionable recommendations
- Explain your reasoning in simple terms
- Suggest specific next steps
- If you need more information, ask for it

Respond as if you're talking to a colleague in Slack/Discord.
`);
  }

  async analyzeErrors(
    errors: NewRelicError[],
    deployments: DeploymentInfo[] = []
  ): Promise<ErrorAnalysis[]> {
    if (errors.length === 0) {
      return [];
    }

    const prompt = await this.analysisPrompt.format({
      errors: JSON.stringify(errors, null, 2),
      deployments: JSON.stringify(deployments, null, 2),
      currentTime: new Date().toISOString(),
    });

    const response = await this.llm.invoke(prompt);
    
    try {
      const analyses = JSON.parse(response.content as string);
      
      // Validate and sanitize the response
      return analyses.map((analysis: any) => ({
        errorId: analysis.errorId || errors[0]?.id || 'unknown',
        severity: this.validateSeverity(analysis.severity),
        isReleaseRelated: Boolean(analysis.isReleaseRelated),
        confidence: Math.min(Math.max(analysis.confidence || 50, 0), 100),
        recommendation: this.validateRecommendation(analysis.recommendation),
        reasoning: analysis.reasoning || 'Analysis not provided',
        suggestedActions: Array.isArray(analysis.suggestedActions) 
          ? analysis.suggestedActions 
          : ['Review error details'],
        relatedErrors: analysis.relatedErrors || [],
      }));
    } catch (error) {
      console.error('Failed to parse AI analysis response:', error);
      
      // Fallback analysis
      return errors.map(error => ({
        errorId: error.id,
        severity: this.inferSeverityFromError(error),
        isReleaseRelated: this.inferReleaseRelation(error, deployments),
        confidence: 30,
        recommendation: 'investigate' as const,
        reasoning: 'Automated analysis failed, manual review required',
        suggestedActions: [
          'Review error details manually',
          'Check error frequency and user impact',
          'Correlate with recent deployments',
        ],
      }));
    }
  }

  async handleConversation(
    userQuestion: string,
    errorData?: NewRelicError[],
    deploymentData?: DeploymentInfo[],
    previousAnalysis?: ErrorAnalysis[]
  ): Promise<string> {
    const prompt = await this.conversationPrompt.format({
      userQuestion,
      errorData: errorData ? JSON.stringify(errorData, null, 2) : 'No error data provided',
      deploymentData: deploymentData ? JSON.stringify(deploymentData, null, 2) : 'No deployment data provided',
      previousAnalysis: previousAnalysis ? JSON.stringify(previousAnalysis, null, 2) : 'No previous analysis',
    });

    const response = await this.llm.invoke(prompt);
    return response.content as string;
  }

  async generateSummary(analyses: ErrorAnalysis[]): Promise<string> {
    if (analyses.length === 0) {
      return "No errors found in the specified time range. ✅";
    }

    const critical = analyses.filter(a => a.severity === 'critical');
    const high = analyses.filter(a => a.severity === 'high');
    const releaseRelated = analyses.filter(a => a.isReleaseRelated);
    const needRollback = analyses.filter(a => a.recommendation === 'rollback');
    const needHotfix = analyses.filter(a => a.recommendation === 'hotfix');

    let summary = `📊 **Error Analysis Summary**\n\n`;
    summary += `• **Total Errors**: ${analyses.length}\n`;
    summary += `• **Critical**: ${critical.length} 🔴\n`;
    summary += `• **High Priority**: ${high.length} 🟡\n`;
    summary += `• **Release Related**: ${releaseRelated.length}\n\n`;

    if (needRollback.length > 0) {
      summary += `🚨 **ROLLBACK RECOMMENDED** for ${needRollback.length} critical issue(s)\n\n`;
    }

    if (needHotfix.length > 0) {
      summary += `⚡ **Hotfix needed** for ${needHotfix.length} issue(s)\n\n`;
    }

    if (critical.length === 0 && high.length === 0) {
      summary += `✅ No critical issues detected. Continue monitoring.\n`;
    }

    return summary;
  }

  private validateSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    return validSeverities.includes(severity) ? severity as any : 'medium';
  }

  private validateRecommendation(recommendation: string): 'rollback' | 'hotfix' | 'monitor' | 'investigate' {
    const validRecommendations = ['rollback', 'hotfix', 'monitor', 'investigate'];
    return validRecommendations.includes(recommendation) ? recommendation as any : 'investigate';
  }

  private inferSeverityFromError(error: NewRelicError): 'critical' | 'high' | 'medium' | 'low' {
    // Simple heuristics for severity inference
    if (error.userImpact > 50 || error.count > 100) return 'critical';
    if (error.userImpact > 10 || error.count > 50) return 'high';
    if (error.count > 10) return 'medium';
    return 'low';
  }

  private inferReleaseRelation(error: NewRelicError, deployments: DeploymentInfo[]): boolean {
    if (deployments.length === 0) return false;
    
    // Check if error occurred within 1 hour of any deployment
    const errorTime = error.timestamp.getTime();
    return deployments.some(deployment => {
      const deployTime = deployment.timestamp.getTime();
      const timeDiff = Math.abs(errorTime - deployTime);
      return timeDiff <= (60 * 60 * 1000); // 1 hour
    });
  }
}

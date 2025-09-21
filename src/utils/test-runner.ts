import { ErrorAnalyzer } from '../agents/error-analyzer';
import { MockNewRelicServer, demoScenarios } from '../mock/sample-data';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test runner for demonstrating the Vibe Debugger functionality
 * This can be used for demos and testing without Slack integration
 */
export class TestRunner {
  private errorAnalyzer: ErrorAnalyzer;
  private mockServer: MockNewRelicServer;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for testing');
    }
    
    this.errorAnalyzer = new ErrorAnalyzer(process.env.OPENAI_API_KEY);
    this.mockServer = new MockNewRelicServer();
  }

  async runAllScenarios() {
    console.log('🧪 Running Vibe Debugger Test Scenarios\n');

    for (const [scenarioName, scenario] of Object.entries(demoScenarios)) {
      console.log(`\n📋 Testing Scenario: ${scenario.name}`);
      console.log(`📝 Description: ${scenario.description}`);
      console.log(`🎯 Expected: ${scenario.expectedRecommendation}`);
      console.log('─'.repeat(60));

      try {
        const analyses = await this.errorAnalyzer.analyzeErrors(
          scenario.errors,
          scenario.deployments
        );

        const summary = await this.errorAnalyzer.generateSummary(analyses);
        
        console.log('📊 Analysis Results:');
        console.log(summary);
        
        console.log('\n🔍 Detailed Analysis:');
        analyses.forEach(analysis => {
          console.log(`  • Error: ${analysis.errorId}`);
          console.log(`    Severity: ${analysis.severity}`);
          console.log(`    Recommendation: ${analysis.recommendation}`);
          console.log(`    Confidence: ${analysis.confidence}%`);
          console.log(`    Release Related: ${analysis.isReleaseRelated ? 'Yes' : 'No'}`);
          console.log(`    Reasoning: ${analysis.reasoning.substring(0, 100)}...`);
        });

        // Check if recommendation matches expectation
        const hasExpectedRecommendation = analyses.some(a => 
          a.recommendation === scenario.expectedRecommendation
        );
        
        console.log(`\n✅ Expected Recommendation: ${hasExpectedRecommendation ? 'MATCHED' : 'DIFFERENT'}`);
        
      } catch (error) {
        console.error(`❌ Error in scenario ${scenarioName}:`, error);
      }
    }
  }

  async testConversationalFlow() {
    console.log('\n💬 Testing Conversational Flow\n');
    console.log('─'.repeat(60));

    const questions = [
      "What errors happened in the last hour?",
      "Are there any critical issues I should be worried about?",
      "Should we rollback the latest deployment?",
      "What's causing the database timeout errors?",
      "How many users are affected by the payment issues?",
    ];

    // Get some sample data
    const errorResponse = await this.mockServer.getErrorInbox({ 
      timeRange: '1 hour ago',
      limit: 10 
    });
    const errorData = JSON.parse(errorResponse.content[0].text);
    
    const deploymentResponse = await this.mockServer.getDeploymentInfo({ 
      timeRange: '24 hours ago' 
    });
    const deploymentData = JSON.parse(deploymentResponse.content[0].text);

    const analyses = await this.errorAnalyzer.analyzeErrors(
      errorData.errors,
      deploymentData.deployments
    );

    for (const question of questions) {
      console.log(`\n❓ Question: "${question}"`);
      console.log('🤖 AI Response:');
      
      try {
        const response = await this.errorAnalyzer.handleConversation(
          question,
          errorData.errors,
          deploymentData.deployments,
          analyses
        );
        
        console.log(response);
        console.log('─'.repeat(40));
        
      } catch (error) {
        console.error(`❌ Error handling question: ${error}`);
      }
    }
  }

  async testNewRelicIntegration() {
    console.log('\n📊 Testing New Relic Integration (Mock)\n');
    console.log('─'.repeat(60));

    try {
      // Test error inbox fetching
      console.log('🔍 Fetching recent errors...');
      const errorResponse = await this.mockServer.getErrorInbox({
        timeRange: '1 hour ago',
        limit: 5
      });
      
      const errorData = JSON.parse(errorResponse.content[0].text);
      console.log(`✅ Found ${errorData.errors.length} errors`);
      
      errorData.errors.forEach((error: any) => {
        console.log(`  • ${error.errorClass}: ${error.message} (${error.count} occurrences)`);
      });

      // Test deployment info
      console.log('\n🚀 Fetching deployment info...');
      const deploymentResponse = await this.mockServer.getDeploymentInfo({
        timeRange: '24 hours ago'
      });
      
      const deploymentData = JSON.parse(deploymentResponse.content[0].text);
      console.log(`✅ Found ${deploymentData.deployments.length} deployments`);
      
      deploymentData.deployments.forEach((deployment: any) => {
        console.log(`  • ${deployment.version} (${deployment.environment}) at ${deployment.timestamp}`);
      });

      // Test error details
      if (errorData.errors.length > 0) {
        console.log('\n🔍 Fetching error details...');
        const errorId = errorData.errors[0].id;
        const detailResponse = await this.mockServer.getErrorDetails({ errorId });
        const detailData = JSON.parse(detailResponse.content[0].text);
        
        console.log(`✅ Error details for ${errorId}:`);
        console.log(`  Message: ${detailData.error.message}`);
        console.log(`  Class: ${detailData.error.errorClass}`);
        console.log(`  Occurrences: ${detailData.error.occurrences}`);
      }

    } catch (error) {
      console.error('❌ Error testing New Relic integration:', error);
    }
  }

  async runFullDemo() {
    console.log('🎬 Running Full Vibe Debugger Demo');
    console.log('='.repeat(60));
    
    await this.testNewRelicIntegration();
    await this.runAllScenarios();
    await this.testConversationalFlow();
    
    console.log('\n🎉 Demo Complete!');
    console.log('\n💡 Next Steps:');
    console.log('  1. Set up Slack bot integration');
    console.log('  2. Configure New Relic API credentials');
    console.log('  3. Deploy to your infrastructure');
    console.log('  4. Start chatting with your AI release assistant!');
  }
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const testRunner = new TestRunner();
  
  const command = process.argv[2] || 'demo';
  
  switch (command) {
    case 'scenarios':
      testRunner.runAllScenarios();
      break;
    case 'conversation':
      testRunner.testConversationalFlow();
      break;
    case 'newrelic':
      testRunner.testNewRelicIntegration();
      break;
    case 'demo':
    default:
      testRunner.runFullDemo();
      break;
  }
}

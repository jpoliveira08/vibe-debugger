import { NewRelicServerInterface } from '../types/index';

/**
 * Wrapper for NewRelicMCPServer to handle ES module import issues
 */
export async function createNewRelicMCPServer(apiKey: string, accountId: string): Promise<NewRelicServerInterface> {
  try {
    // Dynamic import to handle ES module compatibility
    const { NewRelicMCPServer } = await import('./newrelic-server');
    return new NewRelicMCPServer(apiKey, accountId);
  } catch (error) {
    console.error('Failed to import NewRelicMCPServer:', error);
    console.log('Falling back to mock server...');
    
    // Fallback to mock server if import fails
    const { MockNewRelicServer } = await import('../mock/sample-data');
    return new MockNewRelicServer();
  }
}

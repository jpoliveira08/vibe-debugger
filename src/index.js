import dotenv from 'dotenv';
import { ErrorAnalyzer } from './agents/error-analyzer.js';
import { DiscordBot } from './bots/discord-bot.js';
import { NewRelicMCPServer } from './mcp/newrelic-server.js';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting Vibe Debugger...');

  // Validate required environment variables
  const requiredEnvVars = [
    'GEMINI_API_KEY',
    'DISCORD_BOT_TOKEN',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  try {
    // Initialize New Relic server (or mock for demo)
    let newRelicServer;
    if (process.env.NEW_RELIC_API_KEY && process.env.NEW_RELIC_ACCOUNT_ID) {
      console.log('📊 Connecting to New Relic...');
      newRelicServer = new NewRelicMCPServer(
        process.env.NEW_RELIC_API_KEY,
        process.env.NEW_RELIC_ACCOUNT_ID
      );
    } else {
      console.log('🎭 Using mock New Relic data for demo...');
    }

    // Initialize components
    console.log('🤖 Initializing AI Error Analyzer...');
    const errorAnalyzer = new ErrorAnalyzer(process.env.GEMINI_API_KEY, newRelicServer);

    // Initialize Discord bot
    console.log('💬 Starting Discord bot...');
    const discordBot = new DiscordBot(
      process.env.DISCORD_BOT_TOKEN,
      errorAnalyzer
    );

    // Start the bot
    await discordBot.start(process.env.DISCORD_BOT_TOKEN);

    console.log('✅ Vibe Debugger is running!');
    console.log('');
    console.log('🎮 Discord Commands:');
    console.log('  • Mention @Vibe Debugger in any channel');
    console.log('  • Send direct messages to the bot');
    console.log('  • Use /vibe-errors [timerange] [application] to check errors');
    console.log('  • Use /vibe-status for overall status');
    console.log('  • Use /vibe-analyze <error_id> to analyze specific errors');
    console.log('');
    console.log('💡 Try asking:');
    console.log('  • "Check recent errors"');
    console.log('  • "Show errors from last 30 minutes"');
    console.log('  • "Should we rollback the last release?"');
    console.log('  • "Analyze error error_001"');
    console.log('');
    console.log('🔧 Configuration:');
    console.log(`  • New Relic: ${process.env.NEW_RELIC_API_KEY ? '✅ Connected' : '🎭 Mock Mode'}`);
    console.log(`  • OpenAI: ${process.env.GEMINI_API_KEY ? '✅ Connected' : '❌ Missing'}`);
    console.log(`  • Discord: ✅ Connected`);

  } catch (error) {
    console.error('❌ Failed to start Vibe Debugger:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Vibe Debugger...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Vibe Debugger...');
  process.exit(0);
});

// Start the application
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

# Vibe Debugger - AI Release Assistant

An AI-powered release assistant that monitors New Relic Error Inbox and provides intelligent recommendations through Discord chat interface.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key
- Discord bot token
- New Relic API key (optional - uses mock data if not provided)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd vibe-debugger
npm install
```

2. **Set up environment variables:**
```bash
cp env.example .env
```

Edit `.env` with your credentials:
```env
# Required
OPENAI_API_KEY=your_openai_api_key_here
DISCORD_BOT_TOKEN=your_discord_bot_token

# Optional (uses mock data if not provided)
NEW_RELIC_API_KEY=your_new_relic_api_key_here
NEW_RELIC_ACCOUNT_ID=your_account_id_here
```

3. **Build and run:**
```bash
npm run build
npm start

# Or for development:
npm run dev
```

## 🤖 Discord Bot Usage

### Commands

- **Mention the bot:** `@Vibe Debugger check recent errors`
- **Direct message:** Send DMs to the bot
- **Slash commands:**
  - `/vibe-errors [timerange] [application]` - Check for recent errors
  - `/vibe-status` - Get overall error status
  - `/vibe-analyze <error_id>` - Analyze specific error

### Example Conversations

```
You: @Vibe Debugger check errors from last 30 minutes
Bot: 🔍 Checking for errors in the last 30 minutes...
     📊 Error Analysis Summary
     • Total Errors: 3
     • Critical: 1 🔴
     • High Priority: 1 🟡
     • Release Related: 2
     
     🚨 ROLLBACK RECOMMENDED for 1 critical issue(s)

You: Should we rollback?
Bot: Based on the database timeout errors (45 occurrences, 25% user impact) 
     that started 5 minutes after the v2.1.4 deployment, I recommend an 
     immediate rollback. The errors are clearly correlated with the recent 
     database migration changes.

You: What about the payment errors?
Bot: The payment gateway timeouts are also concerning (8 occurrences, 60% 
     user impact). This appears related to the payment processing improvements 
     in v2.1.4. I'd recommend rolling back and investigating both issues in 
     staging before the next deployment.
```

## 🏗️ Architecture

### Core Components

1. **New Relic MCP Server** (`src/mcp/newrelic-server.ts`)
   - Fetches errors from New Relic Error Inbox
   - Gets deployment information
   - Retrieves detailed error information

2. **AI Error Analyzer** (`src/agents/error-analyzer.ts`)
   - Analyzes error patterns and severity
   - Correlates errors with deployments
   - Generates recommendations (rollback/hotfix/monitor)
   - Handles conversational interactions

3. **Discord Bot** (`src/bots/discord-bot.ts`)
   - Interactive chat interface with embeds and buttons
   - Slash command support
   - Rich message formatting with embeds
   - Conversation history management

4. **Mock Data** (`src/mock/sample-data.ts`)
   - Sample errors and deployments for testing
   - Demo scenarios for presentations
   - Fallback when New Relic isn't configured

## 🎯 Features

### Error Analysis
- **Severity Assessment:** Critical/High/Medium/Low classification
- **Release Correlation:** Identifies deployment-related errors
- **Impact Analysis:** User impact and error frequency analysis
- **Confidence Scoring:** AI confidence levels for recommendations

### Recommendations
- **Rollback:** For critical deployment-related issues
- **Hotfix:** For high-impact issues with clear fixes
- **Monitor:** For low-impact or unclear correlation issues
- **Investigate:** When more data is needed

### Chat Interface
- **Natural Language:** Ask questions in plain English
- **Interactive Buttons:** Click to analyze specific errors
- **Context Awareness:** Bot remembers conversation context
- **Proactive Alerts:** Can be extended for automatic notifications

## 🧪 Demo Scenarios

The system includes pre-built demo scenarios:

1. **Critical Database Issue:** Multiple timeout errors after deployment
2. **Minor UI Error:** Low-impact frontend error
3. **Pre-existing Issue:** Redis errors from before deployment
4. **Authentication Spike:** Sudden auth error increase

Run with mock data to demonstrate these scenarios.

## 📊 Example Analysis Output

```json
{
  "errorId": "error_001",
  "severity": "critical",
  "isReleaseRelated": true,
  "confidence": 95,
  "recommendation": "rollback",
  "reasoning": "Database timeout errors started 5 minutes after v2.1.4 deployment. High frequency (45 occurrences) and significant user impact (25%). Pattern strongly correlates with database migration changes in this release.",
  "suggestedActions": [
    "Immediate rollback to v2.1.3",
    "Review database migration scripts",
    "Test connection pooling in staging",
    "Monitor error rates post-rollback"
  ]
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI analysis |
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token |
| `NEW_RELIC_API_KEY` | No | New Relic API key (uses mock if missing) |
| `NEW_RELIC_ACCOUNT_ID` | No | New Relic account ID |
| `NODE_ENV` | No | Environment (development/production) |
| `PORT` | No | Server port (default: 3000) |

### Discord Bot Setup

1. Create a new Discord application at https://discord.com/developers/applications
2. Go to "Bot" section and create a bot
3. Copy the bot token for your `.env` file
4. Under "Privileged Gateway Intents", enable:
   - Message Content Intent
5. Go to "OAuth2" > "URL Generator":
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions: `Send Messages`, `Use Slash Commands`, `Read Message History`, `Add Reactions`
6. Use the generated URL to invite the bot to your Discord server

## 🚀 Development

### Project Structure
```
src/
├── agents/          # AI analysis logic
├── bots/           # Chat platform integrations  
├── mcp/            # New Relic MCP server
├── mock/           # Sample data for testing
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Main application entry
```

### Available Scripts
- `npm run dev` - Development with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run built application
- `npm test` - Run tests
- `npm run lint` - Lint code

### Adding New Features

1. **Slack Integration:** Add back Slack support alongside Discord
2. **Additional MCP Servers:** Add to `src/mcp/` for GitHub, JIRA, etc.
3. **Enhanced Analysis:** Extend `ErrorAnalyzer` with new analysis patterns
4. **Custom Scenarios:** Add to `src/mock/sample-data.ts` for testing

## 📈 Monitoring

The system is designed to integrate with:
- **LangFuse:** AI system observability (future enhancement)
- **LangGraph:** Workflow orchestration (future enhancement)
- **New Relic:** Application monitoring (current)
- **Discord:** Team communication (current)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built for rapid POC demonstration - ready to show your team the power of AI-assisted release monitoring through Discord!** 🚀

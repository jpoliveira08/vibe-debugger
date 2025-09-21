# Vibe Debugger Setup Guide

## Prerequisites Installation

### 1. Install Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Alternative (using snap):**
```bash
sudo snap install node --classic
```

**Manual installation:**
1. Download from https://nodejs.org/
2. Extract and add to PATH

### 2. Verify Installation
```bash
node --version  # Should show v18+ 
npm --version   # Should show npm version
```

## Project Setup

### 1. Install Dependencies
```bash
cd /home/joao-laptop/projetos/vibe-debbuger
npm install
```

### 2. Configure Environment
```bash
cp env.example .env
```

Edit `.env` with your API keys:
```env
# Required for AI analysis
OPENAI_API_KEY=your_openai_api_key_here

# Required for Discord integration
DISCORD_BOT_TOKEN=your_discord_bot_token

# Optional - uses mock data if not provided
NEW_RELIC_API_KEY=your_new_relic_api_key_here
NEW_RELIC_ACCOUNT_ID=your_account_id_here
```

### 3. Build and Test
```bash
# Build TypeScript
npm run build

# Run demo (works without Slack setup)
npm run demo

# Run with Discord integration
npm run dev
```

## Quick Demo (No Setup Required)

You can run a demo with mock data even without API keys:

1. Install Node.js (see above)
2. `npm install`
3. Create `.env` with just: `OPENAI_API_KEY=sk-fake-key-for-demo`
4. `npm run demo`

The demo will show you how the AI analysis works with sample error data.

## Troubleshooting

### "npm: command not found"
- Node.js is not installed or not in PATH
- Follow Node.js installation steps above

### "Cannot find module" errors
- Run `npm install` to install dependencies
- Check that package.json exists

### "Missing API key" errors  
- Check your `.env` file exists and has correct keys
- For demo mode, you can use fake keys

### Discord integration issues
- Verify Discord bot is created and configured
- Check bot token is correct in `.env`
- Ensure bot has required permissions and Message Content Intent enabled
- Make sure bot is invited to your Discord server

## Next Steps

1. **Get API Keys:**
   - OpenAI: https://platform.openai.com/api-keys
   - New Relic: https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/
   - Discord: https://discord.com/developers/applications

2. **Set up Discord Bot:**
   - Create bot at https://discord.com/developers/applications
   - Enable Message Content Intent
   - Add bot permissions: `Send Messages`, `Use Slash Commands`, `Read Message History`
   - Invite to Discord server

3. **Deploy:**
   - Run on your infrastructure
   - Set up monitoring
   - Configure alerts

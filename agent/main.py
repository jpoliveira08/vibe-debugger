import os
import sys
import logging
import discord
from discord.ext import commands
from fastapi import FastAPI, Request, HTTPException
from dotenv import load_dotenv
import uvicorn
import asyncio
from typing import Optional
from .vibe_debugger_agent import VibeDebuggerAgent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
ALERT_CHANNEL_ID_STR = os.getenv("ALERT_CHANNEL_ID")

# Validate environment variables
if not DISCORD_BOT_TOKEN:
    logger.error("DISCORD_BOT_TOKEN is required but not set")
    sys.exit(1)

if not ALERT_CHANNEL_ID_STR or not ALERT_CHANNEL_ID_STR.isdigit():
    logger.error("ALERT_CHANNEL_ID must be a valid Discord channel ID")
    sys.exit(1)

ALERT_CHANNEL_ID = int(ALERT_CHANNEL_ID_STR)

# --- FastAPI Webhook Server ---
app = FastAPI()

@app.post("/webhook")
async def receive_alert(request: Request):
    """
    Receives alerts from Prometheus Alertmanager.
    """
    try:
        alert_data = await request.json()
        logger.info(f"Received alert: {alert_data}")
        
        # Initialize and run the VibeDebugger Agent
        agent = VibeDebuggerAgent()
        
        # Send the alert to a Discord channel
        if bot and ALERT_CHANNEL_ID:
            channel = bot.get_channel(ALERT_CHANNEL_ID)
            if not channel:
                logger.error(f"Discord channel {ALERT_CHANNEL_ID} not found")
                raise HTTPException(status_code=404, detail="Discord channel not found")
                
            # Simple formatting for the POC
            for alert in alert_data.get('alerts', []):
                try:
                    # Run the agent to get the initial analysis
                    agent_result = agent.run(alert)
                    investigation_summary = agent_result.get('investigation_summary', "Agent investigation failed.")
                    
                    summary = alert.get('annotations', {}).get('summary', 'No summary')
                    description = alert.get('annotations', {}).get('description', 'No description')
                    status = alert.get('status', 'unknown')
                    
                    embed = discord.Embed(
                        title=f"🚨 New Alert: {summary}",
                        description=description,
                        color=discord.Color.red() if status == 'firing' else discord.Color.green()
                    )
                    embed.add_field(name="Status", value=status, inline=True)
                    embed.add_field(name="VibeDebugger Analysis", value=investigation_summary, inline=False)
                    
                    await channel.send(embed=embed)
                    logger.info(f"Alert sent to Discord: {summary}")
                    
                except Exception as e:
                    logger.error(f"Failed to process individual alert: {e}")
                    # Continue processing other alerts
                    continue
        else:
            logger.warning("Bot not ready or channel ID not configured")

        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Failed to process webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Discord Bot ---
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    logger.info(f'Discord bot logged in as {bot.user.name}')
    
@bot.event
async def on_error(event, *args, **kwargs):
    logger.error(f'Discord bot error in {event}: {args}')

@bot.command()
async def hello(ctx):
    await ctx.send("Hello! I am the VibeDebugger bot.")

# --- Main entrypoint to run both services ---
async def main():
    # Start FastAPI server
    config = uvicorn.Config(app, host="0.0.0.0", port=8080, log_level="info")
    server = uvicorn.Server(config)
    
    # Start Discord bot
    async with bot:
        await asyncio.gather(
            server.serve(),
            bot.start(DISCORD_BOT_TOKEN)
        )

@app.get("/health")
async def health_check():
    """Health check endpoint for Docker health checks"""
    return {"status": "healthy", "service": "vibe-debugger-agent"}

if __name__ == "__main__":
    logger.info("Starting VibeDebugger Agent...")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down gracefully...")
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        sys.exit(1)

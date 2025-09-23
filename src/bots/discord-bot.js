import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export class DiscordBot {
  constructor(token, errorAnalyzer) {
    this.token = token;
    this.errorAnalyzer = errorAnalyzer;
    this.conversationHistory = new Map();
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // GatewayIntentBits.MessageContent, // Need to enable on discord bot dashboard
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`✅ Discord bot logged in as ${this.client.user.tag}`);
      this.registerSlashCommands();
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Handle direct messages or mentions
      if (message.channel.type === 1 || message.mentions.has(this.client.user)) {
        await this.handleMessage(message);
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleSlashCommand(interaction);
    });
  }

  async registerSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName('vibe-errors')
        .setDescription('Check recent errors from New Relic')
        .addStringOption(option =>
          option.setName('timerange')
            .setDescription('Time range (e.g., "1 hour ago", "30 minutes ago")')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Filter by application name')
            .setRequired(false)),
      
      new SlashCommandBuilder()
        .setName('vibe-status')
        .setDescription('Get overall system status'),
      
      new SlashCommandBuilder()
        .setName('vibe-analyze')
        .setDescription('Analyze a specific error')
        .addStringOption(option =>
          option.setName('error_id')
            .setDescription('The error ID to analyze')
            .setRequired(true)),
    ];

    try {
      console.log('🔄 Refreshing application (/) commands...');
      await this.client.application.commands.set(commands);
      console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error('❌ Error registering slash commands:', error);
    }
  }

  async handleMessage(message) {
    try {
      const userId = message.author.id;
      const userMessage = message.content.replace(`<@${this.client.user.id}>`, '').trim();
      
      if (!userMessage) {
        await message.reply('👋 Hi! I\'m Vibe Debugger. Ask me about errors, deployments, or system status!');
        return;
      }

      await message.channel.sendTyping();

      // Get conversation history
      const history = this.conversationHistory.get(userId) || [];
      
      // Get AI response (ErrorAnalyzer will handle fetching New Relic data)
      const aiResponse = await this.errorAnalyzer.handleConversation(
        userMessage,
        history
      );

      // Update conversation history
      history.push({
        user: userMessage,
        bot: aiResponse,
        timestamp: new Date()
      });
      
      // Keep only last 10 messages
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }
      
      this.conversationHistory.set(userId, history);

      // Send response (split if too long)
      await this.sendLongMessage(message.channel, aiResponse);

    } catch (error) {
      console.error('Error handling message:', error);
      await message.reply('❌ Sorry, I encountered an error processing your request. Please try again.');
    }
  }

  async handleSlashCommand(interaction) {
    try {
      await interaction.deferReply();

      switch (interaction.commandName) {
        case 'vibe-errors':
          await this.handleErrorsCommand(interaction);
          break;
        case 'vibe-status':
          await this.handleStatusCommand(interaction);
          break;
        case 'vibe-analyze':
          await this.handleAnalyzeCommand(interaction);
          break;
        default:
          await interaction.editReply('Unknown command');
      }
    } catch (error) {
      console.error('Error handling slash command:', error);
      await interaction.editReply('❌ An error occurred while processing your command.');
    }
  }

  async handleErrorsCommand(interaction) {
    const timeRange = interaction.options.getString('timerange') || '1 hour ago';
    const application = interaction.options.getString('application');

    try {
      // Use ErrorAnalyzer to get recent data
      const { errors } = await this.errorAnalyzer.fetchRecentData(timeRange);
      
      // Filter by application if specified
      const filteredErrors = application 
        ? errors.filter(error => error.applicationName.toLowerCase().includes(application.toLowerCase()))
        : errors;

      let description = '';
      if (filteredErrors.length === 0) {
        description = `No errors found in the last ${timeRange}${application ? ` for application "${application}"` : ''}.`;
      } else {
        description = `Found ${filteredErrors.length} errors in the last ${timeRange}:\n\n`;
        description += filteredErrors.slice(0, 5).map(error => 
          `🚨 **${error.id}**: ${error.message}\n` +
          `   App: ${error.applicationName}\n` +
          `   Count: ${error.count}\n`
        ).join('\n');
        
        if (filteredErrors.length > 5) {
          description += `\n... and ${filteredErrors.length - 5} more errors.`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`🚨 Recent Errors (${timeRange})`)
        .setDescription(description.substring(0, 4096))
        .setColor(0xff0000)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`❌ Error fetching errors: ${error.message}`);
    }
  }

  async handleStatusCommand(interaction) {
    const hasNewRelic = this.errorAnalyzer.newRelicServer !== null;
    
    const embed = new EmbedBuilder()
      .setTitle('🔧 Vibe Debugger Status')
      .addFields(
        { name: '🤖 AI Analyzer', value: '✅ Online', inline: true },
        { name: '📊 New Relic', value: hasNewRelic ? '✅ Connected' : '🎭 Mock Mode', inline: true },
        { name: '💬 Discord', value: '✅ Connected', inline: true }
      )
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleAnalyzeCommand(interaction) {
    const errorId = interaction.options.getString('error_id');

    try {
      // Get recent data to find the error
      const { errors, deployments } = await this.errorAnalyzer.fetchRecentData();
      
      // Find the specific error
      const targetError = errors.find(error => error.id === errorId);
      
      if (!targetError) {
        await interaction.editReply(`❌ Error ${errorId} not found in recent errors.`);
        return;
      }

      // Analyze the specific error
      const analysis = await this.errorAnalyzer.analyzeErrors([targetError], deployments);
      const errorAnalysis = analysis[0];

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Error Analysis: ${errorId}`)
        .addFields(
          { name: '🚨 Error Message', value: targetError.message, inline: false },
          { name: '📱 Application', value: targetError.applicationName, inline: true },
          { name: '⚠️ Severity', value: errorAnalysis?.severity || 'Unknown', inline: true },
          { name: '🎯 Confidence', value: `${errorAnalysis?.confidence || 0}%`, inline: true },
          { name: '🔧 Recommendation', value: errorAnalysis?.recommendation || 'Investigate', inline: true },
          { name: '📊 Count', value: targetError.count.toString(), inline: true },
          { name: '👥 User Impact', value: targetError.userImpact.toString(), inline: true },
          { name: '💭 Reasoning', value: errorAnalysis?.reasoning || 'No analysis available', inline: false }
        )
        .setColor(0xffa500)
        .setTimestamp();

      if (targetError.stackTrace) {
        embed.addFields({ name: '📋 Stack Trace', value: `\`\`\`${targetError.stackTrace.substring(0, 1000)}\`\`\``, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`❌ Error analyzing error: ${error.message}`);
    }
  }


  async sendLongMessage(channel, content) {
    const maxLength = 2000;
    
    if (content.length <= maxLength) {
      await channel.send(content);
      return;
    }

    // Split message into chunks
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        
        if (line.length > maxLength) {
          // Split very long lines
          for (let i = 0; i < line.length; i += maxLength) {
            chunks.push(line.substring(i, i + maxLength));
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Send chunks
    for (const chunk of chunks) {
      await channel.send(chunk);
    }
  }

  async start(token) {
    await this.client.login(token);
  }

  async stop() {
    await this.client.destroy();
  }
}

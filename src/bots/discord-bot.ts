import { Client, GatewayIntentBits, Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Events } from 'discord.js';
import { ErrorAnalyzer } from '../agents/error-analyzer';
// import { NewRelicMCPServer } from '../mcp/newrelic-server';
import { NewRelicError, DeploymentInfo, ErrorAnalysis, ConversationMessage, NewRelicServerInterface } from '../types/index';

export class DiscordBot {
  private client: Client;
  private errorAnalyzer: ErrorAnalyzer;
  private newRelicServer: NewRelicServerInterface; // Can be NewRelicMCPServer or MockNewRelicServer
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();

  constructor(
    token: string,
    errorAnalyzer: ErrorAnalyzer,
    newRelicServer: NewRelicServerInterface
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.errorAnalyzer = errorAnalyzer;
    this.newRelicServer = newRelicServer;
    this.setupHandlers();
  }

  private setupHandlers() {
    this.client.once(Events.ClientReady, () => {
      console.log(`✅ Discord bot logged in as ${this.client.user?.tag}!`);
      this.registerSlashCommands();
    });

    // Handle messages (mentions and DMs)
    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;

      const botUser = this.client.user;
      if (!botUser) return;

      // Check if bot is mentioned or it's a DM
      const isMentioned = message.mentions.has(botUser);
      const isDM = message.channel.type === 1; // DM channel

      if (!isMentioned && !isDM) return;

      await this.handleMessage(message);
    });

    // Handle slash commands
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }
    });
  }

  private async registerSlashCommands() {
    const commands = [
      {
        name: 'vibe-errors',
        description: 'Check for recent errors',
        options: [
          {
            name: 'timerange',
            description: 'Time range to check (e.g., "30 minutes ago", "1 hour ago")',
            type: 3, // STRING
            required: false,
          },
          {
            name: 'application',
            description: 'Filter by application name',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'vibe-status',
        description: 'Get overall error status and recent deployments',
      },
      {
        name: 'vibe-analyze',
        description: 'Analyze a specific error',
        options: [
          {
            name: 'error_id',
            description: 'The error ID to analyze',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ];

    try {
      await this.client.application?.commands.set(commands);
      console.log('✅ Discord slash commands registered successfully!');
    } catch (error) {
      console.error('❌ Failed to register slash commands:', error);
    }
  }

  private async handleMessage(message: Message) {
    try {
      // Clean up the message text (remove mentions)
      const cleanText = message.content.replace(/<@!?\d+>/g, '').trim();
      
      // Show typing indicator
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Determine intent and extract parameters
      const intent = this.parseIntent(cleanText);
      
      switch (intent.type) {
        case 'check_errors':
          await this.handleErrorCheck(intent.params, message);
          break;
        case 'analyze_error':
          await this.handleErrorAnalysis(intent.params, message);
          break;
        case 'deployment_status':
          await this.handleDeploymentStatus(intent.params, message);
          break;
        case 'conversation':
          await this.handleConversation(cleanText, message);
          break;
        default:
          await this.showHelp(message);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      await message.reply({
        content: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    try {
      switch (interaction.commandName) {
        case 'vibe-errors': {
          await interaction.deferReply();
          const timeRange = interaction.options.getString('timerange') || '1 hour ago';
          const applicationName = interaction.options.getString('application');
          await this.handleErrorCheckSlash(interaction, { timeRange, applicationName });
          break;
        }

        case 'vibe-status':
          await interaction.deferReply();
          await this.handleDeploymentStatusSlash(interaction);
          break;

        case 'vibe-analyze': {
          await interaction.deferReply();
          const errorId = interaction.options.getString('error_id', true);
          await this.handleErrorAnalysisSlash(interaction, { errorId });
          break;
        }

        default:
          await interaction.reply({
            content: 'Unknown command!',
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error('Error handling slash command:', error);
      const errorMessage = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  private async handleButtonInteraction(interaction: any) {
    try {
      await interaction.deferReply();
      
      const [action, errorId] = interaction.customId.split('_');
      
      if (action === 'analyze') {
        await this.analyzeSpecificError(errorId, interaction, true);
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      await interaction.editReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async handleErrorCheck(params: any, message: Message) {
    const { timeRange = '1 hour ago', applicationName } = params;
    
    await message.reply(`🔍 Checking for errors in the last ${timeRange}...`);

    try {
      // Get errors from New Relic
      const errorResponse = await this.newRelicServer.getErrorInbox({
        timeRange,
        applicationName,
        limit: 20,
      });

      const errorData = JSON.parse(errorResponse.content[0].text);
      const errors: NewRelicError[] = errorData.errors;

      if (errors.length === 0) {
        if ('send' in message.channel) {
          await message.channel.send({
            content: `✅ No errors found in the last ${timeRange}${applicationName ? ` for ${applicationName}` : ''}`,
          });
        }
        return;
      }

      // Get deployment info
      const deploymentResponse = await this.newRelicServer.getDeploymentInfo({
        applicationName,
        timeRange: '24 hours ago',
      });
      const deploymentData = JSON.parse(deploymentResponse.content[0].text);
      const deployments: DeploymentInfo[] = deploymentData.deployments;

      // Analyze errors
      const analyses = await this.errorAnalyzer.analyzeErrors(errors, deployments);
      const summary = await this.errorAnalyzer.generateSummary(analyses);

      // Create embed with summary
      const embed = this.createErrorSummaryEmbed(analyses, errors, summary);
      const components = this.createErrorActionButtons(analyses, errors);

      if ('send' in message.channel) {
        await message.channel.send({
          content: summary,
          embeds: [embed],
          components: components.length > 0 ? [components[0]] : [],
        });
      }

    } catch (error) {
      if ('send' in message.channel) {
        await message.channel.send({
          content: `❌ Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  }

  private async handleErrorCheckSlash(interaction: ChatInputCommandInteraction, params: any) {
    const { timeRange, applicationName } = params;
    
    try {
      const errorResponse = await this.newRelicServer.getErrorInbox({
        timeRange,
        applicationName,
        limit: 20,
      });

      const errorData = JSON.parse(errorResponse.content[0].text);
      const errors: NewRelicError[] = errorData.errors;

      if (errors.length === 0) {
        await interaction.editReply({
          content: `✅ No errors found in the last ${timeRange}${applicationName ? ` for ${applicationName}` : ''}`,
        });
        return;
      }

      const deploymentResponse = await this.newRelicServer.getDeploymentInfo({
        applicationName,
        timeRange: '24 hours ago',
      });
      const deploymentData = JSON.parse(deploymentResponse.content[0].text);
      const deployments: DeploymentInfo[] = deploymentData.deployments;

      const analyses = await this.errorAnalyzer.analyzeErrors(errors, deployments);
      const summary = await this.errorAnalyzer.generateSummary(analyses);

      const embed = this.createErrorSummaryEmbed(analyses, errors, summary);
      const components = this.createErrorActionButtons(analyses, errors);

      await interaction.editReply({
        content: summary,
        embeds: [embed],
        components: components.length > 0 ? [components[0]] : [],
      });

    } catch (error) {
      await interaction.editReply({
        content: `❌ Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async handleErrorAnalysis(params: any, message: Message) {
    const { errorId } = params;
    await this.analyzeSpecificError(errorId, message, false);
  }

  private async handleErrorAnalysisSlash(interaction: ChatInputCommandInteraction, params: any) {
    const { errorId } = params;
    await this.analyzeSpecificError(errorId, interaction, true);
  }

  private async analyzeSpecificError(errorId: string, context: Message | ChatInputCommandInteraction, isInteraction: boolean) {
    try {
      const errorResponse = await this.newRelicServer.getErrorDetails({ errorId });
      if (!errorResponse) {
        throw new Error(`Error ${errorId} not found`);
      }
      const errorData = JSON.parse(errorResponse.content[0].text);
      const error = errorData.error;

      const analysis = await this.errorAnalyzer.analyzeErrors([error]);
      const analysisResult = analysis[0];

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Error Analysis: ${error.errorClass}`)
        .setColor(this.getSeverityColor(analysisResult.severity))
        .addFields(
          {
            name: '📊 Severity',
            value: `${this.getSeverityEmoji(analysisResult.severity)} ${analysisResult.severity.toUpperCase()}`,
            inline: true,
          },
          {
            name: '🎯 Confidence',
            value: `${analysisResult.confidence}%`,
            inline: true,
          },
          {
            name: '💡 Recommendation',
            value: `${this.getRecommendationEmoji(analysisResult.recommendation)} ${analysisResult.recommendation.toUpperCase()}`,
            inline: true,
          },
          {
            name: '🔗 Release Related',
            value: analysisResult.isReleaseRelated ? '✅ Yes' : '❌ No',
            inline: true,
          },
          {
            name: '📝 Reasoning',
            value: analysisResult.reasoning,
            inline: false,
          },
          {
            name: '🛠️ Suggested Actions',
            value: analysisResult.suggestedActions.map(action => `• ${action}`).join('\n'),
            inline: false,
          }
        )
        .setTimestamp();

      if (isInteraction) {
        await (context as ChatInputCommandInteraction).editReply({
          content: `Analysis complete for error ${errorId}`,
          embeds: [embed],
        });
      } else {
        const channel = (context as Message).channel;
        if ('send' in channel) {
          await channel.send({
            content: `Analysis complete for error ${errorId}`,
            embeds: [embed],
          });
        }
      }

    } catch (error) {
      const errorMessage = `❌ Error analyzing ${errorId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      if (isInteraction) {
        await (context as ChatInputCommandInteraction).editReply({ content: errorMessage });
      } else {
        const channel = (context as Message).channel;
        if ('send' in channel) {
          await channel.send({ content: errorMessage });
        }
      }
    }
  }

  private async handleDeploymentStatus(params: any, message: Message) {
    const { applicationName } = params;
    
    try {
      const deploymentResponse = await this.newRelicServer.getDeploymentInfo({
        applicationName,
        timeRange: '24 hours ago',
      });

      const deploymentData = JSON.parse(deploymentResponse.content[0].text);
      const deployments: DeploymentInfo[] = deploymentData.deployments;

      if (deployments.length === 0) {
        if ('send' in message.channel) {
          await message.channel.send({
            content: `No deployments found in the last 24 hours${applicationName ? ` for ${applicationName}` : ''}`,
          });
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📦 Recent Deployments (Last 24h)')
        .setColor('#00ff00')
        .setTimestamp();

      deployments.slice(0, 5).forEach((deployment, index) => {
        embed.addFields({
          name: `Deployment ${index + 1}`,
          value: [
            `**Version:** ${deployment.version}`,
            `**Environment:** ${deployment.environment}`,
            `**Time:** ${deployment.timestamp.toLocaleString()}`,
            `**Commit:** ${deployment.commitSha || 'N/A'}`,
          ].join('\n'),
          inline: true,
        });
      });

      if ('send' in message.channel) {
        await message.channel.send({ embeds: [embed] });
      }

    } catch (error) {
      if ('send' in message.channel) {
        await message.channel.send({
          content: `❌ Error fetching deployments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  }

  private async handleDeploymentStatusSlash(interaction: ChatInputCommandInteraction) {
    try {
      const deploymentResponse = await this.newRelicServer.getDeploymentInfo({
        timeRange: '24 hours ago',
      });

      const deploymentData = JSON.parse(deploymentResponse.content[0].text);
      const deployments: DeploymentInfo[] = deploymentData.deployments;

      if (deployments.length === 0) {
        await interaction.editReply({
          content: 'No deployments found in the last 24 hours',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📦 Recent Deployments (Last 24h)')
        .setColor('#00ff00')
        .setTimestamp();

      deployments.slice(0, 5).forEach((deployment, index) => {
        embed.addFields({
          name: `Deployment ${index + 1}`,
          value: [
            `**Version:** ${deployment.version}`,
            `**Environment:** ${deployment.environment}`,
            `**Time:** ${deployment.timestamp.toLocaleString()}`,
            `**Commit:** ${deployment.commitSha || 'N/A'}`,
          ].join('\n'),
          inline: true,
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      await interaction.editReply({
        content: `❌ Error fetching deployments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async handleConversation(text: string, message: Message) {
    try {
      const userId = message.author.id;
      const channelId = message.channel.id;
      const historyKey = `${userId}_${channelId}`;
      const history = this.conversationHistory.get(historyKey) || [];

      const response = await this.errorAnalyzer.handleConversation(
        text,
        undefined,
        undefined,
        undefined
      );

      history.push({ user: text, bot: response, timestamp: new Date() });
      if (history.length > 10) history.shift();
      this.conversationHistory.set(historyKey, history);

      // Split long responses
      if (response.length > 2000) {
        const chunks = this.splitMessage(response, 2000);
        for (const chunk of chunks) {
          if ('send' in message.channel) {
            await message.channel.send({ content: chunk });
          }
        }
      } else {
        if ('send' in message.channel) {
          await message.channel.send({ content: response });
        }
      }

    } catch (error) {
      if ('send' in message.channel) {
        await message.channel.send({
          content: "I'm having trouble processing that request. Could you try rephrasing it?",
        });
      }
    }
  }

  private parseIntent(text: string): { type: string; params: any } {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('error') && (lowerText.includes('check') || lowerText.includes('show') || lowerText.includes('recent'))) {
      return {
        type: 'check_errors',
        params: {
          timeRange: this.extractTimeRange(text) || '1 hour ago',
          applicationName: this.extractApplicationName(text),
        },
      };
    }

    if (lowerText.includes('analyze') || lowerText.includes('analysis')) {
      return {
        type: 'analyze_error',
        params: {
          errorId: this.extractErrorId(text),
        },
      };
    }

    if (lowerText.includes('deployment') || lowerText.includes('deploy') || lowerText.includes('release')) {
      return {
        type: 'deployment_status',
        params: {
          applicationName: this.extractApplicationName(text),
        },
      };
    }

    return { type: 'conversation', params: {} };
  }

  private extractTimeRange(text: string): string | null {
    const timePatterns = [
      /(\d+)\s+(minute|hour|day)s?\s+ago/i,
      /last\s+(\d+)\s+(minute|hour|day)s?/i,
      /past\s+(\d+)\s+(minute|hour|day)s?/i,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return `${match[1]} ${match[2]}${parseInt(match[1]) > 1 ? 's' : ''} ago`;
      }
    }

    return null;
  }

  private extractApplicationName(text: string): string | null {
    const appPattern = /app(?:lication)?\s+([a-zA-Z0-9-_]+)/i;
    const match = text.match(appPattern);
    return match ? match[1] : null;
  }

  private extractErrorId(text: string): string | null {
    const idPattern = /error\s+([a-zA-Z0-9-_]+)/i;
    const match = text.match(idPattern);
    return match ? match[1] : null;
  }

  private createErrorSummaryEmbed(analyses: ErrorAnalysis[], errors: NewRelicError[], summary: string): EmbedBuilder {
    const criticalCount = analyses.filter(a => a.severity === 'critical').length;
    const highCount = analyses.filter(a => a.severity === 'high').length;
    const releaseRelatedCount = analyses.filter(a => a.isReleaseRelated).length;

    return new EmbedBuilder()
      .setTitle('📊 Error Analysis Summary')
      .setDescription(summary)
      .addFields(
        {
          name: '📈 Error Breakdown',
          value: [
            `**Total Errors:** ${analyses.length}`,
            `**Critical:** ${criticalCount} 🔴`,
            `**High Priority:** ${highCount} 🟡`,
            `**Release Related:** ${releaseRelatedCount}`,
          ].join('\n'),
          inline: true,
        }
      )
      .setColor(criticalCount > 0 ? '#ff0000' : highCount > 0 ? '#ffaa00' : '#00ff00')
      .setTimestamp();
  }

  private createErrorActionButtons(analyses: ErrorAnalysis[], errors: NewRelicError[]): ActionRowBuilder<ButtonBuilder>[] {
    const criticalErrors = analyses.filter(a => a.severity === 'critical').slice(0, 3);
    
    if (criticalErrors.length === 0) return [];

    const buttons = criticalErrors.map(analysis => {
      const error = errors.find(e => e.id === analysis.errorId);
      return new ButtonBuilder()
        .setCustomId(`analyze_${analysis.errorId}`)
        .setLabel(`Analyze: ${error?.errorClass || 'Unknown'}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔍');
    });

    return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
  }

  private getSeverityEmoji(severity: string): string {
    const emojis = {
      critical: '🔴',
      high: '🟡',
      medium: '🟠',
      low: '🟢',
    };
    return emojis[severity as keyof typeof emojis] || '⚪';
  }

  private getSeverityColor(severity: string): number {
    const colors = {
      critical: 0xff0000, // Red
      high: 0xffaa00,    // Orange
      medium: 0xffff00,  // Yellow
      low: 0x00ff00,     // Green
    };
    return colors[severity as keyof typeof colors] || 0x888888;
  }

  private getRecommendationEmoji(recommendation: string): string {
    const emojis = {
      rollback: '⏪',
      hotfix: '⚡',
      monitor: '👁️',
      investigate: '🔍',
    };
    return emojis[recommendation as keyof typeof emojis] || '❓';
  }

  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const lines = text.split('\n');
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        if (line.length > maxLength) {
          // Split very long lines
          const words = line.split(' ');
          for (const word of words) {
            if (currentChunk.length + word.length + 1 > maxLength) {
              chunks.push(currentChunk);
              currentChunk = word;
            } else {
              currentChunk += (currentChunk ? ' ' : '') + word;
            }
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

    return chunks;
  }

  private async showHelp(message: Message) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Vibe Debugger Help')
      .setDescription('I can help you monitor and analyze application errors!')
      .addFields(
        {
          name: '💬 Chat Commands',
          value: [
            '• "Check recent errors"',
            '• "Show errors from last 30 minutes"',
            '• "Any errors in app myapp?"',
            '• "Analyze error error_123"',
            '• "Should we rollback the last release?"',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚡ Slash Commands',
          value: [
            '• `/vibe-errors [timerange] [application]` - Check for recent errors',
            '• `/vibe-status` - Get overall error status',
            '• `/vibe-analyze <error_id>` - Analyze specific error',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📝 Usage Tips',
          value: [
            '• Mention me (@Vibe Debugger) in any channel',
            '• Send me direct messages',
            '• Use natural language - I understand context!',
            '• Click buttons for quick actions',
          ].join('\n'),
          inline: false,
        }
      )
      .setColor('#0099ff')
      .setTimestamp();

    if ('send' in message.channel) {
      await message.channel.send({ embeds: [embed] });
    }
  }

  async start(token: string) {
    try {
      await this.client.login(token);
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      throw error;
    }
  }

  async stop() {
    await this.client.destroy();
  }
}

export default DiscordBot;

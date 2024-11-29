import {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    Collection,
    ChannelType,
    DiscordAPIError,
} from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import startBotTracking from './botTracker.js';

config({ path: './settings.env' });

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const ALLOWED_SERVER_IDS = process.env.ALLOWED_SERVER_IDS?.split(',') || [];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

// Utility function to get the current time in PDT
function getCurrentTimePDT() {
    const timeZone = 'America/Los_Angeles';
    const date = new Date();
    return new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

/**
 * Logs a message to both the console and the specified Discord channel.
 *
 * @param {string} message - The message to log.
 */
async function logToChannel(message, includeDate = false) {
    const timeZone = 'America/Los_Angeles';
    const date = new Date();
    const currentDateStr = new Intl.DateTimeFormat('en-US').format(date);
    const currentTimeStr = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);

    // Add date if required
    const logPrefix = includeDate ? `[Log] :: ${currentDateStr}` : `[Log] ::`;

    // Console logging
    console.log(`${logPrefix} ${message}`);

    // Discord channel logging
    try {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel && channel.type === ChannelType.GuildText) {
            const logMessage = `\`\`\`asciidoc\n${logPrefix}\n${message}\n[Time] :: ${currentTimeStr}\n\`\`\``;
            await channel.send(logMessage);
        }
    } catch (error) {
        console.error('Failed to log message to Discord channel:', error);
    }
}

// Load and register commands
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath));
    client.commands.set(command.default.data.name, command.default);
    commands.push(command.default.data.toJSON());
}

// Discord REST API for commands
const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    const currentTimeStr = getCurrentTimePDT();

    try {
        await logToChannel(`Logged in as ${client.user.tag}`);
        await logToChannel('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

        await logToChannel('Successfully reloaded application (/) commands.');
        await logToChannel('🚀 Bot tracking started!');

        // Start bot tracking for recurring tasks
        startBotTracking(client, DISCORD_CHANNEL_ID);
    } catch (error) {
        console.error('Error during setup:', error);
        await logToChannel(`[Setup Error] :: ${error.message}`);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const subcommand = interaction.options.getSubcommand(false);
    const guild = interaction.guild ? interaction.guild.name : 'DM';

    try {
        await command.execute(interaction);

        await logToChannel(
            `[Command Executed] :: ${interaction.commandName}\n` +
            `[Sub-Command Executed] :: ${subcommand || 'None'}\n` +
            `[Executed By] :: ${interaction.user.tag}\n` +
            `[Guild] :: ${guild}`,
            true // Include date
        );
    } catch (error) {
        console.error('Error executing command:', error);

        await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
        });

        await logToChannel(
            `[Command Error] :: ${error.message || 'No message'}\n` +
            `[Command] :: ${interaction.commandName}\n` +
            `[Sub-Command] :: ${subcommand || 'None'}\n` +
            `[Executed By] :: ${interaction.user.tag}\n` +
            `[Guild] :: ${guild}\n` +
            `[Stack Trace] :: ${error.stack || 'No stack trace available'}`,
            true // Include date
        );
    }
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);

    await logToChannel(
        `[Unhandled Rejection] :: ${reason instanceof Error ? reason.message : String(reason)}\n` +
        `[Stack Trace] :: ${reason instanceof Error ? reason.stack : 'No stack trace available'}`
    );
});

process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception thrown:', error);

    await logToChannel(
        `[Uncaught Exception] :: ${error.message || 'No message'}\n` +
        `[Stack Trace] :: ${error.stack || 'No stack trace available'}`
    );
});

client.login(TOKEN);
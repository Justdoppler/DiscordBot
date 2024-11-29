import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { formatInTimeZone } from 'date-fns-tz';

config({ path: path.resolve('settings.env') });

const ownerId = process.env.OWNER_ID;
const announcementsChannelId = process.env.ANNOUNCEMENTS_CHANNEL_ID;
const updatesFile = path.join(path.resolve(), 'json/updates.json');
const coinsFilePath = path.join(path.resolve(), 'json/dabcoins.json');

function isOwner(interaction) {
    return interaction.user.id === ownerId;
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
}

function loadJSON(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getNextVersion(currentVersion) {
    if (!currentVersion) {
        return 'V0.1';
    }

    const versionParts = currentVersion.slice(1).split('.');
    let major = parseInt(versionParts[0], 10);
    let minor = parseInt(versionParts[1], 10);

    if (major === 0 && minor < 9) {
        minor += 1;
    } else if (major === 0 && minor === 9) {
        major = 1;
        minor = 0;
    } else {
        minor += 1;
    }

    return `V${major}.${minor}`;
}

function adjustCoins(username, amount) {
    const coinsData = loadJSON(coinsFilePath);
    if (!coinsData[username]) {
        coinsData[username] = { balance: 0 };
    }
    coinsData[username].balance += amount;
    saveJSON(coinsFilePath, coinsData);
    return coinsData[username].balance;
}

function getCurrentTimePDT() {
    const timeZone = 'America/Los_Angeles';
    const date = new Date();
    return formatInTimeZone(date, timeZone, 'MMMM dd, yyyy hh:mm a zzz');
}

export default {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Owner commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_update')
                .setDescription('Create a new version in the updates JSON with empty sections.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('announcement')
                .setDescription('Post an announcement about the latest bot updates.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restart')
                .setDescription('Restarts the bot for updating purposes.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Update a specific section of the current version.')
                .addStringOption(option =>
                    option.setName('section')
                        .setDescription('Section to update: new_additions, fixes, upgrades, notes')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('updates')
                        .setDescription('Enter the updates, separated by semicolons (;)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('dabcoins')
                .setDescription('Add or remove dabcoins from a user.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to add/remove coins to/from.')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('The amount of coins to add/remove.')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        try {
            if (!isOwner(interaction)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const updatesData = loadJSON(updatesFile);
            const currentVersion = Object.keys(updatesData).sort().reverse()[0];
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'set_update') {
                const newVersion = getNextVersion(currentVersion);

                if (!updatesData[newVersion]) {
                    updatesData[newVersion] = {
                        new_additions: [],
                        fixes: [],
                        upgrades: [],
                        notes: [],
                        last_updated_by: interaction.user.username,
                        last_updated_time: getCurrentTimePDT(),
                    };

                    saveJSON(updatesFile, updatesData);
                    await interaction.reply(`✅ Bot updates version ${newVersion} has been successfully created!`);
                } else {
                    await interaction.reply({ content: `❌ Version ${newVersion} already exists!`, ephemeral: true });
                }

            } else if (subcommand === 'update') {
                if (!currentVersion) {
                    await interaction.reply({ content: '❌ No version found. Please create a new version using `/owner set_update`.', ephemeral: true });
                    return;
                }

                const section = interaction.options.getString('section').toLowerCase();
                const updates = interaction.options.getString('updates').split(';').map(update => update.trim());

                if (updatesData[currentVersion][section]) {
                    updatesData[currentVersion][section].push(...updates);
                    updatesData[currentVersion].last_updated_by = interaction.user.username;
                    updatesData[currentVersion].last_updated_time = getCurrentTimePDT();

                    saveJSON(updatesFile, updatesData);
                    await interaction.reply(`✅ Bot section '${section}' has been successfully updated in version ${currentVersion}!`);
                } else {
                    await interaction.reply({ content: `❌ Invalid section '${section}'. Please use one of the following: new_additions, fixes, upgrades, notes.`, ephemeral: true });
                }

            } else if (subcommand === 'restart') {
                await interaction.reply('Restarting bot...');
                await interaction.client.destroy();
                process.exit(0);

            } else if (subcommand === 'dabcoins') {
                const user = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                const balance = adjustCoins(user.username, amount);
                await interaction.reply(`${amount >= 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} coins. New balance: **${balance}**.`);

            } else if (subcommand === 'announcement') {
                const versions = Object.keys(updatesData).sort().reverse();

                if (!versions.length) {
                    await interaction.reply({ content: 'No updates found.', ephemeral: true });
                    return;
                }

                const latestVersion = versions[0];
                const updateData = updatesData[latestVersion];
                const {
                    new_additions = [],
                    fixes = [],
                    upgrades = [],
                    notes = [],
                    last_updated_by = 'Unknown',
                    last_updated_time = 'Unknown date',
                } = updateData;

                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`Bot Announcement - Version ${latestVersion}`)
                    .setDescription(
                        `In the most recent update of the bot, **Version ${latestVersion}**, released on **${last_updated_time}**, the following updates were made:`
                    )
                    .addFields(
                        { name: 'New Additions', value: new_additions.length ? new_additions.map(a => `- ${a}`).join('\n') : 'No new additions.', inline: false },
                        { name: 'Fixes', value: fixes.length ? fixes.map(f => `- ${f}`).join('\n') : 'No fixes.', inline: false },
                        { name: 'Upgrades', value: upgrades.length ? upgrades.map(u => `- ${u}`).join('\n') : 'No upgrades.', inline: false },
                        { name: 'Notes', value: notes.length ? notes.map(n => `- ${n}`).join('\n') : 'No notes.', inline: false }
                    )
                    .setFooter({ text: `Last updated by: ${last_updated_by} ; at ${last_updated_time}` });

                const announcementsChannel = await interaction.client.channels.fetch(announcementsChannelId);

                if (!announcementsChannel || !announcementsChannel.isTextBased()) {
                    await interaction.reply({ content: 'Announcements channel not found or is not a text-based channel.', ephemeral: true });
                    return;
                }

                await announcementsChannel.send({ embeds: [embed] });
                await interaction.reply({ content: 'Announcement posted successfully.', ephemeral: true });
            }
        } catch (error) {
            console.error('Error executing owner command:', error);
            await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
        }
    },
};
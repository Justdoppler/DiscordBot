import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from 'dotenv';
import { formatInTimeZone } from 'date-fns-tz';
import { getCoinBalance, adjustCoins, loadCoins, saveCoins } from './utils/coinUtils.js'; // Import coin utilities
import fs from 'fs';
import path from 'path';

config({ path: path.resolve('settings.env') });

const ownerId = process.env.OWNER_ID;
const announcementsChannelId = process.env.ANNOUNCEMENTS_CHANNEL_ID;
const updatesFile = path.join(path.resolve(), 'json/updates.json');
const dabcoinsFile = path.join(path.resolve(), 'json/dabcoins.json');

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

function getCurrentTimePDT() {
    const timeZone = 'America/Los_Angeles';
    const date = new Date();
    return formatInTimeZone(date, timeZone, 'MMM dd, yyyy hh:mm:ss a zzz');
}

export default {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Owner commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Kick a user from the server.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to kick.').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason').setDescription('Reason for kicking the user.').setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Ban a user from the server.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to ban.').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason').setDescription('Reason for banning the user.').setRequired(true)
                )
        )
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ignore')
                .setDescription('Ignore a user from the leaderboard')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to ignore')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unignore')
                .setDescription('Unignore a user from the leaderboard')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to unignore')
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
            const dabcoinsData = loadJSON(dabcoinsFile);
            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('user');

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

                const balance = adjustCoins(user.id, amount); // Adjust coins using `coinUtils.js`
                await interaction.reply(`${amount >= 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} coins. New balance: **${balance}**.`);

            } else if (subcommand === 'kick') {
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided';
    
                const member = await interaction.guild.members.fetch(user.id);
                await member.kick(reason);
    
                await interaction.reply(`👢 ${user.tag} has been kicked. Reason: ${reason}`);
            } else if (subcommand === 'ban') {
                try {
                    const user = interaction.options.getUser('user');
                    const reason = interaction.options.getString('reason') || 'No reason provided'; // Default if no reason given
            
                    // Fetch the member
                    const member = await interaction.guild.members.fetch(user.id);
            
                    // Ban the member with the reason
                    await member.ban({ reason });
            
                    // Reply with confirmation
                    await interaction.reply(`🔨 ${user.tag} has been banned. Reason: ${reason}`);
                } catch (error) {
                    console.error('Error executing ban command:', error);
            
                    // Handle common errors
                    if (error.code === '10007') {
                        await interaction.reply({ content: 'The user is not a member of this guild.', ephemeral: true });
                    } else if (error.code === '50013') {
                        await interaction.reply({ content: 'I do not have permission to ban this user.', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'An error occurred while trying to ban the user.', ephemeral: true });
                    }
                }
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
            } else  if (subcommand === 'ignore') {
                // Load existing ignored users
                const coinsData = loadCoins();
                const ignoredUsers = coinsData.ignoredUsers || [];
    
                // Add user to ignored list if not already ignored
                if (!ignoredUsers.includes(targetUser.id)) {
                    ignoredUsers.push(targetUser.id);
                    coinsData.ignoredUsers = ignoredUsers;
                    saveCoins(coinsData); // Save updated data
                    await interaction.reply(`${targetUser.username} has been ignored from the leaderboard.`);
                } else {
                    await interaction.reply(`${targetUser.username} is already ignored.`);
                }
            } else if (subcommand === 'unignore') {
                // Load existing ignored users
                const coinsData = loadCoins();
                const ignoredUsers = coinsData.ignoredUsers || [];
    
                // Remove user from ignored list
                const index = ignoredUsers.indexOf(targetUser.id);
                if (index !== -1) {
                    ignoredUsers.splice(index, 1);
                    coinsData.ignoredUsers = ignoredUsers;
                    saveCoins(coinsData); // Save updated data
                    await interaction.reply(`${targetUser.username} has been unignored from the leaderboard.`);
                } else {
                    await interaction.reply(`${targetUser.username} is not ignored.`);
                }
            }
        } catch (error) {
            console.error('Error executing owner command:', error);
            await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
        }
    },
};
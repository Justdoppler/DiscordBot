import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { adjustCoins, getCoinBalance } from './utils/coinUtils.js';
import fs from 'fs';
import path from 'path';

const coinsFilePath = path.join(path.resolve(), 'json/dabcoins.json');
const jackpotFilePath = path.join(path.resolve(), 'json/jackpot.json');
const cooldownFilePath = path.join(path.resolve(), 'json/daily.json');

// Load or initialize cooldown data
function loadCooldowns() {
    if (!fs.existsSync(cooldownFilePath)) {
        fs.writeFileSync(cooldownFilePath, JSON.stringify({}, null, 4));
    }
    const data = fs.readFileSync(cooldownFilePath, 'utf-8');
    return JSON.parse(data);
}

// Save cooldown data
function saveCooldowns(data) {
    fs.writeFileSync(cooldownFilePath, JSON.stringify(data, null, 4));
}

// Check if a user is eligible for daily reward
function canRedeemDaily(userId) {
    const cooldowns = loadCooldowns();
    const lastRedeemed = cooldowns[userId]?.lastRedeemed;
    if (!lastRedeemed) return true;

    const now = Date.now();
    return now - lastRedeemed >= 24 * 60 * 60 * 1000; // 24 hours
}

// Mark a user as having redeemed the daily reward
function redeemDaily(userId) {
    const cooldowns = loadCooldowns();
    cooldowns[userId] = { lastRedeemed: Date.now() };
    saveCooldowns(cooldowns);
}

// Calculate daily reward
function calculateDailyReward() {
    const chance = Math.random() * 100;
    if (chance <= 6) {
        const reward = jackpot;
        jackpot = 0;
        saveJackpot(jackpot);
        return { reward, isJackpot: true };
    } else {
        const rewards = [
            { amount: 50, chance: 15 },
            { amount: 100, chance: 10 },
            { amount: 500, chance: 8 },
            { amount: 1000, chance: 5 },
            { amount: 5000, chance: 3 },
            { amount: 10000, chance: 1 },
        ];
        const totalWeight = rewards.reduce((sum, r) => sum + r.chance, 0);

        let random = Math.random() * totalWeight;
        for (const reward of rewards) {
            if (random < reward.chance) {
                return { reward: reward.amount, isJackpot: false };
            }
            random -= reward.chance;
        }
        return { reward: 50, isJackpot: false };
    }
}

// Load Current Time
function getCurrentTimePDT() {
    const now = new Date();
    const utcOffset = now.getTimezoneOffset() * 60000;
    const PDTOffset = -7 * 3600000;
    const PDTTime = new Date(now.getTime() + utcOffset + PDTOffset);

    return PDTTime.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
    });
}

// Load dabcoins data
function loadCoins() {
    if (!fs.existsSync(coinsFilePath)) {
        fs.writeFileSync(coinsFilePath, JSON.stringify({ lastUpdated: null }, null, 4));
    }
    const data = fs.readFileSync(coinsFilePath, 'utf-8');
    return JSON.parse(data);
}

// Save dabcoins data
function saveCoins(data) {
    fs.writeFileSync(coinsFilePath, JSON.stringify(data, null, 4));
}

// Load jackpot data
function loadJackpot() {
    if (!fs.existsSync(jackpotFilePath)) {
        fs.writeFileSync(jackpotFilePath, JSON.stringify(0, null, 4));
    }
    return JSON.parse(fs.readFileSync(jackpotFilePath, 'utf-8'));
}

// Save jackpot data
function saveJackpot(amount) {
    fs.writeFileSync(jackpotFilePath, JSON.stringify(amount, null, 4));
}

// Increment jackpot over time
let jackpot = loadJackpot();
setInterval(() => {
    jackpot += 46; // Add to jackpot every 10 minutes
    saveJackpot(jackpot);
}, 600000);

// Get leaderboard data
function getUserLeaderboard(interaction) {
    const coinsData = loadCoins();
    const ignoredUsers = coinsData.ignoredUsers || [];

    const leaderboard = Object.entries(coinsData)
        .filter(([userId]) => userId !== 'lastUpdated')
        .filter(([userId]) => {
            const member = interaction.guild.members.cache.get(userId);
            return member && !member.user.bot && !ignoredUsers.includes(userId);
        })
        .map(([userId, { balance }]) => {
            const member = interaction.guild.members.cache.get(userId);
            return {
                displayName: member ? member.displayName : `<Unknown User (${userId})>`,
                balance,
            };
        })
        .sort((a, b) => b.balance - a.balance);
    return leaderboard;
}

// Slash command logic
export default {
    data: new SlashCommandBuilder()
        .setName('dabcoins')
        .setDescription('Manage dabcoins')
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Check your dabcoin balance')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to check the balance of')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transfer dabcoins to another user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to transfer coins to')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('The amount of coins to transfer')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Display the dabcoins leaderboard')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('daily')
                .setDescription('Claim your daily reward')
        ),
    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'balance') {
                const targetUser = interaction.options.getUser('user') || interaction.user;
                const userId = targetUser.id;
                const balance = getCoinBalance(userId);
                const displayName = interaction.guild.members.cache.get(userId)?.displayName || targetUser.username;
                await interaction.reply(`${displayName}'s current coin balance is: ${balance} coins.`);
            } else if (subcommand === 'transfer') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');
                const senderId = interaction.user.id;
                const recipientId = targetUser.id;

                if (targetUser.bot) {
                    await interaction.reply({ content: 'You cannot transfer dabcoins to a bot.', ephemeral: true });
                    return;
                }

                const senderBalance = getCoinBalance(senderId);
                if (senderBalance < amount) {
                    await interaction.reply({ content: 'You do not have enough dabcoins to transfer.', ephemeral: true });
                    return;
                }

                adjustCoins(senderId, -amount);
                adjustCoins(recipientId, amount);
                await interaction.reply(`Transferred ${amount} coins to ${targetUser.username}.`);
            } else if (subcommand === 'leaderboard') {
                const coinsData = loadCoins();
                const leaderboard = getUserLeaderboard(interaction);

                const embed = new EmbedBuilder()
                    .setTitle('Dabcoins Leaderboard')
                    .setColor(0x00AE86)
                    .setDescription(
                        leaderboard
                            .map((user, index) => `${index + 1}. **${user.displayName}**: ${user.balance} coins`)
                            .join('\n') || 'No data available.'
                    )
                    .setFooter({
                        text: `Last updated at ${coinsData.lastUpdated || 'Unknown'}`,
                    });

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else if (subcommand === 'daily') {
                const userId = interaction.user.id;
    
                if (!canRedeemDaily(userId)) {
                    const cooldowns = loadCooldowns();
                    const lastRedeemed = cooldowns[userId]?.lastRedeemed;
                    const remainingTime = new Date(
                        lastRedeemed + 24 * 60 * 60 * 1000 - Date.now()
                    );
                    const hours = Math.floor(remainingTime / (60 * 60 * 1000));
                    const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
    
                    await interaction.reply({
                        content: `You have already claimed your daily reward. Please try again in ${hours} hours and ${minutes} minutes.`,
                        ephemeral: true,
                    });
                    return;
                }
    
                const { reward, isJackpot } = calculateDailyReward();
                adjustCoins(userId, reward);
                redeemDaily(userId);

                if (isJackpot) {
                    await interaction.reply(`🎉 Jackpot Winner! You earned ${reward} coins!`);
                } else {
                    await interaction.reply(`You claimed ${reward} coins as your daily reward.`);
                }
            }
        } catch (error) {
            console.error('Error executing dabcoins command:', error);
            await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};
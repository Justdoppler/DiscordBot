import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

const coinsFilePath = path.join(path.resolve(), 'json/dabcoins.json');
const jackpotFilePath = path.join(path.resolve(), 'json/jackpot.json');

function loadCoins() {
    if (!fs.existsSync(coinsFilePath)) {
        fs.writeFileSync(coinsFilePath, JSON.stringify({}, null, 4));
    }
    const data = fs.readFileSync(coinsFilePath, 'utf-8');
    return JSON.parse(data);
}

function saveCoins(data) {
    fs.writeFileSync(coinsFilePath, JSON.stringify(data, null, 4));
}

function loadJackpot() {
    if (!fs.existsSync(jackpotFilePath)) {
        fs.writeFileSync(jackpotFilePath, JSON.stringify(0, null, 4));
    }
    return JSON.parse(fs.readFileSync(jackpotFilePath, 'utf-8'));
}

function saveJackpot(amount) {
    fs.writeFileSync(jackpotFilePath, JSON.stringify(amount, null, 4));
}

let jackpot = loadJackpot();
setInterval(() => {
    jackpot += 46;
    saveJackpot(jackpot);
}, 600000);

function getCoinBalance(username) {
    const coinsData = loadCoins();
    return coinsData[username] ? coinsData[username].balance : 0;
}

function adjustCoins(username, amount) {
    const coinsData = loadCoins();
    if (!coinsData[username]) {
        coinsData[username] = { balance: 0 };
    }
    coinsData[username].balance += amount;
    saveCoins(coinsData);
    return coinsData[username].balance;
}

function getUserLeaderboard() {
    const coinsData = loadCoins();
    const sortedUsers = Object.entries(coinsData)
        .sort(([, a], [, b]) => b.balance - a.balance)
        .map(([username, { balance }]) => ({ username, balance }));
    return sortedUsers;
}


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
                const balance = getCoinBalance(targetUser.username);
                await interaction.reply(`${targetUser.username}'s current coin balance is: ${balance} coins.`);
            } else if (subcommand === 'transfer') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                if (targetUser.bot) {
                    await interaction.reply({ content: 'You cannot transfer dabcoins to a bot.', ephemeral: true });
                    return;
                }

                const userBalance = getCoinBalance(interaction.user.username);
                if (userBalance < amount) {
                    await interaction.reply({ content: 'You do not have enough dabcoins to transfer.', ephemeral: true });
                    return;
                }

                adjustCoins(interaction.user.username, -amount);
                adjustCoins(targetUser.username, amount);
                await interaction.reply(`Transferred ${amount} coins to ${targetUser.username}.`);
            } else if (subcommand === 'leaderboard') {
                const leaderboard = getUserLeaderboard();
                const leaderboardMessage = leaderboard
                    .map((user, index) => `${index + 1}. ${user.username}: ${user.balance} coins`)
                    .join('\n');
                await interaction.reply(`Dabcoins Leaderboard:\n${leaderboardMessage}`);
            } else if (subcommand === 'daily') {
                const userId = interaction.user.username;
                const { reward, isJackpot } = calculateDailyReward();
                adjustCoins(userId, reward);

                if (isJackpot) {
                    await interaction.reply(`🎉 Jackpot Winner! You earned ${reward} coins!`);
                } else {
                    await interaction.reply(`You claimed ${reward} coins as your daily reward.`);
                }
            }
        } catch (error) {
            console.error('Error executing dabcoins command:', error);
            await interaction.reply('An error occurred while executing this command.');
        }
    },
};
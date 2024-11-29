import { SlashCommandBuilder, SlashCommandSubcommandBuilder, EmbedBuilder } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';

const coinsFilePath = path.join(path.resolve(), 'json/dabcoins.json');
const jackpotFilePath = path.join(path.resolve(), 'json/jackpot.json');
const lotteryPath = path.join(path.resolve(), 'json/lottery.json');

// Function to load or initialize the lottery data
function loadLottery() {
    if (!fs.existsSync(lotteryPath)) {
        fs.writeFileSync(
            lotteryPath,
            JSON.stringify({
                TicketHolders: {
                    Users: {},
                    LotteryInfo: { Prize: 0 },
                },
            }, null, 4)
        );
    }

    const data = JSON.parse(fs.readFileSync(lotteryPath, 'utf-8'));
    
    // Ensure structure exists
    if (!data.TicketHolders) {
        data.TicketHolders = { Users: {}, LotteryInfo: { Prize: 0 } };
    }
    if (!data.TicketHolders.Users) {
        data.TicketHolders.Users = {};
    }
    if (!data.TicketHolders.LotteryInfo) {
        data.TicketHolders.LotteryInfo = { Prize: 0 };
    }

    return data;
}

// Function to save lottery data
function saveLottery(data) {
    fs.writeFileSync(lotteryPath, JSON.stringify(data, null, 4));
}

function loadJSON(filePath, defaultValue = {}) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 4));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
}

function adjustCoins(username, amount) {
    const coinsData = loadLottery(coinsFilePath, {});
    if (!coinsData[username]) {
        coinsData[username] = { balance: 0 };
    }
    coinsData[username].balance += amount;
    saveLottery(coinsData);
    return coinsData[username].balance;
}

function getCoinBalance(username) {
    const coinsData = loadLottery(coinsFilePath, {});
    return coinsData[username]?.balance || 0;
}

// Global Prize Definitions
const godTierPrizes = [
    { prize: '🔥 1,000,000 dabcoins!', amount: 1000000 },
    { prize: '☢️ 500,000 dabcoins!', amount: 500000 },
    { prize: '⚠️ 250,000 dabcoins!', amount: 250000 }
];

const highTierPrizes = [
    { prize: '👑 50,000 dabcoins!', amount: 50000 },
    { prize: '💰 10,000 dabcoins!', amount: 10000 },
    { prize: '💎 5,000 dabcoins!', amount: 5000 },
    { prize: '🏆 2,500 dabcoins!', amount: 2500 },
    { prize: '🎖️ 1,250 dabcoins!', amount: 1250 },
    { prize: '✨ 1,000 dabcoins!', amount: 1000 }
];

const lowTierPrizes = [
    { prize: '✅ 1,000 dabcoins!', amount: 750 },
    { prize: '🎁 500 dabcoins!', amount: 500 },
    { prize: '🎉 250 dabcoins!', amount: 250 },
    { prize: '🔑 100 dabcoins!', amount: 100 },
    { prize: '🎊 50 dabcoins!', amount: 50 },
    { prize: '🍬 25 dabcoins!', amount: 25 },
    { prize: '⭐ 10 dabcoins!', amount: 10 },
    { prize: '🙃 5 dabcoins!', amount: 5 },
    { prize: '😞 1 dabcoin!', amount: 1 },
    { prize: '💤 0 dabcoins!', amount: 0 }
];

// Function to Select a Random Prize
function selectRandomPrize() {
    const isGodTier = Math.random() < 0.03; // 3% chance for god-tier prize
    const isHighTier = !isGodTier && Math.random() < 0.15; // 15% chance for high-tier prize, only if not god-tier

    const prizeList = isGodTier
        ? godTierPrizes
        : isHighTier
        ? highTierPrizes
        : lowTierPrizes;

    return prizeList[Math.floor(Math.random() * prizeList.length)];
}

// Jackpot Subcommand
const JackpotSubcommand = {
    data: new SlashCommandSubcommandBuilder()
        .setName('jackpot')
        .setDescription('Buy a ticket for the jackpot (1000 dabcoins).'),

    async execute(interaction) {
        const user = interaction.user.username;
        const ticketPrice = 1000;

        const balance = getCoinBalance(user);
        if (balance < ticketPrice) {
            await interaction.reply({ content: 'You do not have enough dabcoins to buy a ticket.', ephemeral: true });
            return;
        }

        const tickets = loadJSON(ticketsFilePath);

        if (tickets[user]) {
            await interaction.reply({ content: 'You have already purchased a ticket for this jackpot.', ephemeral: true });
            return;
        }

        adjustCoins(user, -ticketPrice);

        const jackpot = loadJSON(jackpotFilePath, 0) + ticketPrice;
        saveJSON(jackpotFilePath, jackpot);

        tickets[user] = true;
        saveJSON(ticketsFilePath, tickets);

        await interaction.reply(`🎟️ You have purchased a ticket for the jackpot! The current jackpot is **${jackpot} dabcoins**.`);
    },
};

// Buy Lottery Tickets
const BuyTicketCommand = {
    data: new SlashCommandBuilder()
        .setName('buyticket')
        .setDescription('Buy a lottery ticket for the current draw.'),
    async execute(interaction) {
        const lotteryData = loadLottery();
        const user = interaction.user;

        // Check if the user already has a ticket
        if (lotteryData.TicketHolders.Users[user.id]) {
            await interaction.reply({
                content: `🎟️ You already have a ticket! Your ticket number is **${lotteryData.TicketHolders.Users[user.id].Ticket}**.`,
                ephemeral: true,
            });
            return;
        }

        // Generate a random ticket number between 1 and 100,000
        const ticketNumber = Math.floor(Math.random() * 100000) + 1;

        // Update the lottery data
        lotteryData.TicketHolders.Users[user.id] = {
            Username: user.username,
            Ticket: ticketNumber,
        };

        // Initialize or update the prize amount
        if (!lotteryData.TicketHolders.LotteryInfo.Prize) {
            const randomPrize = Math.floor(Math.random() * (2000000 - 250000 + 1)) + 250000;
            lotteryData.TicketHolders.LotteryInfo.Prize = randomPrize;
        }

        // Save the updated lottery data
        saveLottery(lotteryData);

        // Reply to the user with their ticket information
        await interaction.reply({
            content: `🎟️ You have purchased ticket number **${ticketNumber}**. The current prize is **${lotteryData.TicketHolders.LotteryInfo.Prize.toLocaleString()} dabcoins**. Good luck!`,
            ephemeral: true,
        });
    },
};

// Spinner Subcommand
const SpinSubcommand = {
    data: new SlashCommandSubcommandBuilder()
        .setName('spinner')
        .setDescription('Spin the wheel for a random prize!'),
    async execute(interaction) {
        const user = interaction.user.username;
        const balance = getCoinBalance(user);

        if (balance < 200) {
            await interaction.reply({ content: 'You need at least 200 dabcoins to spin the wheel.', ephemeral: true });
            return;
        }

        adjustCoins(user, -200);

        const spinningWheel = [
            ...godTierPrizes.map(p => p.prize.split(' ')[0]),
            ...highTierPrizes.map(p => p.prize.split(' ')[0]),
            ...lowTierPrizes.map(p => p.prize.split(' ')[0]),
        ];

        const spin = async () => {
            for (let i = 0; i < 10; i++) {
                const display = spinningWheel
                    .slice(i % spinningWheel.length, (i % spinningWheel.length) + 3)
                    .join(' ');
                await interaction.editReply(`🎡 Spinning: ${display}`);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        };

        const result = selectRandomPrize();
        await interaction.reply({ content: 'Spinning the wheel... 🎡', fetchReply: true });
        await spin();
        adjustCoins(user, result.amount);
        await interaction.editReply(`🎉 The wheel stopped on **${result.prize}**! Your new balance is **${getCoinBalance(user)} dabcoins**.`);
    },
};

// Rock Paper Scissors Subcommand
const RockPaperScissorsSubcommand = {
    data: new SlashCommandSubcommandBuilder()
        .setName('rps')
        .setDescription('Play Rock, Paper, Scissors against the bot!')
        .addStringOption(option =>
            option
                .setName('choice')
                .setDescription('Choose Rock, Paper, or Scissors.')
                .setRequired(true)
                .addChoices(
                    { name: 'Rock', value: 'rock' },
                    { name: 'Paper', value: 'paper' },
                    { name: 'Scissors', value: 'scissors' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('wager')
                .setDescription('Amount of dabcoins to wager.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.user.username;
        const playerChoice = interaction.options.getString('choice');
        const wager = interaction.options.getInteger('wager');

        const balance = getCoinBalance(user);
        if (balance < wager) {
            await interaction.reply({ content: 'You do not have enough dabcoins to wager.', ephemeral: true });
            return;
        }

        if (wager < 10) {
            await interaction.reply({ content: 'You must wager at least 10 dabcoins.', ephemeral: true });
            return;
        }

        const botChoices = ['rock', 'paper', 'scissors'];
        const botChoice = botChoices[Math.floor(Math.random() * botChoices.length)];

        let result;
        if (playerChoice === botChoice) {
            result = 'tie';
        } else if (
            (playerChoice === 'rock' && botChoice === 'scissors') ||
            (playerChoice === 'paper' && botChoice === 'rock') ||
            (playerChoice === 'scissors' && botChoice === 'paper')
        ) {
            result = 'win';
        } else {
            result = 'lose';
        }

        if (result === 'win') {
            adjustCoins(user, wager);
            await interaction.reply(`🎉 You chose **${playerChoice}**, and the bot chose **${botChoice}**. You won ${wager} dabcoins!`);
        } else if (result === 'lose') {
            adjustCoins(user, -wager);
            await interaction.reply(`😢 You chose **${playerChoice}**, and the bot chose **${botChoice}**. You lost ${wager} dabcoins.`);
        } else {
            await interaction.reply(`🤝 You chose **${playerChoice}**, and the bot chose **${botChoice}**. It's a tie! No dabcoins were lost.`);
        }
    }
};

// Export Command
export default {
    data: new SlashCommandBuilder()
        .setName('games')
        .setDescription('Various game commands.')
        .addSubcommand(JackpotSubcommand.data)
        .addSubcommand(SpinSubcommand.data)
        .addSubcommand(RockPaperScissorsSubcommand.data)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('buyticket')
                .setDescription('Buy a lottery ticket for the current draw.')
            ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'buyticket') {
            await BuyTicketCommand.execute(interaction);
        } else if (subcommand === 'jackpot') {
            await JackpotSubcommand.execute(interaction);
        } else if (subcommand === 'spinner') {
            await SpinSubcommand.execute(interaction);
        } else if (subcommand === 'rps') {
            await RockPaperScissorsSubcommand.execute(interaction);
        } else if (subcommand === 'buyticket') {
            await BuyTicketSubcommand.execute(interaction);
        }
    }
};
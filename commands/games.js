import { SlashCommandBuilder, SlashCommandSubcommandBuilder, EmbedBuilder } from '@discordjs/builders';
import { getCoinBalance, adjustCoins } from './utils/coinUtils.js';
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

// Function to load the dabcoins data
function loadCoins() {
    if (!fs.existsSync(coinsFilePath)) {
        fs.writeFileSync(coinsFilePath, JSON.stringify({ lastUpdated: null }, null, 4));
    }
    return JSON.parse(fs.readFileSync(coinsFilePath, 'utf-8'));
}

// Function to save the dabcoins data
function saveCoins(data) {
    fs.writeFileSync(coinsFilePath, JSON.stringify(data, null, 4));
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

const BuyTicketCommand = {
    data: new SlashCommandBuilder()
        .setName('buyticket')
        .setDescription('Buy a lottery ticket for the current draw.'),
    async execute(interaction) {
        const lotteryData = loadLottery();
        const user = interaction.user;
        const userId = user.id;

        // Ticket price
        const ticketPrice = 10000; // Updated ticket price to 10,000 dabcoins

        // Check user balance
        const balance = getCoinBalance(userId);
        if (balance < ticketPrice) {
            await interaction.reply({
                content: `You do not have enough dabcoins to buy a ticket. You need **${ticketPrice.toLocaleString()} dabcoins**.`,
                ephemeral: true,
            });
            return;
        }

        // Check if the user already has a ticket
        if (lotteryData.TicketHolders.Users[userId]) {
            await interaction.reply({
                content: `🎟️ You already have a ticket! Your ticket number is **${lotteryData.TicketHolders.Users[userId].Ticket}**.`,
                ephemeral: true,
            });
            return;
        }

        // Generate a random ticket number between 1 and 100,000
        const ticketNumber = Math.floor(Math.random() * 100000) + 1;

        // Deduct dabcoins
        adjustCoins(userId, -ticketPrice);

        // Update the lottery data
        lotteryData.TicketHolders.Users[userId] = {
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
            content: `🎟️ You have purchased ticket number **${ticketNumber}** for **${ticketPrice.toLocaleString()} dabcoins**. The current prize is **${lotteryData.TicketHolders.LotteryInfo.Prize.toLocaleString()} dabcoins**. Good luck!`,
            ephemeral: true,
        });
    },
};

// Jackpot Subcommand
const JackpotSubcommand = {
    data: new SlashCommandSubcommandBuilder()
        .setName('jackpot')
        .setDescription('Buy a ticket for the jackpot.'),

    async execute(interaction) {
        const user = interaction.user;
        const userId = user.id;

        // Load the current jackpot value
        const jackpot = loadJSON(jackpotFilePath, 0);

        // Determine ticket price based on the jackpot value
        let ticketPrice = 1000; // Default price
        if (jackpot >= 100000 && jackpot < 2000000) ticketPrice = 10000;
        else if (jackpot >= 2000000 && jackpot < 3000000) ticketPrice = 20000;

        // Check user balance
        const balance = getCoinBalance(userId);
        if (balance < ticketPrice) {
            await interaction.reply({
                content: `You do not have enough dabcoins to buy a jackpot ticket. The ticket price is **${ticketPrice.toLocaleString()} dabcoins**.`,
                ephemeral: true,
            });
            return;
        }

        const tickets = loadJSON(ticketsFilePath, {});

        // Check if user has already purchased a ticket
        if (tickets[userId]) {
            await interaction.reply({
                content: `You have already purchased a ticket for this jackpot.`,
                ephemeral: true,
            });
            return;
        }

        // Deduct the ticket price from user's balance
        adjustCoins(userId, -ticketPrice);

        // Add the ticket price to the jackpot
        const updatedJackpot = jackpot + ticketPrice;
        saveJSON(jackpotFilePath, updatedJackpot);

        // Mark user as having a ticket
        tickets[userId] = true;
        saveJSON(ticketsFilePath, tickets);

        await interaction.reply({
            content: `🎟️ You have purchased a ticket for the jackpot! The current jackpot is **${updatedJackpot.toLocaleString()} dabcoins**.`,
            ephemeral: true,
        });
    },
};

// Spinner Subcommand
const SpinCommand = {
    data: new SlashCommandSubcommandBuilder()
        .setName('spinner')
        .setDescription('Spin the wheel for a random prize!'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const balance = getCoinBalance(userId);

        if (balance < 200) {
            await interaction.reply({ content: 'You need at least 200 dabcoins to spin the wheel.', ephemeral: true });
            return;
        }

        adjustCoins(userId, -200);

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

        // Initially reply that the spin has started
        const replyMessage = await interaction.reply({ content: 'Spinning the wheel... 🎡', fetchReply: true });

        // Handle the spinning process
        await spin();

        // Adjust the user's balance based on the result
        adjustCoins(userId, result.amount);

        // Prepare the result message
        const resultMessage = `🎡 The wheel stopped on **${result.prize}**! Your new balance is **${getCoinBalance(userId)} dabcoins**.`;

        // Check if the initial message can be edited (ensure it's not already been replied to or deferred)
        if (!interaction.replied && !interaction.deferred) {
            // Edit the original message to show the result
            await replyMessage.edit(resultMessage);
        } else {
            // If the message can't be edited, send a new message or ephemeral reply
            await interaction.followUp({
                content: resultMessage,
                ephemeral: true // You can make it ephemeral, or leave it public based on your preference
            });
        }
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
        const user = interaction.user;
        const userId = user.id;
        const playerChoice = interaction.options.getString('choice');
        const wager = interaction.options.getInteger('wager');

        // Check user balance
        const balance = getCoinBalance(userId);
        if (balance < wager) {
            await interaction.reply({ content: 'You do not have enough dabcoins to wager.', ephemeral: true });
            return;
        }

        // Validate wager amount
        if (wager < 10) {
            await interaction.reply({ content: 'You must wager at least 10 dabcoins.', ephemeral: true });
            return;
        }

        // Bot's random choice
        const botChoices = ['rock', 'paper', 'scissors'];
        const botChoice = botChoices[Math.floor(Math.random() * botChoices.length)];

        // Determine result
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

        // Handle results
        if (result === 'win') {
            adjustCoins(userId, wager);
            await interaction.reply({
                content: `🎉 You chose **${playerChoice}**, and the bot chose **${botChoice}**. You won **${wager} dabcoins**! Your new balance is **${getCoinBalance(userId)} dabcoins**.`,
                ephemeral: true,
            });
        } else if (result === 'lose') {
            adjustCoins(userId, -wager);
            await interaction.reply({
                content: `😢 You chose **${playerChoice}**, and the bot chose **${botChoice}**. You lost **${wager} dabcoins**. Your new balance is **${getCoinBalance(userId)} dabcoins**.`,
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: `🤝 You chose **${playerChoice}**, and the bot chose **${botChoice}**. It's a tie! No dabcoins were lost. Your balance remains **${getCoinBalance(userId)} dabcoins**.`,
                ephemeral: true,
            });
        }
    },
};

// Export Command
export default {
    data: new SlashCommandBuilder()
        .setName('games')
        .setDescription('Various game commands.')
        .addSubcommand(JackpotSubcommand.data)
        .addSubcommand(SpinCommand.data)
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
            await SpinCommand.execute(interaction);
        } else if (subcommand === 'rps') {
            await RockPaperScissorsSubcommand.execute(interaction);
        } else if (subcommand === 'buyticket') {
            await BuyTicketCommand.execute(interaction);
        }
    }
};
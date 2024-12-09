import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

const lotteryPath = path.join(path.resolve(), 'json/lottery.json');

// Load or initialize lottery data
function loadLottery() {
    if (!fs.existsSync(lotteryPath)) {
        fs.writeFileSync(
            lotteryPath,
            JSON.stringify({
                TicketHolders: {
                    Users: {},
                    LotteryInfo: { Prize: null, AutoStartTime: null },
                },
            }, null, 4)
        );
    }
    return JSON.parse(fs.readFileSync(lotteryPath, 'utf-8'));
}

function saveLottery(data) {
    fs.writeFileSync(lotteryPath, JSON.stringify(data, null, 4));
}

function resetLottery() {
    const emptyLottery = {
        TicketHolders: {
            Users: {},
            LotteryInfo: {
                Prize: 0,
                Time: time,
            },
        },
    };
    saveLottery(emptyLottery);
}

async function manualDraw(interaction) {
    const lottery = loadLottery();
    const users = Object.values(lottery.TicketHolders.Users);

    if (users.length === 0) {
        await interaction.reply('🎟️ No tickets have been sold for this draw. Resetting the lottery.');
        resetLottery();
        return;
    }

    const winningNumber = Math.floor(Math.random() * 100000) + 1;
    const winner = users.find(user => user.Ticket === winningNumber);

    if (winner) {
        const prize = lottery.TicketHolders.LotteryInfo.Prize;
        await interaction.reply(
            `🎉 **Lottery Winner Announced!** 🎉\nCongratulations to **${winner.Username}**! They won **${prize.toLocaleString()} dabcoins** with ticket number **${winningNumber}**!`
        );
        resetLottery();
    } else {
        await interaction.reply(`🎟️ No winner for this draw. The winning number was **${winningNumber}**. Resetting the lottery.`);
        resetLottery();
    }
}

function hasAdminPermissions(interaction) {
    return interaction.member.permissions.has('Administrator');
}

// Command Definitions
export default {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('purge')
                .setDescription('Purge messages from a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user whose messages will be purged.').setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('count').setDescription('Number of messages to purge (1-1000).').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Lock or unlock a channel.')
                .addChannelOption(option =>
                    option.setName('channel').setDescription('The channel to lock/unlock.').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('lottery')
                .setDescription('Manage the lottery system.')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Choose between manual or autostart.')
                        .addChoices(
                            { name: 'manual', value: 'manual' },
                            { name: 'autostart', value: 'autostart' }
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Time in 24hr format (for autostart, e.g., 15:00).')
                        .setRequired(false)
                )
        ),
        async execute(interaction) {
            if (!hasAdminPermissions(interaction)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }
        
            const subcommand = interaction.options.getSubcommand();
        
            try {
                if (subcommand === 'purge') {
                    const user = interaction.options.getUser('user');
                    const count = interaction.options.getInteger('count');
        
                    if (count < 1 || count > 1000) {
                        await interaction.reply({ content: 'You must specify a message count between 1 and 1000.', ephemeral: true });
                        return;
                    }
        
                    const messages = await interaction.channel.messages.fetch({ limit: 100 });
                    const userMessages = messages.filter(msg => msg.author.id === user.id).first(count);
        
                    if (userMessages.length === 0) {
                        await interaction.reply({ content: `No recent messages found for ${user.tag}.`, ephemeral: true });
                        return;
                    }
        
                    await interaction.channel.bulkDelete(userMessages, true);
                    await interaction.reply(`🧹 Purged ${userMessages.length} messages from ${user.tag}.`);
        
                } else if (subcommand === 'channel') {
                    const channel = interaction.options.getChannel('channel');
                    const permissions = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id);
        
                    if (permissions && permissions.deny.has('SendMessages')) {
                        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                            SendMessages: true
                        });
                        await interaction.reply(`🔓 The channel ${channel.name} has been unlocked.`);
                    } else {
                        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                            SendMessages: false
                        });
                        await interaction.reply(`🔒 The channel ${channel.name} has been locked.`);
                    }
        
                } else if (subcommand === 'lottery') {
                    const action = interaction.options.getString('action');
                    const time = interaction.options.getString('time');
                    const lotteryData = loadLottery();
    
                    if (action === 'manual') {
                        const ticketHolders = Object.values(lotteryData.TicketHolders.Users || {});
    
                        if (ticketHolders.length === 0) {
                            await interaction.reply('🎟️ No tickets have been sold for this draw.');
                            return;
                        }
    
                        // Randomly select a winner
                        const winningTicketNumber = Math.floor(Math.random() * 100000) + 1;
                        const winner = ticketHolders.find(holder => holder.Ticket === winningTicketNumber);
    
                        if (winner) {
                            const prizeAmount = lotteryData.TicketHolders.LotteryInfo.Prize || 0;
                            await interaction.reply(`🎉 **Lottery Winner Announced!** 🎉\nCongratulations to **${winner.Username}**! They won **${prizeAmount.toLocaleString()} dabcoins**!`);
                        } else {
                            await interaction.reply('😢 No winner this time. The lottery is being reset.');
                        }
    
                        // Reset the lottery data but retain the AutoStartTime
                        const autoStartTime = lotteryData.TicketHolders.LotteryInfo.AutoStartTime; // Retain AutoStartTime
                        lotteryData.TicketHolders = {
                            Users: {},
                            LotteryInfo: { Prize: null, AutoStartTime: autoStartTime },
                        };
                        saveLottery(lotteryData);
    
                        if (!winner) {
                            await interaction.followUp('🔄 The lottery has been reset. Players can now buy new tickets!');
                        }
    
                    } else if (action === 'autostart') {
                        if (!time || !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(time)) {
                            await interaction.reply({ content: 'You must provide a valid time in 24-hour format (e.g., 15:00).', ephemeral: true });
                            return;
                        }
    
                        // Save the auto start time in the lottery data
                        lotteryData.TicketHolders.LotteryInfo.AutoStartTime = time;
                        saveLottery(lotteryData);
    
                        await interaction.reply(`⏰ Auto lottery draw has been set to ${time}.`);
    
                        // Schedule the next lottery draw
                        const [hours, minutes] = time.split(':').map(Number);
                        const now = new Date();
                        const nextDraw = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    
                        if (nextDraw < now) {
                            nextDraw.setDate(nextDraw.getDate() + 1); // Schedule for the next day
                        }
    
                        const delay = nextDraw.getTime() - now.getTime();
                        setTimeout(() => {
                            // Trigger a manual draw
                            this.execute({ options: { getSubcommand: () => 'lottery', getString: () => 'manual' } });
                        }, delay);
                    }
                }
            } catch (error) {
                console.error(`Error executing admin command: ${error.message}`);
                await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
            }
        }
};
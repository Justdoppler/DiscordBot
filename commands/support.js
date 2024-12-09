import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';

const updatesFile = path.join(path.resolve(), 'json/updates.json');
const startTime = new Date();

export default {
    data: new SlashCommandBuilder()
        .setName('support')
        .setDescription('Support commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('updates')
                .setDescription('View the update history of the bot.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('uptime')
                .setDescription('Displays how long the bot has been running.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tos')
                .setDescription('Displays the Terms of Service.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('privacy')
                .setDescription('Displays the Privacy Policy.')
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'updates') {
            try {
                const data = JSON.parse(fs.readFileSync(updatesFile, 'utf-8'));
                const versions = Object.keys(data).reverse();
                let currentPage = 0;
    
                const generateEmbed = (page) => {
                    const version = versions[page];
                    const updateData = data[version];
                    const { new_additions = [], fixes = [], upgrades = [], notes = [], last_updated_by, last_updated_time } = updateData;
    
                    return new EmbedBuilder()
                        .setColor(0x7289DA)
                        .setTitle(`Bot Updates - Version ${version}`)
                        .setDescription('Here is the update history:')
                        .addFields(
                            { name: 'New Additions', value: new_additions.length ? new_additions.map(a => `- ${a}`).join('\n') : 'No new additions.', inline: false },
                            { name: 'Fixes', value: fixes.length ? fixes.map(f => `- ${f}`).join('\n') : 'No fixes.', inline: false },
                            { name: 'Upgrades', value: upgrades.length ? upgrades.map(u => `- ${u}`).join('\n') : 'No upgrades.', inline: false },
                            { name: 'Notes', value: notes.length ? notes.map(n => `- ${n}`).join('\n') : 'No notes.', inline: false }
                        )
                        .setFooter({ text: `Last updated by: ${last_updated_by} ; at ${last_updated_time} | Page ${page + 1} of ${versions.length}` });
                };
    
                const generateButtons = (page) => {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === versions.length - 1)
                    );
                };
    
                const embed = generateEmbed(currentPage);
                const buttons = generateButtons(currentPage);
    
                await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    
                const message = await interaction.fetchReply();
    
                const filter = (i) =>
                    ['prev', 'next'].includes(i.customId) && i.user.id === interaction.user.id;
    
                const collector = message.createMessageComponentCollector({ filter, time: 60000 });
    
                collector.on('collect', async (i) => {
                    if (i.customId === 'prev' && currentPage > 0) {
                        currentPage--;
                    } else if (i.customId === 'next' && currentPage < versions.length - 1) {
                        currentPage++;
                    }
    
                    const newEmbed = generateEmbed(currentPage);
                    const newButtons = generateButtons(currentPage);
    
                    await i.update({ embeds: [newEmbed], components: [newButtons] });
                });
    
                collector.on('end', () => {
                    console.log('Collector ended: Interaction expired.');
                    // No need to edit or delete ephemeral messages.
                });
            } catch (error) {
                console.error('Error reading updates file:', error);
                await interaction.reply({ content: 'Error reading the updates file.', ephemeral: true });
            }
        } else if (subcommand === 'uptime') {
            const currentTime = new Date();
            const uptimeDuration = currentTime - startTime;
            const days = Math.floor(uptimeDuration / 86400000);
            const hours = Math.floor((uptimeDuration % 86400000) / 3600000);
            const minutes = Math.floor((uptimeDuration % 3600000) / 60000);
            const seconds = Math.floor((uptimeDuration % 60000) / 1000);

            const uptimeMessage = `The bot has been running for ${days}d ${hours}h ${minutes}m ${seconds}s.`;
            await interaction.reply(uptimeMessage);
        } else if (subcommand === 'tos') {
            await interaction.reply('Here is our [Terms of Service](https://gist.githubusercontent.com/Justdoppler/f3b9f61acf74fca186f573b325719df1/raw/24976f96880878f6858f8117a71bdce560e7c33d/Terms%2520of%2520Service%2520Agreement%2520-%2520Cardbot).');
        } else if (subcommand === 'privacy') {
            await interaction.reply('Here is our [Privacy Policy](https://gist.githubusercontent.com/Justdoppler/a212b07d42f2c4d4bc55f08f9ea8d3dc/raw/8adcc9f1fe76537fbe9e398863ae9813a2201083/Privacy%2520Policy%2520-%2520Cardbot).');
        }
    }
};
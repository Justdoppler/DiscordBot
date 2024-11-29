import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Fetch command files dynamically
const commandFiles = fs
    .readdirSync(path.join(path.resolve(), 'commands'))
    .filter((file) => file.endsWith('.js'));

const ownerId = '133383783251574786';

// Load commands dynamically from the command directory
async function loadDynamicCommands() {
    return await Promise.all(
        commandFiles.map(async (file) => {
            const command = (await import(pathToFileURL(path.join(path.resolve(), 'commands', file)).href))
                .default;
            return { file: file.replace('.js', ''), data: command.data };
        })
    );
}

// Categorize commands based on user permissions
function categorizeCommands(commands, interaction) {
    const isOwner = interaction.user.id === ownerId;
    const isAdmin = interaction.member.permissions.has('Administrator');

    const categories = {
        General: commands
            .filter((cmd) => ['dabcoins', 'games', 'mtg'].includes(cmd.file))
            .flatMap((cmd) =>
                cmd.data.options?.filter((sub) => sub.name && sub.description).map((sub) => ({
                    name: `/${cmd.file} ${sub.name}`,
                    description: sub.description,
                }))
            ),
        Support: commands
            .filter((cmd) => ['support'].includes(cmd.file))
            .flatMap((cmd) =>
                cmd.data.options?.filter((sub) => sub.name && sub.description).map((sub) => ({
                    name: `/${cmd.file} ${sub.name}`,
                    description: sub.description,
                }))
            ),
        Admin: isAdmin
            ? commands
                  .filter((cmd) => cmd.file === 'admin')
                  .flatMap((cmd) =>
                      cmd.data.options?.filter((sub) => sub.name && sub.description).map((sub) => ({
                          name: `/${cmd.file} ${sub.name}`,
                          description: sub.description,
                      }))
                  )
            : [],
        Owner: isOwner
            ? commands
                  .filter((cmd) => cmd.file === 'owner')
                  .flatMap((cmd) =>
                      cmd.data.options?.filter((sub) => sub.name && sub.description).map((sub) => ({
                          name: `/${cmd.file} ${sub.name}`,
                          description: sub.description,
                      }))
                  )
            : [],
    };

    // Remove empty categories
    return Object.keys(categories).reduce((filtered, key) => {
        if (categories[key].length > 0) {
            filtered[key] = categories[key];
        }
        return filtered;
    }, {});
}

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Provides help on using the bot'),

    async execute(interaction) {
        const commands = await loadDynamicCommands();
        const categories = categorizeCommands(commands, interaction);
        const categoryNames = Object.keys(categories);

        const generateMenuOptions = () => {
            return categoryNames.map((category, index) => ({
                label: category,
                description: `View commands under the ${category} category.`,
                value: `category_${index}`,
            }));
        };

        const generateEmbed = (category) => {
            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(`${category} Commands`)
                .setDescription('Here is a list of available commands:')
                .addFields(
                    categories[category].map((cmd) => ({
                        name: cmd.name,
                        value: cmd.description,
                        inline: false,
                    }))
                );

            return embed;
        };

        // Create the dropdown menu
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Select a category to view commands')
            .addOptions(generateMenuOptions());

        const actionRow = new ActionRowBuilder().addComponents(menu);

        // Initial embed shown when the help command is invoked
        const defaultEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('Help Menu')
            .setDescription('Use the dropdown menu below to select a category.')
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.reply({
            embeds: [defaultEmbed],
            components: [actionRow],
            ephemeral: true,
        });

        const message = await interaction.fetchReply();

        const filter = (i) =>
            i.customId === 'help_menu' && i.user.id === interaction.user.id;

        const collector = message.createMessageComponentCollector({
            filter,
        });

        collector.on('collect', async (i) => {
            const selectedCategory = categoryNames[parseInt(i.values[0].split('_')[1])];
            const categoryEmbed = generateEmbed(selectedCategory);

            await i.update({ embeds: [categoryEmbed], components: [actionRow] });
        });
    },
};
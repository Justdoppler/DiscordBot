import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const decksFilePath = path.join(path.resolve(), 'json/decks.json');

// Load or initialize decks
function loadDecks() {
    if (!fs.existsSync(decksFilePath)) {
        fs.writeFileSync(decksFilePath, JSON.stringify({}, null, 4));
    }
    return JSON.parse(fs.readFileSync(decksFilePath, 'utf-8'));
}

// Save decks
function saveDecks(data) {
    fs.writeFileSync(decksFilePath, JSON.stringify(data, null, 4));
}

export default {
    data: new SlashCommandBuilder()
        .setName('mtg')
        .setDescription('Magic: The Gathering commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('card')
                .setDescription('Search for a Magic card.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the card to search for.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('deck')
                .setDescription('Manage your decks.')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Add, remove, or view your deck.')
                        .addChoices(
                            { name: 'Add', value: 'add' },
                            { name: 'Remove', value: 'remove' },
                            { name: 'View', value: 'view' }
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('card')
                        .setDescription('Name of the card to add or remove.')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('commander')
                .setDescription('Returns a random commander, its details, and its art.')
                .addBooleanOption(option =>
                    option.setName('rage')
                        .setDescription('Include rage commanders (must attack each combat if able)')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'card') {
            const cardName = interaction.options.getString('name');
            const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Card not found.');

                const cardData = await response.json();
                const cardName = cardData.name;
                const cardDetails = cardData.oracle_text || 'No text available.';
                const cardImage = cardData.image_uris ? cardData.image_uris.normal : 'No image available.';

                await interaction.reply({
                    embeds: [
                        {
                            title: `Card: ${cardName}`,
                            description: cardDetails,
                            image: { url: cardImage },
                        },
                    ],
                });
            } catch (error) {
                console.error('Error fetching card data:', error);
                await interaction.reply({ content: 'Error fetching card details. Please try again later.', ephemeral: true });
            }
        }

        if (subcommand === 'deck') {
            const action = interaction.options.getString('action');
            const cardName = interaction.options.getString('card');
            const userId = interaction.user.id;
            const decks = loadDecks();

            if (!decks[userId]) decks[userId] = [];

            try {
                if (action === 'add') {
                    if (!cardName) {
                        await interaction.reply({ content: 'Please specify the card to add.', ephemeral: true });
                        return;
                    }
                    decks[userId].push(cardName);
                    saveDecks(decks);
                    await interaction.reply(`Added **${cardName}** to your deck.`);
                } else if (action === 'remove') {
                    if (!cardName) {
                        await interaction.reply({ content: 'Please specify the card to remove.', ephemeral: true });
                        return;
                    }
                    decks[userId] = decks[userId].filter(card => card.toLowerCase() !== cardName.toLowerCase());
                    saveDecks(decks);
                    await interaction.reply(`Removed **${cardName}** from your deck.`);
                } else if (action === 'view') {
                    const userDeck = decks[userId];
                    if (!userDeck.length) {
                        await interaction.reply({ content: 'Your deck is empty.', ephemeral: true });
                        return;
                    }
                    await interaction.reply(`Your Deck:\n${userDeck.join('\n')}`);
                }
            } catch (error) {
                console.error('Error managing deck:', error);
                await interaction.reply({ content: 'An error occurred while managing your deck.', ephemeral: true });
            }
        }

        if (subcommand === 'commander') {
            const rage = interaction.options.getBoolean('rage');
            let query = 't:legend t:creature is:commander';

            if (rage) {
                query += ' +(o:"must attack each combat if able" OR o:"attacks each turn if able" OR o:"aggro")';
            }

            try {
                const response = await fetch(`https://api.scryfall.com/cards/random?q=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Commander not found.');

                const cardData = await response.json();
                const commanderName = cardData.name;
                const commanderDetails = cardData.oracle_text || 'No text available.';
                const commanderImage = cardData.image_uris ? cardData.image_uris.large : 'No image available.';

                await interaction.reply({
                    embeds: [
                        {
                            title: 'Random Commander',
                            description: `**${commanderName}**\n${commanderDetails}`,
                            image: { url: commanderImage },
                        },
                    ],
                });
            } catch (error) {
                console.error('Error fetching commander:', error);
                await interaction.reply({ content: 'Failed to fetch a commander. Please try again later.', ephemeral: true });
            }
        }
    },
};
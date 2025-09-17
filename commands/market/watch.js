const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const db = require('../../utils/database');
const { createPagedPrintingsCollector } = require('../../utils/components');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('watch')
        .setDescription('Adds a specific card printing to the price watch dashboard.')
        .addStringOption(option =>
            option.setName('cardname')
                .setDescription('The name of the card to start watching.')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const cardNameQuery = interaction.options.getString('cardname');

        try {
            let allPrintings = [];
            let scryfallApiUrl = `https://api.scryfall.com/cards/search?q=!%22${encodeURIComponent(cardNameQuery)}%22&unique=prints`;

            while (scryfallApiUrl) {
                const response = await axios.get(scryfallApiUrl);
                allPrintings.push(...response.data.data);
                scryfallApiUrl = response.data.has_more ? response.data.next_page : null;
            }
            
            allPrintings.sort((a, b) => new Date(a.released_at) - new Date(b.released_at));

            createPagedPrintingsCollector(interaction, allPrintings, cardNameQuery, async (selectedCard) => {
                const resultMessage = await db.addToWatchlist(selectedCard);
                await interaction.followUp({ content: resultMessage, ephemeral: true });
            });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                await interaction.editReply(`❌ I couldn't find any card named "${cardNameQuery}". Please check your spelling.`);
            } else {
                console.error("Scryfall API Error:", error);
                await interaction.editReply('An error occurred while communicating with the Scryfall API.');
            }
        }
    },
};
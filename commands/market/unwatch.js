const { SlashCommandBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwatch')
        .setDescription('Removes all watched versions of a card from the dashboard.')
        .addStringOption(option =>
            option.setName('cardname')
                .setDescription('The name of the card to stop watching.')
                .setRequired(true)),
    async execute(interaction) {
        const cardName = interaction.options.getString('cardname');
        const resultMessage = await db.removeFromWatchlist(cardName);
        await interaction.reply({ content: resultMessage, ephemeral: true });
    },
};
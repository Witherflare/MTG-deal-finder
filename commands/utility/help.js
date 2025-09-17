// /commands/utility/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Lists all available commands.'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Bot Commands')
            .setDescription('Here is a list of all my commands:');

        // Dynamically add command fields
        const commands = interaction.client.commands;
        commands.forEach(command => {
            embed.addFields({ 
                name: `\`/${command.data.name}\``, 
                value: command.data.description 
            });
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
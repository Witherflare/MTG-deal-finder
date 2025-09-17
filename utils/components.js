const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

/**
 * Creates an interactive, paginated menu of card printings and waits for a user selection.
 * @param {import('discord.js').Interaction} interaction The interaction to reply to.
 * @param {Array<object>} allPrintings The array of card printing objects.
 * @param {string} cardName The name of the card.
 * @param {function(object): Promise<void>} onSelectCallback The function to execute once a printing is selected.
 */
function createPagedPrintingsCollector(interaction, allPrintings, cardName, onSelectCallback) {
    let currentPage = 0;
    const totalPages = Math.ceil(allPrintings.length / 25);

    const generateMessage = (page) => {
        const start = page * 25;
        const currentPrintings = allPrintings.slice(start, start + 25);
        const menu = new StringSelectMenuBuilder()
            .setCustomId('select_printing')
            .setPlaceholder(`Select a printing of ${cardName.substring(0, 50)}...`)
            .addOptions(currentPrintings.map(p => {
                const label = `${p.set_name}`.substring(0, 80);
                const description = `#${p.collector_number} | Released: ${p.released_at}`.substring(0, 100);
                return { label, description, value: p.id };
            }));
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1)
        );
        return {
            content: `Found **${allPrintings.length}** printings of **${cardName}**. (Page ${page + 1}/${totalPages})`,
            components: [new ActionRowBuilder().addComponents(menu), buttons],
            ephemeral: true
        };
    };

    interaction.editReply(generateMessage(currentPage)).then(reply => {
        const collector = reply.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === interaction.user.id });
        collector.on('collect', async i => {
            if (i.isButton()) {
                currentPage = i.customId === 'next_page' ? currentPage + 1 : currentPage - 1;
                await i.update(generateMessage(currentPage));
                return;
            }
            if (i.isStringSelectMenu()) {
                collector.stop();
                const selectedScryfallId = i.values[0];
                const selectedCard = allPrintings.find(p => p.id === selectedScryfallId);
                await i.update({ content: `You selected **${selectedCard.name} (${selectedCard.set_name})**.`, components: [] });
                // Execute the callback function with the selected card
                await onSelectCallback(selectedCard);
            }
        });
        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'Your request timed out.', components: [] });
            }
        });
    });
}

module.exports = { createPagedPrintingsCollector };
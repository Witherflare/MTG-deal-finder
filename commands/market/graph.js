const { SlashCommandBuilder, AttachmentBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const db = require('../../utils/database');
const { generatePriceChart } = require('../../utils/graphing');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('graph')
        .setDescription('Displays a price history graph for a watched card.')
        .addStringOption(option =>
            option.setName('cardname')
                .setDescription('The exact name of the card to generate a graph for.')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const cardName = interaction.options.getString('cardname');
        
        // Find all printings of this card that are on the watchlist
        const watchedPrintings = (await db.getWatchlist()).filter(p => p.card_name.toLowerCase() === cardName.toLowerCase());
        
        if (watchedPrintings.length === 0) {
            await interaction.editReply(`You aren't watching any versions of **${cardName}**. Use \`/watch\` to add one.`);
            return;
        }

        let selectedPrinting = watchedPrintings[0];
        // If the user is watching multiple versions, ask them which one to graph
        if (watchedPrintings.length > 1) {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('select_graph_printing')
                .setPlaceholder('Select a printing to graph...')
                .addOptions(watchedPrintings.map(p => ({
                    label: p.set_name,
                    value: p.scryfall_id,
                })));
            
            const row = new ActionRowBuilder().addComponents(menu);
            const menuReply = await interaction.editReply({ content: `You are watching multiple printings of **${cardName}**. Please choose one to graph:`, components: [row] });

            try {
                const collectorResponse = await menuReply.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, componentType: ComponentType.StringSelect, time: 60000 });
                selectedPrinting = watchedPrintings.find(p => p.scryfall_id === collectorResponse.values[0]);
                await collectorResponse.update({ content: `Generating graph for **${selectedPrinting.card_name} (${selectedPrinting.set_name})**...`, components: [] });
            } catch (e) {
                await interaction.editReply({ content: 'No selection made, request timed out.', components: [] });
                return;
            }
        }
        
        // Get the price history from the database for the selected printing
        const history = await db.getPriceHistory(selectedPrinting.scryfall_id);
        if (history.length < 2) {
            await interaction.editReply(`Not enough historical data for **${selectedPrinting.card_name} (${selectedPrinting.set_name})**. The watcher needs at least two data points.`);
            return;
        }
        
        // Generate the chart and send it
        const chartPath = await generatePriceChart(history, `${selectedPrinting.card_name} (${selectedPrinting.set_name})`);
        const attachment = new AttachmentBuilder(chartPath);

        await interaction.editReply({
            content: `Displaying price history for **${selectedPrinting.card_name} (${selectedPrinting.set_name})**:`,
            files: [attachment],
            components: []
        });
    },
};
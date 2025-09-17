const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('./database');
const { generatePriceChart } = require('./graphing');

const DASHBOARD_CHANNEL_ID = process.env.GRAPH_DASHBOARD_CHANNEL_ID;

/**
 * Updates the embed for a specific watched card in the dashboard channel.
 * It will display a graph if data is available, or a "collecting data" message if not.
 * @param {import('discord.js').Client} client The Discord client instance.
 * @param {object} watchedItem The watched item object from the database.
 */
async function updateDashboardGraph(client, watchedItem) {
    try {
        const channel = await client.channels.fetch(DASHBOARD_CHANNEL_ID);
        if (!channel) {
            console.error(`Error: Dashboard channel with ID ${DASHBOARD_CHANNEL_ID} not found.`);
            return;
        }

        const history = await db.getPriceHistory(watchedItem.scryfall_id);
        
        // --- NEW LOGIC: Build the embed first ---
        const embed = new EmbedBuilder()
            .setTitle(`${watchedItem.card_name} - ${watchedItem.set_name} (#${watchedItem.collector_number})`)
            .setURL(watchedItem.scryfall_uri)
            .setColor(0x5865F2)
            .setFooter({ text: `Last Updated: ${new Date().toLocaleString()}` });

        let messagePayload = {};

        if (history.length < 2) {
            // Case 1: Not enough data to create a graph
            embed.setDescription("⌛ Collecting initial price data...\nMore data points are needed to generate a graph.");
            messagePayload = { embeds: [embed] };
        } else {
            // Case 2: Enough data, create and attach the graph
            const chartPath = await generatePriceChart(history, `${watchedItem.card_name} (${watchedItem.set_name})`);
            const attachment = new AttachmentBuilder(chartPath, { name: 'price-chart.png' });
            embed.setImage('attachment://price-chart.png');
            messagePayload = { embeds: [embed], files: [attachment] };
        }

        // --- NEW LOGIC: Send or Edit the message ---
        if (watchedItem.message_id) {
            try {
                const message = await channel.messages.fetch(watchedItem.message_id);
                await message.edit(messagePayload);
                console.log(`- Updated embed for ${watchedItem.card_name}`);
                return;
            } catch (error) {
                console.log(`- Could not edit message for ${watchedItem.card_name}. Creating a new one.`);
            }
        }

        const newMessage = await channel.send(messagePayload);
        db.setMessageIdForWatchedCard(watchedItem.scryfall_id, newMessage.id);
        console.log(`- Created new embed for ${watchedItem.card_name}`);

    } catch (error) {
        console.error(`Failed to update dashboard for ${watchedItem.card_name}:`, error);
    }
}

module.exports = { updateDashboardGraph };
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { chromium } = require('playwright');
const axios = require('axios');
const db = require('../../utils/database');
const { analyzeCard } = require('../../utils/scraper');
const { createPagedPrintingsCollector } = require('../../utils/components');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('price')
		.setDescription('Finds the market price for a Magic card.')
		.addStringOption(option =>
			option.setName('cardname')
				.setDescription('The name of the card to search for.')
				.setRequired(true)),
	async execute(interaction) {
		await interaction.deferReply();
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
                await interaction.followUp({ content: `🚀 Scraping data for **${selectedCard.name}** from **${selectedCard.set_name}**...`, ephemeral: true });

                if (!selectedCard?.tcgplayer_id) {
                    await interaction.followUp({ content: `Sorry, this version is not sold on TCGplayer.`, ephemeral: true });
                    return;
                }

                try {
                    const browser = await chromium.launch({ headless: false, args: ['--window-position=-2000,0'] });
                    const page = await browser.newPage();
                    const cardToAnalyze = {
                        cardName: selectedCard.name,
                        setName: selectedCard.set_name,
                        tcgplayer_id: selectedCard.tcgplayer_id,
                        manaPoolUrl: `https://manapool.com/card/${selectedCard.set}/${selectedCard.collector_number}/${selectedCard.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`
                    };

                    const result = await analyzeCard(page, cardToAnalyze);
                    await browser.close();

                    if (result.error) {
                        await interaction.followUp({ content: `An error occurred during scraping: ${result.error}`, ephemeral: true });
                    } else {
                        db.saveScrapeData(selectedCard.id, result.tcgplayerData, result.manapoolData);
                        const resultEmbed = createResultEmbed(selectedCard, result);
                        await interaction.followUp({ embeds: [resultEmbed], ephemeral: false });
                    }
                } catch (scrapeError) {
                    console.error("Scraping failed:", scrapeError);
                    await interaction.followUp({ content: `A critical error occurred while trying to scrape market data.`, ephemeral: true });
                }
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

/**
 * Creates the final rich embed to display the scraped price data.
 * This version is corrected to prevent empty field values.
 * @param {object} selectedCard The full card object for the selected printing.
 * @param {object} result The combined data from the scraper.
 * @returns {EmbedBuilder}
 */
function createResultEmbed(selectedCard, result) {
    const tcgPrices = result.tcgplayerData.lowestPrices || {};
    const mpPrices = result.manapoolData.lowestPrices || {};

    // Generate price strings, ensuring a fallback value if no listings are found
    const tcgPriceString = Object.entries(tcgPrices).map(([cond, price]) => `**${cond}:** $${price.toFixed(2)}`).join('\n');
    const mpPriceString = Object.entries(mpPrices).map(([cond, price]) => `**${cond}:** $${price.toFixed(2)}`).join('\n');

    return new EmbedBuilder()
        .setColor(0x1a75ff)
        .setTitle(`${result.cardName} - ${result.setName.toUpperCase()}`)
        .setURL(selectedCard.scryfall_uri)
        .setThumbnail(selectedCard.image_uris?.normal || '')
        .addFields(
            { name: 'Volatility', value: `\`${result.tcgplayerData.volatility || 'N/A'}\``, inline: true },
            { name: 'Last Sold', value: result.tcgplayerData.lastSoldPrice ? `\`$${result.tcgplayerData.lastSoldPrice.toFixed(2)}\`` : '`N/A`', inline: true },
            { name: 'Listings', value: `\`${result.tcgplayerData.currentQuantity || 0}\``, inline: true },
            // Use the generated strings, with a final fallback to a non-empty string
            { name: 'TCGplayer Lowest (Non-Foil)', value: tcgPriceString || 'No listings found.', inline: true },
            { name: 'ManaPool Lowest (Non-Foil)', value: mpPriceString || 'No listings found.', inline: true }
        )
        .setTimestamp();
}
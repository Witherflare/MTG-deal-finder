const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const { chromium } = require('playwright');
const { analyzeCard } = require('../../utils/scraper.js');
const { findBestCardMatches } = require('../../utils/search.js'); // Import our fuzzy search utility

// --- Main command execution logic ---
module.exports = {
	data: new SlashCommandBuilder()
		.setName('price')
		.setDescription('Finds the market price for a Magic card.')
		.addStringOption(option =>
			option.setName('cardname')
				.setDescription('The name of the card to search for (can be misspelled)')
				.setRequired(true)),
	async execute(interaction) {
		await interaction.deferReply();
        const cardNameQuery = interaction.options.getString('cardname');
        
        try {
            // First, try an exact match search on Scryfall
            const exactMatchUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardNameQuery)}`;
            const response = await axios.get(exactMatchUrl);
            // If successful, proceed directly to processing the card
            await processCardSelection(interaction, response.data.name);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // Exact match failed, so we use our fuzzy search utility
                const bestMatches = findBestCardMatches(cardNameQuery);
                
                if (bestMatches.length === 0) {
                    await interaction.editReply(`❌ I couldn't find an exact match for "${cardNameQuery}" and there were no close alternatives. Please check the spelling.`);
                    return;
                }
                
                // Offer the best matches to the user in a select menu
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_correction')
                    .setPlaceholder('Select the card you meant...')
                    .addOptions(bestMatches.map(name => ({
                        label: name,
                        value: name,
                    })));

                const row = new ActionRowBuilder().addComponents(selectMenu);
                const suggestionReply = await interaction.editReply({
                    content: `I couldn't find an exact match for "${cardNameQuery}". Did you mean one of these?`,
                    components: [row],
                });

                // Wait for the user to select a correction
                try {
                    const collectorResponse = await suggestionReply.awaitMessageComponent({
                        filter: i => i.user.id === interaction.user.id,
                        componentType: ComponentType.StringSelect,
                        time: 60000, // 60 seconds
                    });
                    const correctedCardName = collectorResponse.values[0];
                    await collectorResponse.update({ content: `Got it! Searching for "${correctedCardName}"...`, components: [] });
                    await processCardSelection(interaction, correctedCardName);
                } catch (e) {
                    await interaction.editReply({ content: 'No selection made, request timed out.', components: [] });
                }

            } else {
                console.error("Scryfall API Error:", error);
                await interaction.editReply('An error occurred while communicating with the Scryfall API.');
            }
        }
	},
};

// --- Refactored Helper Function: Handles everything after a card name is confirmed ---
async function processCardSelection(interaction, confirmedCardName) {
    // 1. Fetch all printings for the confirmed card name
    let allPrintings = [];
    let scryfallApiUrl = `https://api.scryfall.com/cards/search?q=!%22${encodeURIComponent(confirmedCardName)}%22&unique=prints`;

    try {
        while (scryfallApiUrl) {
            const response = await axios.get(scryfallApiUrl);
            allPrintings.push(...response.data.data);
            scryfallApiUrl = response.data.has_more ? response.data.next_page : null;
        }
    } catch (error) {
        console.error("Scryfall API Error on printings fetch:", error);
        await interaction.editReply('An error occurred while fetching card printings.');
        return;
    }

    // 2. Create and send the paginated message for selecting a printing
    let currentPage = 0;
    const totalPages = Math.ceil(allPrintings.length / 25);
    const initialMessage = createPagedPrintings(currentPage, totalPages, allPrintings, confirmedCardName);
    // Use followUp here because the interaction may have been updated already by the fuzzy search collector
    const reply = await interaction.followUp(initialMessage);

    // 3. Create a collector for printing selection (buttons and menu)
    const collector = reply.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async i => {
        // Handle Button Clicks for pagination
        if (i.isButton()) {
            currentPage = i.customId === 'next_page' ? currentPage + 1 : currentPage - 1;
            const newMessage = createPagedPrintings(currentPage, totalPages, allPrintings, confirmedCardName);
            await i.update(newMessage);
            return;
        }

        // Handle Select Menu Choice for a specific printing
        if (i.isStringSelectMenu()) {
            collector.stop();
            const selectedScryfallId = i.values[0];
            const selectedCard = allPrintings.find(p => p.id === selectedScryfallId);

            if (!selectedCard?.tcgplayer_id) {
                await i.update({ content: `Sorry, the selected printing **(${selectedCard.set_name})** is not sold on TCGplayer.`, components: [] });
                return;
            }

            await i.update({ content: `🚀 Scraping market data for **${selectedCard.name}** from **${selectedCard.set_name}**. This should be quick...`, components: [] });

            // 4. Run the scraper
            const browser = await chromium.launch({ headless: false });
            const page = await browser.newPage();
            // await blockResources(page);
            
            const cardToAnalyze = {
                cardName: selectedCard.name,
                setName: selectedCard.set_name,
                tcgplayer_id: selectedCard.tcgplayer_id,
                manaPoolUrl: `https://manapool.com/card/${selectedCard.set}/${selectedCard.collector_number}/${selectedCard.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`
            };

            const result = await analyzeCard(page, cardToAnalyze);
            await browser.close();

            if (result.error) {
                await interaction.editReply({ content: `An error occurred during scraping: ${result.error}`, embeds: [] });
                return;
            }
            
            // 5. Display the final results
            const resultEmbed = createResultEmbed(selectedCard, result);
            await interaction.editReply({ content: '', embeds: [resultEmbed] });
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            interaction.editReply({ content: 'Your request timed out after 5 minutes.', components: [] });
        }
    });
}

// --- Helper functions for message creation and scraping ---
async function blockResources(page) {
    await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            route.abort();
        } else {
            route.continue();
        }
    });
}

function createPagedPrintings(page, totalPages, printings, cardName) {
    const start = page * 25;
    const end = start + 25;
    const currentPrintings = printings.slice(start, end);

    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_printing')
        .setPlaceholder(`Select a printing of ${cardName.substring(0, 50)}...`)
        .addOptions(currentPrintings.map(p => {
            const price = p.prices.usd ? `$${p.prices.usd}` : (p.prices.usd_foil ? `$${p.prices.usd_foil} (Foil)` : 'N/A');
            const label = `${p.set_name}`.substring(0, 80);
            const description = `#${p.collector_number} | Price: ${price}`.substring(0, 100);
            return { label, description, value: p.id };
        }));

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1)
    );

    return {
        content: `I found **${printings.length}** printings of **${cardName}**. Please choose one. (Page ${page + 1}/${totalPages})`,
        components: [new ActionRowBuilder().addComponents(menu), buttons],
        ephemeral: true // Use ephemeral messages for selections to keep channel clean
    };
}

function createResultEmbed(selectedCard, result) {
    const resultEmbed = new EmbedBuilder()
        .setColor(0x1a75ff)
        .setTitle(`${result.cardName} - ${result.setName.toUpperCase()}`)
        .setURL(selectedCard.scryfall_uri)
        .setThumbnail(selectedCard.image_uris?.normal || '')
        .addFields(
            { name: 'Volatility', value: `\`${result.tcgplayerData.volatility || 'N/A'}\``, inline: true },
            { name: 'Last Sold', value: result.tcgplayerData.lastSoldPrice ? `\`$${result.tcgplayerData.lastSoldPrice.toFixed(2)}\`` : '`N/A`', inline: true },
            { name: 'Total Listings', value: `\`${result.tcgplayerData.currentQuantity || 0}\``, inline: true },
        )
        .setTimestamp();
    
    const tcgPrices = result.tcgplayerData.lowestPrices;
    const mpPrices = result.manapoolData.lowestPrices;
    let tcgPriceString = Object.keys(tcgPrices).map(cond => `**${cond}:** $${tcgPrices[cond].toFixed(2)}`).join('\n') || 'No listings found.';
    let mpPriceString = Object.keys(mpPrices).map(cond => `**${cond}:** $${mpPrices[cond].toFixed(2)}`).join('\n') || 'No listings found.';
    resultEmbed.addFields(
        { name: 'TCGplayer Lowest (Non-Foil)', value: tcgPriceString, inline: true },
        { name: 'ManaPool Lowest (Non-Foil)', value: mpPriceString, inline: true }
    );
    return resultEmbed;
}
// witherflare/mtg-deal-finder/utils/scraper.js
const { scrapeTcgplayerData } = require('../scrapers/tcgplayer');
const { scrapeManaPoolListings } = require('../scrapers/manapool');

/**
 * Analyzes a card by scraping data from multiple vendors.
 * @param {import('playwright').Page} page The Playwright page object.
 * @param {object} card The card to analyze.
 * @returns {Promise<object>} An object containing the scraped data and any errors.
 */
async function analyzeCard(page, card) {
    const result = { 
        ...card, 
        tcgplayerData: null, 
        manapoolData: null, 
        cardkingdomData: null,
        starcitygamesData: null,
        coolstuffincData: null,
        error: null 
    };

    if (!card.tcgplayer_id) {
        result.error = "Missing TCGplayer ID.";
        return result;
    }

    try {
        result.tcgplayerData = await scrapeTcgplayerData(page, card.tcgplayer_id);
    } catch (error) {
        console.error(`  ... ❌ Failed to scrape TCGplayer for ${card.cardName}: ${error.message}`);
        result.tcgplayerData = { error: error.message };
    }

    try {
        result.manapoolData = await scrapeManaPoolListings(page, card.manaPoolUrl);
    } catch (error) {
        console.error(`  ... ❌ Failed to scrape ManaPool for ${card.cardName}: ${error.message}`);
        result.manapoolData = { error: error.message };
    }

    console.log(`  ... ✔️ Finished scraping ${card.cardName}.`);

    return result;
}

module.exports = { analyzeCard };

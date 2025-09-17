// witherflare/mtg-deal-finder/utils/scraper.js
const { scrapeTcgplayerData } = require('../scrapers/tcgplayer');
const { scrapeManaPoolListings } = require('../scrapers/manapool');
const { scrapeCardKingdom } = require('../scrapers/cardkingdom');
const { scrapeStarCityGames } = require('../scrapers/starcitygames');
const { scrapeCoolStuffInc } = require('../scrapers/coolstuffinc');
const { scrapeChannelFireball } = require('../scrapers/channelfireball');

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
        channelfireballData: null,
        error: null 
    };

    if (!card.tcgplayer_id) {
        result.error = "Missing TCGplayer ID.";
        return result;
    }

    try {
        result.tcgplayerData = await scrapeTcgplayerData(page, card.tcgplayer_id);
        result.manapoolData = await scrapeManaPoolListings(page, card.manaPoolUrl);
        result.cardkingdomData = await scrapeCardKingdom(page, card);
        result.starcitygamesData = await scrapeStarCityGames(page, card);
        result.coolstuffincData = await scrapeCoolStuffInc(page, card);
        
        console.log(`  ... ✔️ Successfully scraped ${card.cardName}.`);
    } catch (error) {
        console.error(`  ... ❌ Failed to scrape ${card.cardName}: ${error.message}`);
        result.error = error.message;
    }

    return result;
}

module.exports = { analyzeCard };

// witherflare/mtg-deal-finder/utils/scraper.js
const { scrapeTcgplayerData } = require('../scrapers/tcgplayer');
const { scrapeManaPoolListings } = require('../scrapers/manapool');
const { scrapeCardKingdom } = require('../scrapers/cardkingdom');
const { scrapeStarCityGames } = require('../scrapers/starcitygames');
const { scrapeCoolStuffInc } = require('../scrapers/coolstuffinc');

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

    try {
        result.cardkingdomData = await scrapeCardKingdom(page, card);
    } catch (error) {
        console.error(`  ... ❌ Failed to scrape Card Kingdom for ${card.cardName}: ${error.message}`);
        result.cardkingdomData = { error: error.message };
    }

    // try {
    //     result.starcitygamesData = await scrapeStarCityGames(page, card);
    // } catch (error) {
    //     console.error(`  ... ❌ Failed to scrape Star City Games for ${card.cardName}: ${error.message}`);
    //     result.starcitygamesData = { error: error.message };
    // }

    try {
        result.coolstuffincData = await scrapeCoolStuffInc(page, card);
    } catch (error) {
        console.error(`  ... ❌ Failed to scrape CoolStuffInc for ${card.cardName}: ${error.message}`);
        result.coolstuffincData = { error: error.message };
    }

    console.log(`  ... ✔️ Finished scraping ${card.cardName}.`);

    return result;
}

module.exports = { analyzeCard };

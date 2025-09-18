// witherflare/mtg-deal-finder/utils/scraper.js
const { scrapeTcgplayerData } = require('../scrapers/tcgplayer');
const { scrapeManaPoolListings } = require('../scrapers/manapool');

/**
 * Analyzes a card by scraping data from multiple vendors in parallel.
 * @param {import('playwright').Page} tcgplayerPage The Playwright page object for TCGPlayer.
 * @param {import('playwright').Page} manapoolPage The Playwright page object for ManaPool.
 * @param {object} card The card to analyze.
 * @returns {Promise<object>} An object containing the scraped data and any errors.
 */
async function analyzeCard(tcgplayerPage, manapoolPage, card) {
    const result = { 
        ...card, 
        tcgplayerData: null, 
        manapoolData: null, 
        error: null 
    };

    if (!card.tcgplayer_id) {
        result.error = "Missing TCGplayer ID.";
        return result;
    }

    // Run scrapers in parallel
    const tcgplayerPromise = scrapeTcgplayerData(tcgplayerPage, card.tcgplayer_id).catch(err => ({ error: err.message }));
    const manapoolPromise = scrapeManaPoolListings(manapoolPage, card.manaPoolUrl).catch(err => ({ error: err.message }));

    const [tcgplayerResult, manapoolResult] = await Promise.all([
        tcgplayerPromise,
        manapoolPromise
    ]);

    result.tcgplayerData = tcgplayerResult;
    result.manapoolData = manapoolResult;

    if (tcgplayerResult.error) {
        console.error(`  ... ❌ Failed to scrape TCGplayer for ${card.cardName}: ${tcgplayerResult.error}`);
    }
    if (manapoolResult.error) {
        console.error(`  ... ❌ Failed to scrape ManaPool for ${card.cardName}: ${manapoolResult.error}`);
    }

    console.log(`  ... ✔️ Finished scraping ${card.cardName}.`);
    return result;
}

module.exports = { analyzeCard };

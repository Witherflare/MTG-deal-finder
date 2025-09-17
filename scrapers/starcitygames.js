// witherflare/mtg-deal-finder/scrapers/starcitygames.js

const conditionMap = {
    'Near Mint': 'NM',
    'Played': 'PL',
    'Heavily Played': 'HP'
};

/**
 * Scrapes card price data from Star City Games.
 * @param {import('playwright').Page} page The Playwright page object.
 * @param {object} card The card object containing information like name and set.
 * @returns {Promise<object>} The scraped price data.
 */
async function scrapeStarCityGames(page, card) {
    console.log(`  -> Scraping Star City Games for ${card.cardName}...`);
    const cardName = card.cardName.split(' // ')[0];
    const url = `https://starcitygames.com/search/?card_name=${encodeURIComponent(cardName)}`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
        await page.waitForSelector('.hawk-results-item', { timeout: 20000 });
    } catch (error) {
        console.log(`Could not find results for ${card.cardName} on Star City Games.`);
        return { lowestPrices: {} };
    }

    const listingElements = await page.locator('.hawk-results-item').all();
    if (listingElements.length === 0) {
        console.log(`No Star City Games listings found for ${card.cardName}.`);
        return { lowestPrices: {} };
    }

    const data = { lowestPrices: {} };

    for (const item of listingElements) {
        try {
            // This is a simplified approach; a more robust solution would navigate to the product page
            const title = await item.locator('.hawk-results-item__title').textContent();
            if (!title.includes(card.setName)) continue; // Basic check to match the set

            const isFoil = title.includes('Foil');
            if (isFoil) continue;

            const conditionText = await item.locator('.hawk-results-item__options-table-cell--name').first().textContent();
            const priceText = await item.locator('.hawk-results-item__options-table-cell--price').first().textContent();
            const price = parseFloat(priceText.replace('$', ''));
            const conditionCode = conditionMap[conditionText.trim()];

            if (conditionCode && (!data.lowestPrices[conditionCode] || price < data.lowestPrices[conditionCode])) {
                data.lowestPrices[conditionCode] = price;
            }
        } catch (e) {
            continue;
        }
    }

    return data;
}

module.exports = { scrapeStarCityGames };

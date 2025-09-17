// witherflare/mtg-deal-finder/scrapers/cardkingdom.js

const conditionMap = {
    'Near Mint': 'NM',
    'Excellent': 'EX',
    'Very Good': 'VG',
    'Good': 'G'
};

/**
 * Scrapes card price data from Card Kingdom.
 * @param {import('playwright').Page} page The Playwright page object.
 * @param {object} card The card object containing information like name and set.
 * @returns {Promise<object>} The scraped price data.
 */
async function scrapeCardKingdom(page, card) {
    console.log(`  -> Scraping Card Kingdom for ${card.cardName}...`);
    const cardName = card.cardName.split(' // ')[0];
    const url = `https://www.cardkingdom.com/mtg/${card.setName.toLowerCase().replace(/ /g, '-')}/${cardName.toLowerCase().replace(/ /g, '-')}`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
        await page.waitForSelector('.itemContentWrapper', { timeout: 20000 });
    } catch (error) {
        console.log(`Could not find selector for ${card.cardName}. It might be out of stock or the name is mismatched.`);
        return { lowestPrices: {} };
    }

    const listingElements = await page.locator('.itemContentWrapper').all();
    if (listingElements.length === 0) {
        console.log(`No Card Kingdom listings found for ${card.cardName}.`);
        return { lowestPrices: {} };
    }

    const data = { lowestPrices: {} };

    for (const item of listingElements) {
        try {
            const isFoil = await item.locator('span:text("Foil")').count() > 0;
            if (isFoil) continue;

            const conditionText = await item.locator('.styleDescription').textContent();
            const priceText = await item.locator('.price').textContent();
            const price = parseFloat(priceText.replace('$', ''));
            const conditionCode = conditionMap[conditionText.trim()];
            
            if (conditionCode && (!data.lowestPrices[conditionCode] || price < data.lowestPrices[conditionCode])) {
                data.lowestPrices[conditionCode] = price;
            }
        } catch (e) {
            // Ignore items that don't have the expected structure
            continue;
        }
    }

    return data;
}

module.exports = { scrapeCardKingdom };

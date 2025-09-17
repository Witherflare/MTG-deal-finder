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
    
    // Format card and set names for the URL
    const cardName = card.cardName.split(' // ')[0]
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove special characters except hyphen
        .replace(/\s+/g, '-');
        
    const setName = card.setName.toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove special characters except hyphen
        .replace(':', '') // remove colons often found in set names
        .replace(/\s+/g, '-');

    const url = `https://www.cardkingdom.com/mtg/${setName}/${cardName}`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
        await page.waitForSelector('.product-card', { timeout: 20000 });
    } catch (error) {
        console.log(`Could not find product card for ${card.cardName}. It might be out of stock or the name/set is mismatched.`);
        return { lowestPrices: {} };
    }

    const data = { lowestPrices: {} };
    const productCards = await page.locator('.product-card').all();

    for (const productCard of productCards) {
        try {
            const titleElement = productCard.locator('.product-card-title');
            const title = await titleElement.textContent();

            // Skip foil versions
            if (title.includes('Foil')) {
                continue;
            }

            // Find the table with price data
            const priceTable = productCard.locator('table.product-card-table');
            const rows = await priceTable.locator('tbody tr').all();

            for (const row of rows) {
                const qtyText = await row.locator('.product-card-qty').textContent();
                if (qtyText.trim().toLowerCase() === 'out of stock') {
                    continue;
                }
                
                const conditionText = await row.locator('.product-card-condition').textContent();
                const priceText = await row.locator('.product-card-price').textContent();
                
                const conditionCode = conditionMap[conditionText.trim()];
                const price = parseFloat(priceText.replace('$', '').trim());

                if (conditionCode && (!data.lowestPrices[conditionCode] || price < data.lowestPrices[conditionCode])) {
                    data.lowestPrices[conditionCode] = price;
                }
            }
        } catch (e) {
            // Ignore cards that don't match the structure, might be sealed product etc.
            continue;
        }
    }

    return data;
}

module.exports = { scrapeCardKingdom };

// witherflare/mtg-deal-finder/scrapers/coolstuffinc.js

/**
 * Scrapes card price data from CoolStuffInc.
 * @param {import('playwright').Page} page The Playwright page object.
 * @param {object} card The card object containing information like name and set.
 * @returns {Promise<object>} The scraped price data.
 */
async function scrapeCoolStuffInc(page, card) {
    console.log(`  -> Scraping CoolStuffInc for ${card.cardName}...`);
    const cardName = card.cardName.split(' // ')[0];
    const url = `https://www.coolstuffinc.com/p/${encodeURIComponent(cardName)}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
        await page.waitForSelector('.product-grouping', { timeout: 20000 });
    } catch (error) {
        console.log(`Could not find product grouping for ${card.cardName} on CoolStuffInc.`);
        return { lowestPrices: {} };
    }

    const data = { lowestPrices: {} };
    const productRows = await page.locator('.product-grouping').all();

    for (const row of productRows) {
        try {
            const setName = await row.locator('h5').textContent();
            if (!setName.includes(card.setName)) continue;

            const priceText = await row.locator('.price').textContent();
            const price = parseFloat(priceText.replace('$', '').trim());

            // CoolStuffInc often doesn't specify condition for NM, so we assume it
            if (!data.lowestPrices['NM'] || price < data.lowestPrices['NM']) {
                data.lowestPrices['NM'] = price;
            }
        } catch (e) {
            continue;
        }
    }

    return data;
}

module.exports = { scrapeCoolStuffInc };

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

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    try {
        await page.waitForSelector('.card-set-row', { timeout: 20000 });
    } catch (error) {
        console.log(`Could not find product listings for ${card.cardName} on CoolStuffInc.`);
        return { lowestPrices: {} };
    }

    const data = { lowestPrices: {} };
    const productRows = await page.locator('.card-set-row').all();

    const conditionMap = {
        'Near Mint': 'NM',
        'Played': 'PL',
        'Heavily Played': 'HP'
    };

    for (const row of productRows) {
        try {
            const setName = await row.locator('.ItemSet').textContent();
            if (!setName.includes(card.setName)) continue;

            const offers = await row.locator('[itemprop="offers"]').all();

            for (const offer of offers) {
                const conditionText = await offer.locator('.fixtype').nth(1).textContent();
                const conditionCode = conditionMap[conditionText.trim()];

                if (conditionCode) {
                    const priceText = await offer.locator('.darkred [itemprop="price"]').textContent();
                    const price = parseFloat(priceText.replace('$', '').trim());

                    if (!data.lowestPrices[conditionCode] || price < data.lowestPrices[conditionCode]) {
                        data.lowestPrices[conditionCode] = price;
                    }
                }
            }
        } catch (e) {
            continue;
        }
    }

    return data;
}

module.exports = { scrapeCoolStuffInc };
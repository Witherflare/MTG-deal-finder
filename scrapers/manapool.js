// witherflare/mtg-deal-finder/scrapers/manapool.js

async function scrapeManaPoolListings(page, manaPoolUrl) {
    console.log(`  -> Scraping ManaPool...`);
    await page.goto(manaPoolUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('li .font-bold.text-green-700', { timeout: 20000 });

    const listingElements = await page.locator('.flow-root li').all();
    if (listingElements.length === 0) throw new Error("No ManaPool listings found.");

    const data = { lowestPrices: {} };
    const validConditions = ['NM', 'LP', 'MP', 'HP', 'DMG'];

    for (const item of listingElements) {
        try {
            const badges = await item.locator('span[class*="rounded-"]').allTextContents();
            if (badges.some(b => b.trim() === 'Foil')) continue;

            const priceText = await item.locator('.font-bold.text-green-700').textContent();
            const price = parseFloat(priceText.replace('$', ''));
            
            let conditionCode = 'NM';
            badges.forEach(badgeText => {
                const text = badgeText.trim();
                if (validConditions.includes(text)) {
                    conditionCode = text;
                }
            });
            
            if (!data.lowestPrices[conditionCode] || price < data.lowestPrices[conditionCode]) {
                data.lowestPrices[conditionCode] = price;
            }
        } catch { continue; }
    }
    return data;
}

module.exports = { scrapeManaPoolListings };

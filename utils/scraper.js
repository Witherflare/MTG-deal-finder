// scraper.js
const { chromium } = require('playwright');

const conditionMap = {
    'Near Mint': 'NM', 'Lightly Played': 'LP', 'Moderately Played': 'MP', 
    'Heavily Played': 'HP', 'Damaged': 'DMG'
};

async function scrapeTcgplayerData(page, tcgplayer_id) {
    console.log(`  -> Scraping TCGplayer...`);
    const productUrl = `https://www.tcgplayer.com/product/${tcgplayer_id}?Language=English`;
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.listing-item', { timeout: 20000 });

    const listingElements = await page.locator('.listing-item').all();
    if (listingElements.length === 0) throw new Error("No TCGplayer listings found.");

    const data = { lowestPrices: {} };
    for (const item of listingElements) {
        try {
            const isFoil = await item.locator('span:text("Foil")').count() > 0;
            if (isFoil) continue;

            const conditionText = await item.locator('.listing-item__listing-data__info__condition').textContent();
            const priceText = await item.locator('.listing-item__listing-data__info__price').textContent();
            const price = parseFloat(priceText.replace('$', ''));
            const conditionCode = conditionMap[conditionText.trim()];

            if (conditionCode && (!data.lowestPrices[conditionCode] || price < data.lowestPrices[conditionCode])) {
                data.lowestPrices[conditionCode] = price;
            }
        } catch { continue; }
    }
    
    try {
        const lastSoldPriceText = await page.locator('tr:has-text("Most Recent Sale") .price-points__upper__price').textContent({ timeout: 5000 });
        data.lastSoldPrice = parseFloat(lastSoldPriceText.replace('$', ''));
    } catch (e) { data.lastSoldPrice = null; }

    try {
        const totalSoldText = await page.locator('tr:has-text("Total Sales") .sales-data__price').textContent({ timeout: 5000 });
        data.totalSold = parseInt(totalSoldText.trim(), 10);
    } catch (e) { data.totalSold = 0; }
    
    try {
        const currentQuantityText = await page.locator('tr:has-text("Current Quantity:") .price-points__lower__price').textContent({ timeout: 5000 });
        data.currentQuantity = parseInt(currentQuantityText.trim(), 10);
    } catch (e) { data.currentQuantity = 0; }

    try {
        data.volatility = await page.locator('.volatility__label').textContent({ timeout: 5000 });
    } catch (e) { data.volatility = 'N/A'; }

    return data;
}

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

async function analyzeCard(page, card) {
    const result = { ...card, tcgplayerData: null, manapoolData: null, error: null };
    if (!card.tcgplayer_id) {
        result.error = "Missing TCGplayer ID.";
        return result;
    }
    try {
        result.tcgplayerData = await scrapeTcgplayerData(page, card.tcgplayer_id);
        result.manapoolData = await scrapeManaPoolListings(page, card.manaPoolUrl);
        console.log(`  ... ✔️ Successfully scraped ${card.cardName}.`);
    } catch (error) {
        console.error(`  ... ❌ Failed to scrape ${card.cardName}: ${error.message}`);
        result.error = error.message;
    }
    return result;
}

module.exports = { analyzeCard };
// witherflare/mtg-deal-finder/utils/watcher.js
const { chromium } = require('playwright');
const axios = require('axios');
const db = require('./database');
const { analyzeCard } = require('./scraper');

const WATCHER_INTERVAL_MS = 4 * 60 * 60 * 1000;
let isRunning = false;

async function runWatcherCycle(client) {
    if (isRunning) {
        console.log('Watcher is already running. Skipping this cycle.');
        return;
    }

    isRunning = true;
    console.log('--- 🏃‍♂️ Starting Watcher Cycle ---');
    
    const watchlist = await db.getWatchlist();
    if (watchlist.length === 0) {
        console.log('Watchlist is empty. Ending cycle.');
        isRunning = false;
        return;
    }

    const browser = await chromium.launch({ headless: false, args: ['--window-position=-2000,0'] });
    const page = await browser.newPage();

    for (const item of watchlist) {
        console.log(`- Scraping watched card: ${item.card_name} (${item.set_name})`);
        
        try {
            const response = await axios.get(`https://api.scryfall.com/cards/${item.scryfall_id}`);
            const printing = response.data;

            if (!printing || !printing.tcgplayer_id) {
                console.log(`  -> Could not find TCGplayer ID for ${item.card_name}. Skipping.`);
                continue;
            }

            const cardToAnalyze = {
                cardName: printing.name,
                setName: printing.set_name,
                tcgplayer_id: printing.tcgplayer_id,
                manaPoolUrl: `https://manapool.com/card/${printing.set}/${printing.collector_number}/${printing.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`
            };

            const result = await analyzeCard(page, cardToAnalyze);
            if (result && !result.error) {
                db.saveScrapeData(printing.id, result);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`  -> Failed to scrape ${item.card_name} (${item.set_name}):`, error.message);
        }
    }
    
    await browser.close();
    isRunning = false;
}

function initializeWatcher(client) {
    console.log(`👀 Watcher initialized. Will run every ${WATCHER_INTERVAL_MS / 1000 / 60} minutes.`);
    setTimeout(() => runWatcherCycle(client), 10000); 
    setInterval(() => runWatcherCycle(client), WATCHER_INTERVAL_MS);
}

module.exports = { initializeWatcher };

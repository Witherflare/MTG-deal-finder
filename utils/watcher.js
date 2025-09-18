// witherflare/mtg-deal-finder/utils/watcher.js
const { chromium } = require('playwright');
const axios = require('axios');
const db = require('./database');
const { analyzeCard } = require('./scraper');

const WATCHER_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Shared status object
let watcherStatus = {
    isRunning: false,
    currentCard: 'None',
    progress: 0,
    total: 0,
    status: 'Idle',
    averageTime: 0,
    timeLeft: 'N/A'
};
let scrapeTimes = [];

async function runWatcherCycle() {
    if (watcherStatus.isRunning) {
        console.log('Watcher is already running. Skipping this cycle.');
        return;
    }

    const cycleStartTime = Date.now();
    watcherStatus.isRunning = true;
    watcherStatus.status = 'Initializing...';
    console.log('--- 🏃‍♂️ Starting Watcher Cycle ---');
    
    const watchlist = await db.getWatchlist();
    if (watchlist.length === 0) {
        console.log('Watchlist is empty. Ending cycle.');
        watcherStatus = { isRunning: false, currentCard: 'None', progress: 0, total: 0, status: 'Idle', averageTime: 0, timeLeft: 'N/A' };
        return;
    }

    watcherStatus.total = watchlist.length;
    watcherStatus.progress = 0;
    scrapeTimes = [];

    const browser = await chromium.launch({ headless: false });
    const tcgplayerPage = await browser.newPage();
    const manapoolPage = await browser.newPage();

    for (const [index, item] of watchlist.entries()) {
        const cardScrapeStartTime = Date.now();
        watcherStatus.progress = index + 1;
        watcherStatus.currentCard = `${item.card_name} (${item.set_name})`;
        watcherStatus.status = `Scraping card ${index + 1} of ${watchlist.length}`;
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

            const result = await analyzeCard(tcgplayerPage, manapoolPage, cardToAnalyze);
            if (result && !result.error) {
                result.scryfallPrice = printing.prices.usd;
                db.saveScrapeData(printing.id, result);
            }
        } catch (error) {
            console.error(`  -> Failed to scrape ${item.card_name} (${item.set_name}):`, error.message);
        }
        
        const cardScrapeEndTime = Date.now();
        const timeTaken = (cardScrapeEndTime - cardScrapeStartTime) / 1000;
        scrapeTimes.push(timeTaken);
        
        const totalScrapeTime = scrapeTimes.reduce((a, b) => a + b, 0);
        watcherStatus.averageTime = totalScrapeTime / scrapeTimes.length;

        const cardsRemaining = watcherStatus.total - watcherStatus.progress;
        const estimatedTimeRemaining = cardsRemaining * watcherStatus.averageTime;
        
        const minutes = Math.floor(estimatedTimeRemaining / 60);
        const seconds = Math.floor(estimatedTimeRemaining % 60);
        watcherStatus.timeLeft = `${minutes}m ${seconds}s`;
    }
    
    await browser.close();
    console.log('--- ✅ Watcher Cycle Complete ---');
    watcherStatus = { isRunning: false, currentCard: 'None', progress: 0, total: 0, status: 'Idle', averageTime: 0, timeLeft: 'N/A' };
}

function initializeWatcher() {
    console.log(`👀 Watcher initialized. Will run every ${WATCHER_INTERVAL_MS / 1000 / 60} minutes.`);
    setTimeout(runWatcherCycle, 10000); 
    setInterval(runWatcherCycle, WATCHER_INTERVAL_MS);
}

function getWatcherStatus() {
    return watcherStatus;
}

module.exports = { initializeWatcher, getWatcherStatus };
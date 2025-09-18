const express = require('express');
const axios = require('axios');
const { chromium } = require('playwright');
const db = require('../utils/database');
const { getCardNames, processValuableCardsFromStream } = require('../utils/card-data');
const { analyzeCard } = require('../utils/scraper');
const { getWatcherStatus } = require('../utils/watcher');

const router = express.Router();

// --- API Routes ---
router.get('/card-names', (req, res) => res.json(getCardNames()));
router.get('/dashboard-data', async (req, res) => res.json(await db.getDashboardData()));
router.get('/history/:scryfallId', async (req, res) => res.json(await db.getPriceHistory(req.params.scryfallId)));
router.get('/watcher-status', (req, res) => res.json(getWatcherStatus()));


router.get('/printings/:cardName', async (req, res) => {
    try {
        const cardName = req.params.cardName;
        const url = `https://api.scryfall.com/cards/search?q=!%22${encodeURIComponent(cardName)}%22&unique=prints&order=released`;
        const response = await axios.get(url);
        res.json(response.data.data);
    } catch (error) {
        res.status(404).json({ error: "Could not find printings." });
    }
});

router.post('/scrape', async (req, res) => {
    const { card } = req.body;
    if (!card || !card.tcgplayer_id) {
        return res.status(400).json({ error: 'A specific card printing with a TCGplayer ID is required.' });
    }
    try {
        // Launch one browser, but create two pages for parallel work
        const browser = await chromium.launch({ headless: false });
        const tcgplayerPage = await browser.newPage();
        const manapoolPage = await browser.newPage();

        const cardToAnalyze = {
            cardName: card.name,
            setName: card.set_name,
            tcgplayer_id: card.tcgplayer_id,
            manaPoolUrl: `https://manapool.com/card/${card.set}/${card.collector_number}/${card.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`
        };
        // Pass both pages to the analyzeCard function
        const result = await analyzeCard(tcgplayerPage, manapoolPage, cardToAnalyze);
        await browser.close();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to scrape card data.' });
    }
});

router.post('/watch', async (req, res) => {
    const { card } = req.body;
    if (!card) return res.status(400).json({ error: 'A card object is required.' });
    try {
        const resultMessage = await db.addToWatchlist(card);
        res.json({ message: resultMessage });
    } catch (error) {
         res.status(500).json({ error: 'Failed to add card to watchlist.' });
    }
});

router.post('/watch-scryfall-query', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'A Scryfall query is required.' });

    try {
        let allCards = [];
        let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;

        while (url) {
            const response = await axios.get(url);
            allCards = allCards.concat(response.data.data);
            url = response.data.has_more ? response.data.next_page : null;
        }

        let addedCount = 0;
        let alreadyExistsCount = 0;

        for (const card of allCards) {
            const resultMessage = await db.addToWatchlist(card);
            if (resultMessage.startsWith('Successfully added')) {
                addedCount++;
            } else if (resultMessage.includes('is already on the watchlist')) {
                alreadyExistsCount++;
            }
        }
        res.json({ message: `Successfully added ${addedCount} cards. ${alreadyExistsCount} cards were already on the watchlist.` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cards from Scryfall or add them to the watchlist.' });
    }
});

router.post('/watch-valuable-cards', (req, res) => {
    const { minValue } = req.body;
    if (!minValue) return res.status(400).json({ error: 'A minimum value is required.' });

    processValuableCardsFromStream(minValue);
    res.json({ message: `Started adding cards with a value over $${minValue}. This will take a long time and run in the background.` });
});


module.exports = router;
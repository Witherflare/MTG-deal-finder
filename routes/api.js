const express = require('express');
const axios = require('axios');
const { chromium } = require('playwright');
const db = require('../utils/database');
const { getCardNames } = require('../utils/card-data');
const { analyzeCard } = require('../utils/scraper');

// --- THIS IS THE FIX ---
// 1. Create a router instance instead of using 'app'
const router = express.Router();
// --- END FIX ---

// All routes are now attached to 'router'
router.get('/card-names', (req, res) => res.json(getCardNames()));
router.get('/watchlist', async (req, res) => res.json(await db.getWatchlist()));
router.get('/history/:scryfallId', async (req, res) => res.json(await db.getPriceHistory(req.params.scryfallId)));

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
        const browser = await chromium.launch({ headless: false, args: ['--window-position=-2000,0'] });
        const page = await browser.newPage();
        const cardToAnalyze = {
            cardName: card.name,
            setName: card.set_name,
            tcgplayer_id: card.tcgplayer_id,
            manaPoolUrl: `https://manapool.com/card/${card.set}/${card.collector_number}/${card.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`
        };
        const result = await analyzeCard(page, cardToAnalyze);
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

// Export the configured router
module.exports = router;
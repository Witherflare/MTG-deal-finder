const fs = require('node:fs');
const path = require('node:path');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');

let allCardsCache = [];
const dataFilePath = path.join(__dirname, '..', 'scryfall-all-cards.json');

/**
 * Streams the entire scryfall-all-cards.json file into an in-memory array.
 * This should only be run once at startup.
 * @returns {Promise<void>}
 */
function loadAllCardsData() {
    return new Promise((resolve, reject) => {
        console.log('Loading full Scryfall dataset into memory...');
        if (!fs.existsSync(dataFilePath)) {
            const warning = 'scryfall-all-cards.json not found. Full data features will be unavailable.';
            console.warn(`WARNING: ${warning}`);
            allCardsCache = [];
            return reject(new Error(warning));
        }

        const tempCardCache = [];
        const fileStream = fs.createReadStream(dataFilePath);
        const jsonStream = fileStream.pipe(parser()).pipe(streamArray());

        jsonStream.on('data', ({ value: card }) => {
            // Push the entire card object into the cache
            if (card && card.name && card.games?.includes('paper')) {
                tempCardCache.push(card);
            }
        });

        jsonStream.on('end', () => {
            allCardsCache = tempCardCache;
            console.log(`✅ Successfully loaded ${allCardsCache.length} playable card objects into memory.`);
            resolve();
        });

        jsonStream.on('error', (err) => {
            console.error('❌ Failed to load full Scryfall dataset from stream:', err);
            reject(err);
        });
    });
}

/**
 * Returns the entire array of cached card objects.
 * @returns {Array<object>}
 */
function getAllCards() {
    return allCardsCache;
}

/**
 * Returns a new array containing only the names of all cards.
 * @returns {Array<string>}
 */
function getCardNames() {
    if (allCardsCache.length === 0) return [];
    
    const uniqueNames = new Set();
    for (const card of allCardsCache) {
        const mainName = card.name.split(' // ')[0];
        uniqueNames.add(mainName);
    }
    return [...uniqueNames];
}

module.exports = { loadAllCardsData, getAllCards, getCardNames };
const axios = require('axios');
const JSONStream = require('jsonstream');
const db = require('./database');

let cardNamesCache = [];

/**
 * Fetches the catalog of all card names from Scryfall.
 */
async function initializeCardNameCache() {
    try {
        console.log('Fetching Scryfall card name catalog...');
        const response = await axios.get('https://api.scryfall.com/catalog/card-names');
        cardNamesCache = response.data.data;
        console.log(`✅ Cached ${cardNamesCache.length} card names for autocomplete.`);
    } catch (error) {
        console.error('Failed to fetch Scryfall card names:', error.message);
    }
}

/**
 * Downloads the Scryfall bulk data file as a stream and processes it to find and add valuable cards to the watchlist.
 * @param {number} minValue The minimum USD value for a card to be considered valuable.
 */
async function processValuableCardsFromStream(minValue) {
    console.log('Starting valuable card stream processing...');
    let addedCount = 0;
    let alreadyExistsCount = 0;

    try {
        console.log('Fetching Scryfall bulk data URI...');
        const bulkDataInfo = await axios.get('https://api.scryfall.com/bulk-data/all-cards');
        const bulkDataUri = bulkDataInfo.data.download_uri;

        console.log('Streaming and processing Scryfall bulk data...');
        const response = await axios({
            method: 'get',
            url: bulkDataUri,
            responseType: 'stream'
        });

        const stream = response.data.pipe(JSONStream.parse('*'));

        stream.on('data', async (card) => {
            if (card.prices && card.prices.usd && parseFloat(card.prices.usd) > minValue) {
                const cardToAdd = {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    collector_number: card.collector_number,
                    scryfall_uri: card.scryfall_uri,
                    image_uris: card.image_uris,
                };
                const resultMessage = await db.addToWatchlist(cardToAdd);
                if (resultMessage.startsWith('Successfully added')) {
                    addedCount++;
                } else if (resultMessage.includes('is already on the watchlist')) {
                    alreadyExistsCount++;
                }
            }
        });

        stream.on('end', () => {
            console.log(`✅ Stream processing complete. Added ${addedCount} new cards. ${alreadyExistsCount} cards already existed.`);
        });

    } catch (error) {
        console.error('Failed to process Scryfall bulk data stream:', error.message);
    }
}


/**
 * Returns the cached array of card names.
 * @returns {Array<string>}
 */
function getCardNames() {
    return cardNamesCache;
}

module.exports = { initializeCardNameCache, getCardNames, processValuableCardsFromStream };
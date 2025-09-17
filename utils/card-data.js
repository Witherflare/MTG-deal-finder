const axios = require('axios');
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
 * Returns the cached array of card names.
 * @returns {Array<string>}
 */
function getCardNames() {
    return cardNamesCache;
}

module.exports = { initializeCardNameCache, getCardNames };
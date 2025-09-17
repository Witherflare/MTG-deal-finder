const levenshtein = require('fast-levenshtein');
const { getCardNames } = require('./scryfall-data.js'); // Get data from our new module

let cardNamesCache = [];

/**
 * Initializes the search-specific cache by getting names from the main data module.
 */
function initializeSearchCache() {
    console.log('Initializing fuzzy search name cache...');
    cardNamesCache = getCardNames();
    console.log(`✅ Search cache initialized with ${cardNamesCache.length} names.`);
}

/**
 * Finds the best card name matches for a given query from the in-memory cache.
 * @param {string} query The user's (potentially misspelled) card name search.
 * @param {number} count The number of matches to return.
 * @returns {Array<string>} An array of the closest matching card names.
 */
function findBestCardMatches(query, count = 5) {
    if (cardNamesCache.length === 0) {
        console.error("Search cache is not initialized. Cannot perform search.");
        return [];
    }

    const normalizedQuery = query.toLowerCase();

    const matches = cardNamesCache.map(name => {
        const distance = levenshtein.get(normalizedQuery, name.toLowerCase());
        return { name, distance };
    })
    .sort((a, b) => a.distance - b.distance);

    const threshold = Math.floor(normalizedQuery.length / 2);
    const bestMatches = matches.filter(m => m.distance <= threshold);

    return bestMatches.slice(0, count).map(m => m.name);
}

module.exports = { initializeSearchCache, findBestCardMatches };
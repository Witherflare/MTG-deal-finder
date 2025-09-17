const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'market-data.db'));

function initializeDatabase() {
    db.serialize(() => {
        // Price history table remains the same
        db.run(`
            CREATE TABLE IF NOT EXISTS price_history (
                scryfall_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                tcg_nm REAL, tcg_lp REAL, tcg_mp REAL, tcg_hp REAL, tcg_dmg REAL,
                mana_nm REAL, mana_lp REAL, mana_mp REAL, mana_hp REAL, mana_dmg REAL,
                PRIMARY KEY (scryfall_id, timestamp)
            )
        `);
        // ADD image_uri column to the watchlist
        db.run(`
            CREATE TABLE IF NOT EXISTS watchlist (
                scryfall_id TEXT PRIMARY KEY,
                card_name TEXT NOT NULL,
                set_name TEXT NOT NULL,
                collector_number TEXT NOT NULL,
                scryfall_uri TEXT NOT NULL,
                image_uri TEXT,
                last_scraped TEXT,
                message_id TEXT 
            )
        `);
    });
    console.log('✅ Database initialized successfully.');
}

/**
 * Adds a specific card printing to the watchlist.
 * @param {object} cardPrinting The full card object from the scryfall data.
 * @returns {Promise<string>} A promise that resolves with a success or failure message.
 */
function addToWatchlist(cardPrinting) {
    return new Promise((resolve) => {
        const sql = `INSERT INTO watchlist (scryfall_id, card_name, set_name, collector_number, scryfall_uri, image_uri) VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [
            cardPrinting.id,
            cardPrinting.name,
            cardPrinting.set_name,
            cardPrinting.collector_number,
            cardPrinting.scryfall_uri,
            cardPrinting.image_uris?.art_crop || cardPrinting.image_uris?.normal // Store the image URL
        ];
        db.run(sql, params, function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    resolve(`**${cardPrinting.name} (${cardPrinting.set_name})** is already on the watchlist.`);
                } else {
                    resolve('An error occurred while adding to the watchlist.');
                }
            } else {
                resolve(`Successfully added **${cardPrinting.name} (${cardPrinting.set_name})** to the watchlist.`);
            }
        });
    });
}


function saveScrapeData(scryfallId, tcgData, manapoolData) {
    const timestamp = new Date().toISOString();
    const sql = `INSERT INTO price_history (scryfall_id, timestamp, tcg_nm, tcg_lp, tcg_mp, tcg_hp, tcg_dmg, mana_nm, mana_lp, mana_mp, mana_hp, mana_dmg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        scryfallId, timestamp,
        tcgData.lowestPrices?.NM || null, tcgData.lowestPrices?.LP || null, tcgData.lowestPrices?.MP || null, tcgData.lowestPrices?.HP || null, tcgData.lowestPrices?.DMG || null,
        manapoolData.lowestPrices?.NM || null, manapoolData.lowestPrices?.LP || null, manapoolData.lowestPrices?.MP || null, manapoolData.lowestPrices?.HP || null, manapoolData.lowestPrices?.DMG || null,
    ];
    db.run(sql, params, (err) => {
        if (err) console.error('Database Error - Failed to save scrape data:', err.message);
    });
}

function setMessageIdForWatchedCard(scryfallId, messageId) {
    db.run(`UPDATE watchlist SET message_id = ? WHERE scryfall_id = ?`, [messageId, scryfallId], (err) => {
        if (err) console.error('Database Error - Failed to set message ID:', err.message);
    });
}

function removeFromWatchlist(name) {
     return new Promise((resolve) => {
        const sql = `DELETE FROM watchlist WHERE card_name = ? COLLATE NOCASE`;
        db.run(sql, [name], function(err) {
            if (err) {
                resolve('An error occurred while removing from the watchlist.');
            } else if (this.changes === 0) {
                resolve(`'${name}' was not found on the watchlist.`);
            } else {
                resolve(`Successfully removed all watched versions of '${name}' from the watchlist.`);
            }
        });
    });
}

function getPriceHistory(scryfallId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM price_history WHERE scryfall_id = ? ORDER BY timestamp ASC`;
        db.all(sql, [scryfallId], (err, rows) => {
            if (err) return reject(err);
resolve(rows);
        });
    });
}

function getWatchlist() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM watchlist`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// --- THIS IS THE CORRECTED PART ---
// Ensure all functions that other files need are listed here.
module.exports = {
    initializeDatabase,
    saveScrapeData,
    setMessageIdForWatchedCard,
    addToWatchlist,
    removeFromWatchlist,
    getPriceHistory,
    getWatchlist,
};
// witherflare/mtg-deal-finder/utils/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'market-data.db'));

function initializeDatabase() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS price_history (
                scryfall_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                tcg_nm REAL, tcg_lp REAL, tcg_mp REAL, tcg_hp REAL, tcg_dmg REAL,
                mana_nm REAL, mana_lp REAL, mana_mp REAL, mana_hp REAL, mana_dmg REAL,
                scryfall_usd REAL,
                PRIMARY KEY (scryfall_id, timestamp)
            )
        `);
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

function addToWatchlist(cardPrinting) {
    return new Promise((resolve) => {
        const sql = `INSERT INTO watchlist (scryfall_id, card_name, set_name, collector_number, scryfall_uri, image_uri) VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [
            cardPrinting.id,
            cardPrinting.name,
            cardPrinting.set_name,
            cardPrinting.collector_number,
            cardPrinting.scryfall_uri,
            cardPrinting.image_uris?.normal
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

function saveScrapeData(scryfallId, allData) {
    const timestamp = new Date().toISOString();
    const sql = `INSERT INTO price_history (scryfall_id, timestamp, tcg_nm, tcg_lp, tcg_mp, tcg_hp, tcg_dmg, mana_nm, mana_lp, mana_mp, mana_hp, mana_dmg, scryfall_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        scryfallId, timestamp,
        allData.tcgplayerData?.lowestPrices?.NM || null, allData.tcgplayerData?.lowestPrices?.LP || null, allData.tcgplayerData?.lowestPrices?.MP || null, allData.tcgplayerData?.lowestPrices?.HP || null, allData.tcgplayerData?.lowestPrices?.DMG || null,
        allData.manapoolData?.lowestPrices?.NM || null, allData.manapoolData?.lowestPrices?.LP || null, allData.manapoolData?.lowestPrices?.MP || null, allData.manapoolData?.lowestPrices?.HP || null, allData.manapoolData?.lowestPrices?.DMG || null,
        allData.scryfallPrice || null
    ];
    db.run(sql, params, (err) => {
        if (err) console.error('Database Error - Failed to save scrape data:', err.message);
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

function getDashboardData() {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT
                w.*,
                p.tcg_nm,
                p.mana_nm
            FROM watchlist w
            LEFT JOIN (
                SELECT scryfall_id, tcg_nm, mana_nm
                FROM price_history
                WHERE (scryfall_id, timestamp) IN (
                    SELECT scryfall_id, MAX(timestamp)
                    FROM price_history
                    GROUP BY scryfall_id
                )
            ) p ON w.scryfall_id = p.scryfall_id
        `;
        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}


module.exports = {
    initializeDatabase,
    addToWatchlist,
    saveScrapeData,
    getPriceHistory,
    getWatchlist,
    getDashboardData,
};
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
const dataFilePath = path.join(__dirname, '..', 'scryfall-all-cards.json');

// --- Helper Functions ---

async function downloadBulkData(downloadUri) {
    console.log(`📥 Starting download of new Scryfall data...`);
    const writer = fs.createWriteStream(dataFilePath);

    const response = await axios({
        method: 'get',
        url: downloadUri,
        responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function runCacheCheck() {
    try {
        console.log('Checking for new Scryfall bulk data...');
        const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data');
        const allCardsData = bulkDataResponse.data.data.find(d => d.type === 'all_cards');

        if (!allCardsData || !allCardsData.download_uri) {
            throw new Error('Could not find "All Cards" download URI in Scryfall response.');
        }

        const remoteTimestamp = new Date(allCardsData.updated_at);

        if (fs.existsSync(dataFilePath)) {
            const localStats = fs.statSync(dataFilePath);
            const localTimestamp = new Date(localStats.mtime);
            if (localTimestamp >= remoteTimestamp) {
                console.log('✅ Local Scryfall cache is up-to-date. No download needed.');
                return;
            }
        } else {
            console.log('Local cache file not found. Starting initial download.');
        }

        await downloadBulkData(allCardsData.download_uri);
        console.log(`✅ Successfully downloaded and updated Scryfall bulk data.`);
    } catch (error) {
        console.error('❌ Failed to update Scryfall bulk data:', error.message);
    }
}

function scheduleNextCacheUpdate() {
    console.log(`⏰ Next Scryfall bulk data check scheduled in 24 hours.`);
    setTimeout(async () => {
        await runCacheCheck();
        scheduleNextCacheUpdate(); // Schedule the next one
    }, twentyFourHoursInMs);
}

// --- Main Exported Function ---

async function initializeScryfallCache() {
    await runCacheCheck(); // Run the check once on startup
    scheduleNextCacheUpdate(); // Start the recurring 24-hour timer
}

module.exports = {
    initializeScryfallCache
};
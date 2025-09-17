const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
// Define the path for the data file in the project's root directory
const dataFilePath = path.join(__dirname, '..', 'scryfall-all-cards.json');

/**
 * Downloads the Scryfall bulk data file and saves it locally.
 * @param {string} downloadUri The URL of the bulk data file to download.
 */
async function downloadBulkData(downloadUri) {
    console.log(`📥 Starting download of new Scryfall data...`);
    const writer = fs.createWriteStream(dataFilePath);

    const response = await axios({
        method: 'get',
        url: downloadUri,
        responseType: 'stream',
    });

    // Pipe the download stream directly to the file
    response.data.pipe(writer);

    // Return a promise that resolves when the download is finished or rejects on error
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

/**
 * Checks if the remote Scryfall data is newer than the local cache and downloads if needed.
 * Schedules itself to run again in 24 hours.
 */
async function updateScryfallCache() {
    try {
        console.log('Checking for new Scryfall bulk data...');
        const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data');
        
        // Find the "All Cards" data object from the API response
        const allCardsData = bulkDataResponse.data.data.find(d => d.type === 'all_cards');

        if (!allCardsData || !allCardsData.download_uri) {
            throw new Error('Could not find "All Cards" download URI in Scryfall response.');
        }

        const remoteTimestamp = new Date(allCardsData.updated_at);

        // --- NEW LOGIC ---
        // Check if the local file exists
        if (fs.existsSync(dataFilePath)) {
            // If it exists, get its modification time
            const localStats = fs.statSync(dataFilePath);
            const localTimestamp = new Date(localStats.mtime);

            // Compare timestamps. If local is same or newer, skip download.
            if (localTimestamp >= remoteTimestamp) {
                console.log('✅ Local Scryfall cache is up-to-date. No download needed.');
                return; // Exit the function early
            }
        } else {
            console.log('Local cache file not found. Starting initial download.');
        }

        // If we reach here, either the file doesn't exist or it's outdated.
        await downloadBulkData(allCardsData.download_uri);
        console.log(`✅ Successfully downloaded and updated Scryfall bulk data.`);

    } catch (error) {
        console.error('❌ Failed to update Scryfall bulk data:', error.message);
    } finally {
        // Whether it succeeds or fails, schedule the next check
        console.log(`⏰ Next Scryfall bulk data check scheduled in 24 hours.`);
        setTimeout(updateScryfallCache, twentyFourHoursInMs);
    }
}

module.exports = { updateScryfallCache };
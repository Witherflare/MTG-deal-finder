const { createCanvas } = require('@napi-rs/canvas');
const Chart = require('chart.js/auto');
const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Generates a price history line chart and saves it as a PNG file.
 * This version uses a stable category axis to avoid date adapter issues.
 * @param {Array<object>} historyData The historical data from the database.
 * @param {string} cardName The name of the card for the chart title.
 * @returns {Promise<string>} The file path of the generated chart image.
 */
async function generatePriceChart(historyData, cardName) {
    const width = 1000;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Create simple date labels (e.g., "Sep 17") for the X-axis
    const labels = historyData.map(d => {
        const date = new Date(d.timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const configuration = {
        type: 'line',
        data: {
            labels: labels, // Use our formatted date strings as labels
            datasets: [
                {
                    label: 'TCGplayer (NM)',
                    data: historyData.map(d => d.tcg_nm),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                },
                {
                    label: 'ManaPool (NM)',
                    data: historyData.map(d => d.mana_nm),
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1
                },
                {
                    label: 'TCGplayer (DMG)',
                    data: historyData.map(d => d.tcg_dmg),
                    borderColor: 'rgb(255, 206, 86)',
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'ManaPool (DMG)',
                    data: historyData.map(d => d.mana_dmg),
                    borderColor: 'rgb(75, 192, 192)',
                    borderDash: [5, 5],
                    tension: 0.1
                }
            ]
        },
        options: {
            // --- ADDED THIS LINE FOR WHITE BACKGROUND ---
            backgroundColor: 'white', 
            // --- END ADDITION ---
            plugins: {
                title: { display: true, text: `Price History for ${cardName}`, font: { size: 20 } },
                legend: { position: 'top' }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Date' }
                },
                y: {
                    title: { display: true, text: 'Price (USD)' },
                    ticks: { callback: (value) => value ? `$${Number(value).toFixed(2)}` : '$0.00' }
                }
            }
        }
    };

    // Create the chart on the canvas
    new Chart(ctx, configuration);

    // Save the canvas to a file
    const chartPath = path.join(__dirname, '..', 'price-chart.png');
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(chartPath, buffer);
    return chartPath;
}

module.exports = { generatePriceChart };
// witherflare/mtg-deal-finder/public/dashboard-view.js
document.addEventListener('DOMContentLoaded', async () => {
    const dashboard = document.getElementById('dashboard');
    dashboard.innerHTML = '<h2>Loading Watchlist...</h2>';

    const watchlist = await (await fetch('/api/watchlist')).json();
    dashboard.innerHTML = '';

    if (watchlist.length === 0) {
        dashboard.innerHTML = '<p>Your watchlist is empty. Use the main search page to add cards.</p>';
        return;
    }

    for (const item of watchlist) {
        const history = await (await fetch(`/api/history/${item.scryfall_id}`)).json();
        const cardContainer = document.createElement('div');
        cardContainer.className = 'dashboard-card';
        
        cardContainer.innerHTML = `
            <a href="${item.scryfall_uri}" target="_blank">
                <img src="${item.image_uri}" alt="${item.card_name}" class="card-art">
                <h2>${item.card_name}</h2>
            </a>
            <p>${item.set_name} (#${item.collector_number})</p>
            <div class="chart-container">
                <canvas></canvas>
            </div>
        `;
        
        dashboard.appendChild(cardContainer);

        if (history.length > 1) {
            const canvas = cardContainer.querySelector('canvas');
            createChart(canvas, history);
        } else {
            cardContainer.querySelector('.chart-container').innerHTML = '<p>Collecting initial price data...</p>';
        }
    }
});

function createChart(canvas, history) {
    const parseTimestamp = (ts) => ts ? new Date(ts).getTime() : null;
    new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: 'TCGplayer (NM)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.tcg_nm })), borderColor: '#fd5c63' },
                { label: 'ManaPool (NM)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.mana_nm })), borderColor: '#0d6efd' },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom' } },
            scales: {
                x: { type: 'time', time: { unit: 'day' } },
                y: { ticks: { callback: (value) => `$${value.toFixed(2)}` } }
            }
        }
    });
}

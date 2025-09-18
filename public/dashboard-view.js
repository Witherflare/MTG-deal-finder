// witherflare/mtg-deal-finder/public/dashboard-view.js
document.addEventListener('DOMContentLoaded', async () => {
    // --- Element References ---
    const dashboard = document.getElementById('dashboard');
    const searchBar = document.getElementById('dashboard-search-bar');
    
    // Card Modal
    const cardModal = document.getElementById('card-modal');
    const closeCardModalButton = cardModal.querySelector('.close-button');
    
    // Watcher Status Modal
    const watcherStatusModal = document.getElementById('watcher-status-modal');
    const openWatcherStatusButton = document.getElementById('watcher-status-button');
    const closeWatcherStatusButton = watcherStatusModal.querySelector('.close-button');
    const statusText = document.getElementById('status-text');
    const currentCardText = document.getElementById('current-card-text');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const avgTimeText = document.getElementById('avg-time-text');
    const timeLeftText = document.getElementById('time-left-text');

    // --- State ---
    let activeChart = null;
    let watchlist = [];
    let filteredWatchlist = [];

    dashboard.innerHTML = '<h2><center>Loading Watchlist...</center></h2>';

    // --- Virtualization Constants ---
    const CARD_ASPECT_RATIO = 680 / 488;
    const CARD_WRAPPER_PADDING = 12;
    let cardHeight = 307;

    // --- Data Fetching ---
    try {
        watchlist = await (await fetch('/api/dashboard-data')).json();
        filteredWatchlist = [...watchlist];
        initializeDashboard();
    } catch (error) {
        dashboard.innerHTML = '<p>Your watchlist is empty or an error occurred.</p>';
        console.error("Failed to load watchlist:", error);
    }
    
    // --- Initialization ---
    function initializeDashboard() {
        if (watchlist.length === 0) {
            dashboard.innerHTML = '<p>Your watchlist is empty. Use the main search page to add cards.</p>';
            return;
        }
        dashboard.innerHTML = '';
        updateVirtualizationConstants();
        dashboard.style.height = `${Math.ceil(filteredWatchlist.length / getColumnCount()) * (cardHeight + (CARD_WRAPPER_PADDING * 2))}px`;
        renderVisibleCards();
        document.getElementById('dashboard-container').addEventListener('scroll', renderVisibleCards);
        window.addEventListener('resize', () => {
             updateVirtualizationConstants();
             dashboard.style.height = `${Math.ceil(filteredWatchlist.length / getColumnCount()) * (cardHeight + (CARD_WRAPPER_PADDING * 2))}px`;
            renderVisibleCards();
        });
    }

    function updateVirtualizationConstants() {
        const columns = getColumnCount();
        const columnWidth = dashboard.offsetWidth / columns;
        const cardWidth = columnWidth - (CARD_WRAPPER_PADDING * 2);
        cardHeight = cardWidth * CARD_ASPECT_RATIO;
    }


    // --- Rendering ---
    function getColumnCount() {
        const gridWidth = dashboard.offsetWidth;
        const minCardWidth = 220;
        return Math.max(1, Math.floor(gridWidth / minCardWidth));
    }

    function renderVisibleCards() {
        const container = document.getElementById('dashboard-container');
        const scrollTop = container.scrollTop;
        const containerHeight = container.offsetHeight;
        const columns = getColumnCount();
        const rowHeight = cardHeight + (CARD_WRAPPER_PADDING * 2);
        const RENDER_AHEAD_ROWS = 3;

        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) * columns - (RENDER_AHEAD_ROWS * columns));
        const endIndex = Math.min(filteredWatchlist.length, Math.ceil((scrollTop + containerHeight) / rowHeight) * columns + (RENDER_AHEAD_ROWS * columns));
        
        dashboard.innerHTML = '';

        for (let i = startIndex; i < endIndex; i++) {
            const item = filteredWatchlist[i];
            
            const wrapper = document.createElement('div');
            wrapper.className = 'card-wrapper';
            wrapper.style.top = `${Math.floor(i / columns) * rowHeight}px`;
            wrapper.style.left = `${(i % columns) * (100 / columns)}%`;
            wrapper.style.width = `${100 / columns}%`;
            wrapper.style.height = `${rowHeight}px`;

            const cardContainer = document.createElement('div');
            cardContainer.className = 'dashboard-card';
            cardContainer.dataset.scryfallId = item.scryfall_id;
            
            cardContainer.innerHTML = `
                <img src="${item.image_uri}" alt="${item.card_name}" class="dashboard-card-image">
                <div class="dashboard-card-info">
                    <h2 class="card-name">${item.card_name}</h2>
                    <div class="price-container">
                        <span>TCG: ${item.tcg_nm ? '$' + item.tcg_nm.toFixed(2) : 'N/A'}</span>
                        <span>MP: ${item.mana_nm ? '$' + item.mana_nm.toFixed(2) : 'N/A'}</span>
                    </div>
                </div>
            `;
            wrapper.appendChild(cardContainer);
            dashboard.appendChild(wrapper);
            cardContainer.addEventListener('click', () => openModal(item));
        }
    }

    // --- Modal Logic ---
    async function openModal(item) {
        if (activeChart) activeChart.destroy();
        
        document.getElementById('modal-card-image').src = item.image_uri;
        document.getElementById('modal-card-name').textContent = item.card_name;
        document.getElementById('modal-card-set').textContent = `${item.set_name} (#${item.collector_number})`;
        
        const history = await (await fetch(`/api/history/${item.scryfall_id}`)).json();

        if (history.length > 1) {
            activeChart = createChart(document.getElementById('modal-chart'), history);
        }
        cardModal.style.display = 'block';
    }

    function closeModal() {
        cardModal.style.display = 'none';
        watcherStatusModal.style.display = 'none';
        if (activeChart) {
            activeChart.destroy();
            activeChart = null;
        }
    }

    // --- Event Listeners ---
    closeCardModalButton.addEventListener('click', closeModal);
    openWatcherStatusButton.addEventListener('click', () => watcherStatusModal.style.display = 'block');
    closeWatcherStatusButton.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target == cardModal || event.target == watcherStatusModal) closeModal();
    });

    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filteredWatchlist = watchlist.filter(item => item.card_name.toLowerCase().includes(searchTerm));
        document.getElementById('dashboard-container').scrollTop = 0;
        initializeDashboard();
    });

    // --- Watcher Status Polling ---
    setInterval(async () => {
        const status = await (await fetch('/api/watcher-status')).json();
        statusText.textContent = status.status;
        currentCardText.textContent = status.currentCard;
        progressText.textContent = `${status.progress} / ${status.total}`;
        avgTimeText.textContent = `${status.averageTime.toFixed(2)}s`;
        timeLeftText.textContent = status.timeLeft;
        const percentage = status.total > 0 ? (status.progress / status.total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
    }, 2000);
});

function createChart(canvas, history) {
    const parseTimestamp = (ts) => ts ? new Date(ts).getTime() : null;
    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: 'TCG (NM)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.tcg_nm })), borderColor: '#fd5c63' },
                { label: 'TCG (LP)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.tcg_lp })), borderColor: '#fd7f6f' },
                { label: 'TCG (MP)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.tcg_mp })), borderColor: '#ffb347' },
                { label: 'TCG (HP)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.tcg_hp })), borderColor: '#ffcc5c' },
                { label: 'TCG (DMG)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.tcg_dmg })), borderColor: '#ffeead' },
                { label: 'ManaPool (NM)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.mana_nm })), borderColor: '#0d6efd' },
                { label: 'ManaPool (LP)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.mana_lp })), borderColor: '#6495ed' },
                { label: 'ManaPool (MP)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.mana_mp })), borderColor: '#7b68ee' },
                { label: 'ManaPool (HP)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.mana_hp })), borderColor: '#9370db' },
                { label: 'ManaPool (DMG)', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.mana_dmg })), borderColor: '#ba55d3' },
                { label: 'Scryfall', data: history.map(d => ({ x: parseTimestamp(d.timestamp), y: d.scryfall_usd })), borderColor: '#32cd32' },
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
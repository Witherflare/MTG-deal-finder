// witherflare/mtg-deal-finder/public/search.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const searchBar = document.getElementById('search-bar');
    const printingsContainer = document.getElementById('printings-container');
    const actionButtons = document.getElementById('action-buttons');
    const selectedPrintingText = document.getElementById('selected-printing-text');
    const btnScrape = document.getElementById('btn-scrape');
    const btnWatch = document.getElementById('btn-watch');
    const resultsContainer = document.getElementById('results-container');
    
    // Bulk Add
    const scryfallQueryBar = document.getElementById('scryfall-query-bar');
    const btnWatchQuery = document.getElementById('btn-watch-query');
    const scryfallResultsContainer = document.getElementById('scryfall-results-container');
    const valueBar = document.getElementById('value-bar');
    const btnWatchValuable = document.getElementById('btn-watch-valuable');
    const valuableResultsContainer = document.getElementById('valuable-results-container');

    // Watcher Status
    const statusText = document.getElementById('status-text');
    const currentCardText = document.getElementById('current-card-text');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const avgTimeText = document.getElementById('avg-time-text');
    const timeLeftText = document.getElementById('time-left-text');

    // --- State ---
    let cardNameList = [];
    let selectedPrinting = null;

    // --- Initial Fetch for Autocomplete ---
    fetch('/api/card-names')
        .then(res => res.json())
        .then(data => {
            cardNameList = data;
            new Awesomplete(searchBar, { list: cardNameList });
        });

    // --- Event Listeners ---
    searchBar.addEventListener('awesomplete-selectcomplete', async (event) => {
        const cardName = event.text.value;
        printingsContainer.innerHTML = '<em>Loading printings...</em>';
        actionButtons.style.display = 'none';
        resultsContainer.innerHTML = '';
        selectedPrinting = null;

        try {
            const response = await fetch(`/api/printings/${encodeURIComponent(cardName)}`);
            if (!response.ok) throw new Error('Card not found');
            const printings = await response.json();
            
            printingsContainer.innerHTML = '';
            printings.forEach(printing => {
                if (!printing.image_uris) return;
                
                const img = document.createElement('img');
                img.src = printing.image_uris.small;
                img.title = `${printing.name} - ${printing.set_name} (#${printing.collector_number})`;
                img.alt = img.title;
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'printing-item';
                itemDiv.appendChild(img);
                
                itemDiv.addEventListener('click', () => {
                    document.querySelectorAll('.printing-item.selected').forEach(el => el.classList.remove('selected'));
                    itemDiv.classList.add('selected');

                    selectedPrinting = printing;
                    selectedPrintingText.innerText = `Selected: ${printing.name} (${printing.set_name})`;
                    actionButtons.style.display = 'block';
                });

                printingsContainer.appendChild(itemDiv);
            });
        } catch (error) {
            printingsContainer.innerHTML = `<p class="error">Could not find any printings for "${cardName}".</p>`;
        }
    });
    
    btnScrape.addEventListener('click', async () => {
        if (!selectedPrinting) return;
        resultsContainer.innerHTML = '<h4>Scraping... This may take a moment.</h4>';
        
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card: selectedPrinting })
        });
        const data = await response.json();
        displayScrapeResults(data);
    });

    btnWatch.addEventListener('click', async () => {
        if (!selectedPrinting) return;
        resultsContainer.innerHTML = `<h4>Adding to watchlist...</h4>`;
        
        const response = await fetch('/api/watch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card: selectedPrinting })
        });
        const data = await response.json();
        resultsContainer.innerHTML = `<h4>${data.message || 'Done!'}</h4>`;
    });

    btnWatchQuery.addEventListener('click', async () => {
        const query = scryfallQueryBar.value;
        if (!query) return;
        scryfallResultsContainer.innerHTML = `<h4>Adding cards from your query... This may take some time.</h4>`;
        
        const response = await fetch('/api/watch-scryfall-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        scryfallResultsContainer.innerHTML = `<h4>${data.message || 'Done!'}</h4>`;
    });

    btnWatchValuable.addEventListener('click', async () => {
        const minValue = valueBar.value;
        if (!minValue) return;
        valuableResultsContainer.innerHTML = `<h4>Adding valuable cards... This will take a long time and run in the background.</h4>`;
        
        const response = await fetch('/api/watch-valuable-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minValue })
        });
        const data = await response.json();
        valuableResultsContainer.innerHTML = `<h4>${data.message || 'Done!'}</h4>`;
    });

    // --- Accordion Logic ---
    const accordions = document.getElementsByClassName("accordion");
    for (let i = 0; i < accordions.length; i++) {
        accordions[i].addEventListener("click", function() {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                panel.style.maxHeight = panel.scrollHeight + "px";
            }
        });
    }

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

    // --- Helper Functions ---
    function displayScrapeResults(result) {
        if (result.error) {
            resultsContainer.innerHTML = `<p class="error">Error: ${result.error}</p>`;
            return;
        }

        const createPriceList = (data) => {
            if (!data || !data.lowestPrices) return '<li>No listings found.</li>';
            return Object.entries(data.lowestPrices).map(([cond, price]) => `<li>${cond}: $${price.toFixed(2)}</li>`).join('');
        };
        
        const tcgplayerUrl = `https://www.tcgplayer.com/product/${result.tcgplayer_id}?Language=English`;
        const manapoolUrl = result.manaPoolUrl;
        const scryfallPrice = selectedPrinting && selectedPrinting.prices && selectedPrinting.prices.usd
            ? `$${selectedPrinting.prices.usd}`
            : 'N/A';

        resultsContainer.innerHTML = `
            <h3>${result.cardName} (${result.setName})</h3>
            <div class="results-grid">
                <div>
                    <h4><a href="${tcgplayerUrl}" target="_blank">TCGplayer</a></h4>
                    <ul>${createPriceList(result.tcgplayerData)}</ul>
                </div>
                <div>
                    <h4><a href="${manapoolUrl}" target="_blank">ManaPool</a></h4>
                    <ul>${createPriceList(result.manapoolData)}</ul>
                </div>
                <div>
                    <h4>Scryfall Market Price</h4>
                    <p>${scryfallPrice}</p>
                </div>
            </div>
        `;
    }
});
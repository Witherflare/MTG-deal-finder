document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const searchBar = document.getElementById('search-bar');
    const printingsContainer = document.getElementById('printings-container');
    const actionButtons = document.getElementById('action-buttons');
    const selectedPrintingText = document.getElementById('selected-printing-text');
    const btnScrape = document.getElementById('btn-scrape');
    const btnWatch = document.getElementById('btn-watch');
    const resultsContainer = document.getElementById('results-container');

    // --- State Variables ---
    let cardNameList = [];
    let selectedPrinting = null;

    // --- Initialization ---
    // Fetch all card names to populate the autocomplete search bar
    fetch('/api/card-names')
        .then(res => res.json())
        .then(data => {
            cardNameList = data;
            new Awesomplete(searchBar, { list: cardNameList });
        });

    // --- Event Listeners ---

    // Event: A card name is selected from the autocomplete list
    searchBar.addEventListener('awesomplete-selectcomplete', async (event) => {
        const cardName = event.text.value;
        // Reset the UI state
        printingsContainer.innerHTML = '<em>Loading printings...</em>';
        actionButtons.style.display = 'none';
        resultsContainer.innerHTML = '';
        selectedPrinting = null;

        try {
            const response = await fetch(`/api/printings/${encodeURIComponent(cardName)}`);
            if (!response.ok) throw new Error('Card not found');
            const printings = await response.json();
            
            printingsContainer.innerHTML = ''; // Clear "Loading..." message
            printings.forEach(printing => {
                if (!printing.image_uris) return; // Skip cards without images (like art cards)
                
                const img = document.createElement('img');
                img.src = printing.image_uris.small;
                img.title = `${printing.name} - ${printing.set_name} (#${printing.collector_number})`;
                img.alt = img.title;
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'printing-item';
                itemDiv.appendChild(img);
                
                // Event: A specific printing image is clicked
                itemDiv.addEventListener('click', () => {
                    // Deselect any previously selected item
                    document.querySelectorAll('.printing-item.selected').forEach(el => el.classList.remove('selected'));
                    // Select the new item
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
    
    // Event: "Get Price" button is clicked
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

    // Event: "Watch Card" button is clicked
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


    // --- Helper function to display temporary scrape results ---
    function displayScrapeResults(result) {
        if (result.error) {
            resultsContainer.innerHTML = `<p class="error">Error: ${result.error}</p>`;
            return;
        }

        const tcgPrices = Object.entries(result.tcgplayerData.lowestPrices).map(([cond, price]) => `<li>${cond}: $${price.toFixed(2)}</li>`).join('');
        const mpPrices = Object.entries(result.manapoolData.lowestPrices).map(([cond, price]) => `<li>${cond}: $${price.toFixed(2)}</li>`).join('');
        
        resultsContainer.innerHTML = `
            <h3>${result.cardName} (${result.setName})</h3>
            <div class="results-grid">
                <div>
                    <h4>TCGplayer</h4>
                    <ul>${tcgPrices || '<li>No listings found.</li>'}</ul>
                </div>
                <div>
                    <h4>ManaPool</h4>
                    <ul>${mpPrices || '<li>No listings found.</li>'}</ul>
                </div>
            </div>
        `;
    }
});
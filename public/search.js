// witherflare/mtg-deal-finder/public/search.js
document.addEventListener('DOMContentLoaded', () => {
    const searchBar = document.getElementById('search-bar');
    const printingsContainer = document.getElementById('printings-container');
    const actionButtons = document.getElementById('action-buttons');
    const selectedPrintingText = document.getElementById('selected-printing-text');
    const btnScrape = document.getElementById('btn-scrape');
    const btnWatch = document.getElementById('btn-watch');
    const resultsContainer = document.getElementById('results-container');

    let cardNameList = [];
    let selectedPrinting = null;

    fetch('/api/card-names')
        .then(res => res.json())
        .then(data => {
            cardNameList = data;
            new Awesomplete(searchBar, { list: cardNameList });
        });

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

    function displayScrapeResults(result) {
        if (result.error) {
            resultsContainer.innerHTML = `<p class="error">Error: ${result.error}</p>`;
            return;
        }

        const createPriceList = (data) => {
            if (!data || !data.lowestPrices) return '<li>No listings found.</li>';
            return Object.entries(data.lowestPrices).map(([cond, price]) => `<li>${cond}: $${price.toFixed(2)}</li>`).join('');
        };
        
        resultsContainer.innerHTML = `
            <h3>${result.cardName} (${result.setName})</h3>
            <div class="results-grid">
                <div><h4>TCGplayer</h4><ul>${createPriceList(result.tcgplayerData)}</ul></div>
                <div><h4>ManaPool</h4><ul>${createPriceList(result.manapoolData)}</ul></div>
                <div><h4>Card Kingdom</h4><ul>${createPriceList(result.cardkingdomData)}</ul></div>
                <div><h4>Star City Games</h4><ul>${createPriceList(result.starcitygamesData)}</ul></div>
                <div><h4>CoolStuffInc</h4><ul>${createPriceList(result.coolstuffincData)}</ul></div>
                <div><h4>ChannelFireball</h4><ul>${createPriceList(result.channelfireballData)}</ul></div>
            </div>
        `;
    }
});

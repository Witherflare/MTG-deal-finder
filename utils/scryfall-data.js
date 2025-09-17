const fs = require('node:fs');
const path = require('node:path');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');

const dataFilePath = path.join(__dirname, '..', 'scryfall-all-cards.json');

/**
 * A generic, reusable function to stream the entire dataset and find all cards
 * that match a given filter condition.
 * WARNING: This can be memory-intensive if the filter matches a large number of cards.
 * @param {function(object): boolean} filterFunction A function that takes a card object and returns true if it's a match.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of matching card objects.
 */
function findCards(filterFunction) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(dataFilePath)) {
            return reject(new Error('Scryfall data file not found.'));
        }

        const matches = [];
        const fileStream = fs.createReadStream(dataFilePath);
        const jsonStream = fileStream.pipe(parser()).pipe(streamArray());

        jsonStream.on('data', ({ value: card }) => {
            try {
                if (filterFunction(card)) {
                    matches.push(card);
                }
            } catch (e) {
                // Ignore errors
            }
        });

        jsonStream.on('end', () => resolve(matches));
        jsonStream.on('error', (err) => reject(err));
    });
}

/**
 * A memory-efficient function to get all unique card names for the search cache.
 * It streams the entire file but only ever stores the names in memory.
 * @returns {Promise<Array<string>>}
 */
function getCardNames() {
    return new Promise((resolve, reject) => {
        console.log('Streaming file to build card name cache...');
        if (!fs.existsSync(dataFilePath)) {
            console.warn('Scryfall data file not found, cannot build name cache.');
            return resolve([]);
        }

        const uniqueNames = new Set();
        const fileStream = fs.createReadStream(dataFilePath);
        const jsonStream = fileStream.pipe(parser()).pipe(streamArray());

        jsonStream.on('data', ({ value: card }) => {
            // Process each card, but only store the name
            if (card && card.name && card.games?.includes('paper')) {
                const mainName = card.name.split(' // ')[0];
                uniqueNames.add(mainName);
            }
        });

        jsonStream.on('end', () => {
            const names = [...uniqueNames];
            console.log(`✅ Name cache built with ${names.length} unique names.`);
            resolve(names);
        });

        jsonStream.on('error', (err) => {
            console.error('Error streaming for card names:', err);
            reject(err);
        });
    });
}

module.exports = { findCards, getCardNames };

/**
 * {"object":"card","id":"0000419b-0bba-4488-8f7a-6194544ce91e","oracle_id":"b34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6","multiverse_ids":[668564],"mtgo_id":129825,"arena_id":91829,"tcgplayer_id":558404,"cardmarket_id":777725,"name":"Forest","lang":"en","released_at":"2024-08-02","uri":"https://api.scryfall.com/cards/0000419b-0bba-4488-8f7a-6194544ce91e","scryfall_uri":"https://scryfall.com/card/blb/280/forest?utm_source=api","layout":"normal","highres_image":true,"image_status":"highres_scan","image_uris":{"small":"https://cards.scryfall.io/small/front/0/0/0000419b-0bba-4488-8f7a-6194544ce91e.jpg?1721427487","normal":"https://cards.scryfall.io/normal/front/0/0/0000419b-0bba-4488-8f7a-6194544ce91e.jpg?1721427487","large":"https://cards.scryfall.io/large/front/0/0/0000419b-0bba-4488-8f7a-6194544ce91e.jpg?1721427487","png":"https://cards.scryfall.io/png/front/0/0/0000419b-0bba-4488-8f7a-6194544ce91e.png?1721427487","art_crop":"https://cards.scryfall.io/art_crop/front/0/0/0000419b-0bba-4488-8f7a-6194544ce91e.jpg?1721427487","border_crop":"https://cards.scryfall.io/border_crop/front/0/0/0000419b-0bba-4488-8f7a-6194544ce91e.jpg?1721427487"},"mana_cost":"","cmc":0.0,"type_line":"Basic Land — Forest","oracle_text":"({T}: Add {G}.)","colors":[],"color_identity":["G"],"keywords":[],"produced_mana":["G"],"legalities":{"standard":"legal","future":"legal","historic":"legal","timeless":"legal","gladiator":"legal","pioneer":"legal","modern":"legal","legacy":"legal","pauper":"legal","vintage":"legal","penny":"legal","commander":"legal","oathbreaker":"legal","standardbrawl":"legal","brawl":"legal","alchemy":"legal","paupercommander":"legal","duel":"legal","oldschool":"not_legal","premodern":"legal","predh":"legal"},"games":["paper","mtgo","arena"],"reserved":false,"game_changer":false,"foil":true,"nonfoil":true,"finishes":["nonfoil","foil"],"oversized":false,"promo":false,"reprint":true,"variation":false,"set_id":"a2f58272-bba6-439d-871e-7a46686ac018","set":"blb","set_name":"Bloomburrow","set_type":"expansion","set_uri":"https://api.scryfall.com/sets/a2f58272-bba6-439d-871e-7a46686ac018","set_search_uri":"https://api.scryfall.com/cards/search?order=set&q=e%3Ablb&unique=prints","scryfall_set_uri":"https://scryfall.com/sets/blb?utm_source=api","rulings_uri":"https://api.scryfall.com/cards/0000419b-0bba-4488-8f7a-6194544ce91e/rulings","prints_search_uri":"https://api.scryfall.com/cards/search?order=released&q=oracleid%3Ab34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6&unique=prints","collector_number":"280","digital":false,"rarity":"common","card_back_id":"0aeebaf5-8c7d-4636-9e82-8c27447861f7","artist":"David Robert Hovey","artist_ids":["22ab27e3-6476-48f1-a9f7-9a9e86339030"],"illustration_id":"fb2b1ca2-7440-48c2-81c8-84da0a45a626","border_color":"black","frame":"2015","full_art":true,"textless":false,"booster":true,"story_spotlight":false,"prices":{"usd":"0.24","usd_foil":"0.56","usd_etched":null,"eur":"0.25","eur_foil":"0.39","tix":"0.03"},"related_uris":{"gatherer":"https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=668564&printed=false","tcgplayer_infinite_articles":"https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DForest","tcgplayer_infinite_decks":"https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DForest","edhrec":"https://edhrec.com/route/?cc=Forest"},"purchase_uris":{"tcgplayer":"https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F558404%3Fpage%3D1","cardmarket":"https://www.cardmarket.com/en/Magic/Products?idProduct=777725&referrer=scryfall&utm_campaign=card_prices&utm_medium=text&utm_source=scryfall","cardhoarder":"https://www.cardhoarder.com/cards/129825?affiliate_id=scryfall&ref=card-profile&utm_campaign=affiliate&utm_medium=card&utm_source=scryfall"}},
*/
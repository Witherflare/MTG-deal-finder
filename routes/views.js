const express = require('express');
const path = require('node:path');
const router = express.Router();

// Serve the main search page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve the new dashboard page
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

module.exports = router;
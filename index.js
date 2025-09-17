require('dotenv').config();
const express = require('express');
const path = require('node:path');
const db = require('./utils/database');
const { initializeWatcher } = require('./utils/watcher');
const { initializeCardNameCache } = require('./utils/card-data');
const apiRoutes = require('./routes/api');
const viewRoutes = require('./routes/views');

const app = express();
const PORT = process.env.PORT || 3000;

db.initializeDatabase();
initializeWatcher();
initializeCardNameCache();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use('/api', apiRoutes);
app.use('/', viewRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
    console.log(`-> Main site: http://localhost:${PORT}`);
    console.log(`-> Dashboard: http://localhost:${PORT}/dashboard`);
});
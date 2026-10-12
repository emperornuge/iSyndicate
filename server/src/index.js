const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { seedBots, startTick } = require('./game');
const routes = require('./routes');

const app = express();

// The game API is public by design (username-only game accounts, no PII).
// Restrict via ALLOWED_ORIGINS env if you ever need to.
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/healthz', (req, res) => res.json({ ok: true, time: Date.now() }));
app.use('/api', routes);

app.get('/', (req, res) => {
  res.send('iSyndicate API — game server running. The iOS app talks to /api.');
});

const PORT = process.env.PORT || 3000;

initDb();
seedBots();
startTick();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`iSyndicate API listening on :${PORT}`);
});

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const port = parseInt(process.env.VAULTDOCK_PORT || '5001', 10);

const app = express();

app.use(express.json());
app.use(router);

// Serve static files from Vite build output
app.use(express.static(distDir));

// SPA fallback — serve index.html for all non-API routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Vaultdock running at http://0.0.0.0:${port}`);
});

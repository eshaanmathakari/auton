import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tipRoutes from './routes/tip.js';
import tipsRoutes from './routes/tips.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/', tipRoutes);
app.use('/', tipsRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});


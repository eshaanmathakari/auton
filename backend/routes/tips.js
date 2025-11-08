import express from 'express';
import database from '../database.js';

const router = express.Router();

// GET /tips/:creatorId - Get tip history for a creator
router.get('/tips/:creatorId', (req, res) => {
  try {
    const { creatorId } = req.params;
    
    const creator = database.getCreator(creatorId);
    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const tips = database.getTips(creatorId);
    
    // Calculate totals
    const totals = tips.reduce((acc, tip) => {
      if (tip.assetType === 'SOL') {
        acc.totalSOL = (acc.totalSOL || 0) + parseFloat(tip.amount);
        acc.totalCreatorAmountSOL = (acc.totalCreatorAmountSOL || 0) + parseFloat(tip.creatorAmount);
      } else if (tip.assetType === 'USDC') {
        acc.totalUSDC = (acc.totalUSDC || 0) + parseFloat(tip.amount);
        acc.totalCreatorAmountUSDC = (acc.totalCreatorAmountUSDC || 0) + parseFloat(tip.creatorAmount);
      }
      return acc;
    }, {});

    res.json({
      creatorId,
      creator: {
        id: creator.id,
        walletAddress: creator.walletAddress,
        createdAt: creator.createdAt,
      },
      tips: tips.map(tip => ({
        id: tip.id,
        amount: tip.amount,
        assetType: tip.assetType,
        creatorAmount: tip.creatorAmount,
        platformFee: tip.platformFee,
        signature: tip.signature,
        from: tip.from,
        timestamp: tip.timestamp,
        transactionUrl: `https://explorer.solana.com/tx/${tip.signature}?cluster=devnet`,
      })),
      totals,
      count: tips.length,
    });
  } catch (error) {
    console.error('Error in /tips endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /creator - Register a new creator
router.post('/creator', (req, res) => {
  try {
    const { creatorId, walletAddress } = req.body;

    if (!creatorId || !walletAddress) {
      return res.status(400).json({ error: 'creatorId and walletAddress are required' });
    }

    const creator = database.createCreator(creatorId, walletAddress);

    res.json({
      success: true,
      creator: {
        id: creator.id,
        walletAddress: creator.walletAddress,
        createdAt: creator.createdAt,
        tipLink: `/tip/${creator.id}`,
      },
    });
  } catch (error) {
    console.error('Error in POST /creator endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;


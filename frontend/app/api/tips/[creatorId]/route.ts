
import { NextRequest, NextResponse } from 'next/server';
import database from '../../../../lib/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const { creatorId } = await params;
    
    const creator = database.getCreator(creatorId);
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const tips = database.getTips(creatorId);
    
    const totals = tips.reduce((acc: any, tip: any) => {
      if (tip.assetType === 'SOL') {
        acc.totalSOL = (acc.totalSOL || 0) + parseFloat(tip.amount);
        acc.totalCreatorAmountSOL = (acc.totalCreatorAmountSOL || 0) + parseFloat(tip.creatorAmount);
      } else if (tip.assetType === 'USDC') {
        acc.totalUSDC = (acc.totalUSDC || 0) + parseFloat(tip.amount);
        acc.totalCreatorAmountUSDC = (acc.totalCreatorAmountUSDC || 0) + parseFloat(tip.creatorAmount);
      }
      return acc;
    }, {});

    return NextResponse.json({
      creatorId,
      creator: {
        id: creator.id,
        walletAddress: creator.walletAddress,
        createdAt: creator.createdAt,
      },
      tips: tips.map((tip: any) => ({
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
  } catch (error: any) {
    console.error('Error in /api/tips/[creatorId] GET:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

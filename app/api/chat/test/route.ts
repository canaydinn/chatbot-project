import { NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';

export async function GET() {
  const envCheck = {
    openaiKey: process.env.OPENAI_API_KEY ? 'Set (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'Missing',
    qdrantUrl: process.env.QDRANT_URL || 'Missing',
    qdrantKey: process.env.QDRANT_API_KEY ? 'Set' : 'Missing (optional)',
    nodeEnv: process.env.NODE_ENV,
  };

  // Qdrant bağlantısını test et
  let qdrantTest: {
    status: string;
    collectionExists?: boolean;
    pointsCount?: number;
    error?: string;
  } = { status: 'not tested' };
  
  if (process.env.QDRANT_URL) {
    try {
      const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
      });
      
      // Collection'ı kontrol et
      try {
        const collection = await client.getCollection('is_plani_rehberi');
        qdrantTest = {
          status: 'connected',
          collectionExists: true,
          pointsCount: collection.points_count ?? undefined,
        };
      } catch (error: any) {
        if (error.status === 404) {
          qdrantTest = {
            status: 'connected',
            collectionExists: false,
            error: 'Collection "is_plani_rehberi" not found',
          };
        } else {
          qdrantTest = {
            status: 'error',
            error: error.message || 'Unknown error',
          };
        }
      }
    } catch (error: any) {
      qdrantTest = {
        status: 'connection failed',
        error: error.message || 'Unknown error',
      };
    }
  }

  return NextResponse.json({
    environment: envCheck,
    qdrant: qdrantTest,
    timestamp: new Date().toISOString(),
  });
}


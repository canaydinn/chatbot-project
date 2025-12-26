import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

// Qdrant client'ı oluştur
function getQdrantClient() {
  if (!process.env.QDRANT_URL) {
    throw new Error('QDRANT_URL environment variable is required');
  }

  return new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });
}

// OpenAI client'ı oluştur
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Metni chunk'lara ayır (basit yaklaşım - satır bazlı)
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Overlap için son birkaç satırı koru
      const lastLines = currentChunk.split('\n').slice(-Math.floor(overlap / 50));
      currentChunk = lastLines.join('\n') + '\n' + line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Embedding oluştur
async function createEmbedding(text: string, openaiClient: OpenAI): Promise<number[]> {
  const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

export async function POST(req: NextRequest) {
  try {
    // Environment variable kontrolü
    if (!process.env.OPENAI_API_KEY || !process.env.QDRANT_URL) {
      return NextResponse.json(
        { error: 'Environment variables are missing' },
        { status: 500 }
      );
    }

    // Request body'yi al
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const email = formData.get('email') as string;

    if (!file || !email) {
      return NextResponse.json(
        { error: 'File and email are required' },
        { status: 400 }
      );
    }

    // Dosyayı oku (sadece text dosyaları)
    if (!file.name.endsWith('.txt')) {
      return NextResponse.json(
        { error: 'Only .txt files are supported' },
        { status: 400 }
      );
    }

    const text = await file.text();
    console.log(`File uploaded: ${file.name}, size: ${text.length} characters`);

    // Collection adı (e-posta ID'sine göre)
    const emailHash = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const collectionName = `user_${emailHash}`;

    // Qdrant ve OpenAI client'ları
    const qdrantClient = getQdrantClient();
    const openaiClient = getOpenAIClient();

    // Collection'ı oluştur veya kontrol et
    try {
      await qdrantClient.getCollection(collectionName);
      console.log(`Collection ${collectionName} already exists, will update`);
    } catch (error: any) {
      if (error.status === 404) {
        // Collection yok, oluştur
        await qdrantClient.createCollection(collectionName, {
          vectors: {
            size: 1536, // text-embedding-3-small dimension
            distance: 'Cosine',
          },
        });
        console.log(`Created collection: ${collectionName}`);
      } else {
        throw error;
      }
    }

    // Metni chunk'lara ayır
    const chunks = chunkText(text, 1000, 200);
    console.log(`Split into ${chunks.length} chunks`);

    // Her chunk için embedding oluştur ve Qdrant'a yükle
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await createEmbedding(chunk, openaiClient);
      
      points.push({
        id: i,
        vector: embedding,
        payload: {
          text: chunk,
          fileName: file.name,
          chunkIndex: i,
          totalChunks: chunks.length,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Batch olarak yükle (her 10 chunk'ta bir)
      if (points.length >= 10 || i === chunks.length - 1) {
        await qdrantClient.upsert(collectionName, {
          wait: true,
          points: points,
        });
        console.log(`Uploaded ${points.length} chunks to Qdrant`);
        points.length = 0; // Array'i temizle
      }
    }

    return NextResponse.json({
      success: true,
      message: 'File uploaded and processed successfully',
      collectionName,
      chunksCount: chunks.length,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


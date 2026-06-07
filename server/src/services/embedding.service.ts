import crypto from 'crypto';
import OpenAI from 'openai';
import { Task } from '../models/Task.model';
import { getDecryptedKey } from '../controllers/apiKey.controller';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Semantic search support. Tasks are embedded with OpenAI's small embedding
 * model (reduced to 512 dims to keep documents lean) and compared in-memory with
 * cosine similarity — no external vector index to configure. Indexing is batched
 * (one API call for many tasks) and lazy: the search endpoint backfills any
 * missing/stale embeddings on demand.
 */

const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMS = 512;

/** Text a task's embedding is built from. */
export const taskEmbedText = (task: any): string =>
  `${task.title || ''}\n${task.description || ''}`.trim().slice(0, 8000);

const hashText = (text: string): string => crypto.createHash('sha256').update(text).digest('hex');

/** Cosine similarity of two equal-length vectors. */
export const cosineSim = (a: number[], b: number[]): number => {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

/** Resolve the team's OpenAI client (throws NO_AI_KEY if unset). */
const clientFor = async (teamId: string): Promise<OpenAI> => {
  const key = await getDecryptedKey(teamId);
  if (!key) {
    throw new ApiError(400, 'Semantic search needs an OpenAI API key. Add one in Team Settings → AI & API.', { code: 'NO_AI_KEY' });
  }
  return new OpenAI({ apiKey: key });
};

/** Embed one or many texts in a single API call. */
export const embedTexts = async (client: OpenAI, inputs: string[]): Promise<number[][]> => {
  if (inputs.length === 0) return [];
  const res = await client.embeddings.create({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS });
  return res.data.map((d) => d.embedding as number[]);
};

/**
 * Ensure every non-archived task in the team has an up-to-date embedding,
 * batching all missing/stale ones into a single API call. Returns the task docs
 * (with embeddings) ready for similarity ranking.
 */
export const indexTeamTasks = async (teamId: string, client: OpenAI) => {
  const tasks = await Task.find({ team: teamId, isArchived: false })
    .select('title description status priority identifier embedding embeddingHash')
    .limit(2000);

  const stale = tasks.filter((t: any) => {
    const h = hashText(taskEmbedText(t));
    return !t.embedding || t.embedding.length === 0 || t.embeddingHash !== h;
  });

  if (stale.length > 0) {
    const vectors = await embedTexts(client, stale.map((t: any) => taskEmbedText(t) || t.title || ' '));
    const ops = stale.map((t: any, i: number) => {
      const h = hashText(taskEmbedText(t));
      (t as any).embedding = vectors[i];
      (t as any).embeddingHash = h;
      return {
        updateOne: {
          filter: { _id: t._id },
          update: { $set: { embedding: vectors[i], embeddingHash: h } },
        },
      };
    });
    try {
      await Task.bulkWrite(ops);
    } catch (err: any) {
      logger.warn(`[embedding] bulk index failed for team ${teamId}: ${err?.message}`);
    }
  }

  return tasks;
};

/** Run a semantic search: returns top-k tasks by cosine similarity to the query. */
export const semanticSearchTasks = async (
  teamId: string,
  query: string,
  limit = 15
): Promise<Array<{ task: any; score: number }>> => {
  const client = await clientFor(teamId);
  const tasks = await indexTeamTasks(teamId, client);
  const [queryVec] = await embedTexts(client, [query]);

  return tasks
    .map((t: any) => ({ task: t, score: t.embedding ? cosineSim(queryVec, t.embedding) : 0 }))
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

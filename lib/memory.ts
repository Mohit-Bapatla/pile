import type { Item, Source } from './model';
export interface MemoryAdapter {
  remember(user: string, source: Source): Promise<void>;
  search(
    user: string,
    query: string,
    items: Item[],
    sources: Source[],
  ): Promise<{ items: Item[]; answer?: string; provider: string }>;
}
export class LocalMemoryAdapter implements MemoryAdapter {
  async remember(_user: string, _source: Source) {
    void _user;
    void _source;
  }
  async search(_user: string, query: string, items: Item[], sources: Source[]) {
    const stop = new Set(
      'the a an i me my what did say about find that thing things do need to in from uploaded yesterday for is of and'.split(
        ' ',
      ),
    );
    const tokens =
      query
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter((t) => !stop.has(t)) || [];
    const sourceMap = new Map(sources.map((s) => [s.id, s]));
    const ranked = items
      .map((item) => {
        const source = sourceMap.get(item.sourceId);
        const text = [
          item.title,
          item.description,
          item.project,
          source?.rawText,
          source?.fileName,
          source?.type,
        ]
          .join(' ')
          .toLowerCase();
        return {
          item,
          score: tokens.reduce((score, t) => score + (text.includes(t) ? 1 : 0), 0),
        };
      })
      .filter((x) => x.score > 0 || !tokens.length)
      .sort((a, b) => b.score - a.score);
    return { items: ranked.map((x) => x.item), provider: 'Local search' };
  }
}
// The local index is always authoritative for item ownership and deleted records.
export class BackboardMemoryAdapter extends LocalMemoryAdapter {
  constructor(private threadId: string) {
    super();
  }
  async message(content: string, write: boolean) {
    const res = await fetch(
      `${process.env.BACKBOARD_BASE_URL || 'https://app.backboard.io/api'}/threads/messages`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.BACKBOARD_API_KEY || '',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          thread_id: this.threadId,
          content,
          stream: false,
          memory: write ? 'Auto' : 'Readonly',
          send_to_llm: write ? 'false' : 'true',
        }),
      },
    );
    if (!res.ok) throw new Error('Memory provider unavailable');
    return res.json();
  }
  async remember(_user: string, source: Source) {
    await this.message(`Source ${source.id}: ${source.summary}\n${source.rawText}`, true);
  }
  async search(user: string, query: string, items: Item[], sources: Source[]) {
    const local = await super.search(user, query, items, sources);
    try {
      const answer = await this.message(query, false);
      return {
        ...local,
        answer: typeof answer.content === 'string' ? answer.content : undefined,
        provider: 'Backboard + local search',
      };
    } catch {
      return {
        ...local,
        provider: 'Local search (memory provider unavailable)',
      };
    }
  }
}

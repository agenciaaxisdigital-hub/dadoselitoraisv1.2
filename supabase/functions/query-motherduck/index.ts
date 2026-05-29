const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── In-memory query cache (persists within the same Edge Function instance) ──
const queryCache = new Map<string, { rows: any[]; ts: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min — alinhado ao staleTime do frontend

function cacheGet(sql: string): any[] | null {
  const entry = queryCache.get(sql);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { queryCache.delete(sql); return null; }
  return entry.rows;
}

function cacheSet(sql: string, rows: any[]): void {
  if (queryCache.size >= 300) {
    // Evict oldest entry to cap memory
    let oldestKey = '';
    let oldestTs = Infinity;
    for (const [k, v] of queryCache) {
      if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
    }
    if (oldestKey) queryCache.delete(oldestKey);
  }
  queryCache.set(sql, { rows: Array.from(rows), ts: Date.now() });
}

// ── Persistent connection pool (reused across requests) ──
let pgPool: any = null;
let lastActivity = 0;

async function getPool() {
  const token = Deno.env.get('MOTHERDUCK_TOKEN');
  if (!token) throw new Error('MOTHERDUCK_TOKEN não configurado');

  const now = Date.now();
  
  // Reuse existing pool if it's been active in last 50s
  if (pgPool && (now - lastActivity) < 50_000) {
    lastActivity = now;
    return pgPool;
  }

  // Close stale pool
  if (pgPool) {
    try { await pgPool.end({ timeout: 2 }); } catch { /* ignore */ }
    pgPool = null;
  }

  const { default: postgres } = await import('https://deno.land/x/postgresjs@v3.4.5/mod.js');

  pgPool = postgres({
    hostname: 'pg.us-east-1-aws.motherduck.com',
    port: 5432,
    username: 'postgres',
    password: token,
    database: 'md:',
    ssl: 'require',
    connection: {
      application_name: 'eleicoesgo-edge',
    },
    max: 3,
    idle_timeout: 55,
    connect_timeout: 30,
  });

  lastActivity = now;
  return pgPool;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const sql = body?.query

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Campo "query" (string SQL) é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Safety: only allow read-only statements
    const trimmed = sql.trim().toUpperCase()
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('DESCRIBE') && !trimmed.startsWith('SHOW') && !trimmed.startsWith('WITH') && !trimmed.startsWith('PRAGMA')) {
      return new Response(
        JSON.stringify({ error: 'Apenas queries SELECT/WITH/DESCRIBE/SHOW são permitidas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cache check — skip for mutations (already blocked above, but defensive)
    const cached = cacheGet(sql);
    if (cached) {
      return new Response(
        JSON.stringify({ rows: cached, rowCount: cached.length, fromCache: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pool = await getPool();
    const rows = await pool.unsafe(sql);
    const columns = rows.columns?.map((c: any) => ({ name: c.name, type: c.type })) || [];

    cacheSet(sql, rows);

    return new Response(
      JSON.stringify({ columns, rows, rowCount: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('query-motherduck error:', err)
    // Reset pool on connection errors
    if ((err as Error).message?.includes('connect') || (err as Error).message?.includes('closed')) {
      pgPool = null;
    }
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
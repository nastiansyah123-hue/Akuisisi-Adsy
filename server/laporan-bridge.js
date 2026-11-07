// Laporan Bridge — connects CS Order (Supabase A) with Laporan Akuisisi (Supabase B).
// CS Order frontend calls these endpoints; auth verified via Supabase A token.

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

const LEAD_KEYS = ['passive','consultation','priceShipping','ooc','casual','boughtElsewhere','other'];

// Verify admin token against Laporan Akuisisi Supabase (Supabase B)
async function verifyAdminToken(env, token) {
  const url = (env.LAPORAN_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.LAPORAN_SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (typeof user.id !== 'string') return null;
    // Check profiles table for admin role
    const q = new URLSearchParams({ id: `eq.${user.id}`, select: 'name,role', limit: '1' });
    const pRes = await fetch(`${url}/rest/v1/profiles?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!pRes.ok) return null;
    const profiles = await pRes.json();
    const p = profiles[0];
    if (!p || p.role !== 'admin') return null;
    return { id: user.id, name: p.name, role: p.role };
  } catch { return null; }
}

// Fetch all active CS names from csorder Supabase (Supabase A)
async function fetchCSList(env) {
  const url = (env.CSORDER_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.CSORDER_SUPABASE_SERVICE_KEY;
  if (!url || !key) return [];
  try {
    const q = new URLSearchParams({ aktif: 'eq.true', select: 'nama,email', order: 'nama.asc' });
    const res = await fetch(`${url}/rest/v1/cs_profiles?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function verifyCSToken(env, token) {
  const url = (env.CSORDER_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.CSORDER_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (typeof user.id !== 'string') return null;
    // Fetch cs_profiles to get nama
    const q = new URLSearchParams({ id: `eq.${user.id}`, select: 'nama,email,aktif', limit: '1' });
    const pRes = await fetch(`${url}/rest/v1/cs_profiles?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!pRes.ok) return null;
    const profiles = await pRes.json();
    const p = profiles[0];
    if (!p || !p.aktif) return null;
    return { id: user.id, nama: p.nama, email: p.email };
  } catch { return null; }
}

function laporanClient(env) {
  const url = (env.LAPORAN_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.LAPORAN_SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    async query(table, params = {}) {
      const q = new URLSearchParams(params);
      const res = await fetch(`${url}/rest/v1/${table}?${q}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error(`DB read ${table}: ${res.status}`);
      return res.json();
    },
    async insert(table, row) {
      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json', Prefer: 'return=representation'
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`DB insert ${table}: ${res.status} ${err}`);
      }
      return res.json();
    },
    async upsert(table, row, onConflict) {
      const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`DB upsert ${table}: ${res.status} ${err}`);
      }
      return res.json();
    },
    async update(table, id, row) {
      const q = new URLSearchParams({ id: `eq.${id}` });
      const res = await fetch(`${url}/rest/v1/${table}?${q}`, {
        method: 'PATCH',
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json', Prefer: 'return=representation'
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`DB update ${table}: ${res.status} ${err}`);
      }
      return res.json();
    }
  };
}

export function createLaporanBridgeHandler() {
  return async function handle(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-CS-Token, X-Admin-Token',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
    const respond = (body, status = 200) => {
      const r = json(body, status);
      for (const [k, v] of Object.entries(corsHeaders)) r.headers.set(k, v);
      return r;
    };

    const db = laporanClient(env);
    if (!db) return respond({ error: 'Database belum dikonfigurasi' }, 503);

    const reqUrl = new URL(request.url);
    const action = reqUrl.searchParams.get('action');

    // ── Admin-only actions (auth via Laporan Akuisisi Supabase) ──
    if (action === 'cs-list') {
      const adminToken = request.headers.get('X-Admin-Token');
      if (!adminToken) return respond({ error: 'Admin token diperlukan' }, 401);
      const admin = await verifyAdminToken(env, adminToken);
      if (!admin) return respond({ error: 'Bukan admin atau token tidak valid' }, 403);
      const list = await fetchCSList(env);
      return respond({ csNames: list });
    }

    // ── CS actions (auth via csorder Supabase) ──
    const token = request.headers.get('X-CS-Token');
    if (!token) return respond({ error: 'Token diperlukan' }, 401);

    const cs = await verifyCSToken(env, token);
    if (!cs) return respond({ error: 'Token tidak valid atau CS tidak aktif' }, 401);

    try {
      // ── GET actions ──
      if (request.method === 'GET') {
        if (action === 'verify') {
          // Check if CS has assignments in Laporan Akuisisi
          const assignments = await db.query('assignments', {
            cs: `eq.${cs.nama}`, active: 'eq.true',
            select: 'id,cs,product,advertiser,channel'
          });
          return respond({ ok: true, cs: cs.nama, email: cs.email, assignments });
        }

        if (action === 'assignments') {
          const assignments = await db.query('assignments', {
            cs: `eq.${cs.nama}`, active: 'eq.true',
            select: 'id,cs,product,advertiser,channel'
          });
          return respond({ assignments });
        }

        if (action === 'catalog') {
          const catalog = await db.query('catalog', { select: 'id,name,unit,packages' });
          return respond({ catalog });
        }

        if (action === 'reports') {
          const start = url.searchParams.get('start');
          const end = url.searchParams.get('end');
          const params = { cs: `eq.${cs.nama}`, select: '*', order: 'date.desc' };
          if (start) params.date = end ? `gte.${start}` : `eq.${start}`;
          // For range filter, use 'and' syntax
          let reports;
          if (start && end) {
            reports = await db.query('reports', {
              cs: `eq.${cs.nama}`, select: '*', order: 'date.desc',
              and: `(date.gte.${start},date.lte.${end})`
            });
          } else {
            reports = await db.query('reports', params);
          }
          // Also fetch lead reports for these reports
          const reportIds = reports.map(r => r.id);
          let leadReports = [];
          if (reportIds.length) {
            leadReports = await db.query('leadReports', {
              'reportId': `in.(${reportIds.join(',')})`, select: '*'
            });
          }
          return respond({ reports, leadReports });
        }

        if (action === 'ads') {
          const start = url.searchParams.get('start');
          const end = url.searchParams.get('end');
          const product = url.searchParams.get('product');
          const params = { select: '*' };
          if (product) params.product = `eq.${product}`;
          if (start && end) params.and = `(date.gte.${start},date.lte.${end})`;
          const ads = await db.query('ads', params);
          return respond({ ads });
        }

        return respond({ error: 'Action tidak dikenal' }, 400);
      }

      // ── POST actions ──
      if (request.method === 'POST') {
        const body = await request.json();

        if (action === 'save-report') {
          const { report, counts, notes } = body;
          if (!report || !counts) return respond({ error: 'Data report dan counts diperlukan' }, 400);

          // Validate CS ownership
          if (report.cs !== cs.nama) return respond({ error: 'Hanya CS pemilik laporan yang dapat menyimpan.' }, 403);

          // Validate report fields
          if (!report.id || !report.date || !report.product || !report.advertiser || !report.channel) {
            return respond({ error: 'Lengkapi identitas laporan.' }, 400);
          }
          const leads = parseInt(report.leads, 10);
          if (!Number.isInteger(leads) || leads < 0) {
            return respond({ error: 'Jumlah leads harus bilangan bulat nol atau lebih.' }, 400);
          }

          // Validate BEF counts
          const countKeys = Object.keys(counts);
          if (countKeys.length !== 7 || !LEAD_KEYS.every(k => k in counts)) {
            return respond({ error: 'Isi tujuh kategori BEF yang valid.' }, 400);
          }
          let totalCounts = 0;
          for (const k of LEAD_KEYS) {
            const v = Number(counts[k]);
            if (!Number.isInteger(v) || v < 0) return respond({ error: 'Kategori BEF harus bilangan bulat nol atau lebih.' }, 400);
            totalCounts += v;
          }
          if (totalCounts > leads) return respond({ error: 'Total kategori melebihi jumlah leads.' }, 400);

          // Check for existing report
          const existing = await db.query('reports', {
            id: `eq.${report.id}`, select: 'id,cs,date,product,advertiser,channel', limit: '1'
          });

          if (existing.length) {
            // Update: identity must not change
            const prev = existing[0];
            if (prev.cs !== report.cs || prev.date !== report.date || prev.product !== report.product ||
                prev.advertiser !== report.advertiser || prev.channel !== report.channel) {
              return respond({ error: 'Identitas laporan tidak dapat dipindahkan.' }, 400);
            }
            await db.update('reports', report.id, {
              leads, notes: report.notes || '',
              packageLines: report.packageLines
            });
          } else {
            // Check duplicate date+cs+product+advertiser+channel
            const dup = await db.query('reports', {
              date: `eq.${report.date}`, cs: `eq.${report.cs}`,
              product: `eq.${report.product}`, advertiser: `eq.${report.advertiser}`,
              channel: `eq.${report.channel}`, select: 'id', limit: '1'
            });
            if (dup.length) return respond({ error: 'Laporan tanggal dan penugasan ini sudah tersedia.' }, 409);

            await db.insert('reports', {
              id: report.id,
              date: report.date,
              cs: report.cs,
              product: report.product,
              advertiser: report.advertiser,
              channel: report.channel,
              leads,
              notes: report.notes || '',
              packageLines: report.packageLines,
              originalPackageLines: report.originalPackageLines || report.packageLines,
              originalLeads: report.originalLeads ?? leads
            });
          }

          // Upsert lead report
          const countsObj = Object.fromEntries(LEAD_KEYS.map(k => [k, Number(counts[k])]));
          await db.upsert('leadReports', {
            id: report.id,
            reportId: report.id,
            counts: countsObj,
            notes: notes || ''
          }, 'reportId');

          return respond({ ok: true });
        }

        return respond({ error: 'Action tidak dikenal' }, 400);
      }

      return respond({ error: 'Method tidak didukung' }, 405);
    } catch (err) {
      return respond({ error: err.message || 'Internal error' }, 500);
    }
  };
}

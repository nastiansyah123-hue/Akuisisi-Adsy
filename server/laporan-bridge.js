// Laporan Bridge — connects CS Order (Supabase A), Adsy Autopilot (Supabase C)
// with Laporan Akuisisi (Supabase B). Auth verified via respective Supabase tokens.

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
    const q = new URLSearchParams({ aktif: 'eq.true', role: 'eq.cs', select: 'nama,email', order: 'nama.asc' });
    const res = await fetch(`${url}/rest/v1/cs_profiles?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// Fetch all active advertiser names from Autopilot Supabase (Supabase C)
async function fetchAdvList(env) {
  const url = (env.AUTOPILOT_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.AUTOPILOT_SUPABASE_SERVICE_KEY;
  if (!url || !key) return [];
  try {
    const q = new URLSearchParams({ status: 'eq.active', role: 'eq.advertiser', select: 'name,email', order: 'name.asc' });
    const res = await fetch(`${url}/rest/v1/profiles?${q}`, {
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

// Verify advertiser token against Autopilot Supabase (Supabase C)
async function verifyAdvertiserToken(env, token) {
  const url = (env.AUTOPILOT_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.AUTOPILOT_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (typeof user.id !== 'string') return null;
    const q = new URLSearchParams({ id: `eq.${user.id}`, select: 'name,email,role,status', limit: '1' });
    const pRes = await fetch(`${url}/rest/v1/profiles?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!pRes.ok) return null;
    const profiles = await pRes.json();
    const p = profiles[0];
    if (!p || p.status !== 'active') return null;
    if (!['advertiser', 'admin', 'superadmin'].includes(p.role)) return null;
    return { id: user.id, name: p.name, email: p.email, role: p.role };
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
          'Access-Control-Allow-Headers': 'Content-Type, X-CS-Token, X-Admin-Token, X-Advertiser-Token',
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
      try {
        const adminToken = request.headers.get('X-Admin-Token');
        if (!adminToken) return respond({ error: 'Admin token diperlukan' }, 401);
        const admin = await verifyAdminToken(env, adminToken);
        if (!admin) return respond({ error: 'Bukan admin atau token tidak valid' }, 403);
        const list = await fetchCSList(env);
        return respond({ csNames: list });
      } catch (err) {
        return respond({ error: err.message || 'Gagal memuat daftar CS' }, 500);
      }
    }

    if (action === 'adv-list') {
      try {
        const adminToken = request.headers.get('X-Admin-Token');
        if (!adminToken) return respond({ error: 'Admin token diperlukan' }, 401);
        const admin = await verifyAdminToken(env, adminToken);
        if (!admin) return respond({ error: 'Bukan admin atau token tidak valid' }, 403);
        const list = await fetchAdvList(env);
        return respond({ advNames: list });
      } catch (err) {
        return respond({ error: err.message || 'Gagal memuat daftar advertiser' }, 500);
      }
    }

    // ── Advertiser actions (auth via Autopilot Supabase C) ──
    const advToken = request.headers.get('X-Advertiser-Token');
    if (advToken) {
      const adv = await verifyAdvertiserToken(env, advToken);
      if (!adv) return respond({ error: 'Token advertiser tidak valid atau tidak aktif' }, 401);

      try {
        if (request.method === 'GET') {
          if (action === 'adv-init') {
            const start = reqUrl.searchParams.get('start');
            const end = reqUrl.searchParams.get('end');
            const [assignments, catalog, reports, ads] = await Promise.all([
              db.query('assignments', {
                advertiser: `eq.${adv.name}`, active: 'eq.true',
                select: 'id,cs,product,advertiser,channel'
              }),
              db.query('catalog', { select: 'id,name,unit,packages' }),
              start && end
                ? db.query('reports', {
                    advertiser: `eq.${adv.name}`, select: '*', order: 'date.desc',
                    and: `(date.gte.${start},date.lte.${end})`
                  })
                : db.query('reports', {
                    advertiser: `eq.${adv.name}`, select: '*', order: 'date.desc'
                  }),
              start && end
                ? db.query('ads', {
                    advertiser: `eq.${adv.name}`, select: '*', order: 'date.desc',
                    and: `(date.gte.${start},date.lte.${end})`
                  })
                : db.query('ads', {
                    advertiser: `eq.${adv.name}`, select: '*', order: 'date.desc'
                  })
            ]);
            const reportIds = reports.map(r => r.id);
            const leadReports = reportIds.length
              ? await db.query('leadReports', { reportId: `in.(${reportIds.join(',')})`, select: '*' })
              : [];
            return respond({ ok: true, advertiser: adv.name, email: adv.email, assignments, catalog, reports, leadReports, ads });
          }

          if (action === 'adv-reports') {
            const start = reqUrl.searchParams.get('start');
            const end = reqUrl.searchParams.get('end');
            const params = { advertiser: `eq.${adv.name}`, select: '*', order: 'date.desc' };
            if (start && end) params.and = `(date.gte.${start},date.lte.${end})`;
            const reports = await db.query('reports', params);
            const reportIds = reports.map(r => r.id);
            const leadReports = reportIds.length
              ? await db.query('leadReports', { reportId: `in.(${reportIds.join(',')})`, select: '*' })
              : [];
            return respond({ reports, leadReports });
          }

          if (action === 'adv-ads') {
            const start = reqUrl.searchParams.get('start');
            const end = reqUrl.searchParams.get('end');
            const params = { advertiser: `eq.${adv.name}`, select: '*', order: 'date.desc' };
            if (start && end) params.and = `(date.gte.${start},date.lte.${end})`;
            const ads = await db.query('ads', params);
            return respond({ ads });
          }

          return respond({ error: 'Action tidak dikenal' }, 400);
        }

        if (request.method === 'POST') {
          const body = await request.json();

          if (action === 'save-ads') {
            const { ad } = body;
            if (!ad) return respond({ error: 'Data biaya iklan diperlukan' }, 400);
            if (!ad.date || !ad.product || !ad.channel) {
              return respond({ error: 'Lengkapi tanggal, produk, dan channel.' }, 400);
            }
            const budget = Number(ad.budget);
            const tax = Number(ad.tax ?? 11);
            if (!Number.isFinite(budget) || budget < 0) {
              return respond({ error: 'Biaya iklan harus nol atau lebih.' }, 400);
            }
            if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
              return respond({ error: 'Pajak harus antara 0 dan 100 persen.' }, 400);
            }
            if (!['Web', 'CTWA'].includes(ad.channel)) {
              return respond({ error: 'Channel harus Web atau CTWA.' }, 400);
            }
            // Verify assignment exists
            const assign = await db.query('assignments', {
              product: `eq.${ad.product}`, advertiser: `eq.${adv.name}`,
              channel: `eq.${ad.channel}`, active: 'eq.true',
              select: 'id', limit: '1'
            });
            if (!assign.length) return respond({ error: 'Tidak ada penugasan aktif untuk kombinasi ini.' }, 400);

            await db.upsert('ads', {
              id: ad.id || crypto.randomUUID(),
              date: ad.date,
              product: ad.product,
              advertiser: adv.name,
              channel: ad.channel,
              budget,
              tax
            }, 'date,product,advertiser,channel');

            return respond({ ok: true });
          }

          return respond({ error: 'Action tidak dikenal' }, 400);
        }

        return respond({ error: 'Method tidak didukung' }, 405);
      } catch (err) {
        return respond({ error: err.message || 'Internal error' }, 500);
      }
    }

    // ── CS actions (auth via csorder Supabase) ──
    const token = request.headers.get('X-CS-Token');
    if (!token) return respond({ error: 'Token diperlukan' }, 401);

    const cs = await verifyCSToken(env, token);
    if (!cs) return respond({ error: 'Token tidak valid atau CS tidak aktif' }, 401);

    try {
      // ── GET actions ──
      if (request.method === 'GET') {
        if (action === 'init') {
          // Combined verify + catalog + reports in one request (reduces cold starts)
          const start = reqUrl.searchParams.get('start');
          const end = reqUrl.searchParams.get('end');
          const [assignments, catalog, reports] = await Promise.all([
            db.query('assignments', {
              cs: `eq.${cs.nama}`, active: 'eq.true',
              select: 'id,cs,product,advertiser,channel'
            }),
            db.query('catalog', { select: 'id,name,unit,packages' }),
            start && end
              ? db.query('reports', {
                  cs: `eq.${cs.nama}`, select: '*', order: 'date.desc',
                  and: `(date.gte.${start},date.lte.${end})`
                })
              : db.query('reports', {
                  cs: `eq.${cs.nama}`, select: '*', order: 'date.desc'
                })
          ]);
          const reportIds = reports.map(r => r.id);
          const leadReports = reportIds.length
            ? await db.query('leadReports', { reportId: `in.(${reportIds.join(',')})`, select: '*' })
            : [];
          return respond({ ok: true, cs: cs.nama, email: cs.email, assignments, catalog, reports, leadReports });
        }

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
          const start = reqUrl.searchParams.get('start');
          const end = reqUrl.searchParams.get('end');
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
          const start = reqUrl.searchParams.get('start');
          const end = reqUrl.searchParams.get('end');
          const product = reqUrl.searchParams.get('product');
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

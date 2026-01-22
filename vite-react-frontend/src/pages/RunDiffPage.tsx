import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { diffRuns, listRuns, type RunDiffResponse, type RunListItem } from '../api/simulation';

const fmt = (v: any): string => {
  if (v === null || v === undefined) return '';
  return String(v);
};

const RunDiffPage: React.FC = () => {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');

  const [diff, setDiff] = useState<RunDiffResponse | null>(null);
  const [diffErr, setDiffErr] = useState<string | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadErr(null);
    listRuns(50)
      .then((data) => {
        if (!alive) return;
        setRuns(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadErr(e?.message ?? 'Failed to load runs');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, RunListItem>();
    for (const r of runs) {
      if (r?.id) m.set(r.id, r);
    }
    return m;
  }, [runs]);

  const aInfo = aId ? byId.get(aId) : undefined;
  const bInfo = bId ? byId.get(bId) : undefined;

  const canDiff = aId && bId && aId !== bId && !diffBusy;

  const attributionLine = (d: RunDiffResponse | null): string | null => {
    const s = d?.attribution?.summary;
    return s ? String(s) : null;
  };

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Diff runs</h2>
        <Link to="/simulation" style={{ textDecoration: 'none' }}>← Back</Link>
      </div>

      <p style={{ opacity: 0.85, marginTop: 8 }}>
        Pick two completed (persisted) runs. The diff attributes output differences to <strong>inputs</strong>,
        <strong> model version</strong>, and/or <strong>randomness</strong>.
      </p>

      <div style={{
        border: '1px solid #444', borderRadius: 12, padding: 12,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Run A</div>
          <select
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
            disabled={loading}
          >
            <option value="">Select…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} {r.createdAt ? `(${r.createdAt})` : ''}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            Version: {fmt(aInfo?.modelAppVersion) || 'unknown'}
            <br />
            Seed: {aInfo?.rngSeed ?? '—'}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Run B</div>
          <select
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
            disabled={loading}
          >
            <option value="">Select…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} {r.createdAt ? `(${r.createdAt})` : ''}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            Version: {fmt(bInfo?.modelAppVersion) || 'unknown'}
            <br />
            Seed: {bInfo?.rngSeed ?? '—'}
          </div>
        </div>
      </div>

      {loadErr && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #ff6b6b55', background: 'rgba(255,107,107,0.10)' }}>
          {loadErr}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <button
          type="button"
          disabled={!canDiff}
          onClick={async () => {
            setDiffErr(null);
            setDiff(null);
            setDiffBusy(true);
            try {
              const d = await diffRuns(aId, bId);
              setDiff(d);
            } catch (e: any) {
              setDiffErr(e?.message ?? 'Diff failed');
            } finally {
              setDiffBusy(false);
            }
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #444',
            cursor: canDiff ? 'pointer' : 'not-allowed',
            opacity: canDiff ? 1 : 0.6,
          }}
        >
          {diffBusy ? 'Diffing…' : 'Diff'}
        </button>
        {aId && bId && aId === bId && (
          <div style={{ fontSize: 13, opacity: 0.85 }}>Select two different runs.</div>
        )}
      </div>

      {diffErr && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #ff6b6b55', background: 'rgba(255,107,107,0.10)' }}>
          {diffErr}
        </div>
      )}

      {diff && (
        <div style={{ marginTop: 12, border: '1px solid #444', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Attribution</div>
          <div style={{ marginBottom: 10 }}>
            {attributionLine(diff) ?? 'No attribution summary.'}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13, opacity: 0.9 }}>
            <span>inputsChanged: {String(Boolean(diff.attribution?.inputsChanged))}</span>
            <span>randomnessChanged: {String(Boolean(diff.attribution?.randomnessChanged))}</span>
            <span>modelVersionChanged: {String(Boolean(diff.attribution?.modelVersionChanged))}</span>
          </div>

          <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #444' }} />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Outputs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>exactMatch</div>
              <div style={{ fontWeight: 700 }}>{String(Boolean(diff.output?.exactMatch))}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>withinTolerance</div>
              <div style={{ fontWeight: 700 }}>{String(Boolean(diff.output?.withinTolerance))}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>mismatches</div>
              <div style={{ fontWeight: 700 }}>{fmt(diff.output?.mismatches) || '0'}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>max |Δ|</div>
              <div style={{ fontWeight: 700 }}>{fmt(diff.output?.maxAbsDiff) || '0'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunDiffPage;

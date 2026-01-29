// src/components/SimulationProgress.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { YearlySummary } from "../models/YearlySummary";
import { getApiBaseUrl } from "../config/runtimeEnv";

type SimulationMeta = {
  dedupHit?: boolean;
  source?: "db" | "cache" | string;
  persisted?: boolean;
  effectiveRuns?: number;
  effectiveBatchSize?: number;
  queueMs?: number;
  computeMs?: number;
  aggregateMs?: number;
  persistMs?: number;
  totalMs?: number;
};

const formatSeconds2 = (ms?: number) => {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return `${(ms / 1000).toFixed(2)} s`;
};

const shouldShowOptionalStage = (ms?: number) => {
  if (ms == null || !Number.isFinite(ms)) return false;
  return ms >= 10; // >= 0.01s
};

interface SimulationProgressProps {
  simulationId: string;
  onComplete: (result: YearlySummary[]) => void;
  /** 'auto' (default) respects document dark class or prefers-color-scheme */
  theme?: "auto" | "light" | "dark";
}

const API_BASE = getApiBaseUrl();

const SimulationProgress: React.FC<SimulationProgressProps> = ({
  simulationId,
  onComplete,
  theme = "auto",
}) => {
  const [status, setStatus] = useState<"open" | "queued" | "running" | "done" | "error">("open");
  const [queuePos0, setQueuePos0] = useState<number | null>(null); // 0 = next in line (from server)
  const [runsPct, setRunsPct] = useState<number>(0);
  const [summariesPct, setSummariesPct] = useState<number>(0);
  const [headline, setHeadline] = useState<string>("Waiting for updates…");
  const [meta, setMeta] = useState<SimulationMeta | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completedPanelOpen, setCompletedPanelOpen] = useState(true);
  const esRef = useRef<EventSource | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    setCompletedPanelOpen(true);
    setDetailsOpen(false);
  }, [simulationId]);

  useEffect(() => {
    if (status === "done") setCompletedPanelOpen(false);
  }, [status]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // ---------- Theme detection ----------
  const [prefersDark, setPrefersDark] = useState<boolean>(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const documentDark =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") ||
      document.body.classList.contains("dark"));

  const isDark = useMemo(() => {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return documentDark || prefersDark;
  }, [theme, documentDark, prefersDark]);

  // Palette (overrideable via CSS variables if you want later)
  const colors = useMemo(() => {
    const varOr = (name: string, fallback: string) => {
      if (typeof window === "undefined") return fallback;
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    };
    const baseText = isDark ? "#e5e7eb" : "#111827";
    const subText = isDark ? "#9ca3af" : "#4b5563";
    const cardBg = isDark ? "#111827" : "#ffffff";
    const border = isDark ? "#1f2937" : "#e5e7eb";
    const shadow = isDark ? "0 1px 2px rgba(0,0,0,0.5)" : "0 1px 2px rgba(0,0,0,0.04)";
    return {
      text: varOr("--sp-text", baseText),
      subtext: varOr("--sp-subtext", subText),
      cardBg: varOr("--sp-card-bg", cardBg),
      border: varOr("--sp-border", border),
      shadow,
      track: varOr("--sp-track", isDark ? "#1f2937" : "#f3f4f6"),
      runsBar: varOr("--sp-runs", isDark ? "#60a5fa" : "#3b82f6"),
      summariesBar: varOr("--sp-summaries", isDark ? "#34d399" : "#10b981"),
      queuedBadge: varOr("--sp-badge-queued", "#f59e0b"),
      runningBadge: varOr("--sp-badge-running", isDark ? "#60a5fa" : "#3b82f6"),
      doneBadge: varOr("--sp-badge-done", "#10b981"),
      errorBadge: varOr("--sp-badge-error", "#ef4444"),
      neutralBadge: varOr("--sp-badge-neutral", "#6b7280"),
    };
  }, [isDark]);

  const badgeBg =
    status === "queued"
      ? colors.queuedBadge
      : status === "running"
      ? colors.runningBadge
      : status === "done"
      ? colors.doneBadge
      : status === "error"
      ? colors.errorBadge
      : colors.neutralBadge;

  // ---------- SSE wiring ----------
  useEffect(() => {
    const url = `${API_BASE}/progress/${simulationId}`;
    const es = new EventSource(url, { withCredentials: false });
    esRef.current = es;

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try {
        es.close();
      } catch {
        // ignore
      }
    };

    const setMessage = (m: string) => setHeadline(m.trim());

    es.addEventListener("open", (ev) => {
      setStatus("open");
      setMessage(`[open] ${(ev as MessageEvent).data ?? "connected"}`);
    });

    es.addEventListener("queued", (ev) => {
      setStatus("queued");
      const raw = String((ev as MessageEvent).data ?? "").trim();
      const m = raw.match(/^position:(\d+)$/);
      if (m) {
        const pos0 = Number(m[1]); // 0-based from server
        setQueuePos0(Number.isFinite(pos0) ? pos0 : null);
        setMessage(pos0 === 0 ? "Queued — you’re next in line" : `Queued — position ${pos0 + 1}`);
      } else {
        setQueuePos0(null);
        setMessage("Queued");
      }
    });

    es.addEventListener("started", () => {
      setStatus("running");
      setQueuePos0(null);
      setMessage("Started");
    });

    es.addEventListener("heartbeat", () => { /* keep-alive, no UI noise */ });

    es.addEventListener("progress", (ev) => {
      setStatus("running");
      const msg = String((ev as MessageEvent).data ?? "").trim();
      if (!msg) return;

      // Completed X/Y runs
      const mRuns = msg.match(/^Completed\s+([\d,]+)\/([\d,]+)\s+runs/i);
      if (mRuns) {
        const done = Number(mRuns[1].replace(/,/g, ""));
        const total = Number(mRuns[2].replace(/,/g, ""));
        if (Number.isFinite(done) && Number.isFinite(total) && total > 0) {
          setRunsPct(Math.min(100, Math.round((done / total) * 100)));
          setMessage(`Runs: ${done.toLocaleString()} / ${total.toLocaleString()}`);
        }
        return;
      }

      // Calculate A/B summaries …
      const mSum = msg.match(/^Calculate\s+(\d+)\/(\+?\d+)\s+summaries/i) || msg.match(/^Calculate\s+(\d+)\/(\d+)\s+summaries/i);
      if (mSum) {
        setRunsPct(100); // snap runs to full when summaries phase starts
        const a = Number(mSum[1]);
        const b = Number(mSum[2]);
        if (Number.isFinite(a) && Number.isFinite(b) && b > 0) {
          setSummariesPct(Math.min(100, Math.round((a / b) * 100)));
          setMessage(`Summaries: ${a.toLocaleString()} / ${b.toLocaleString()}`);
        } else {
          setMessage(msg);
        }
        return;
      }

      // Fallback: show text
      setMessage(msg);
    });

    es.addEventListener("meta", (ev) => {
      if (closed) return;
      try {
        const payload = JSON.parse(String((ev as MessageEvent).data ?? "null")) as SimulationMeta;
        if (payload && typeof payload === "object") {
          setMeta((prev) => ({ ...prev, ...payload }));
        }
      } catch {
        // best-effort
      }
    });

    es.addEventListener("completed", (ev) => {
      if (closed) return;
      try {
        const payload = JSON.parse(String((ev as MessageEvent).data ?? "null")) as YearlySummary[];
        setStatus("done");
        setRunsPct(100);
        setSummariesPct(100);
        setMessage("Completed");
        onCompleteRef.current(payload);
      } catch (e) {
        setStatus("error");
        setMessage("Error parsing final results");
        console.error(e);
      } finally {
        close();
      }
    });

    // unnamed fallback
    es.onmessage = (event) => {
      if (closed) return;
      const trimmed = String(event.data ?? "").trim();
      if (!trimmed) return;
      if (trimmed.startsWith("[")) {
        try {
          onCompleteRef.current(JSON.parse(trimmed));
        } finally {
          close();
        }
      } else {
        setMessage(trimmed);
      }
    };

    es.onerror = (err) => {
      if (closed) return;
      setStatus("error");
      setMessage("SSE connection error");
      console.error("SSE error", err);
      close();
    };

    return () => close();
  }, [simulationId]);

  useEffect(() => {
    if (!detailsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsOpen]);

  const timingRows = useMemo(() => {
    if (!meta) return [] as Array<{ label: string; ms?: number }>;

    const knownKeys = new Set([
      "queueMs",
      "computeMs",
      "aggregateMs",
      "persistMs",
      "totalMs",
    ]);

    const humanize = (k: string) => {
      const base = k.replace(/Ms$/, "");
      const spaced = base.replace(/([a-z])([A-Z])/g, "$1 $2");
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    };

    const rows: Array<{ label: string; ms?: number; always?: boolean }> = [
      { label: "Queue", ms: meta.queueMs, always: true },
      { label: "Running", ms: meta.computeMs, always: true },
      { label: "Aggregation", ms: meta.aggregateMs, always: true },
      { label: "Persist", ms: meta.persistMs, always: false },
    ];

    const extra = Object.entries(meta as Record<string, unknown>)
      .filter(([k]) => k.endsWith("Ms") && !knownKeys.has(k))
      .map(([k, v]) => ({ key: k, ms: typeof v === "number" ? v : undefined }))
      .filter((r) => shouldShowOptionalStage(r.ms))
      .map((r) => ({ label: humanize(r.key), ms: r.ms, always: false }));

    rows.push(...extra);
    rows.push({ label: "Total", ms: meta.totalMs, always: true });

    return rows.filter((r) => r.always || shouldShowOptionalStage(r.ms)).map(({ label, ms }) => ({ label, ms }));
  }, [meta]);

  const showRunDetails = status === "done" || detailsOpen;

  const headerEl = (opts?: { withinSummary?: boolean }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 10,
        marginBottom: opts?.withinSummary ? 0 : 8,
        width: "100%",
        maxWidth: 520,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: "white",
            background: badgeBg,
          }}
        >
          {status.toUpperCase()}
        </span>

        {status === "done" ? <span style={{ fontSize: 13, color: colors.subtext }}>Completed</span> : null}

        {status === "queued" && (
          <span style={{ fontSize: 13, color: colors.subtext }}>
            {queuePos0 != null
              ? queuePos0 === 0
                ? "You’re next in line"
                : `Queue position: ${queuePos0 + 1}`
              : "Queued"}
          </span>
        )}
      </div>
    </div>
  );

  const cardEl = (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: 12,
        background: colors.cardBg,
        boxShadow: colors.shadow,
        width: "100%",
        maxWidth: 520,
      }}
    >
        {/* Single-line (fixed height) headline; replaces content instead of appending */}
        <div
          style={{
            minHeight: 24,
            color: colors.text,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 13,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={headline}
        >
          {headline}
        </div>

        {/* Progress bars */}
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Runs */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: colors.subtext,
                marginBottom: 4,
              }}
            >
              <span>Runs</span>
              <span style={{ color: colors.text }}>{runsPct}%</span>
            </div>
            <div
              style={{
                height: 10,
                background: colors.track,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${runsPct}%`,
                  height: "100%",
                  transition: "width 280ms linear",
                  background: colors.runsBar,
                }}
              />
            </div>
          </div>

          {/* Summaries */}
          {summariesPct > 0 || runsPct === 100 ? (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: colors.subtext,
                  marginBottom: 4,
                }}
              >
                <span>Summaries</span>
                <span style={{ color: colors.text }}>{summariesPct}%</span>
              </div>
              <div
                style={{
                  height: 10,
                  background: colors.track,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${summariesPct}%`,
                    height: "100%",
                    transition: "width 280ms linear",
                    background: colors.summariesBar,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Meta summary + details button */}
        {meta ? (
          <div style={{ marginTop: 12, fontSize: 12, color: colors.subtext }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>
                {meta.dedupHit === true
                  ? `Dedup hit${meta.source ? ` (${meta.source})` : ""}`
                  : meta.dedupHit === false
                  ? "New run"
                  : "Run info"}
              </span>
              {status !== "done" ? (
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  style={{
                    border: `1px solid ${colors.border}`,
                    background: colors.track,
                    color: colors.text,
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  aria-expanded={detailsOpen}
                  aria-label={detailsOpen ? "Hide run details" : "Show run details"}
                >
                  Details {detailsOpen ? "▴" : "▾"}
                </button>
              ) : null}
            </div>

            {meta.persisted != null ? (
              <div style={{ marginTop: 4 }}>Persisted: {meta.persisted ? "yes" : "no"}</div>
            ) : null}

            {meta.effectiveRuns != null || meta.effectiveBatchSize != null ? (
              <div style={{ marginTop: 4 }}>
                Effective: {meta.effectiveRuns ?? "?"} runs, batch {meta.effectiveBatchSize ?? "?"}
              </div>
            ) : null}

            {showRunDetails ? (
              <div
                role="region"
                aria-label="Run details"
                style={{
                  marginTop: 8,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 10,
                  background: colors.cardBg,
                  color: colors.text,
                }}
              >
                <div style={{ fontSize: 12, color: colors.subtext, display: "grid", rowGap: 4 }}>
                  <div>Dedup: {meta.dedupHit === true ? "hit" : meta.dedupHit === false ? "miss" : "—"}</div>
                  {meta.source ? <div>Source: {meta.source}</div> : null}
                  {meta.persisted != null ? <div>Persisted: {meta.persisted ? "yes" : "no"}</div> : null}
                  {meta.effectiveRuns != null ? <div>Effective runs: {meta.effectiveRuns}</div> : null}
                  {meta.effectiveBatchSize != null ? <div>Effective batch size: {meta.effectiveBatchSize}</div> : null}
                </div>

                {timingRows.length ? (
                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      rowGap: 6,
                      columnGap: 12,
                      fontSize: 12,
                    }}
                  >
                    {timingRows.map((r) => (
                      <React.Fragment key={r.label}>
                        <div style={{ color: colors.subtext }}>{r.label}</div>
                        <div style={{ color: colors.text, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
                          {formatSeconds2(r.ms)}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
    </div>
  );

  return (
    <div style={{ marginTop: "1rem" }}>
      {status === "done" ? (
        <>
          <style>{`
            details.sp-completed-panel {
              width: 100%;
              max-width: 520px;
            }
            details.sp-completed-panel > summary {
              list-style: none;
              cursor: pointer;
              padding: 0;
              margin: 0;
              display: flex;
              align-items: center;
              white-space: nowrap;
            }
            details.sp-completed-panel > summary > * {
              min-width: 0;
              flex: 1 1 auto;
            }
            details.sp-completed-panel > summary::-webkit-details-marker {
              display: none;
            }
            details.sp-completed-panel > summary::after {
              content: '▸';
              opacity: 0.8;
              margin-left: auto;
              transform: rotate(0deg);
              transition: transform 140ms ease-out;
            }
            details.sp-completed-panel[open] > summary::after {
              transform: rotate(90deg);
            }
          `}</style>

          <details
            className="sp-completed-panel"
            open={completedPanelOpen}
            onToggle={(e) => setCompletedPanelOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>{headerEl({ withinSummary: true })}</summary>
            <div style={{ marginTop: 8 }}>{cardEl}</div>
          </details>
        </>
      ) : (
        <>
          {headerEl()}
          {cardEl}
        </>
      )}
    </div>
  );
};

export default SimulationProgress;

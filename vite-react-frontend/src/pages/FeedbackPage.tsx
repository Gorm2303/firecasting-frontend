import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import { getOrCreateLocalUserId } from '../state/localUserId';

type PaymentModelId = 'subscription' | 'freemium' | 'usage' | 'lifetime';

type PaymentModel = {
  id: PaymentModelId;
  title: string;
  tagline: string;
  personalTiers?: { name: string; bullets: string[] }[];
  businessTiers?: { name: string; bullets: string[] }[];
  notes?: string[];
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 14,
};

const models: PaymentModel[] = [
  {
    id: 'subscription',
    title: 'Subscription (monthly/annual)',
    tagline: 'Predictable cost, continuous improvements.',
    personalTiers: [
      { name: 'Personal Basic', bullets: ['Core FIRE simulator', 'Core dashboards (skeleton)', 'Local-only storage'] },
      { name: 'Personal Pro', bullets: ['Advanced planning modules (skeleton)', 'Scenario library sync (placeholder)', 'Priority support (placeholder)'] },
    ],
    businessTiers: [
      { name: 'Business Team', bullets: ['Multiple seats (placeholder)', 'Shared scenarios (placeholder)', 'Team permissions (placeholder)'] },
      { name: 'Business Enterprise', bullets: ['SSO (placeholder)', 'Audit logs (placeholder)', 'Custom contracts (placeholder)'] },
    ],
    notes: ['Good for ongoing R&D and frequent releases.'],
  },
  {
    id: 'freemium',
    title: 'Freemium + Pro',
    tagline: 'Free core experience, pay for power features.',
    personalTiers: [
      { name: 'Free', bullets: ['Limited scenarios (placeholder)', 'Core calculators', 'Basic exports (placeholder)'] },
      { name: 'Pro', bullets: ['Unlimited scenarios (placeholder)', 'Advanced simulation tools (placeholder)', 'Deep reports (placeholder)'] },
    ],
    businessTiers: [
      { name: 'Team Pro', bullets: ['Seats + shared workspaces (placeholder)', 'Permissioned sharing (placeholder)'] },
      { name: 'Enterprise', bullets: ['Compliance controls (placeholder)', 'SSO + SCIM (placeholder)'] },
    ],
    notes: ['Best when you want maximum accessibility and word-of-mouth.'],
  },
  {
    id: 'usage',
    title: 'Pay-as-you-go (usage based)',
    tagline: 'Pay for what you simulate or compute.',
    personalTiers: [
      { name: 'Personal', bullets: ['Free monthly quota (placeholder)', 'Pay per heavy simulation run (placeholder)'] },
    ],
    businessTiers: [
      { name: 'Business', bullets: ['Shared quota pool (placeholder)', 'Spend caps (placeholder)', 'Usage reporting (placeholder)'] },
    ],
    notes: ['Transparent for power users; can feel unpredictable without caps.'],
  },
  {
    id: 'lifetime',
    title: 'One-time purchase (lifetime license)',
    tagline: 'Pay once, own it (with optional upgrades).',
    personalTiers: [
      { name: 'Lifetime', bullets: ['Access to current major version', 'Local-first model'] },
    ],
    businessTiers: [
      { name: 'Business License', bullets: ['Seat-based licensing (placeholder)', 'Optional maintenance plan (placeholder)'] },
    ],
    notes: ['Simple and trust-building; funding ongoing work can be harder.'],
  },
];

const FeedbackPage: React.FC = () => {
  const userId = useMemo(() => getOrCreateLocalUserId(), []);
  const voteKey = useMemo(() => `firecasting:feedback:paymentVote:v1:${userId}`, [userId]);

  const [vote, setVote] = useState<PaymentModelId | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(voteKey);
      return (raw as PaymentModelId | null) ?? null;
    } catch {
      /* ignore */
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!vote) return;
    try {
      window.localStorage.setItem(voteKey, vote);
    } catch {
      /* ignore */
    }
  }, [vote, voteKey]);

  const onVote = (id: PaymentModelId) => {
    setVote(id);
  };

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Feedback</h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            Vote on the future payment model for Firecasting.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 6 }}>Payment model vote</div>
          <div style={{ opacity: 0.85 }}>
            {vote ? (
              <>Your vote is recorded. You can switch to a different option at any time.</>
            ) : (
              <>Choose one option below. This is limited to one vote per user (currently enforced locally in your browser).</>
            )}
          </div>

          {vote && (
            <div style={{ marginTop: 10, fontWeight: 800 }}>
              You voted for: {models.find((m) => m.id === vote)?.title ?? vote}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {models.map((m) => (
            <details key={m.id} style={cardStyle}>
              <summary style={{ cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>
                <span>{m.title}</span>
                <span style={{ display: 'block', opacity: 0.78, fontWeight: 600, marginTop: 4 }}>{m.tagline}</span>
              </summary>

              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>How it would work</div>
                  <button
                    type="button"
                    onClick={() => onVote(m.id)}
                    disabled={vote === m.id}
                    style={{ padding: '8px 10px' }}
                    aria-disabled={vote === m.id}
                  >
                    {vote === m.id ? 'Voted' : vote ? 'Switch vote' : 'Vote'}
                  </button>
                </div>

                {(m.personalTiers?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Personal tiers</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {m.personalTiers!.map((t) => (
                        <div key={t.name} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--fc-card-border)' }}>
                          <div style={{ fontWeight: 850 }}>{t.name}</div>
                          <ul style={{ margin: '6px 0 0', paddingLeft: 18, opacity: 0.92 }}>
                            {t.bullets.map((b, idx) => (
                              <li key={idx}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(m.businessTiers?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Business tiers</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {m.businessTiers!.map((t) => (
                        <div key={t.name} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--fc-card-border)' }}>
                          <div style={{ fontWeight: 850 }}>{t.name}</div>
                          <ul style={{ margin: '6px 0 0', paddingLeft: 18, opacity: 0.92 }}>
                            {t.bullets.map((b, idx) => (
                              <li key={idx}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(m.notes?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Notes</div>
                    <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.92 }}>
                      {m.notes!.map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

export default FeedbackPage;

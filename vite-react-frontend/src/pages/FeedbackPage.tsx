import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import { getOrCreateLocalUserId } from '../state/localUserId';
import { Button, Card, PageHeader } from '../components/ui';

type PaymentModelId = 'subscription' | 'freemium' | 'usage' | 'lifetime';

type PaymentModel = {
  id: PaymentModelId;
  title: string;
  tagline: string;
  personalTiers?: { name: string; bullets: string[] }[];
  businessTiers?: { name: string; bullets: string[] }[];
  notes?: string[];
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

const tierCardClass = 'rounded-xl border border-card-border p-3';

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
      <div className="flex flex-col gap-3">
        <PageHeader title="Feedback" subtitle="Vote on the future payment model for Firecasting." />

        <Card>
          <div className="mb-1.5 text-lg font-extrabold">Payment model vote</div>
          <div className="opacity-85">
            {vote ? (
              <>Your vote is recorded. You can switch to a different option at any time.</>
            ) : (
              <>Choose one option below. This is limited to one vote per user (currently enforced locally in your browser).</>
            )}
          </div>

          {vote && (
            <div className="mt-2.5 font-extrabold">
              You voted for: {models.find((m) => m.id === vote)?.title ?? vote}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          {models.map((m) => (
            <details key={m.id} className="rounded-xl border border-card-border bg-card p-3.5 text-card-fg">
              <summary className="cursor-pointer text-base font-black">
                <span>{m.title}</span>
                <span className="mt-1 block font-semibold opacity-80">{m.tagline}</span>
              </summary>

              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="font-extrabold">How it would work</div>
                  <Button variant="secondary" onClick={() => onVote(m.id)} disabled={vote === m.id} aria-disabled={vote === m.id}>
                    {vote === m.id ? 'Voted' : vote ? 'Switch vote' : 'Vote'}
                  </Button>
                </div>

                {(m.personalTiers?.length ?? 0) > 0 && (
                  <div>
                    <div className="mb-1.5 font-extrabold">Personal tiers</div>
                    <div className="flex flex-col gap-2.5">
                      {m.personalTiers!.map((t) => (
                        <div key={t.name} className={tierCardClass}>
                          <div className="font-extrabold">{t.name}</div>
                          <ul className="m-0 mt-1.5 list-disc pl-4.5 opacity-90">
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
                    <div className="mb-1.5 font-extrabold">Business tiers</div>
                    <div className="flex flex-col gap-2.5">
                      {m.businessTiers!.map((t) => (
                        <div key={t.name} className={tierCardClass}>
                          <div className="font-extrabold">{t.name}</div>
                          <ul className="m-0 mt-1.5 list-disc pl-4.5 opacity-90">
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
                    <div className="mb-1.5 font-extrabold">Notes</div>
                    <ul className="m-0 list-disc pl-4.5 opacity-90">
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

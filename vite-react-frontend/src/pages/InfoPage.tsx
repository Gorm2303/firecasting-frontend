// src/pages/InfoPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import DisclaimerSection from '../pages/DisclaimerSection';

type HeadingItem = { id: string; text: string };

const InfoPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  // Ensure smooth scrolling globally for this page
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = prev || '';
    };
  }, []);

  // Collect <h2> inside the page root, assign ids if missing (slugify)
  useEffect(() => {
    const root = document.getElementById('info-root');
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll('h2')) as HTMLHeadingElement[];

    const slugCounts = new Map<string, number>();
    const toSlug = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    const items: HeadingItem[] = nodes.map((h) => {
      if (!h.id) {
        let base = toSlug(h.textContent || 'section');
        if (!base) base = 'section';
        // disambiguate duplicates
        const count = (slugCounts.get(base) ?? 0) + 1;
        slugCounts.set(base, count);
        const id = count > 1 ? `${base}-${count}` : base;
        h.id = id;
      }
      return { id: h.id, text: h.textContent || h.id };
    });
    setHeadings(items);
  }, []);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onNavigate = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.focus?.();
      // scrollIntoView is smooth via page-level style above
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // update hash without adding history entries
      history.replaceState(null, '', `#${id}`);
    }
  };

  const hasMenu = useMemo(() => headings.length > 0, [headings]);

  return (
    <>
      {/* Page-scoped styles for the burger + drawer (light/dark via media queries) */}
      <style>{`
        .info-burger-btn {
          position: fixed; right: max(16px, calc((100vw - 1500px) / 2 + 16px));
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 12px; border-radius: 10px; cursor: pointer;
          border: 1px solid #444; background: #2e2e2e; color: #eee;
        }
        .info-burger-btn:hover { border-color: #646cff; filter: brightness(1.05); }

        .info-drawer-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 1090;
        }
        .info-drawer {
          position: fixed; top: 0;
          right: max(0px, calc((100vw - 1500px) / 2));
          height: 100%; width: min(84vw, 340px);
          z-index: 1100; padding: 16px; display: flex; flex-direction: column; gap: 12px;
          border-left: 1px solid #3a3a3a; background: #1f1f1f; color: #eee;
          transform: translateX(0); transition: transform 180ms ease-out;
        }
        .info-drawer header { display: flex; justify-content: space-between; align-items: center; }
        .info-drawer h3 { margin: 0; font-size: 1rem; }
        .info-drawer .info-list { margin: 4px 0 0; padding: 0; list-style: none; overflow: auto; }
        .info-drawer .info-item-btn {
          width: 100%; text-align: left; border: 1px solid transparent; padding: 8px 10px;
          border-radius: 8px; background: transparent; color: inherit; cursor: pointer;
        }
        .info-drawer .info-item-btn:hover { border-color: #646cff; }

        .info-close-btn {
          border: 1px solid #444; background: transparent; color: inherit;
          padding: 6px 10px; border-radius: 8px; cursor: pointer;
        }
        .info-close-btn:hover { border-color: #646cff; }

        /* Focus ring */
        .info-item-btn:focus, .info-close-btn:focus, .info-burger-btn:focus {
          outline: 4px auto -webkit-focus-ring-color;
        }

        /* Light mode overrides (aligns with your existing CSS) */
        @media (prefers-color-scheme: light) {
          .info-burger-btn {
            border-color: #e5e7eb; background: #ffffff; color: #213547;
          }
          .info-drawer {
            border-left-color: #e5e7eb; background: #ffffff; color: #213547;
          }
          .info-close-btn { border-color: #e5e7eb; }
        }
      `}</style>

      <div id="info-root" style={{ minHeight: '100vh', padding: 16, maxWidth: 980, margin: '0 auto' }}>
      {/* Burger button */}
      {hasMenu && (
        <button
          className="info-burger-btn"
          aria-label="Open section menu"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          ☰ <span style={{ fontSize: 14 }}>Sections</span>
        </button>
      )}

      {/* Drawer + backdrop */}
      {open && (
        <>
          <div className="info-drawer-backdrop" onClick={() => setOpen(false)} />
          <aside className="info-drawer" role="dialog" aria-modal="true" aria-label="Section navigation">
            <header>
              <h3>Jump to…</h3>
              <button className="info-close-btn" onClick={() => setOpen(false)} aria-label="Close menu">
                Close
              </button>
            </header>
            <ul className="info-list">
              {headings.map((h) => (
                <li key={h.id} style={{ marginBottom: 4 }}>
                  <button className="info-item-btn" onClick={() => onNavigate(h.id)}>
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}

      {/* Content */}
        <section>
          <h2 tabIndex={-1}>About Firecasting</h2>
          <p>Short overview of the project, goals, and how simulations are computed.</p>
        </section>

        <section>
          <h2 tabIndex={-1}>Monte Carlo Simulation</h2>
          <p>Monte Carlo simulations use random sampling and statistical modeling to estimate mathematical functions and mimic the operation of complex systems. In the context of financial independence, these simulations can help predict the likelihood of achieving specific financial goals by running thousands of scenarios based on varying inputs and assumptions.</p>
        </section>

        <section>
          <h2 tabIndex={-1}>Simulation Phases</h2>
          <p>Overview of the different phases involved in the simulation process.</p>
        </section>

        <section>
          <h2 tabIndex={-1}>Tax Handling</h2>
          <p>Overview of how taxes are calculated and applied in simulations.</p>
        </section>

        <section>
          <h2 tabIndex={-1}>Inflation Handling</h2>
          <p>Overview of how inflation is calculated and applied in simulations.</p>
        </section>

        <section>
          <h2 tabIndex={-1}>Assumptions and Limitations</h2>
          <p>
            This simulator is intentionally opinionated and simplified. The goal is to be useful for planning and exploring
            tradeoffs, not to perfectly model every detail of a real brokerage account.
          </p>

          <details open>
            <summary><strong>Returns (market model)</strong></summary>
            <p>
              Normal mode uses a data-driven return model based on historical DJIA prices. The engine samples returns over time
              rather than using a single fixed annual rate.
            </p>
            <p>
              Limitation: past returns do not guarantee future performance; the model does not guarantee “regime changes” match
              reality.
            </p>
          </details>

          <details>
            <summary><strong>Inflation</strong></summary>
            <p>
              Normal mode currently assumes a fixed yearly inflation factor of <strong>1.02</strong> (≈ 2%/year). Inflation compounds
              at year-end inside the simulation.
            </p>
            <p>
              Withdrawals are inflation-adjusted over time, meaning “10,000/month” is treated like a real-spending target that
              increases as prices rise.
            </p>
          </details>

          <details>
            <summary><strong>Tax timing</strong></summary>
            <p>
              Taxes depend on the selected tax rule:
            </p>
            <ul>
              <li><strong>Notional gains</strong>: applied at year-end on gains since the previous year-end.</li>
              <li><strong>Capital gains</strong>: applied when withdrawing (month-end), on the portion treated as gains.</li>
            </ul>
            <p>
              Phase exemptions (e.g. exemption card / stock exemption) reduce the taxable amount before the tax rate is applied.
            </p>
          </details>

          <details>
            <summary><strong>Rebalancing / asset allocation</strong></summary>
            <p>
              Normal mode tracks a single pooled portfolio value. There is no explicit asset allocation or rebalancing input.
              Deposits, withdrawals, returns, and taxes all apply to the same pool.
            </p>
          </details>
        </section>

        <section>
          <h2 tabIndex={-1}>FAQ</h2>
          <details>
            <summary>What is the meaning of fire simulation?</summary>
            <p>A financial independence (FI) simulation is a tool that uses various data points and models to project the likelihood of a person reaching their financial independence goal, where their assets can cover their living expenses without a traditional job. These simulations, often using a Monte Carlo simulation approach, run thousands of potential market scenarios to provide a probability of success, helping users understand when they might retire, how much to save, and the impact of different savings rates and market conditions.</p>
          </details>
          <details>
            <summary>What is the 25x rule for early retirement?</summary>
            <p>The 25x rule suggests that you can retire comfortably if you have 25 times your annual expenses saved. This is based on the idea that you can withdraw 4% of your savings each year in retirement.</p>
          </details>
          <details>
            <summary>What is the 4% rule?</summary>
            <p>The 4% rule is a guideline for retirement planning that suggests you can withdraw 4% of your retirement savings each year without running out of money. This rule is based on historical market performance and the idea of allowing your investments to continue growing while you withdraw funds.</p>
          </details>
        </section>

        <section>
          <h2 tabIndex={-1}>Glossary</h2>
          <ul>
            <li><strong>Principal</strong> - Initial invested capital.</li>
            <li><strong>Compound interest</strong> - Interest on principal and accumulated interest.</li>
            <li><strong>Monthly deposit</strong> - Regular contribution to an investment account.</li>
            <li><strong>Yearly increase %</strong> - Annual growth rate of an investment (e.g. 2% annual increase in "monthly deposits").</li>
            <li><strong>Inflation</strong> - Rate of increase in prices over time.</li>
            <li><strong>Withdrawal rate</strong> - Percentage of portfolio withdrawn annually.</li>
            <li><strong>Safe Withdrawal Rate (SWR)</strong> - Sustainable withdrawal rate to avoid depleting funds.</li>
            <li><strong>Sequence of Returns Risk</strong> - Risk of poor returns early in retirement impacting longevity of funds.</li>
            <li><strong>Monte Carlo Simulation</strong> - Statistical method to model probability of different outcomes.</li>
          </ul>
        </section>

        <DisclaimerSection />
      </div>
    </>
  );
};

export default InfoPage;

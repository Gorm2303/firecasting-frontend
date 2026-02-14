// src/pages/InfoPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DisclaimerSection from '../pages/DisclaimerSection';
import PageLayout from '../components/PageLayout';

type HeadingItem = { id: string; text: string };

const InfoSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title,
  children,
  defaultOpen = true,
}) => {
  return (
    <details className="info-section" open={defaultOpen}>
      <summary className="info-section-summary">
        <h2 tabIndex={-1}>{title}</h2>
      </summary>
      <div className="info-section-body">{children}</div>
    </details>
  );
};

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
      // If the heading lives inside a collapsed section, open it before scrolling.
      const parentSection = el.closest('details.info-section') as HTMLDetailsElement | null;
      if (parentSection && !parentSection.open) parentSection.open = true;

      el.focus?.();
      // scrollIntoView is smooth via page-level style above
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // update hash without adding history entries
      history.replaceState(null, '', `#${id}`);
    }
  };

  const hasMenu = useMemo(() => headings.length > 0, [headings]);

  // If the URL already has a hash, auto-open that section.
  useEffect(() => {
    const raw = window.location.hash;
    const id = raw?.startsWith('#') ? raw.slice(1) : '';
    if (!id) return;

    // Defer until headings are collected/ids are assigned.
    if (!headings.length) return;

    const el = document.getElementById(id);
    if (!el) return;
    const parentSection = el.closest('details.info-section') as HTMLDetailsElement | null;
    if (parentSection && !parentSection.open) parentSection.open = true;
  }, [headings]);

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

        /* H2 sections as horizontal "cards" */
        details.info-section {
          border: 1px solid #3a3a3a;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(255,255,255,0.02);
          margin: 12px 0;
        }
        details.info-section > summary.info-section-summary {
          list-style: none;
          cursor: pointer;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        details.info-section > summary.info-section-summary::-webkit-details-marker {
          display: none;
        }
        details.info-section > summary.info-section-summary::after {
          content: '▸';
          opacity: 0.8;
          transform: rotate(0deg);
          transition: transform 140ms ease-out;
          flex: 0 0 auto;
        }
        details.info-section[open] > summary.info-section-summary::after {
          transform: rotate(90deg);
        }
        details.info-section > summary.info-section-summary h2 {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.2;
        }
        .info-section-body {
          padding: 10px 14px 14px 14px;
        }
        .info-section-body p { line-height: 1.6; }
        .info-section-body details { marginTop: 10px; }
      `}</style>

      <PageLayout variant="constrained">
      <div id="info-root">
        <h1 style={{ textAlign: "center" }}>Explainer</h1>
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
      <InfoSection title="About Firecasting">
        <p>
          Firecasting is a financial independence “what-if” simulator. You describe a starting date, a set of life phases
          (saving, coasting, withdrawing), and a return/tax/inflation model. The engine then simulates many possible market
          paths and summarizes the range of outcomes.
        </p>
        <p>
          If you’re new, start on the <Link to="/simulation">Simulation</Link> page. If you want repeatable comparisons,
          the <Link to="/simulation/diff">Diff</Link> page can rerun scenarios and show what changed.
        </p>
        <details>
          <summary>
            <strong>What Firecasting is (and isn’t)</strong>
          </summary>
          <ul>
            <li>
              <strong>It is</strong>: a way to explore tradeoffs (save more vs retire earlier, higher withdrawal vs higher
              failure risk, different tax rules, different return distributions).
            </li>
            <li>
              <strong>It isn’t</strong>: financial advice or a guarantee. It’s a simplified model intended to be useful,
              not perfectly “brokerage-accurate”.
            </li>
          </ul>
        </details>
      </InfoSection>

      <InfoSection title="Normal Mode vs Advanced Mode">
        <p>
          Firecasting offers two ways to build a scenario. They use the same simulation engine, but differ in how much you
          control versus how much is preconfigured.
        </p>

        <details>
          <summary>
            <strong>Normal mode</strong>
          </summary>
          <p>
            Normal mode is designed for speed and clarity. You enter the common inputs (start date, phases, tax, inflation,
            fees, and a return model selection) and run the simulation.
          </p>
          <ul>
            <li>Best for: exploring tradeoffs quickly and building intuition.</li>
            <li>You’ll notice: simpler inputs, fewer “knobs”, and more guidance.</li>
          </ul>
        </details>

        <details>
          <summary>
            <strong>Advanced mode</strong>
          </summary>
          <p>
            Advanced mode exposes more direct control over the underlying statistical model and configuration. It is useful
            when you want to test a specific assumption set, reproduce a run precisely, or compare models.
          </p>
          <ul>
            <li>Best for: deeper experiments, reproducibility, and model comparisons.</li>
            <li>Tradeoff: more settings means it’s easier to create unrealistic combinations — interpret results carefully.</li>
          </ul>
        </details>

        <details>
          <summary>
            <strong>Which one should I use?</strong>
          </summary>
          <p>
            Start with Normal mode until you can explain what changed when you tweak an input. Switch to Advanced mode when
            you need more control or need runs to be reproducible for diffs.
          </p>
        </details>
      </InfoSection>

      <InfoSection title="Features in the App">
        <p>
          Firecasting is more than a single “run” button. These pages and tools are meant to help you iterate, compare, and
          share scenarios.
        </p>

        <details>
          <summary>
            <strong>Simulation</strong>
          </summary>
          <p>
            The <Link to="/simulation">FIRE Simulator</Link> page is where you build a scenario and run it. It’s the main
            workflow for exploring outcomes and viewing charts.
          </p>
        </details>

        <details>
          <summary>
            <strong>Tutor</strong>
          </summary>
          <p>
            The <Link to="/tutorial">Tutor</Link> is a guided, step-by-step walkthrough that uses the same
            input form as the main simulation page. It’s the fastest way to learn what each input does.
          </p>
        </details>

        <details>
          <summary>
            <strong>Saved scenarios</strong>
          </summary>
          <p>
            You can save scenarios while you’re experimenting. Saved scenarios are meant to support quick iteration and
            comparison — for example, keeping a “baseline” and then saving small variations.
          </p>
          <p>
            Note: saved scenarios are stored locally in your browser (so they are tied to this device/browser unless you use
            sharing).
          </p>
        </details>

        <details>
          <summary>
            <strong>Share link (import/export)</strong>
          </summary>
          <p>
            Firecasting can generate a share link that encodes your scenario. Opening the link on another device/browser
            reconstructs the same inputs. This acts as a lightweight import/export mechanism for scenarios.
          </p>
          <p>Tip: for stable comparisons, prefer deterministic seeds before sharing.</p>
        </details>

        <details>
          <summary>
            <strong>Comparator</strong>
          </summary>
          <p>
            The <Link to="/diff-scenarios">Comparator</Link> page compares two runs side-by-side and explains what changed:
            inputs, model version, and/or randomness. It can rerun scenarios (optionally pinning seeds) to make comparisons
            reproducible.
          </p>
        </details>

        <details>
          <summary>
            <strong>Explorer (beta)</strong>
          </summary>
          <p>
            The <Link to="/explore">Explorer</Link> page is a work-in-progress area for browsing and inspecting example or
            sampled runs. Expect unfinished features and placeholders as it evolves.
          </p>
        </details>
      </InfoSection>

      <InfoSection title="Core Concepts">
        <p>
          These terms show up across the UI and in the results. Getting these right makes the charts and the diff tool much
          easier to interpret.
        </p>
        <details>
          <summary>
            <strong>Scenario, run, path</strong>
          </summary>
          <ul>
            <li>
              <strong>Scenario</strong>: your inputs (phases, tax rule, return model, inflation, fees, etc.). Think “the
              plan”.
            </li>
            <li>
              <strong>Path</strong>: one simulated timeline of monthly market returns and outcomes for that scenario.
            </li>
            <li>
              <strong>Run</strong>: a batch of many paths (for example 5,000 paths). A run produces percentile summaries,
              failure rates, and detailed yearly metrics.
            </li>
          </ul>
        </details>
        <details>
          <summary>
            <strong>Percentiles (p5, p50, p95)</strong>
          </summary>
          <p>
            A percentile answers: “In X% of paths, the result is at most this value.” For portfolio value, higher is better.
            For failure rate, lower is better.
          </p>
          <ul>
            <li>
              <strong>p50</strong> (median): a typical outcome (half the paths above, half below).
            </li>
            <li>
              <strong>p5</strong>: a pessimistic tail outcome (only 5% of paths are worse).
            </li>
            <li>
              <strong>p95</strong>: an optimistic tail outcome (only 5% of paths are better).
            </li>
          </ul>
          <p>
            Tip: compare p50 for “typical”, p5 for “stress”, and p95 for “upside”. If p5 is very low while p50 looks fine,
            you may have high sequence-of-returns risk.
          </p>
        </details>
      </InfoSection>

      <InfoSection title="Monte Carlo Simulation (How It Works Here)">
        <p>
          In Firecasting, Monte Carlo means: “simulate lots of possible futures by sampling many possible market return
          paths”. Each path is stepped forward in time (month by month) applying your phase rules, taxes, and inflation.
        </p>
        <details>
          <summary>
            <strong>Why multiple paths?</strong>
          </summary>
          <p>
            A single average return (like “7%/year”) hides the order in which returns happen. The same average can be a smooth
            climb or a crash-then-recovery — and those can have very different outcomes when you are withdrawing.
          </p>
        </details>
        <details>
          <summary>
            <strong>What the simulator samples</strong>
          </summary>
          <p>
            The engine samples returns according to the selected return model (normal-mode historical sampling, or advanced
            distributions). That randomness is controlled by a seed (see “Seeds &amp; reproducibility”).
          </p>
        </details>
      </InfoSection>

      <InfoSection title="Simulation Phases">
        <p>
          A scenario is a timeline of phases. Each phase has a duration (in months) and rules for how cash flows happen.
          Firecasting treats phases as consecutive — when one ends, the next begins.
        </p>
        <details>
          <summary>
            <strong>Common phase types</strong>
          </summary>
          <ul>
            <li>
              <strong>Deposit / accumulation</strong>: add money over time (optionally with yearly increases).
            </li>
            <li>
              <strong>Passive / coast</strong>: no deposits or withdrawals; the portfolio only changes due to returns, fees,
              taxes, and inflation adjustments.
            </li>
            <li>
              <strong>Withdraw / decumulation</strong>: remove money over time (optionally with yearly increases and
              variation bands).
            </li>
          </ul>
        </details>
        <details>
          <summary>
            <strong>Phase-level tax rules</strong>
          </summary>
          <p>
            Some tax exemptions are configured per phase so you can model “these withdrawals are covered by exemption A, then
            later exemption B”. The simulator applies the phase’s tax settings when calculating taxes for that time period.
          </p>
        </details>
      </InfoSection>

      <InfoSection title="Tax Handling">
        <p>
          Taxes are modeled using a small set of rules that aim to capture the big differences between “tax on realized
          withdrawals” versus “tax on gains as they accrue”. The exact year-by-year details will never match every country’s
          tax code — this is a planning tool.
        </p>

        <details>
          <summary>
            <strong>Two main tax rules</strong>
          </summary>
          <ul>
            <li>
              <strong>Notional gains</strong>: tax is applied periodically (typically year-end) to gains since the previous
              year-end.
            </li>
            <li>
              <strong>Capital gains</strong>: tax is applied when selling/withdrawing. Only the gains portion is taxable.
            </li>
          </ul>
        </details>

        <details>
          <summary>
            <strong>Exemptions and thresholds</strong>
          </summary>
          <p>
            If exemptions are enabled for a phase, they reduce the taxable amount before applying your tax percentage. This
            is useful to represent “first X is tax-free” or “only above Y is taxed”.
          </p>
        </details>

        <details>
          <summary>
            <strong>Important simplifications</strong>
          </summary>
          <ul>
            <li>The simulator uses a single pooled portfolio (no separate accounts, no explicit lots).</li>
            <li>
              Tax law edge cases (carryforward losses, brackets, wash sales, special dividend handling, etc.) are not modeled
              unless explicitly supported in the UI.
            </li>
          </ul>
        </details>
      </InfoSection>

      <InfoSection title="Inflation Handling">
        <p>
          Inflation is modeled as a yearly compounding factor. The purpose is to let you express spending goals in “real
          money” (today’s purchasing power) while the simulation evolves in nominal currency.
        </p>

        <details>
          <summary>
            <strong>Inflation-adjusted withdrawals</strong>
          </summary>
          <p>
            If you set a monthly withdrawal, the simulator can treat it like a real-spending target. Over time that means the
            nominal withdrawal amount increases to keep purchasing power roughly constant.
          </p>
        </details>

        <details>
          <summary>
            <strong>Inflation vs yearly increases</strong>
          </summary>
          <p>Inflation adjustment and “yearly increase %” are different knobs:</p>
          <ul>
            <li>
              <strong>Inflation</strong> answers: “How does purchasing power change?”
            </li>
            <li>
              <strong>Yearly increase %</strong> answers: “Do my deposits/withdrawals intentionally grow over time?” (e.g.
              salary growth, lifestyle creep, planned spending step-ups).
            </li>
          </ul>
        </details>
      </InfoSection>

      <InfoSection title="Seeds &amp; Reproducibility">
        <p>
          The random seed controls the pseudo-random number generator that drives the sampled return paths. If you rerun a
          scenario with the same inputs and the same seed, you should get identical results.
        </p>
        <details>
          <summary>
            <strong>Deterministic vs random runs</strong>
          </summary>
          <ul>
            <li>
              <strong>Deterministic</strong>: fixed seed → identical results on rerun (useful for debugging and diffing).
            </li>
            <li>
              <strong>Random</strong>: new seed each start → results change each run (useful for exploring variability).
            </li>
          </ul>
        </details>
        <details>
          <summary>
            <strong>Why you may see “seed text”</strong>
          </summary>
          <p>
            Seeds are 64-bit integers in the backend. JavaScript cannot represent all 64-bit integers exactly as numbers, so
            Firecasting may show a string form of the seed to preserve the exact value.
          </p>
        </details>
        <details>
          <summary>
            <strong>Best practice for comparisons</strong>
          </summary>
          <p>
            If you are comparing two scenarios, pin both to deterministic seeds (or use the Diff page, which can do this for
            you). Otherwise, “randomness changed” can dominate the differences.
          </p>
        </details>
      </InfoSection>

      <InfoSection title="Performance, Queueing, and Deduplication">
        <p>
          Some simulations can take noticeable time, especially with many paths. The backend uses batching and may queue work.
          The UI can stream progress updates while the run is executing.
        </p>
        <details>
          <summary>
            <strong>Progress updates</strong>
          </summary>
          <p>
            During a run, Firecasting can display progress (e.g. queued/running/completed). This is designed to work reliably
            through the dev reverse proxy.
          </p>
        </details>
        <details>
          <summary>
            <strong>Deduplication (reusing identical work)</strong>
          </summary>
          <p>
            For deterministic runs, the backend can detect “these inputs + this seed were already simulated” and reuse the
            previous results instead of recomputing. Random runs are intentionally not deduplicated, because the goal is to
            sample new randomness.
          </p>
        </details>
      </InfoSection>

      <InfoSection title="Reading the Results">
        <p>
          Results are summarized across many paths. Most charts and tables show percentiles over time, and a “failed cases”
          summary highlights how often a path ended up in trouble.
        </p>
        <details>
          <summary>
            <strong>“Failed cases” and negative capital</strong>
          </summary>
          <p>
            Firecasting reports a <strong>negative capital percentage</strong>: the share of paths that went below zero.
            This is a simple failure signal — it represents scenarios where the portfolio could not support the modeled
            withdrawals.
          </p>
          <p>
            Important: “failure” here is a modeling outcome, not a life outcome. In the real world you might reduce spending,
            delay retirement, work part-time, etc. Use this as a risk indicator.
          </p>
        </details>
        <details>
          <summary>
            <strong>Yearly metrics</strong>
          </summary>
          <p>
            Yearly summaries aggregate per-year values like deposits, withdrawals, taxes, and portfolio value. Detailed yearly
            metrics are useful for answering questions like “when do taxes spike?” or “which phase drives most withdrawals?”
          </p>
        </details>
      </InfoSection>

        <InfoSection title="Assumptions and Limitations">
          <p>
            This simulator is intentionally opinionated and simplified. The goal is to be useful for planning and exploring
            tradeoffs, not to perfectly model every detail of a real brokerage account.
          </p>

          <details>
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

          <details>
            <summary><strong>Interpretation</strong></summary>
            <p>
              Firecasting is best used to compare scenarios against each other (e.g. “save 2k more” vs “retire 2 years later”),
              rather than to predict an exact future balance.
            </p>
          </details>
        </InfoSection>

        <InfoSection title="FAQ">
          <details>
            <summary>What is the meaning of fire simulation?</summary>
            <p>A financial independence (FI) simulation is a tool that uses various data points and models to project the likelihood of a person reaching their financial independence goal, where their assets can cover their living expenses without a traditional job. These simulations, often using a Monte Carlo simulation approach, run thousands of potential market scenarios to provide a probability of success, helping users understand when they might retire, how much to save, and the impact of different savings rates and market conditions.</p>
          </details>
          <details>
            <summary>Why do my results change when I rerun?</summary>
            <p>
              If your scenario uses a random seed, each run samples a different set of return paths, so the percentiles move.
              To get repeatable results, switch to a deterministic seed (or use the Diff page to pin a seed).
            </p>
          </details>
          <details>
            <summary>How many paths should I run?</summary>
            <p>
              More paths produce smoother percentiles and more stable failure-rate estimates, but take longer. If you’re
              iterating quickly, use fewer paths; when you’re close to a decision, increase paths for a more stable picture.
            </p>
          </details>
          <details>
            <summary>What is the 25x rule for early retirement?</summary>
            <p>The 25x rule suggests that you can retire comfortably if you have 25 times your annual expenses saved. This is based on the idea that you can withdraw 4% of your savings each year in retirement.</p>
          </details>
          <details>
            <summary>What is the 4% rule?</summary>
            <p>The 4% rule is a guideline for retirement planning that suggests you can withdraw 4% of your retirement savings each year without running out of money. This rule is based on historical market performance and the idea of allowing your investments to continue growing while you withdraw funds.</p>
          </details>
        </InfoSection>

        <InfoSection title="Glossary">
          <ul>
            <li><strong>Principal</strong> - Initial invested capital.</li>
            <li><strong>Compound interest</strong> - Interest on principal and accumulated interest.</li>
            <li><strong>Scenario</strong> - A complete set of inputs describing your plan.</li>
            <li><strong>Path</strong> - One simulated future timeline.</li>
            <li><strong>Run</strong> - Many paths simulated together, producing percentiles.</li>
            <li><strong>Seed</strong> - A value that controls randomness; same seed ⇒ same results.</li>
            <li><strong>Monthly deposit</strong> - Regular contribution to an investment account.</li>
            <li><strong>Yearly increase %</strong> - Annual growth rate of an investment (e.g. 2% annual increase in "monthly deposits").</li>
            <li><strong>Inflation</strong> - Rate of increase in prices over time.</li>
            <li><strong>Withdrawal rate</strong> - Percentage of portfolio withdrawn annually.</li>
            <li><strong>Safe Withdrawal Rate (SWR)</strong> - Sustainable withdrawal rate to avoid depleting funds.</li>
            <li><strong>Sequence of Returns Risk</strong> - Risk of poor returns early in retirement impacting longevity of funds.</li>
            <li><strong>Monte Carlo Simulation</strong> - Statistical method to model probability of different outcomes.</li>
            <li><strong>Percentile</strong> - A rank statistic (p50 = median, p5 = pessimistic tail, p95 = optimistic tail).</li>
            <li><strong>Negative capital %</strong> - Share of paths where the portfolio dipped below zero (a simple failure indicator).</li>
          </ul>
        </InfoSection>

        <DisclaimerSection />
      </div>
      </PageLayout>
    </>
  );
};

export default InfoPage;

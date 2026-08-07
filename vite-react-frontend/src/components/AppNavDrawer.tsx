import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  Compass,
  Cpu,
  CreditCard,
  Filter,
  FileText,
  Flag,
  Flame,
  FlaskConical,
  GitBranch,
  GitCompare,
  GraduationCap,
  Handshake,
  History,
  Home,
  Library,
  LifeBuoy,
  ListTree,
  Menu,
  MessageSquare,
  NotebookPen,
  Percent,
  PieChart,
  PiggyBank,
  Radar,
  Receipt,
  RotateCcw,
  Shield,
  ShieldCheck,
  Share2,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useNavPreferences } from '../state/navPreferences';

type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
  icon: LucideIcon;
};

type NavGroup = {
  id: string;
  title: string;
  to: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type { NavGroup, NavItem };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    title: 'Home',
    to: '/category/home',
    icon: Home,
    items: [
      { label: 'Home', to: '/', isActive: (p) => p === '/', icon: Home },
      { label: 'Explainer', to: '/info', isActive: (p) => p === '/info', icon: BookOpen },
      { label: 'Feedback', to: '/feedback', isActive: (p) => p === '/feedback', icon: MessageSquare },
      { label: 'Assumptions Hub', to: '/assumptions', isActive: (p) => p === '/assumptions', icon: SlidersHorizontal },
      { label: 'Security & Privacy Center', to: '/security-privacy', isActive: (p) => p === '/security-privacy', icon: ShieldCheck },
    ],
  },
  {
    id: 'simulate',
    title: 'Simulate',
    to: '/category/simulate',
    icon: Flame,
    items: [
      { label: 'Tutor', to: '/tutorial', isActive: (p) => p.startsWith('/tutorial') || p.startsWith('/simulation/tutorial'), icon: GraduationCap },
      { label: 'FIRE Simulator', to: '/fire-simulator', isActive: (p) => p === '/fire-simulator', icon: Flame },
      { label: 'Legacy Simulator', to: '/simulation', isActive: (p) => p === '/simulation', icon: History },
      { label: 'Simulation Plan', to: '/simulation-plan', isActive: (p) => p === '/simulation-plan', icon: ListTree },
      { label: 'Simulation Invest', to: '/simulation-invest', isActive: (p) => p === '/simulation-invest', icon: TrendingUp },
      { label: 'Simulation Engine', to: '/simulation-engine', isActive: (p) => p === '/simulation-engine', icon: Cpu },
      {
        label: 'Comparator',
        to: '/diff-scenarios',
        isActive: (p) => p === '/diff-scenarios' || p.startsWith('/simulation/diff'),
        icon: GitCompare,
      },
      { label: 'Stress Test Lab', to: '/stress-test-lab', isActive: (p) => p === '/stress-test-lab', icon: FlaskConical },
      { label: 'Model Validation Suite', to: '/model-validation-suite', isActive: (p) => p === '/model-validation-suite', icon: CheckCircle2 },
      { label: 'Explorer', to: '/explore', isActive: (p) => p === '/explore', icon: Compass },
    ],
  },
  {
    id: 'plan-strategy',
    title: 'Plan & Strategy',
    to: '/category/plan-strategy',
    icon: Target,
    items: [
      { label: 'Deposit Strategy', to: '/deposit-strategy', isActive: (p) => p === '/deposit-strategy', icon: PiggyBank },
      { label: 'Withdrawal Strategy', to: '/withdrawal-strategy', isActive: (p) => p === '/withdrawal-strategy', icon: Wallet },
      { label: 'Policy Builder', to: '/policy-builder', isActive: (p) => p === '/policy-builder', icon: ClipboardList },
      { label: 'Scenario Library', to: '/scenario-library', isActive: (p) => p === '/scenario-library', icon: Library },
      { label: 'FIRE Milestones', to: '/fire-milestones', isActive: (p) => p === '/fire-milestones', icon: Flag },
      { label: 'Confidence Funnel', to: '/confidence-funnel', isActive: (p) => p === '/confidence-funnel', icon: Filter },
      { label: 'Goal Planner', to: '/goal-planner', isActive: (p) => p === '/goal-planner', icon: Target },
      { label: 'Uncertainty Tracks', to: '/uncertainty-tracks', isActive: (p) => p === '/uncertainty-tracks', icon: GitBranch },
      { label: 'Plan Report', to: '/plan-report', isActive: (p) => p === '/plan-report', icon: FileText },
    ],
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle Tools',
    to: '/category/lifestyle',
    icon: Sparkles,
    items: [
      { label: 'Salary Taxator', to: '/salary-after-tax', isActive: (p) => p === '/salary-after-tax', icon: Receipt },
      { label: 'Money Perspectivator', to: '/money-perspective', isActive: (p) => p === '/money-perspective', icon: Coins },
      {
        label: 'Tax Optimizer',
        to: '/simulation-start-tax',
        isActive: (p) => p === '/simulation-start-tax' || p === '/simulation-tax-exemptions',
        icon: Percent,
      },
      { label: 'Time Accounting Dashboard', to: '/time-accounting', isActive: (p) => p === '/time-accounting', icon: Clock },
      {
        label: 'Fixed vs Flexible Spending Analyzer',
        to: '/fixed-vs-flexible-spending',
        isActive: (p) => p === '/fixed-vs-flexible-spending',
        icon: SlidersHorizontal,
      },
      { label: 'Life Events Simulator', to: '/life-events-simulator', isActive: (p) => p === '/life-events-simulator', icon: CalendarClock },
      { label: 'Side Hustle Lab', to: '/side-hustle-lab', isActive: (p) => p === '/side-hustle-lab', icon: Briefcase },
      { label: 'Housing Decision Studio', to: '/housing-decision-studio', isActive: (p) => p === '/housing-decision-studio', icon: Building2 },
      { label: 'Household Negotiation Board', to: '/household-negotiation-board', isActive: (p) => p === '/household-negotiation-board', icon: Handshake },
      { label: 'Family Mode Planner', to: '/family-mode-planner', isActive: (p) => p === '/family-mode-planner', icon: Users },
      { label: 'Debt Freedom Optimizer', to: '/debt-freedom-optimizer', isActive: (p) => p === '/debt-freedom-optimizer', icon: CreditCard },
      { label: 'Emergency Buffer Optimizer', to: '/emergency-buffer-optimizer', isActive: (p) => p === '/emergency-buffer-optimizer', icon: LifeBuoy },
      { label: 'Insurance Risk Shield', to: '/insurance-risk-shield', isActive: (p) => p === '/insurance-risk-shield', icon: Shield },
    ],
  },
  {
    id: 'track-reflect',
    title: 'Track & Reflect',
    to: '/category/track-reflect',
    icon: Activity,
    items: [
      { label: 'Cashflow Command Center', to: '/cashflow-command-center', isActive: (p) => p === '/cashflow-command-center', icon: Radar },
      { label: 'Progress Tracker', to: '/progress-tracker', isActive: (p) => p === '/progress-tracker', icon: Activity },
      { label: 'Portfolio', to: '/portfolio', isActive: (p) => p === '/portfolio', icon: PieChart },
      { label: 'Sequence Risk Radar', to: '/sequence-risk-radar', isActive: (p) => p === '/sequence-risk-radar', icon: Radar },
      { label: 'Decision Journal', to: '/decision-journal', isActive: (p) => p === '/decision-journal', icon: NotebookPen },
      { label: 'Decision Replay / Postmortem', to: '/decision-replay', isActive: (p) => p === '/decision-replay', icon: RotateCcw },
      { label: 'Happiness Tracker', to: '/happiness-tracker', isActive: (p) => p === '/happiness-tracker', icon: Smile },
      { label: 'Community Benchmarks', to: '/community-benchmarks', isActive: (p) => p === '/community-benchmarks', icon: BarChart3 },
      { label: 'Advisor / Share Portal', to: '/advisor-share-portal', isActive: (p) => p === '/advisor-share-portal', icon: Share2 },
      { label: 'No-Spend Challenge Arena', to: '/no-spend-challenge-arena', isActive: (p) => p === '/no-spend-challenge-arena', icon: Trophy },
    ],
  },
];

// Paths backed by a real, dedicated implementation (not the generic SkeletonPage). Everything
// else is hidden from the nav until it graduates out of skeleton status — see
// firecasting/docs/frontend-ui-plan.md for the completion roadmap.
const LIVE_PATHS = new Set<string>([
  '/info',
  '/feedback',
  '/assumptions',
  '/security-privacy',
  '/tutorial',
  '/diff-scenarios',
  '/salary-after-tax',
  '/money-perspective',
  '/simulation-start-tax',
  '/simulation-tax-exemptions',
  '/simulation',
  '/fire-simulator',
  '/simulation-invest',
  '/simulation-engine',
  '/simulation-plan',
  '/explore',
  '/decision-journal',
  '/no-spend-challenge-arena',
  '/deposit-strategy',
  '/withdrawal-strategy',
  '/policy-builder',
  '/scenario-library',
  '/fire-milestones',
  '/confidence-funnel',
  '/goal-planner',
  '/uncertainty-tracks',
  '/plan-report',
  '/time-accounting',
  '/fixed-vs-flexible-spending',
  '/life-events-simulator',
  '/side-hustle-lab',
  '/housing-decision-studio',
  '/household-negotiation-board',
  '/family-mode-planner',
  '/debt-freedom-optimizer',
  '/emergency-buffer-optimizer',
  '/insurance-risk-shield',
  '/cashflow-command-center',
  '/portfolio',
  '/sequence-risk-radar',
  '/decision-replay',
  '/happiness-tracker',
  '/stress-test-lab',
  '/model-validation-suite',
]);

const isSkeletonRoute = (to: string): boolean => !LIVE_PATHS.has(to);

const getFocusable = (root: HTMLElement): HTMLElement[] => {
  const nodes = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
};

const navItemClass = (active: boolean): string =>
  [
    'flex w-full items-center gap-2.5 rounded-md border-l-4 px-2.5 py-2.5 text-left text-sm',
    'whitespace-nowrap overflow-hidden text-ellipsis',
    active ? 'border-current font-extrabold' : 'border-transparent font-semibold hover:bg-subtle',
  ].join(' ');

const AppNavDrawer: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(min-width: 1400px)').matches;
  });
  const { expandedGroups, setGroupExpanded } = useNavPreferences();

  const DRAWER_WIDTH_PX = 260;

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const groups = useMemo<NavGroup[]>(() => NAV_GROUPS, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1400px)');

    const onChange = () => setIsPinned(mq.matches);
    onChange();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    // Safari fallback
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  // If we become pinned, ensure the modal drawer is closed.
  useEffect(() => {
    if (isPinned) setOpen(false);
  }, [isPinned]);

  const onClose = useCallback(() => {
    setOpen(false);
    const last = lastActiveElementRef.current;
    if (last && typeof last.focus === 'function') last.focus();
  }, []);

  const onOpen = useCallback(() => {
    lastActiveElementRef.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
  }, []);

  const onNavigate = useCallback(
    (to: string) => {
      navigate(to);
      onClose();
    },
    [navigate, onClose]
  );

  useEffect(() => {
    if (!open || isPinned) return;
    // Wait for dialog to mount, then focus Close.
    queueMicrotask(() => {
      closeBtnRef.current?.focus();
    });
  }, [isPinned, open]);

  useEffect(() => {
    if (!open || isPinned) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Trap focus while the drawer is maximized (modal).
      if (e.key !== 'Tab') return;

      const root = dialogRef.current;
      if (!root) return;

      const focusable = getFocusable(root);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isPinned, onClose, open]);

  const DrawerNav = (
    <div role="navigation" aria-label="Primary" className="flex flex-col gap-1">
      {groups.map((g, gi) => {
        const groupHasActiveItem = g.items.some((it) => it.isActive(pathname));
        const isExpanded = expandedGroups[g.id] ?? groupHasActiveItem;
        const GroupIcon = g.icon;
        const visibleItems = g.items.filter((it) => !isSkeletonRoute(it.to));
        if (visibleItems.length === 0) return null;

        return (
          <div key={g.id} className={gi === 0 ? '' : 'mt-1.5'}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setGroupExpanded(g.id, !isExpanded)}
                aria-expanded={isExpanded}
                className="flex flex-1 items-center gap-2 rounded-md px-1 py-2 text-left text-[15px] font-extrabold hover:bg-subtle"
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="shrink-0 opacity-70" aria-hidden="true" />
                ) : (
                  <ChevronRight size={16} className="shrink-0 opacity-70" aria-hidden="true" />
                )}
                <GroupIcon size={17} className="shrink-0" aria-hidden="true" />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{g.title}</span>
              </button>
            </div>
            {isExpanded && (
              <div className="mt-1 flex flex-col gap-1 pl-1">
                {visibleItems.map((it) => {
                  const active = it.isActive(pathname);
                  const ItemIcon = it.icon;
                  return (
                    <button
                      key={it.to}
                      type="button"
                      data-nav-item="true"
                      onClick={() => onNavigate(it.to)}
                      className={navItemClass(active)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <ItemIcon size={16} className="shrink-0 opacity-85" aria-hidden="true" />
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Pinned navigation: always visible at >= 1400px */}
      {isPinned ? (
        <aside
          aria-label="Navigation drawer"
          style={{ width: DRAWER_WIDTH_PX }}
          className="sticky top-0 flex h-screen flex-none flex-col gap-2.5 overflow-auto border-r border-card-border bg-card p-3 text-card-fg box-border"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold">Menu</div>
          </div>

          {DrawerNav}
        </aside>
      ) : (
        <>
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => (open ? onClose() : onOpen())}
            className="inline-flex items-center justify-center rounded-md border border-card-border p-1.5 text-card-fg hover:bg-subtle"
            title="Menu"
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          {open ? (
            <>
              <div role="presentation" onClick={onClose} className="fixed inset-0 z-20000 bg-black/35" />

              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation drawer"
                style={{ width: `min(${DRAWER_WIDTH_PX}px, 85vw)` }}
                className="fixed left-0 top-0 z-20001 flex h-screen flex-col gap-2.5 overflow-auto border-r border-card-border bg-card p-3 text-card-fg box-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold">Menu</div>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close navigation menu"
                    className="inline-flex items-center justify-center rounded-md border border-card-border p-1.5 text-card-fg hover:bg-subtle"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                {DrawerNav}
              </div>
            </>
          ) : null}
        </>
      )}
    </>
  );
};

export default AppNavDrawer;

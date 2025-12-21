import { YearlySummary } from './YearlySummary';

export interface MonthlySummary extends YearlySummary {
  month: number; // 1-12
  yearMonth: string; // YYYY-MM for display
}

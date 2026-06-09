import type { MoneyRange } from './types';

const RANGE_SEPARATOR = '(?:-|~|至|到)';
const CURRENCY_MULTIPLIER_TO_CNY: Record<MoneyRange['currency'], number> = {
  CNY: 1,
  USD: 7,
  EUR: 7.5,
  UNKNOWN: 1
};

export function parseCompensationSalary(raw: string): MoneyRange | undefined {
  const compact = raw.replace(/\s+/g, '').replace(/[–—－]/g, '-').toLowerCase();
  if (!/\d/.test(compact)) return undefined;

  const currency = inferCurrency(compact);
  const patterns: Array<{ regex: RegExp; factor: number }> = [
    { regex: new RegExp(`(\\d+(?:\\.\\d+)?)(?:万|w)?${RANGE_SEPARATOR}(\\d+(?:\\.\\d+)?)(?:万|w)(?:/?(月|年))?`), factor: 10_000 },
    { regex: new RegExp(`(\\d+(?:\\.\\d+)?)(?:千)?${RANGE_SEPARATOR}(\\d+(?:\\.\\d+)?)(?:千)(?:/?(月|年))?`), factor: 1_000 },
    { regex: new RegExp(`[$€￥]?(\\d+(?:\\.\\d+)?)(?:k)?${RANGE_SEPARATOR}[$€￥]?(\\d+(?:\\.\\d+)?)(?:k)(?:/?(month|mo|m|yr|year|y|月|年))?`), factor: 1_000 },
    { regex: new RegExp(`(\\d{4,7})${RANGE_SEPARATOR}(\\d{4,7})(?:/?(月|年))?`), factor: 1 }
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern.regex);
    if (!match) continue;

    return {
      min: Number(match[1]) * pattern.factor,
      max: Number(match[2]) * pattern.factor,
      currency,
      period: inferPeriod(compact, match[3]),
      raw: match[0]
    };
  }

  return undefined;
}

export function estimateMonthlyCnySalary(salary: MoneyRange | undefined): number | undefined {
  if (!salary) return undefined;
  const midpoint = getMidpoint(salary);
  if (midpoint === undefined) return undefined;

  let monthly = midpoint;
  if (salary.period === 'year') monthly = midpoint / 12;
  if (salary.period === 'hour') monthly = midpoint * 8 * 21;

  return monthly * CURRENCY_MULTIPLIER_TO_CNY[salary.currency];
}

export function scoreSalaryRange(salary: MoneyRange | undefined): number {
  if (!salary) return 0;
  const monthlyCny = estimateMonthlyCnySalary(salary);
  if (monthlyCny === undefined) return salary.raw ? 0.25 : 0;

  if (monthlyCny >= 50_000) return 1;
  if (monthlyCny >= 35_000) return 0.9;
  if (monthlyCny >= 25_000) return 0.75;
  if (monthlyCny >= 18_000) return 0.55;
  if (monthlyCny >= 12_000) return 0.4;
  return 0.22;
}

function inferCurrency(value: string): MoneyRange['currency'] {
  if (value.includes('$') || value.includes('usd')) return 'USD';
  if (value.includes('€') || value.includes('eur')) return 'EUR';
  if (value.includes('￥') || value.includes('rmb') || value.includes('cny')) return 'CNY';
  return 'CNY';
}

function inferPeriod(value: string, explicitUnit?: string): MoneyRange['period'] {
  if (explicitUnit && ['yr', 'year', 'y', '年'].includes(explicitUnit)) return 'year';
  if (explicitUnit && ['month', 'mo', 'm', '月'].includes(explicitUnit)) return 'month';
  if (/年薪|\/年|peryear|annually|\/yr|\/year/.test(value)) return 'year';
  if (/时薪|\/小时|\/hour|\/hr/.test(value)) return 'hour';
  if (/月薪|\/月|permonth|\/mo|\/month/.test(value)) return 'month';
  return 'month';
}

function getMidpoint(salary: MoneyRange): number | undefined {
  if (salary.min !== undefined && salary.max !== undefined) return (salary.min + salary.max) / 2;
  return salary.min ?? salary.max;
}

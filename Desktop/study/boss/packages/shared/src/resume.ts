import type { ResumeProfile } from './types';
import { tokenize, uniqueBy } from './text';

const COMMON_SKILLS = [
  'typescript',
  'javascript',
  'react',
  'vue',
  'next.js',
  'node',
  'java',
  'python',
  'go',
  'rust',
  'sql',
  'mysql',
  'postgresql',
  'redis',
  'docker',
  'kubernetes',
  'aws',
  'gcp',
  'azure',
  '测试',
  '前端',
  '后端',
  '全栈',
  '算法',
  '运维',
  '数据',
  '产品',
  '项目管理'
];

const COMMON_TARGET_TITLES = [
  '前端工程师',
  '前端开发工程师',
  '全栈工程师',
  '后端工程师',
  'Java工程师',
  'Python工程师',
  'Go工程师',
  'AI应用开发工程师',
  'AI 工程师',
  '算法工程师',
  '数据分析师',
  '数据工程师',
  '产品经理',
  '测试工程师',
  '运维工程师',
  '嵌入式工程师',
  '硬件工程师'
];

const COMMON_LOCATIONS = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '苏州', '西安', '长沙', '重庆', '远程', 'remote'];

const COMMON_INDUSTRIES = [
  'SaaS',
  'AI',
  '人工智能',
  '互联网',
  '电商',
  '金融科技',
  '游戏',
  '教育',
  '医疗',
  '硬件',
  '物联网',
  '半导体',
  '新能源',
  '汽车',
  '机器人'
];

const TARGET_TITLE_LABELS = ['求职意向', '意向岗位', '目标岗位', '应聘岗位', '期望岗位'];
const LOCATION_LABELS = ['期望城市', '目标城市', '意向城市', '工作地点', '期望地点'];
const INDUSTRY_LABELS = ['意向行业', '目标行业', '期望行业', '行业意向'];

export interface ResumeParseInput {
  rawText: string;
  targetTitles?: string[];
  targetLocations?: string[];
  skills?: string[];
  industries?: string[];
}

export function parseResumeText(input: ResumeParseInput): ResumeProfile {
  const rawText = input.rawText.trim();
  const tokens = tokenize(rawText);
  const lowerTokenSet = new Set(tokens);
  const inferredSkills = COMMON_SKILLS.filter((skill) => lowerTokenSet.has(skill.toLowerCase()) || rawText.toLowerCase().includes(skill.toLowerCase()));
  const inferredTargetTitles = inferKnownOrLabeledValues(rawText, TARGET_TITLE_LABELS, COMMON_TARGET_TITLES, true);
  const inferredLocations = inferKnownOrLabeledValues(rawText, LOCATION_LABELS, COMMON_LOCATIONS);
  const inferredIndustries = inferKnownOrLabeledValues(rawText, INDUSTRY_LABELS, COMMON_INDUSTRIES);
  const yearsMatch = rawText.match(/(\d{1,2})\s*(?:年|years?)/i);

  return {
    targetTitles: uniqueClean([...(input.targetTitles ?? []), ...inferredTargetTitles]),
    targetLocations: uniqueClean([...(input.targetLocations ?? []), ...inferredLocations]),
    skills: uniqueBy([...(input.skills ?? []), ...inferredSkills], (item) => item.toLowerCase()).filter(Boolean),
    industries: uniqueClean([...(input.industries ?? []), ...inferredIndustries]),
    yearsOfExperience: yearsMatch ? Number(yearsMatch[1]) : undefined,
    rawText
  };
}

export interface ResumeFileParser {
  parse(file: File): Promise<string>;
}

export async function parseResumeFile(file: File, parser: ResumeFileParser): Promise<ResumeProfile> {
  const rawText = await parser.parse(file);
  return parseResumeText({ rawText });
}

function inferKnownOrLabeledValues(rawText: string, labels: string[], knownValues: string[], fallbackToFullText = false): string[] {
  const labeledText = extractLabeledText(rawText, labels);
  const searchText = labeledText || (fallbackToFullText ? rawText : '');
  const knownMatches = searchText ? knownValues.filter((value) => includesCaseInsensitive(searchText, value)) : [];
  const labeledValues = labeledText ? splitFieldValues(labeledText) : [];

  return uniqueClean([...knownMatches, ...labeledValues.filter((value) => isUsefulProfileValue(value, knownValues))]);
}

function extractLabeledText(rawText: string, labels: string[]): string {
  const segments = rawText.split(/\r?\n|[；;]/).map((segment) => segment.trim()).filter(Boolean);
  const matches: string[] = [];

  for (const segment of segments) {
    for (const label of labels) {
      const colonMatch = segment.match(new RegExp(`${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`, 'i'));
      if (colonMatch?.[1]) {
        matches.push(colonMatch[1]);
        continue;
      }

      if (segment.length <= 120 && includesCaseInsensitive(segment, label)) {
        matches.push(segment.replace(new RegExp(escapeRegExp(label), 'ig'), ''));
      }
    }
  }

  return matches.join('、');
}

function splitFieldValues(value: string): string[] {
  return value
    .split(/[、,，/|｜]+/)
    .map((item) => item.replace(/^(岗位|城市|行业|方向|意向|目标|期望)\s*[:：]?\s*/i, '').trim())
    .filter(Boolean);
}

function isUsefulProfileValue(value: string, knownValues: string[]): boolean {
  if (knownValues.some((knownValue) => includesCaseInsensitive(value, knownValue))) return false;
  return value.length >= 2 && value.length <= 32 && !/[。！？!?]/.test(value);
}

function uniqueClean(values: string[]): string[] {
  return uniqueBy(values.map((item) => item.trim()).filter(Boolean), (item) => item.toLowerCase());
}

function includesCaseInsensitive(value: string, target: string): boolean {
  return value.toLowerCase().includes(target.toLowerCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

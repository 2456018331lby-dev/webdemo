import type { ResumeProfile } from './types';
import { tokenize, uniqueBy } from './text';

const COMMON_SKILLS = [
  'typescript',
  'javascript',
  'react',
  'vue',
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
  const yearsMatch = rawText.match(/(\d{1,2})\s*(?:年|years?)/i);

  return {
    targetTitles: uniqueBy([...(input.targetTitles ?? [])], (item) => item.toLowerCase()).filter(Boolean),
    targetLocations: uniqueBy([...(input.targetLocations ?? [])], (item) => item.toLowerCase()).filter(Boolean),
    skills: uniqueBy([...(input.skills ?? []), ...inferredSkills], (item) => item.toLowerCase()).filter(Boolean),
    industries: uniqueBy([...(input.industries ?? [])], (item) => item.toLowerCase()).filter(Boolean),
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

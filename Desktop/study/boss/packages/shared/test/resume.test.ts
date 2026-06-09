import { describe, expect, it } from 'vitest';
import { parseResumeText } from '../src';

describe('parseResumeText', () => {
  it('infers target titles, locations, industries, skills, and experience from resume intent fields', () => {
    const resume = parseResumeText({
      rawText: [
        '姓名：李同学',
        '求职意向：AI应用开发工程师、全栈工程师',
        '期望城市：上海 / 杭州 / 远程',
        '行业意向：人工智能、SaaS',
        '技能栈：React TypeScript Node Python',
        '3年 Web 应用开发经验'
      ].join('\n')
    });

    expect(resume.targetTitles).toEqual(expect.arrayContaining(['AI应用开发工程师', '全栈工程师']));
    expect(resume.targetLocations).toEqual(expect.arrayContaining(['上海', '杭州', '远程']));
    expect(resume.industries).toEqual(expect.arrayContaining(['人工智能', 'SaaS']));
    expect(resume.skills).toEqual(expect.arrayContaining(['react', 'typescript', 'node', 'python']));
    expect(resume.yearsOfExperience).toBe(3);
  });

  it('merges manual profile hints with inferred values without duplicates', () => {
    const resume = parseResumeText({
      rawText: '目标岗位：前端工程师\n技能：React TypeScript',
      targetTitles: ['前端工程师', '全栈工程师'],
      targetLocations: ['深圳'],
      skills: ['React'],
      industries: ['互联网']
    });

    expect(resume.targetTitles).toEqual(['前端工程师', '全栈工程师']);
    expect(resume.targetLocations).toEqual(['深圳']);
    expect(resume.skills.filter((skill) => skill.toLowerCase() === 'react')).toHaveLength(1);
    expect(resume.industries).toEqual(['互联网']);
  });

  it('does not treat unrelated experience cities as target locations without an intent label', () => {
    const resume = parseResumeText({
      rawText: '工作经历：2024 年在上海参与 React 项目。求职意向：前端工程师。'
    });

    expect(resume.targetTitles).toContain('前端工程师');
    expect(resume.targetLocations).toEqual([]);
  });
});

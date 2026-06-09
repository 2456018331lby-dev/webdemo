import {
  buildResearchQuery,
  addMinutes,
  getResearchCoverageForJob,
  parseCompanyResearch,
  parseResumeText,
  rankQueueItemsByCompany,
  type BlacklistRule,
  type QueueItem,
  type QueuePolicy,
  type ResearchCriterionKey
} from '@job-assistant/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExtensionState, PendingResearchTarget } from '../storage/state';
import { sendRuntimeMessage } from './runtime';
import './styles.css';

function SidePanelApp() {
  const [state, setState] = useState<ExtensionState | undefined>();
  const [resumeText, setResumeText] = useState('');
  const [targets, setTargets] = useState('');
  const [locations, setLocations] = useState('');
  const [skills, setSkills] = useState('');
  const [industries, setIndustries] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [researchCompany, setResearchCompany] = useState('');
  const [researchJobTitle, setResearchJobTitle] = useState('');
  const [researchUrl, setResearchUrl] = useState('');
  const [researchTitle, setResearchTitle] = useState('');
  const [researchSummary, setResearchSummary] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    refresh();
  }, []);

  const rankedCompanies = useMemo(() => rankQueueItemsByCompany(state?.queue.items ?? []), [state]);

  async function refresh() {
    const response = await sendRuntimeMessage({ type: 'GET_STATE' });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function saveResume() {
    const resume = parseResumeText({
      rawText: resumeText,
      targetTitles: splitCsv(targets),
      targetLocations: splitCsv(locations),
      skills: splitCsv(skills),
      industries: splitCsv(industries)
    });
    const response = await sendRuntimeMessage({ type: 'SAVE_RESUME', resume });
    if (response.ok) {
      setState(response.state);
      setTargets(resume.targetTitles.join(', '));
      setLocations(resume.targetLocations.join(', '));
      setSkills(resume.skills.join(', '));
      setIndustries(resume.industries.join(', '));
    } else setError(response.error);
  }

  async function importResumeFile(file: File | undefined) {
    if (!file) return;
    if (!isReadableResumeFile(file)) {
      setError('请导入 .txt、.md、.markdown、.html 或 .json 文本简历，PDF/Word 请先复制文本内容。');
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        setError('导入的简历文件没有可读取文本。');
        return;
      }
      setResumeText(text);
      setResumeFileName(file.name);
      setError(undefined);
    } catch (readError) {
      setError(`读取简历文件失败：${readError instanceof Error ? readError.message : String(readError)}`);
    }
  }

  async function scanActiveTab() {
    const response = await sendRuntimeMessage({ type: 'SCAN_ACTIVE_TAB' });
    if (!response.ok) setError(response.error);
    setTimeout(refresh, 500);
  }

  async function updatePolicy(next: QueuePolicy) {
    const response = await sendRuntimeMessage({ type: 'SET_POLICY', policy: next });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function addBlacklistRule(kind: BlacklistRule['kind'], value: string) {
    if (!state || !value.trim()) return;
    const blacklist: BlacklistRule[] = [
      ...state.blacklist,
      { id: `${kind}-${Date.now()}`, kind, value: value.trim(), enabled: true, reason: '用户添加' }
    ];
    const response = await sendRuntimeMessage({ type: 'SET_BLACKLIST', blacklist });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function runNextDryRun() {
    const response = await sendRuntimeMessage({ type: 'RUN_NEXT_DRY_RUN' });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function startQueueAutomation() {
    const response = await sendRuntimeMessage({ type: 'START_QUEUE_AUTOMATION' });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function stopQueueAutomation() {
    const response = await sendRuntimeMessage({ type: 'STOP_QUEUE_AUTOMATION' });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function saveResearch() {
    if (!researchCompany.trim() || !researchSummary.trim()) return;
    const record = parseCompanyResearch({
      companyName: researchCompany,
      jobTitle: researchJobTitle,
      sourceUrl: researchUrl,
      sourceTitle: researchTitle,
      summary: researchSummary,
      capturedAt: new Date().toISOString()
    });
    const response = await sendRuntimeMessage({ type: 'SAVE_RESEARCH', record });
    if (response.ok) {
      setState(response.state);
      setResearchSummary('');
    } else {
      setError(response.error);
    }
  }

  async function openResearchSearch(companyName = researchCompany, jobTitle = researchJobTitle) {
    if (!companyName.trim()) return;
    const response = await sendRuntimeMessage({ type: 'OPEN_RESEARCH_SEARCH', companyName, jobTitle });
    if (!response.ok) setError(response.error);
  }

  async function openResearchSearchesForItem(item: QueueItem, criteria: ResearchCriterionKey[]) {
    const selectedCriteria = criteria.length > 0 ? criteria : undefined;
    const response = await sendRuntimeMessage({
      type: 'OPEN_RESEARCH_SEARCHES',
      companyName: item.job.company.name,
      jobTitle: item.job.title,
      criteria: selectedCriteria,
      jobId: item.job.id,
      platform: item.job.platform
    });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function openResearchSearchesForTarget(target: PendingResearchTarget) {
    const response = await sendRuntimeMessage({
      type: 'OPEN_RESEARCH_SEARCHES',
      companyName: target.companyName,
      jobTitle: target.jobTitle,
      criteria: target.missingKeys.length > 0 ? target.missingKeys : undefined,
      jobId: target.jobId,
      platform: target.platform
    });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function openQueueResearchSearches() {
    const response = await sendRuntimeMessage({ type: 'OPEN_QUEUE_RESEARCH_SEARCHES', limit: 3 });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function captureActiveResearch() {
    if (!researchCompany.trim()) return;
    const response = await sendRuntimeMessage({ type: 'CAPTURE_ACTIVE_RESEARCH', companyName: researchCompany, jobTitle: researchJobTitle });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  async function capturePendingResearch(target: PendingResearchTarget) {
    fillResearchTarget(target);
    const response = await sendRuntimeMessage({ type: 'CAPTURE_ACTIVE_RESEARCH', companyName: target.companyName, jobTitle: target.jobTitle });
    if (response.ok) setState(response.state);
    else setError(response.error);
  }

  function fillResearchTarget(target: PendingResearchTarget) {
    setResearchCompany(target.companyName);
    setResearchJobTitle(target.jobTitle ?? '');
    setResearchUrl('');
    setResearchTitle('');
  }

  function prepareResearchForItem(item: QueueItem) {
    setResearchCompany(item.job.company.name);
    setResearchJobTitle(item.job.title);
    setResearchUrl('');
    setResearchTitle('');
    void openResearchSearch(item.job.company.name, item.job.title);
  }

  const policy = state?.policy;

  return (
    <main className="app">
      <section className="card">
        <span className="badge">本地优先 · 安全投递</span>
        <h1>求职投递助手</h1>
        <p className="muted">默认 dry-run，不绕过验证码/风控；识别异常会暂停。</p>
        {error && <p className="muted">错误：{error}</p>}
      </section>

      <section className="card">
        <h2>1. 简历画像</h2>
        <input data-testid="resume-file-input" type="file" accept=".txt,.md,.markdown,.html,.htm,.json,text/plain,text/markdown,text/html,application/json" onChange={(event) => importResumeFile(event.target.files?.[0])} />
        {resumeFileName && <p className="muted">已导入：{resumeFileName}</p>}
        <textarea data-testid="resume-textarea" placeholder="粘贴或导入简历文本。" value={resumeText} onChange={(event) => setResumeText(event.target.value)} />
        <div className="row">
          <input placeholder="目标岗位（可从简历自动识别）" value={targets} onChange={(event) => setTargets(event.target.value)} aria-label="目标岗位" />
          <input placeholder="目标城市（可从简历自动识别）" value={locations} onChange={(event) => setLocations(event.target.value)} aria-label="目标城市" />
        </div>
        <input placeholder="技能（可从简历自动识别）" value={skills} onChange={(event) => setSkills(event.target.value)} aria-label="技能" />
        <input placeholder="目标行业（可从简历自动识别）" value={industries} onChange={(event) => setIndustries(event.target.value)} aria-label="目标行业" />
        <button data-testid="save-resume-button" disabled={!resumeText.trim()} onClick={saveResume}>保存简历画像</button>
        {state?.resume && (
          <p className="muted">
            已保存：{state.resume.targetTitles.length} 个目标岗位，{state.resume.targetLocations.length} 个目标城市，{state.resume.skills.length} 个技能，{state.resume.industries.length} 个目标行业。
          </p>
        )}
      </section>

      <section className="card">
        <h2>2. 页面扫描与队列</h2>
        <div className="row">
          <button onClick={scanActiveTab}>扫描当前招聘页</button>
          <button className="secondary" onClick={refresh}>刷新状态</button>
        </div>
        <p className="muted">已识别岗位：{state?.jobs.length ?? 0}；队列：{state?.queue.items.length ?? 0}</p>
      </section>

      {policy && (
        <section className="card">
          <h2>3. 投递策略</h2>
          <div className="row">
            <select value={policy.mode} onChange={(event) => updatePolicy({ ...policy, mode: event.target.value as QueuePolicy['mode'] })}>
              <option value="dry-run">dry-run 只记录</option>
              <option value="manual-approval">人工确认</option>
              <option value="auto">自动队列</option>
            </select>
            <input type="number" value={policy.dailyLimit} onChange={(event) => updatePolicy({ ...policy, dailyLimit: Number(event.target.value) })} />
          </div>
          <input type="number" value={policy.minMinutesBetweenActions} onChange={(event) => updatePolicy({ ...policy, minMinutesBetweenActions: Number(event.target.value) })} />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={policy.requireResearchBeforeAuto}
              onChange={(event) => updatePolicy({ ...policy, requireResearchBeforeAuto: event.target.checked })}
            />
            <span>自动投递前要求全网资料</span>
          </label>
          <div className="row">
            <button className="warning" onClick={runNextDryRun}>dry-run 下一条</button>
            <button className="secondary" disabled={policy.mode !== 'auto' || state?.runner.enabled} onClick={startQueueAutomation}>启动自动队列</button>
            <button className="secondary" disabled={!state?.runner.enabled} onClick={stopQueueAutomation}>停止自动队列</button>
          </div>
          <p className="muted" data-testid="queue-policy-status">{formatQueuePolicyStatus(state?.queue, policy)}</p>
          <p className="muted">
            自动队列：{state?.runner.enabled ? '运行中' : '未启动'}
            {state?.runner.lastTickAt ? ` · 上次执行 ${new Date(state.runner.lastTickAt).toLocaleString()}` : ''}
            {state?.runner.message ? ` · ${state.runner.message}` : ''}
          </p>
        </section>
      )}

      <section className="card">
        <h2>4. 黑名单</h2>
        <div className="row">
          <button className="secondary" onClick={() => addBlacklistRule('keyword', '大小周')}>+ 大小周</button>
          <button className="secondary" onClick={() => addBlacklistRule('keyword', '销售')}>+ 销售</button>
          <button className="secondary" onClick={() => addBlacklistRule('keyword', '薪资面议')}>+ 薪资面议</button>
        </div>
        <p className="muted">规则：{state?.blacklist.filter((rule) => rule.enabled).map((rule) => rule.value).join('、')}</p>
      </section>

      <section className="card">
        <h2>5. 全网资料</h2>
        <div className="row">
          <input placeholder="公司名" value={researchCompany} onChange={(event) => setResearchCompany(event.target.value)} />
          <input placeholder="岗位名（可选）" value={researchJobTitle} onChange={(event) => setResearchJobTitle(event.target.value)} />
        </div>
        <div className="row">
          <input placeholder="来源链接（可选）" value={researchUrl} onChange={(event) => setResearchUrl(event.target.value)} />
          <input placeholder="来源标题（可选）" value={researchTitle} onChange={(event) => setResearchTitle(event.target.value)} />
        </div>
        <textarea className="compact-textarea" placeholder="粘贴搜索到的薪资、奖金、福利、双休/大小周、年假、加班、风险等资料摘要。" value={researchSummary} onChange={(event) => setResearchSummary(event.target.value)} />
        <div className="row">
          <button disabled={!researchCompany.trim() || !researchSummary.trim()} onClick={saveResearch}>保存并重排队列</button>
          <button className="secondary" disabled={!researchCompany.trim()} onClick={() => openResearchSearch()}>打开搜索</button>
        </div>
        <div className="row">
          <button className="secondary" disabled={!researchCompany.trim()} onClick={captureActiveResearch}>捕获当前页资料</button>
          <button
            className="secondary"
            data-testid="queue-research-preflight-button"
            disabled={(state?.queue.items.length ?? 0) === 0}
            onClick={openQueueResearchSearches}
          >
            补齐队列资料
          </button>
        </div>
        <p className="muted">已保存资料：{state?.research.length ?? 0} 条。保存后会重新计算公司分和岗位排序。</p>
        {(state?.pendingResearchTargets.length ?? 0) > 0 && (
          <div className="list">
            {(state?.pendingResearchTargets ?? []).slice(0, 5).map((target) => (
              <article className="research-item" key={target.id}>
                <strong>{target.companyName}{target.jobTitle ? ` · ${target.jobTitle}` : ''}</strong>
                <p className="muted">待补：{target.missingLabels.join('、') || '全网资料'} · {target.source === 'auto-queue' ? '自动队列触发' : '手动搜索触发'}</p>
                <div className="row">
                  <button className="secondary" onClick={() => fillResearchTarget(target)}>带入表单</button>
                  <button className="secondary" onClick={() => openResearchSearchesForTarget(target)}>继续搜索</button>
                  <button className="secondary" onClick={() => capturePendingResearch(target)}>捕获当前页</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="list">
          {(state?.research ?? []).slice(0, 5).map((record) => (
            <article className="research-item" key={record.id}>
              <strong>{record.companyName}{record.jobTitle ? ` · ${record.jobTitle}` : ''}</strong>
              <p className="muted">
                置信度 {record.confidence} · 薪资 {record.salary?.raw ?? '未知'} · 福利 {record.benefits.length} · 风险 {record.warnings.length}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>6. 投递队列</h2>
        <div className="list">
          {rankedCompanies.slice(0, 12).map((company) => (
            <article className="company-group" key={company.companyKey}>
              <div className="company-heading">
                <strong>#{company.companyRank} {company.companyName}</strong>
                <span className="rank-chip">公司 {company.companyGrade} · {Math.round(company.companyScore)}</span>
              </div>
              <p className="muted">
                公司依据：{formatCompanyReasons(company.companyReasons)}
              </p>
              {company.items.slice(0, 5).map((rankedItem) => {
                const item = rankedItem.item;
                const coverage = getResearchCoverageForJob(item.job, state?.research ?? []);
                return (
                  <div className="job" key={item.id}>
                    <strong>#{rankedItem.jobRankInCompany} {item.job.title}</strong>
                    <p className="muted">{item.job.location ?? '地点未知'} · {item.status}</p>
                    <p>
                      <span className="score">{item.score.score}</span> / 100 · 岗位 {item.score.jobGrade ?? '-'}
                    </p>
                    <p className="muted">薪酬 {item.score.compensationScore ?? 0} · 休息/年假 {item.score.workLifeScore ?? 0} · 匹配 {item.score.jobFitScore ?? 0}</p>
                    <p className="muted">
                      全网资料 {coverage.completedCount}/{coverage.requiredCount} · 来源 {coverage.sourceCount}
                      {coverage.complete ? ' · 覆盖完整' : ` · 缺：${coverage.missingLabels.join('、')}`}
                    </p>
                    <div className="coverage-row">
                      {coverage.criteria.map((criterion) => (
                        <span
                          className={`coverage-chip ${criterion.present ? 'present' : 'missing'}`}
                          key={criterion.key}
                          title={criterion.details.join('、') || `缺少${criterion.label}资料`}
                        >
                          {criterion.label}
                        </span>
                      ))}
                    </div>
                    <p className="muted">{item.score.reasons.slice(0, 3).map((reason) => `${reason.label}: ${Math.round(reason.delta)}`).join('；')}</p>
                    <div className="row">
                      <button className="secondary" disabled={coverage.missingKeys.length === 0} onClick={() => openResearchSearchesForItem(item, coverage.missingKeys)}>搜索缺失资料</button>
                      <button className="secondary" onClick={() => prepareResearchForItem(item)}>通用搜索</button>
                    </div>
                    <a className="research-link" href={buildResearchSearchUrl(item)} target="_blank" rel="noreferrer">打开通用搜索链接</a>
                  </div>
                );
              })}
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>7. 审计日志</h2>
        <div className="list">
          {(state?.auditLog ?? []).slice(0, 12).map((entry) => (
            <div className="log" key={entry.id}>
              <strong>{entry.action}</strong>
              <p className="muted">{entry.message}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function splitCsv(value: string): string[] {
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

function isReadableResumeFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/json') return true;
  return ['.txt', '.md', '.markdown', '.html', '.htm', '.json'].some((extension) => lowerName.endsWith(extension));
}

function buildResearchSearchUrl(item: QueueItem): string {
  const query = buildResearchQuery(item.job.company.name, item.job.title);
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}

function formatCompanyReasons(reasons: Array<{ label: string; delta: number }>): string {
  if (reasons.length === 0) return '暂无公司侧资料，等待岗位扫描或全网资料补齐。';
  return reasons.slice(0, 4).map((reason) => `${reason.label} ${formatDelta(reason.delta)}`).join('；');
}

function formatDelta(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function formatQueuePolicyStatus(queue: ExtensionState['queue'] | undefined, policy: QueuePolicy): string {
  const applicationsToday = queue?.applicationsToday ?? 0;
  const remaining = Math.max(0, policy.dailyLimit - applicationsToday);
  const parts = [
    `今日新投递 ${applicationsToday}/${policy.dailyLimit}`,
    `剩余 ${remaining}`,
    `安全间隔 ${policy.minMinutesBetweenActions} 分钟`
  ];

  if (queue?.lastApplicationAt) {
    parts.push(`下次可投 ${new Date(addMinutes(queue.lastApplicationAt, policy.minMinutesBetweenActions)).toLocaleString()}`);
  } else {
    parts.push('下次可投：现在');
  }

  return parts.join(' · ');
}

createRoot(document.getElementById('root')!).render(<SidePanelApp />);

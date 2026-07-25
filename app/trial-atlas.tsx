"use client";

import { useEffect, useMemo, useState } from "react";
import data from "./trials.json";
import akesoCompany from "./akeso.json";
import lisaftoclaxCompany from "./lisaftoclax.json";

type FDA = {
  regulatoryId: string;
  designation: string;
  submissionStatus: string;
  lastVerified: string;
};

type Eligibility = {
  keyInclusion: string[];
  keyExclusion: string[];
  stratificationFactors: string[];
};

type SubgroupAnalysis = {
  dimension: string;
  subgroup: string;
  n: string;
  endpoint: string;
  effect: string;
  ci: string;
  interactionP: string;
  conclusion: string;
};

type ResultMetric = {
  label: string;
  value: string;
  context?: string;
};

type BaselineCharacteristic = {
  label: string;
  value: string;
  context?: string;
};

type EvidenceSource = {
  label: string;
  url: string;
};

type Trial = {
  id: string;
  name: string;
  nct: string;
  phase: string;
  status: string;
  indication: string;
  design: string;
  arms: string;
  population: string;
  eligibility: Eligibility;
  subgroupAnalyses: SubgroupAnalysis[];
  enrollment: number | string;
  primaryEndpoint: string;
  secondaryEndpoints: string[];
  startDate: string;
  primaryCompletion: string;
  countries: string[];
  sponsor: string;
  fda: FDA;
  result: string;
  source: string;
  dataCut?: string;
  evidenceLevel?: string;
  baselineCharacteristics?: BaselineCharacteristic[];
  efficacyHighlights?: ResultMetric[];
  safetyHighlights?: ResultMetric[];
  pkHighlights?: ResultMetric[];
  sources?: EvidenceSource[];
};

type Pipeline = {
  id: string;
  code: string;
  genericName: string;
  target: string;
  modality: string;
  stage: string;
  indications: string[];
  trials: Trial[];
};

type Company = {
  id: string;
  name: string;
  ticker: string;
  focus: string;
  pipelines: Pipeline[];
};

type FlatTrial = Trial & {
  companyName: string;
  pipelineCode: string;
  pipelineId: string;
};

const companies = [
  ...(data.companies as Company[]).filter((company) => company.id !== "akeso"),
  akesoCompany as Company,
  lisaftoclaxCompany as Company,
];
const allPipelines = companies.flatMap((company) =>
  company.pipelines.map((pipeline) => ({ ...pipeline, company }))
);
const allTrials: FlatTrial[] = allPipelines.flatMap(({ company, ...pipeline }) =>
  pipeline.trials.map((trial) => ({
    ...trial,
    companyName: company.name,
    pipelineCode: pipeline.code,
    pipelineId: pipeline.id,
  }))
);

const toneClass = (status: string) => {
  if (status.includes("完成") || status.includes("获批")) return "status status-done";
  if (status.includes("招募")) return "status status-live";
  return "status status-hold";
};

function Header({
  onHome,
}: {
  onHome: () => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="返回首页">
        <span className="brand-mark">TS</span>
        <span>
          <b>TrialScope</b>
          <small>Clinical Intelligence</small>
        </span>
      </button>
      <nav>
        <button onClick={onHome}>管线图谱</button>
        <a href="/compare">临床对比</a>
        <span className="source-badge">LOCAL DATA</span>
      </nav>
    </header>
  );
}

function Home({
  onPipeline,
}: {
  onPipeline: (pipelineId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const visibleCompanies = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return companies;
    return companies
      .map((company) => ({
        ...company,
        pipelines: company.pipelines.filter((pipeline) =>
          [
            company.name,
            company.ticker,
            pipeline.code,
            pipeline.genericName,
            pipeline.target,
            ...pipeline.indications,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        ),
      }))
      .filter((company) => company.pipelines.length > 0);
  }, [query]);

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">临床研发情报 · 本地数据驱动</span>
          <h1>
            从公司到临床，
            <br />
            一屏看清药物管线。
          </h1>
          <p>
            统一整理关键试验设计、入组标准、亚组分析与 FDA 注册信息，
            快速追踪竞争格局并完成跨项目对比。
          </p>
          <label className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索公司、药物、靶点或适应症"
              aria-label="搜索公司、药物、靶点或适应症"
            />
            <kbd>⌘ K</kbd>
          </label>
        </div>
        <div className="hero-metrics">
          <div>
            <strong>{companies.length}</strong>
            <span>家公司</span>
          </div>
          <div>
            <strong>{allPipelines.length}</strong>
            <span>条管线</span>
          </div>
          <div>
            <strong>{allTrials.length}</strong>
            <span>项临床</span>
          </div>
          <small>
            <i />
            数据更新于 {data.updatedAt}
          </small>
        </div>
      </section>

      <section className="content-section companies-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">COMPANIES</span>
            <h2>公司与研发管线</h2>
          </div>
          <span className="muted">{visibleCompanies.length} 家公司</span>
        </div>
        <div className="company-grid">
          {visibleCompanies.map((company, index) => (
            <article className="company-card" key={company.id}>
              <div className="company-head">
                <span className={`company-avatar avatar-${index + 1}`}>
                  {company.name.slice(0, 1)}
                </span>
                <div>
                  <h3>{company.name}</h3>
                  <p>{company.ticker} · {company.focus}</p>
                </div>
                <span className="pipeline-count">{company.pipelines.length} PIPELINES</span>
              </div>
              <div className="pipeline-list">
                {company.pipelines.map((pipeline) => (
                  <button key={pipeline.id} onClick={() => onPipeline(pipeline.id)}>
                    <span>
                      <b>{pipeline.code}</b>
                      <small>{pipeline.modality} · {pipeline.target}</small>
                    </span>
                    <span className="pipeline-meta">
                      <em>{pipeline.stage}</em>
                      <i>→</i>
                    </span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function TrialDocument({
  trial,
  pipeline,
  company,
}: {
  trial: Trial;
  pipeline: Pipeline;
  company: Company;
}) {
  return (
    <main className="clinical-page" aria-label={`${trial.name} 临床详情`}>
      <div className="clinical-document">
        <div className="detail-top">
          <div>
            <span className="section-kicker">FDA CLINICAL TEMPLATE</span>
            <h2>{trial.name}</h2>
            <p>{company.name} · {pipeline.code} · {trial.nct}</p>
          </div>
          <a className="clinical-back" href={`/#pipeline/${pipeline.id}`}>← 返回管线</a>
        </div>

        <div className="detail-status-row">
          <span className={toneClass(trial.status)}>{trial.status}</span>
          <span className="phase-pill">{trial.phase}</span>
          {trial.dataCut && <span className="clinical-datacut">数据截止 {trial.dataCut}</span>}
          {trial.evidenceLevel && <span className="clinical-evidence">{trial.evidenceLevel}</span>}
        </div>

        <section className="detail-section">
          <h3><span>01</span>试验识别</h3>
          <div className="field-grid">
            <Info label="官方标题 / 项目名" value={trial.name} />
            <Info label="ClinicalTrials.gov ID" value={trial.nct} mono />
            <Info label="申办方" value={trial.sponsor} />
            <Info label="研究阶段" value={trial.phase} />
          </div>
        </section>

        <section className="detail-section">
          <h3><span>02</span>研究设计与入组人群</h3>
          <div className="field-grid">
            <Info label="适应症" value={trial.indication} wide />
            <Info label="试验设计" value={trial.design} wide />
            <Info label="目标入组人群" value={trial.population} wide />
            <Info label="治疗组 / 对照组" value={trial.arms} wide />
            <Info
              label="计划 / 实际入组"
              value={typeof trial.enrollment === "number" ? `${trial.enrollment} 例` : trial.enrollment}
            />
            <Info label="研究国家 / 地区" value={trial.countries.join("、")} />
          </div>
          <div className="eligibility-grid">
            <EligibilityBlock title="关键纳入标准" marker="IN" items={trial.eligibility.keyInclusion} tone="include" />
            <EligibilityBlock title="关键排除标准" marker="EX" items={trial.eligibility.keyExclusion} tone="exclude" />
            <EligibilityBlock title="随机分层因素" marker="ST" items={trial.eligibility.stratificationFactors} tone="stratify" />
          </div>
          {trial.baselineCharacteristics && trial.baselineCharacteristics.length > 0 && (
            <div className="baseline-block">
              <div className="baseline-heading">
                <strong>实际入组基线</strong>
                <span>分母为 ITT；“未披露”不等于无该类患者</span>
              </div>
              <div className="baseline-grid">
                {trial.baselineCharacteristics.map((item) => (
                  <div className="baseline-item" key={`${item.label}-${item.value}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.context && <small>{item.context}</small>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="detail-section">
          <h3><span>03</span>终点与时间轴</h3>
          <div className="field-grid">
            <Info label="主要终点" value={trial.primaryEndpoint} wide />
            <Info label="次要终点" value={trial.secondaryEndpoints.join(" · ")} wide />
            <Info label="研究启动" value={trial.startDate} />
            <Info label="主要完成日期" value={trial.primaryCompletion} />
          </div>
        </section>

        {(trial.efficacyHighlights?.length || trial.safetyHighlights?.length || trial.pkHighlights?.length) && (
          <section className="detail-section results-section">
            <div className="results-heading">
              <h3><span>04</span>临床结果摘要</h3>
              <div>
                {trial.dataCut && <span>数据截止 {trial.dataCut}</span>}
                {trial.evidenceLevel && <b>{trial.evidenceLevel}</b>}
              </div>
            </div>
            <div className="results-columns">
              <ResultMetrics title="疗效结果" metrics={trial.efficacyHighlights ?? []} tone="efficacy" />
              <ResultMetrics title="安全性结果" metrics={trial.safetyHighlights ?? []} tone="safety" />
              {trial.pkHighlights && trial.pkHighlights.length > 0 && (
                <ResultMetrics title="药代动力学（单次口服）" metrics={trial.pkHighlights} tone="pk" />
              )}
            </div>
          </section>
        )}

        <section className="detail-section subgroup-section">
          <div className="subgroup-heading">
            <h3><span>05</span>亚组分析</h3>
            <span>SUBGROUP / INTERACTION</span>
          </div>
          <div className="subgroup-table-wrap">
            <table className="subgroup-table">
              <thead>
                <tr>
                  <th>分析维度</th>
                  <th>亚组</th>
                  <th>样本量</th>
                  <th>终点</th>
                  <th>效应值</th>
                  <th>95% CI</th>
                  <th>交互 P 值</th>
                  <th>结论 / 解释</th>
                </tr>
              </thead>
              <tbody>
                {trial.subgroupAnalyses.map((analysis, index) => (
                  <tr key={`${analysis.dimension}-${index}`}>
                    <th>{analysis.dimension}</th>
                    <td>{analysis.subgroup}</td>
                    <td>{analysis.n}</td>
                    <td>{analysis.endpoint}</td>
                    <td className="effect-cell">{analysis.effect}</td>
                    <td>{analysis.ci}</td>
                    <td>{analysis.interactionP}</td>
                    <td>{analysis.conclusion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="analysis-note">
            记录规范：注明预设或探索性分析、分析集、效应量类型、多重性控制及交互检验；
            不应仅凭单个亚组是否“显著”判断组间差异。
          </p>
        </section>

        <section className="detail-section fda-section">
          <div className="fda-heading">
            <h3><span>06</span>FDA 注册信息</h3>
            <span>REGULATORY</span>
          </div>
          <div className="field-grid">
            <Info label="IND / 监管识别" value={trial.fda.regulatoryId} />
            <Info label="监管认定" value={trial.fda.designation} />
            <Info label="申报状态" value={trial.fda.submissionStatus} />
            <Info label="最后核验" value={trial.fda.lastVerified} />
          </div>
        </section>

        <section className="detail-section">
          <h3><span>07</span>结果与溯源</h3>
          <div className="field-grid">
            <Info label="结果摘要" value={trial.result} wide />
            <Info label="数据来源" value={trial.source} />
            <Info label="本地数据核验" value={`更新于 ${data.updatedAt}`} />
          </div>
          <p className="template-note">
            模板建议：正式使用时补充 FDA Drugs@FDA、FDA 公告、研究方案版本、
            统计分析计划、关键安全性事件及原始来源链接。
          </p>
          {trial.sources && trial.sources.length > 0 && (
            <div className="source-links">
              <span>原始来源</span>
              <div>
                {trial.sources.map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                    {source.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export function ClinicalTrialPage() {
  const [trialId, setTrialId] = useState<string | null>(null);

  useEffect(() => {
    setTrialId(new URLSearchParams(window.location.search).get("trial"));
  }, []);

  const flatTrial = allTrials.find((trial) => trial.id === trialId);
  const pipelineRecord = flatTrial
    ? allPipelines.find((pipeline) => pipeline.id === flatTrial.pipelineId)
    : undefined;

  if (!flatTrial || !pipelineRecord) {
    return (
      <div className="clinical-loading">
        <span className="brand-mark">TS</span>
        <p>{trialId === null ? "正在读取临床数据…" : "未找到该临床记录"}</p>
        {trialId !== null && <a href="/">返回管线图谱</a>}
      </div>
    );
  }

  return (
    <div className="app-shell clinical-app">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">TS</span>
          <span>
            <b>TrialScope</b>
            <small>Clinical Intelligence</small>
          </span>
        </a>
        <nav>
          <a href={`/#pipeline/${pipelineRecord.id}`}>返回 {pipelineRecord.code}</a>
          <span className="source-badge">LOCAL DATA</span>
        </nav>
      </header>
      <TrialDocument
        trial={flatTrial}
        pipeline={pipelineRecord}
        company={pipelineRecord.company}
      />
      <footer>
        <span><b>TrialScope</b> · 本地临床情报模板</span>
        <span>{flatTrial.nct}</span>
        <span>仅供研究，不构成医疗建议</span>
      </footer>
    </div>
  );
}

function ResultMetrics({
  title,
  metrics,
  tone,
}: {
  title: string;
  metrics: ResultMetric[];
  tone: "efficacy" | "safety" | "pk";
}) {
  return (
    <div className={`result-metrics ${tone}`}>
      <h4>{title}</h4>
      {metrics.length ? (
        <div>
          {metrics.map((metric) => (
            <div className="result-metric" key={`${metric.label}-${metric.value}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              {metric.context && <small>{metric.context}</small>}
            </div>
          ))}
        </div>
      ) : (
        <p>尚未披露结果</p>
      )}
    </div>
  );
}

function EligibilityBlock({
  title,
  marker,
  items,
  tone,
}: {
  title: string;
  marker: string;
  items: string[];
  tone: "include" | "exclude" | "stratify";
}) {
  return (
    <div className={`eligibility-block ${tone}`}>
      <div>
        <span>{marker}</span>
        <strong>{title}</strong>
      </div>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Info({
  label,
  value,
  wide,
  mono,
}: {
  label: string;
  value: string;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={wide ? "info-field wide" : "info-field"}>
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}

function PipelinePage({
  pipelineId,
  selectedIds,
  onToggle,
  onBack,
  onCompare,
}: {
  pipelineId: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onCompare: () => void;
}) {
  const found = allPipelines.find((item) => item.id === pipelineId) ?? allPipelines[0];
  const pipeline = found as Pipeline & { company: Company };

  return (
    <main className="pipeline-page">
      <section className="pipeline-hero">
        <button className="back-link" onClick={onBack}>← 返回管线图谱</button>
        <div className="pipeline-title-row">
          <div>
            <span className="eyebrow">{pipeline.company.name} · {pipeline.company.ticker}</span>
            <h1>{pipeline.code}</h1>
            <p>{pipeline.genericName} · {pipeline.modality}</p>
          </div>
          <div className="target-seal">
            <span>TARGET</span>
            <strong>{pipeline.target}</strong>
          </div>
        </div>
        <div className="pipeline-stats">
          <div><span>最高阶段</span><strong>{pipeline.stage}</strong></div>
          <div><span>临床试验</span><strong>{pipeline.trials.length} 项</strong></div>
          <div><span>适应症</span><strong>{pipeline.indications.length} 个</strong></div>
          <div><span>数据来源</span><strong>本地文件</strong></div>
        </div>
      </section>

      <section className="content-section pipeline-content">
        <div className="pipeline-toolbar">
          <div>
            <span className="section-kicker">CLINICAL PROGRAMS</span>
            <h2>临床试验项目</h2>
            <p>点击试验名称查看 FDA 临床信息模板</p>
          </div>
          <button className="primary-button" onClick={onCompare}>
            对比临床 <span>{selectedIds.length}</span>
          </button>
        </div>

        <div className="trial-table">
          <div className="trial-table-head">
            <span>试验 / 注册号</span>
            <span>阶段</span>
            <span>适应症</span>
            <span>状态</span>
            <span>入组</span>
            <span />
          </div>
          {pipeline.trials.map((trial) => (
            <div className="trial-row" key={trial.id}>
              <a className="trial-name" href={`/clinical?trial=${encodeURIComponent(trial.id)}`}>
                <strong>{trial.name}</strong>
                <small>{trial.nct}</small>
              </a>
              <span className="phase-pill">{trial.phase}</span>
              <p>{trial.indication}</p>
              <span className={toneClass(trial.status)}>{trial.status}</span>
              <b>{trial.enrollment}</b>
              <label className="compare-check">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(trial.id)}
                  onChange={() => onToggle(trial.id)}
                />
                <span>对比</span>
              </label>
            </div>
          ))}
        </div>

        <div className="indication-strip">
          <span>覆盖适应症</span>
          {pipeline.indications.map((indication) => <b key={indication}>{indication}</b>)}
        </div>
      </section>

    </main>
  );
}

const comparisonRows: [string, (trial: FlatTrial) => string][] = [
  ["阶段 / 状态", (trial) => `${trial.phase} · ${trial.status}`],
  ["适应症", (trial) => trial.indication],
  ["研究设计", (trial) => trial.design],
  ["目标入组人群", (trial) => trial.population],
  ["实际入组基线", (trial) => trial.baselineCharacteristics?.map((item) => `${item.label}：${item.value}`).join("；") || "尚未披露"],
  ["关键纳入标准", (trial) => trial.eligibility.keyInclusion.join("；")],
  ["关键排除标准", (trial) => trial.eligibility.keyExclusion.join("；")],
  ["分层因素", (trial) => trial.eligibility.stratificationFactors.join("；")],
  ["治疗方案", (trial) => trial.arms],
  ["计划 / 实际入组", (trial) => typeof trial.enrollment === "number" ? `${trial.enrollment} 例` : trial.enrollment],
  ["主要终点", (trial) => trial.primaryEndpoint],
  ["主要完成", (trial) => trial.primaryCompletion],
  ["疗效摘要", (trial) => (trial.efficacyHighlights ?? []).map((item) => `${item.label} ${item.value}`).join("；") || "尚未披露"],
  ["安全性摘要", (trial) => (trial.safetyHighlights ?? []).map((item) => `${item.label} ${item.value}`).join("；") || "尚未披露"],
  ["亚组分析", (trial) => trial.subgroupAnalyses.map((item) => `${item.dimension}：${item.subgroup}，${item.effect}`).join("；")],
  ["FDA / 申报", (trial) => `${trial.fda.regulatoryId} · ${trial.fda.submissionStatus}`],
];

function ComparisonTable({ trials }: { trials: FlatTrial[] }) {
  if (!trials.length) {
    return (
      <div className="compare-empty">
        <span>⇄</span>
        <h3>先选择需要对比的临床</h3>
        <p>可按公司、管线或关键词缩小范围，最多同时选择4项。</p>
      </div>
    );
  }

  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>对比维度</th>
            {trials.map((trial) => (
              <th key={trial.id}>
                <span>{trial.companyName}</span>
                <strong>{trial.name}</strong>
                <small>{trial.pipelineCode}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparisonRows.map(([label, getter]) => (
            <tr key={label}>
              <th>{label}</th>
              {trials.map((trial) => <td key={trial.id}>{getter(trial)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClinicalComparePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(8);

  useEffect(() => {
    const ids = (new URLSearchParams(window.location.search).get("trials") ?? "")
      .split(",")
      .filter((id) => allTrials.some((trial) => trial.id === id))
      .slice(0, 4);
    setSelectedIds(ids);
  }, []);

  useEffect(() => {
    const url = selectedIds.length ? `/compare?trials=${selectedIds.join(",")}` : "/compare";
    window.history.replaceState(null, "", url);
  }, [selectedIds]);

  const pipelineOptions = useMemo(
    () => allPipelines.filter(({ company }) => companyFilter === "all" || company.id === companyFilter),
    [companyFilter]
  );

  const filteredTrials = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return allTrials.filter((trial) => {
      const pipeline = allPipelines.find((item) => item.id === trial.pipelineId);
      const companyMatches = companyFilter === "all" || pipeline?.company.id === companyFilter;
      const pipelineMatches = pipelineFilter === "all" || trial.pipelineId === pipelineFilter;
      const keywordMatches = !keyword || [
        trial.name,
        trial.nct,
        trial.companyName,
        trial.pipelineCode,
        trial.indication,
        trial.phase,
        trial.status,
      ].join(" ").toLowerCase().includes(keyword);
      return companyMatches && pipelineMatches && keywordMatches;
    });
  }, [companyFilter, pipelineFilter, query]);

  const selected = allTrials.filter((trial) => selectedIds.includes(trial.id));

  const toggleTrial = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  };

  const changeCompany = (value: string) => {
    setCompanyFilter(value);
    setPipelineFilter("all");
    setVisibleLimit(8);
  };

  return (
    <div className="app-shell compare-app">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">TS</span>
          <span><b>TrialScope</b><small>Clinical Intelligence</small></span>
        </a>
        <nav>
          <a href="/">管线图谱</a>
          <a className="nav-active" href="/compare">临床对比</a>
          <span className="source-badge">LOCAL DATA</span>
        </nav>
      </header>

      <main className="compare-page">
        <section className="compare-page-header">
          <div>
            <span className="section-kicker">CROSS-PIPELINE COMPARISON</span>
            <h1>临床试验对比</h1>
            <p>跨公司、跨管线筛选临床；候选列表按需加载，避免数据增长后页面拥挤。</p>
          </div>
          <div className="compare-counter"><strong>{selected.length}</strong><span>/ 4 已选</span></div>
        </section>

        <section className="compare-workspace">
          <aside className="compare-selector">
            <div className="selector-title">
              <div><span>SELECT TRIALS</span><h2>选择临床</h2></div>
              <b>{filteredTrials.length} 项匹配</b>
            </div>

            <label className="compare-search">
              <span>搜索</span>
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleLimit(8); }}
                placeholder="试验名、NCT、适应症…"
              />
            </label>
            <div className="compare-filters">
              <label>
                <span>公司</span>
                <select value={companyFilter} onChange={(event) => changeCompany(event.target.value)}>
                  <option value="all">全部公司</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </label>
              <label>
                <span>管线</span>
                <select
                  value={pipelineFilter}
                  onChange={(event) => { setPipelineFilter(event.target.value); setVisibleLimit(8); }}
                >
                  <option value="all">全部管线</option>
                  {pipelineOptions.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.code}</option>)}
                </select>
              </label>
            </div>

            <div className="candidate-list">
              {filteredTrials.slice(0, visibleLimit).map((trial) => {
                const isSelected = selectedIds.includes(trial.id);
                const selectionFull = selectedIds.length >= 4 && !isSelected;
                return (
                  <button
                    key={trial.id}
                    className={isSelected ? "candidate-row selected" : "candidate-row"}
                    onClick={() => toggleTrial(trial.id)}
                    disabled={selectionFull}
                  >
                    <span>
                      <b>{trial.name}</b>
                      <small>{trial.companyName} · {trial.pipelineCode}</small>
                      <em>{trial.nct} · {trial.phase}</em>
                    </span>
                    <i>{isSelected ? "已选" : selectionFull ? "已满" : "加入"}</i>
                  </button>
                );
              })}
              {!filteredTrials.length && <p className="candidate-empty">没有符合条件的临床</p>}
            </div>

            {visibleLimit < filteredTrials.length && (
              <button className="load-more" onClick={() => setVisibleLimit((limit) => limit + 8)}>
                再显示 {Math.min(8, filteredTrials.length - visibleLimit)} 项
              </button>
            )}
          </aside>

          <section className="compare-results">
            <div className="selected-trials">
              <div className="selected-heading">
                <span>当前对比</span>
                {selected.length > 0 && <button onClick={() => setSelectedIds([])}>清空</button>}
              </div>
              <div>
                {selected.map((trial) => (
                  <button key={trial.id} onClick={() => toggleTrial(trial.id)}>
                    <span><b>{trial.name}</b><small>{trial.companyName}</small></span>
                    <i aria-hidden="true">×</i>
                  </button>
                ))}
                {!selected.length && <p>从左侧搜索并加入临床，最多4项。</p>}
              </div>
            </div>
            <ComparisonTable trials={selected} />
          </section>
        </section>
      </main>

      <footer>
        <span><b>TrialScope</b> · 临床试验对比</span>
        <span>{allTrials.length} 项本地临床可检索</span>
        <span>仅供研究，不构成医疗建议</span>
      </footer>
    </div>
  );
}

export function TrialAtlas() {
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#pipeline/")) setPipelineId(hash.replace("#pipeline/", ""));
    const handleHash = () => {
      const next = window.location.hash;
      setPipelineId(next.startsWith("#pipeline/") ? next.replace("#pipeline/", "") : null);
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const openPipeline = (id: string) => {
    setPipelineId(id);
    window.location.hash = `pipeline/${id}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => {
    setPipelineId(null);
    history.pushState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleTrial = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <div className="app-shell">
      <Header
        onHome={goHome}
      />
      {pipelineId ? (
        <PipelinePage
          pipelineId={pipelineId}
          selectedIds={selectedIds}
          onToggle={toggleTrial}
          onBack={goHome}
          onCompare={() => {
            const query = selectedIds.length ? `?trials=${selectedIds.join(",")}` : "";
            window.location.href = `/compare${query}`;
          }}
        />
      ) : (
        <Home onPipeline={openPipeline} />
      )}
      <footer>
        <span><b>TrialScope</b> · 本地临床情报模板</span>
        <span>JSON / CSV / Markdown / Excel Ready</span>
        <span>仅供研究，不构成医疗建议</span>
      </footer>
    </div>
  );
}

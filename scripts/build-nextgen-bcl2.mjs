import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sonrotoclaxRegistry = JSON.parse(
  readFileSync(process.argv[2] ?? "/private/tmp/sonrotoclax_registry.json", "utf8"),
);
const mesutoclaxRegistry = JSON.parse(
  readFileSync(process.argv[3] ?? "/private/tmp/icp248_registry.json", "utf8"),
);

const statusMap = {
  COMPLETED: "已完成",
  ACTIVE_NOT_RECRUITING: "进行中（停止招募）",
  RECRUITING: "招募中",
  NOT_YET_RECRUITING: "尚未招募",
  TERMINATED: "提前终止",
  WITHDRAWN: "已撤回",
  SUSPENDED: "已暂停",
  ENROLLING_BY_INVITATION: "邀请入组",
  UNKNOWN: "状态未知",
};

const clean = (value = "") => value.replace(/\s+/g, " ").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];

const splitCriteria = (text = "") => {
  const [inclusion = "", exclusion = ""] = text.split(/Exclusion Criteria:/i);
  const parse = (value) =>
    value
      .replace(/^[\s\S]*?(Key )?Inclusion Criteria:/i, "")
      .split(/\n\s*(?:[-*•]|\d+[.)])\s*/)
      .map(clean)
      .filter((item) => item.length > 4)
      .slice(0, 10);
  return {
    keyInclusion: parse(inclusion),
    keyExclusion: parse(exclusion),
  };
};

const diseaseLabel = (study) => {
  const protocol = study.protocolSection;
  const text = [
    protocol.identificationModule?.briefTitle,
    protocol.identificationModule?.officialTitle,
    ...(protocol.conditionsModule?.conditions ?? []),
  ].join(" ").toUpperCase();
  const rr = /RELAPSED|REFRACTORY|R\/R/.test(text) ? "复发/难治性" : "";
  const untreated = /UNTREATED|TREATMENT-NA[IÏ]VE|NEWLY DIAGNOSED/.test(text) ? "初治" : "";
  if (/HEALTHY/.test(text)) return "健康受试者（药代/食物效应）";
  if (/RICHTER/.test(text)) return "Richter转化";
  if (/AL AMYLOIDOSIS|AMYLOIDOSIS/.test(text)) return `${rr || untreated}AL型淀粉样变性`;
  if (/MIXED PHENOTYPE ACUTE LEUKEMIA/.test(text)) return "初治混合表型急性白血病";
  if (/MYELOID|ACUTE MYELOID|MYELODYSPLASTIC/.test(text)) {
    const aml = /AML|ACUTE MYELOID/.test(text);
    const mds = /MDS|MYELODYSPLASTIC/.test(text);
    return aml && !mds
      ? `${rr || untreated}AML`
      : mds && !aml
        ? `${rr || untreated}MDS`
        : `${rr || untreated}AML/MDS`;
  }
  if (/MULTIPLE MYELOMA/.test(text)) return `${rr || untreated}多发性骨髓瘤`;
  if (/WALDENSTR/.test(text)) return `${rr || untreated}华氏巨球蛋白血症`;
  if (/MANTLE CELL|MCL/.test(text) && !/CLL/.test(text)) return `${rr || untreated}套细胞淋巴瘤`;
  if (/FOLLICULAR|FL\b/.test(text) && !/CLL/.test(text)) return `${rr || untreated}滤泡性淋巴瘤`;
  if (/MARGINAL ZONE|MZL/.test(text) && !/CLL/.test(text)) return `${rr || untreated}边缘区淋巴瘤`;
  if (/LARGE B-CELL|DLBCL|LBCL/.test(text)) return `${rr || untreated}大B细胞淋巴瘤`;
  if (/CLL|SLL|CHRONIC LYMPHOCYTIC/.test(text)) return `${rr || untreated}CLL/SLL`;
  if (/B-CELL|NON-HODGKIN|NHL/.test(text)) return `${rr || untreated}B细胞恶性肿瘤`;
  return protocol.conditionsModule?.conditions?.join(" / ") || "血液系统疾病";
};

const phaseLabel = (phases = []) => {
  const labels = {
    EARLY_PHASE1: "早期I",
    PHASE1: "I",
    PHASE2: "II",
    PHASE3: "III",
    PHASE4: "IV",
    NA: "不适用",
  };
  return `${phases.map((phase) => labels[phase] ?? phase).join("/")}期`;
};

const armSummary = (protocol) => {
  const arms = protocol.armsInterventionsModule?.armGroups ?? [];
  if (!arms.length) {
    return unique(
      (protocol.armsInterventionsModule?.interventions ?? []).map((item) => item.name),
    ).join(" + ") || "详见研究方案";
  }
  return arms
    .map((arm) => `${arm.label}：${clean(arm.description ?? "")}`)
    .join("；")
    .slice(0, 1800);
};

const designSummary = (protocol) => {
  const design = protocol.designModule?.designInfo ?? {};
  return [
    design.allocation?.replaceAll("_", " "),
    design.interventionModel?.replaceAll("_", " "),
    design.maskingInfo?.masking?.replaceAll("_", " "),
    protocol.designModule?.designInfo?.primaryPurpose,
  ].filter(Boolean).join("；") || "干预性临床研究";
};

const baselineFromResults = (results) => {
  const measures = results?.baselineCharacteristicsModule?.measures ?? [];
  const selected = measures
    .filter((measure) => /Age|Sex|Gender|ECOG|IGHV|TP53|17p|Prior/i.test(measure.title))
    .slice(0, 8)
    .map((measure) => {
      const values = measure.classes?.flatMap((group) =>
        group.categories?.flatMap((category) =>
          category.measurements?.map((measurement) => measurement.value),
        ),
      ).filter(Boolean);
      return {
        label: measure.title,
        value: unique(values ?? []).slice(0, 5).join(" / ") || "见注册库结果表",
      };
    });
  return selected.length
    ? selected
    : [{ label: "实际入组基线", value: "尚未在注册库发布结构化结果；不以计划入组标准代替实际基线" }];
};

const publicResults = {
  NCT05471843: {
    result: "R/R MCL、既往抗CD20及BTK抑制剂治疗后：IRC ORR 52%，CR 16%，中位DoR 15.8个月；支持美国加速批准。",
    efficacy: [
      ["IRC ORR", "52%（95%CI 42–62）"],
      ["CR率", "16%（95%CI 9.1–24.0）"],
      ["中位DoR", "15.8个月（95%CI 7.4–NE）"],
    ],
    safety: [
      ["实验室/临床TLS", "7%（按推荐爬坡方案）"],
      ["常见不良反应", "肺炎16%、乏力16%"],
    ],
    subgroup: ["既往治疗", "抗CD20+BTKi后R/R MCL", "n=103", "ORR/DoR", "ORR 52%；DoR 15.8个月"],
    source: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-sonrotoclax-relapsed-or-refractory-mantle-cell-lymphoma",
  },
  NCT05479994: {
    result: "中国注册性II期R/R CLL/SLL研究：IRC ORR 77%；总体安全性可管理，支持中国获批。",
    efficacy: [["IRC ORR", "77%"]],
    safety: [["总体安全性", "公司披露为总体耐受、AE可管理；完整发生率以正式论文为准"]],
    subgroup: ["总体", "既往至少一线、含BTKi治疗的R/R CLL/SLL", "n=100", "IRC ORR", "77%"],
    source: "https://ir.beonemedicines.com/news/beone-medicines-novel-bcl2-inhibitor-sonrotoclax-achieves-first-in-world-approval-in-rr-mcl-and-rr-cllsll/562da165-f6a9-48d0-a357-aca27ac112ca",
  },
  NCT04277637: {
    result: "初治CLL/SLL的Sonrotoclax+Zanubrutinib队列：ORR 100%、CR 59.5%、最佳uMRD4 98.8%；TP53突变/del(17p)人群最佳uMRD 92.9%。",
    efficacy: [
      ["ORR", "100%"],
      ["CR率", "59.5%"],
      ["最佳uMRD4", "98.8%"],
      ["达到uMRD4中位时间", "联合治疗后4.5个月"],
    ],
    safety: [["安全性", "与既往联合研究一致；需注意中性粒细胞减少和TLS监测"]],
    subgroup: ["高危遗传学", "TP53突变和/或del(17p)", "未单列", "最佳uMRD", "92.9%"],
    source: "https://ir.beonemedicines.com/news/beone-medicines-establishes-standard-for-long-term-disease-control-in-cll-with-brukinsa-78-month-data-at/b4bd2456-0171-42db-b7ff-3dc5dea831a2",
  },
  NCT05728658: {
    result: "Mesutoclax单药/联合早期研究：BTKi难治R/R MCL亚组ORR 84%、CR 36%；R/R CLL/SLL与MCL多个队列显示活性。",
    efficacy: [
      ["BTKi难治R/R MCL ORR", "84%"],
      ["BTKi难治R/R MCL CR", "36%"],
      ["R/R CLL/SLL ORR", "100%（早期小样本）"],
    ],
    safety: [["总体安全性", "公司披露为耐受性和PK特征良好；TLS采用剂量爬坡管理"]],
    subgroup: ["既往BTKi反应", "BTKi难治R/R MCL", "n=25", "ORR/CR", "84% / 36%"],
    source: "https://www.innocarepharma.com/en/news/activity/en020260325-InnoCare-2025-Annual-Results",
  },
  NCT06378138: {
    result: "初治CLL/SLL的Mesutoclax+奥布替尼固定疗程：ORR 100%、靶病灶CR 57.1%、36周外周血uMRD 65%，未观察到TLS。",
    efficacy: [
      ["ORR", "100%"],
      ["靶病灶CR", "57.1%"],
      ["36周外周血uMRD", "65%"],
    ],
    safety: [["TLS", "0例（n=42早期队列）"]],
    subgroup: ["剂量/时间", "100 mg或125 mg；36周MRD检查点", "n=42", "ORR/CR/uMRD", "100% / 57.1% / 65%"],
    source: "https://www.innocarepharma.com/uploads/2026-04-23/InnoCare-2026-Q1-Results-NDR_EN.pdf",
  },
  NCT06656494: {
    result: "Mesutoclax+阿扎胞苷：初治MDS可评估患者ORR 100%；初治AML cCR 81.8%，其中MRD阴性率86.5%。数据仍属I期非随机研究。",
    efficacy: [
      ["初治MDS ORR", "100%"],
      ["初治MDS CR", "40%（IWG 2006）"],
      ["初治AML cCR", "81.8%"],
      ["AML cCR患者MRD阴性", "86.5%"],
    ],
    safety: [["总体安全性", "早期披露未见DLT或TLS；长期骨髓抑制数据仍需成熟"]],
    subgroup: ["疾病类型", "初治AML vs 初治MDS", "AML/MDS分队列", "cCR/ORR", "AML cCR 81.8%；MDS ORR 100%"],
    source: "https://www.innocarepharma.com/en/news/activity/en020260603",
  },
};

const makeTrial = (study, program) => {
  const protocol = study.protocolSection;
  const nct = protocol.identificationModule.nctId;
  const criteria = splitCriteria(protocol.eligibilityModule?.eligibilityCriteria);
  const primary = protocol.outcomesModule?.primaryOutcomes?.map((item) => item.measure) ?? [];
  const secondary = protocol.outcomesModule?.secondaryOutcomes?.map((item) => item.measure) ?? [];
  const aliases = protocol.identificationModule?.secondaryIdInfos?.map((item) => item.id) ?? [];
  const shortName =
    protocol.identificationModule?.acronym ??
    protocol.identificationModule?.orgStudyIdInfo?.id ??
    nct;
  const readout = publicResults[nct];
  const countries = unique(
    protocol.contactsLocationsModule?.locations?.map((location) => location.country) ?? [],
  );
  const phase = phaseLabel(protocol.designModule?.phases ?? []);
  const isSonrotoclax = program === "sonrotoclax";
  const approvedTrial = nct === "NCT05471843";
  return {
    id: `${program}-${nct.toLowerCase()}`,
    name: `${shortName} / ${diseaseLabel(study)}`,
    nct,
    phase,
    status: nct === "NCT06378138"
      ? "已完成入组（随访中）"
      : statusMap[protocol.statusModule?.overallStatus] ?? protocol.statusModule?.overallStatus ?? "未报告",
    indication: diseaseLabel(study),
    design: designSummary(protocol),
    arms: armSummary(protocol),
    population: criteria.keyInclusion.slice(0, 4).join("；") || protocol.conditionsModule?.conditions?.join(" / ") || "详见研究方案",
    eligibility: {
      keyInclusion: criteria.keyInclusion.length ? criteria.keyInclusion : ["详见ClinicalTrials.gov完整方案"],
      keyExclusion: criteria.keyExclusion.length ? criteria.keyExclusion : ["详见ClinicalTrials.gov完整方案"],
      stratificationFactors: ["若为随机研究，具体分层因素以完整研究方案/SAP为准；注册摘要未披露时不作推断"],
    },
    subgroupAnalyses: readout
      ? [{
          dimension: readout.subgroup[0],
          subgroup: readout.subgroup[1],
          n: readout.subgroup[2],
          endpoint: readout.subgroup[3],
          effect: readout.subgroup[4],
          ci: "详见原始披露",
          interactionP: "未报告",
          conclusion: "早期或探索性亚组；未报告交互检验时不能推断亚组间治疗效应差异",
        }]
      : [{
          dimension: "公开结果状态",
          subgroup: "预设队列/亚组",
          n: "尚未公开",
          endpoint: primary.join("；") || "安全性/初步疗效",
          effect: "尚无可核验的公开亚组结果",
          ci: "未报告",
          interactionP: "未报告",
          conclusion: "研究尚未读出或结果未公开，不以计划入组特征替代实际亚组分析",
        }],
    enrollment: protocol.designModule?.enrollmentInfo?.count ?? "未报告",
    primaryEndpoint: primary.join("；") || "未报告",
    secondaryEndpoints: secondary.length ? secondary.slice(0, 12) : ["注册库尚未列出"],
    startDate: protocol.statusModule?.startDateStruct?.date ?? "未报告",
    primaryCompletion: protocol.statusModule?.primaryCompletionDateStruct?.date ?? "未报告",
    countries: countries.length ? countries : ["注册库未列出"],
    sponsor: protocol.sponsorCollaboratorsModule?.leadSponsor?.name
      ?? protocol.identificationModule?.organization?.fullName
      ?? (isSonrotoclax ? "BeOne Medicines" : "InnoCare Pharma"),
    fda: isSonrotoclax
      ? {
          regulatoryId: "NDA 220711",
          designation: approvedTrial ? "突破性疗法、快速通道、孤儿药；加速批准" : "Sonrotoclax已获FDA批准用于特定R/R MCL人群；本研究适应症须单独判断",
          submissionStatus: approvedTrial ? "2026-05-13 FDA加速批准R/R MCL" : "该研究是否支持标签扩展尚待结果与监管审评",
          lastVerified: "2026-07-26",
        }
      : {
          regulatoryId: "尚无FDA批准编号",
          designation: /套细胞淋巴瘤/.test(diseaseLabel(study)) ? "中国NMPA突破性治疗品种（BTKi治疗后R/R MCL）" : "未见该研究对应FDA特殊资格公开披露",
          submissionStatus: "在研；尚未获FDA/NMPA上市批准",
          lastVerified: "2026-07-26",
        },
    result: readout?.result ?? "尚无可核验的公开临床结果；保留注册设计、入组人群和时间轴，待正式读出后更新。",
    source: "ClinicalTrials.gov官方注册记录；公司官方披露/监管文件仅在可对应到具体研究时补充。数据按NCT号去重。",
    dataCut: readout ? "最新公开披露截至2026-07-26" : "注册状态核对：2026-07-26",
    evidenceLevel: readout ? `${phase} · 官方披露/监管结果` : `${phase} · 注册设计（暂无公开结果）`,
    baselineCharacteristics: baselineFromResults(study.resultsSection),
    efficacyHighlights: readout
      ? readout.efficacy.map(([label, value]) => ({ label, value }))
      : [{ label: "疗效结果", value: "尚未公开" }],
    safetyHighlights: readout
      ? readout.safety.map(([label, value]) => ({ label, value }))
      : [{ label: "安全性结果", value: "尚未公开；仅列方案监测终点不等同于实际发生率" }],
    pkHighlights: aliases.length
      ? [{ label: "其他登记/方案号", value: aliases.slice(0, 5).join("；") }]
      : undefined,
    sources: [
      { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/study/${nct}` },
      ...(readout ? [{ label: "对应公开结果", url: readout.source }] : []),
    ],
  };
};

const sonrotoclaxTrials = sonrotoclaxRegistry.studies
  .map((study) => makeTrial(study, "sonrotoclax"))
  .sort((a, b) => b.startDate.localeCompare(a.startDate));

const mesutoclaxTrials = mesutoclaxRegistry.studies
  .map((study) => makeTrial(study, "mesutoclax"))
  .sort((a, b) => b.startDate.localeCompare(a.startDate));

mesutoclaxTrials.push({
  id: "mesutoclax-rrmcl-phase3-cn",
  name: "ICP-248 R/R MCL随机III期 / 登记号待公开",
  nct: "中国登记号待公开",
  phase: "III期",
  status: "已获准启动（登记号待公开）",
  indication: "复发/难治性套细胞淋巴瘤",
  design: "随机、双盲、多中心、III期；中国研究",
  arms: "Mesutoclax联合奥布替尼 vs Pirtobrutinib；最终方案以公开登记为准",
  population: "复发/难治性MCL；公司披露计划开展头对头研究，完整入排标准尚未公开",
  eligibility: {
    keyInclusion: ["复发/难治性MCL；其他标准待中国临床试验登记公开"],
    keyExclusion: ["尚未公开"],
    stratificationFactors: ["尚未公开"],
  },
  subgroupAnalyses: [{
    dimension: "公开结果状态",
    subgroup: "预设亚组",
    n: "尚未公开",
    endpoint: "尚未公开",
    effect: "研究尚未读出",
    ci: "未报告",
    interactionP: "未报告",
    conclusion: "仅纳入公司已正式披露的研究；登记号和方案公开后应替换本占位记录",
  }],
  enrollment: "尚未公开",
  primaryEndpoint: "尚未公开",
  secondaryEndpoints: ["尚未公开"],
  startDate: "2026（计划/启动阶段）",
  primaryCompletion: "尚未公开",
  countries: ["中国"],
  sponsor: "北京诺诚健华医药科技有限公司",
  fda: {
    regulatoryId: "尚无FDA批准编号",
    designation: "中国NMPA突破性治疗品种覆盖BTKi治疗后R/R MCL开发方向",
    submissionStatus: "III期已获准启动；公开登记待更新",
    lastVerified: "2026-07-26",
  },
  result: "尚无公开结果。",
  source: "诺诚健华2025年年报及2026年一季度披露；未编造尚未公布的登记号或方案字段。",
  dataCut: "2026-07-26",
  evidenceLevel: "III期 · 公司正式披露（登记待公开）",
  baselineCharacteristics: [{ label: "实际入组基线", value: "尚未公开" }],
  efficacyHighlights: [{ label: "疗效结果", value: "尚未公开" }],
  safetyHighlights: [{ label: "安全性结果", value: "尚未公开" }],
  sources: [{
    label: "诺诚健华2025年年报",
    url: "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0325/2026032501166.pdf",
  }],
});

const sonrotoclaxCompany = {
  id: "beone",
  name: "百济神州 / BeOne Medicines",
  ticker: "ONC / 06160.HK / 688235.SH",
  focus: "血液肿瘤与全球创新药开发",
  pipelines: [{
    id: "sonrotoclax",
    code: "Sonrotoclax / BEQALZI",
    genericName: "Sonrotoclax（索托克拉，BGB-11417）",
    target: "BCL-2",
    modality: "高选择性口服BCL-2抑制剂",
    stage: "已上市 / III期全景",
    indications: unique(sonrotoclaxTrials.map((trial) => diseaseLabelFromText(trial.indication))),
    trials: sonrotoclaxTrials,
  }],
};

const mesutoclaxCompany = {
  id: "innocare",
  name: "诺诚健华",
  ticker: "9969.HK / 688428.SH",
  focus: "血液肿瘤与自身免疫创新药",
  pipelines: [{
    id: "mesutoclax",
    code: "ICP-248 / Mesutoclax",
    genericName: "Mesutoclax（ICP-248）",
    target: "BCL-2",
    modality: "高选择性口服BCL-2抑制剂",
    stage: "III期 / 注册性开发",
    indications: unique(mesutoclaxTrials.map((trial) => diseaseLabelFromText(trial.indication))),
    trials: mesutoclaxTrials,
  }],
};

function diseaseLabelFromText(indication) {
  return indication
    .replace(/^(复发\/难治性|初治)/, "")
    .replace(/（.*?）/g, "");
}

const validate = (company, expected) => {
  const trials = company.pipelines[0].trials;
  if (trials.length !== expected) throw new Error(`${company.id}: expected ${expected}, got ${trials.length}`);
  const ids = new Set(trials.map((trial) => trial.id));
  if (ids.size !== trials.length) throw new Error(`${company.id}: duplicate trial IDs`);
  for (const trial of trials) {
    for (const field of ["id", "name", "nct", "phase", "status", "indication", "design", "arms", "population", "startDate", "result"]) {
      if (!trial[field]) throw new Error(`${trial.id}: missing ${field}`);
    }
  }
};

validate(sonrotoclaxCompany, 40);
validate(mesutoclaxCompany, 6);

writeFileSync(resolve("app/sonrotoclax.json"), `${JSON.stringify(sonrotoclaxCompany, null, 2)}\n`);
writeFileSync(resolve("app/mesutoclax.json"), `${JSON.stringify(mesutoclaxCompany, null, 2)}\n`);
console.log(`Wrote ${sonrotoclaxTrials.length} Sonrotoclax and ${mesutoclaxTrials.length} Mesutoclax studies`);

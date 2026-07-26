import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath =
  process.argv[2] ??
  "/Users/zendu/Workbuddy/2026-07-25-17-03-43/K药三期临床详细模板.html";
const registryPath = process.argv[3] ?? "/private/tmp/pembro_registry.json";
const outputPath = resolve("app/pembrolizumab.json");

const html = readFileSync(sourcePath, "utf8");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const registryByNct = new Map(
  registry.studies.map((study) => [
    study.protocolSection.identificationModule.nctId,
    study,
  ]),
);

const decode = (value = "") =>
  value
    .replace(/<br\s*\/?>/gi, "；")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ge;/g, "≥")
    .replace(/&le;/g, "≤")
    .replace(/&times;/g, "×")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const splitItems = (value = "") =>
  decode(value)
    .split(/[；;]/)
    .map((item) => item.trim())
    .filter(Boolean);

const section = (card, number) => {
  const start = card.search(
    new RegExp(`<span class="num">0?${number}<\\/span>`),
  );
  if (start === -1) return "";
  const rest = card.slice(start + 1);
  const next = rest.search(/<span class="num">0?[1-8]<\/span>/);
  return next === -1 ? card.slice(start) : card.slice(start, start + 1 + next);
};

const fields = (fragment) =>
  [...fragment.matchAll(
    /<div class="field-label">([\s\S]*?)<\/div>\s*<div class="field-value">([\s\S]*?)<\/div>/g,
  )].map((match) => ({ label: decode(match[1]), value: decode(match[2]) }));

const field = (fragment, labels, fallback = "未报告") => {
  const candidates = Array.isArray(labels) ? labels : [labels];
  return (
    fields(fragment).find((item) =>
      candidates.some((label) => item.label.includes(label)),
    )?.value ?? fallback
  );
};

const resultItems = (fragment) =>
  [...fragment.matchAll(
    /<div class="result-item">[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/g,
  )].map((match) => ({ label: decode(match[1]), value: decode(match[2]) }));

const tableRows = (fragment) =>
  [...fragment.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) => [
    ...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g),
  ].map((cell) => decode(cell[1])));

const normalizeStatus = (value = "") =>
  ({
    COMPLETED: "已完成",
    ACTIVE_NOT_RECRUITING: "进行中（停止招募）",
    RECRUITING: "招募中",
    NOT_YET_RECRUITING: "尚未招募",
    TERMINATED: "提前终止",
    WITHDRAWN: "已撤回",
    SUSPENDED: "已暂停",
    UNKNOWN: "状态未知",
  })[value] ?? value;

const registryMeta = (nct) => {
  const study = registryByNct.get(nct);
  if (!study) return null;
  const protocol = study.protocolSection;
  return {
    protocol,
    results: study.resultsSection,
    enrollment: protocol.designModule?.enrollmentInfo?.count,
    status: normalizeStatus(protocol.statusModule?.overallStatus),
    startDate: protocol.statusModule?.startDateStruct?.date,
    primaryCompletion:
      protocol.statusModule?.primaryCompletionDateStruct?.date ?? "未报告",
  };
};

const correctedNct = {
  "KEYNOTE-006": "NCT01866319",
  "KEYNOTE-024": "NCT02142738",
  "KEYNOTE-042": "NCT02220894",
  "KEYNOTE-189": "NCT02578680",
  "KEYNOTE-407": "NCT02775435",
  "KEYNOTE-671": "NCT03425643",
  "KEYNOTE-522": "NCT03036488",
  "KEYNOTE-048": "NCT02358031",
  "KEYNOTE-859": "NCT03675737",
  "KEYNOTE-811": "NCT03615326",
  "KEYNOTE-826": "NCT03635567",
  "KEYNOTE-045": "NCT02256436",
  "KEYNOTE-426": "NCT02853331",
  "KEYNOTE-564": "NCT03142334",
  "KEYNOTE-394": "NCT03062358",
};

const commentMatches = [...html.matchAll(/<!-- (KEYNOTE-[A-Z0-9]+) -->/g)];
const detailedTrials = commentMatches.map((match, index) => {
  const name = match[1];
  const end =
    commentMatches[index + 1]?.index ??
    html.indexOf("<!-- 其他III期试验简化列表 -->");
  const card = html.slice(match.index, end);
  const s1 = section(card, 1);
  const s2 = section(card, 2);
  const s3 = section(card, 3);
  const s4 = section(card, 4);
  const s5 = section(card, 5);
  const s6 = section(card, 6);
  const s7 = section(card, 7);
  const s8 = section(card, 8);
  const nct = correctedNct[name] ?? field(s1, ["ClinicalTrials.gov ID", "NCT编号"]);
  const meta = registryMeta(nct);
  const title =
    decode(card.match(/<h2 class="trial-title">([\s\S]*?)<\/h2>/)?.[1]) || name;
  const enrollmentText = field(s2, ["目标/实际入组", "总入组数"]);
  const parsedEnrollment = Number(enrollmentText.match(/\d[\d,]*/)?.[0]?.replace(/,/g, ""));
  const inclusion = field(s2, ["关键入组标准", "入组标准关键点"]);
  const note = decode(s2.match(/<div class="note">([\s\S]*?)<\/div>/)?.[1]);
  const exclusion = note.replace(/^关键排除[:：]\s*/, "");
  const subgroupRows = tableRows(s6);
  const subgroupHeaders = subgroupRows[0] ?? [];
  const subgroupAnalyses = subgroupRows.slice(1).map((row) => {
    const get = (pattern) => {
      const index = subgroupHeaders.findIndex((header) => pattern.test(header));
      return index >= 0 ? row[index] : "";
    };
    const combinedEffect = row
      .map((value, cellIndex) =>
        /HR|效应值|差异/i.test(subgroupHeaders[cellIndex] ?? "")
          ? `${subgroupHeaders[cellIndex]} ${value}`
          : "",
      )
      .filter(Boolean)
      .join("；");
    return {
      dimension: get(/分析维度/) || "预设亚组",
      subgroup: get(/^亚组$/) || row[0] || "未报告",
      n: get(/^N$|样本量/i) || "未单列",
      endpoint: get(/终点/) || subgroupHeaders.filter((header) => /HR/i.test(header)).join("/") || "主要终点",
      effect: get(/效应值/) || combinedEffect || row[1] || "未报告",
      ci: get(/95%/) || (combinedEffect.match(/\([^)]*\)/)?.[0] ?? "未报告"),
      interactionP: get(/交互/) || "未报告",
      conclusion: get(/结论|解释/) || "方向与总体结果比较，未报告交互检验",
    };
  });
  const fdaFields = fields(s7);
  const sourceText = field(s8, "原始来源");
  return {
    id: name.toLowerCase(),
    name: title,
    nct,
    phase: "III期",
    status: meta?.status ?? (field(s1, ["研发阶段", "试验阶段"]).includes("完成") ? "已完成" : "进行中"),
    indication: field(s2, ["适应症", "瘤种 / 适应症"]),
    design: field(s2, ["试验设计", "研究设计"]),
    arms: field(s2, ["治疗/对照组", "研究设计"]),
    population: inclusion,
    eligibility: {
      keyInclusion: splitItems(inclusion),
      keyExclusion: splitItems(exclusion || "活动性不可控疾病或方案规定的免疫治疗禁忌"),
      stratificationFactors: splitItems(field(s2, "分层因素", "未报告")),
    },
    subgroupAnalyses,
    enrollment: meta?.enrollment ?? (Number.isFinite(parsedEnrollment) ? parsedEnrollment : enrollmentText),
    primaryEndpoint: field(s4, "主要终点"),
    secondaryEndpoints: splitItems(field(s4, "次要终点")),
    startDate: meta?.startDate ?? field(s4, "研究启动"),
    primaryCompletion: meta?.primaryCompletion ?? field(s4, ["主要完成日期", "首次数据截止"]),
    countries: splitItems(field(s2, "研究国家/地区", "全球多中心")),
    sponsor: field(s1, "申办方", "Merck Sharp & Dohme LLC"),
    fda: {
      regulatoryId: "BLA 125514",
      designation: fdaFields.find((item) => item.label.includes("监管认定"))?.value ?? "未单列",
      submissionStatus:
        fdaFields.find((item) => item.label.includes("申报状态"))?.value ?? "以FDA现行说明书为准",
      lastVerified: "2026-07-26",
    },
    result: field(s8, "结果摘要"),
    source: `${sourceText}；ClinicalTrials.gov；FDA现行说明书。模板与官方记录冲突时以官方记录为准。`,
    dataCut: field(s8, "数据截止"),
    evidenceLevel: "III期 · 注册库/同行评议",
    baselineCharacteristics: fields(s3).map(({ label, value }) => ({ label, value })),
    efficacyHighlights: resultItems(s5).filter(
      (item) => !/AE|安全|停药|死亡|毒性/.test(item.label),
    ),
    safetyHighlights: resultItems(s5).filter((item) =>
      /AE|安全|停药|死亡|毒性/.test(item.label),
    ),
    sources: [
      { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/study/${nct}` },
      {
        label: "FDA KEYTRUDA说明书",
        url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/125514s173lbl.pdf",
      },
    ],
  };
});

const supplemental = [
  ["KEYNOTE-010", "NCT01905657", "PD-L1阳性晚期非小细胞肺癌二线", "Pembro 2/10 mg/kg vs 多西他赛", "OS阳性；PD-L1 TPS≥50%获益更明显", "PD-L1", "TPS≥50%", "OS HR 0.54–0.50"],
  ["KEYNOTE-054", "NCT02362594", "高危III期黑色素瘤术后辅助", "Pembro vs 安慰剂，治疗约1年", "RFS与DMFS阳性", "PD-L1", "阳性与阴性", "RFS获益方向一致"],
  ["KEYNOTE-716", "NCT03553836", "IIB/IIC期黑色素瘤术后辅助", "Pembro vs 安慰剂，治疗约1年", "RFS与DMFS阳性", "分期", "IIB与IIC期", "RFS获益方向一致"],
  ["KEYNOTE-091", "NCT02504372", "IB–IIIA期非小细胞肺癌术后辅助", "Pembro vs 安慰剂", "总体人群DFS阳性；PD-L1≥50%共同主要终点未达显著", "PD-L1", "TPS≥50%", "DFS未达到预设显著性"],
  ["KEYNOTE-355", "NCT02819518", "局部复发不可切除或转移性三阴性乳腺癌一线", "Pembro+化疗 vs 安慰剂+化疗", "CPS≥10人群PFS与OS阳性", "PD-L1", "CPS≥10", "OS HR 0.65"],
  ["KEYNOTE-119", "NCT02555657", "转移性三阴性乳腺癌二/三线", "Pembro vs 单药化疗", "总体OS阴性；PD-L1高表达人群呈获益趋势", "PD-L1", "CPS≥10", "OS HR约0.78，探索性"],
  ["KEYNOTE-590", "NCT03189719", "局部晚期不可切除或转移性食管癌/食管胃结合部癌一线", "Pembro+顺铂/5-FU vs 安慰剂+化疗", "总人群及PD-L1富集人群OS阳性", "PD-L1", "CPS≥10", "OS HR 0.62"],
  ["KEYNOTE-177", "NCT02563002", "MSI-H/dMMR转移性结直肠癌一线", "Pembro vs 化疗±贝伐珠单抗/西妥昔单抗", "PFS阳性；OS受高比例交叉影响未达预设显著性", "分子亚型", "MSI-H/dMMR", "PFS HR 0.60"],
  ["KEYNOTE-A18", "NCT04221945", "高危局部晚期宫颈癌根治性同步放化疗", "Pembro+CCRT后维持 vs 安慰剂+CCRT", "PFS与OS阳性", "分期", "FIGO III–IVA", "OS获益更明确"],
  ["KEYNOTE-775", "NCT03517449", "既往铂类治疗后晚期子宫内膜癌", "Pembro+仑伐替尼 vs 医师选择化疗", "pMMR及全人群PFS、OS阳性", "错配修复", "pMMR", "OS HR 0.68"],
  ["KEYNOTE-868", "NCT03914612", "原发晚期或复发性子宫内膜癌一线", "Pembro+卡铂/紫杉醇后维持 vs 安慰剂", "dMMR与pMMR队列PFS均阳性", "错配修复", "dMMR / pMMR", "PFS HR 0.30 / 0.54"],
  ["KEYNOTE-240", "NCT02702401", "索拉非尼后晚期肝细胞癌二线", "Pembro+BSC vs 安慰剂+BSC", "OS/PFS数值改善，但未越过预设多重性显著性边界", "地区/病因", "预设亚组", "方向大体一致，研究整体统计学阴性"],
  ["KEYNOTE-937", "NCT03867084", "肝细胞癌切除或消融后辅助", "Pembro vs 安慰剂", "RFS与OS均阴性；注册库2026年结果纠正原模板的“RFS阳性”", "总体", "ITT", "RFS HR 1.06；OS HR 1.08"],
  ["KEYNOTE-181", "NCT02564263", "晚期食管癌/食管胃结合部癌二线", "Pembro vs 紫杉醇/多西他赛/伊立替康", "PD-L1 CPS≥10人群OS阳性", "PD-L1", "CPS≥10", "OS HR 0.69"],
  ["KEYNOTE-062", "NCT02494583", "HER2阴性、PD-L1阳性晚期胃癌/胃食管结合部癌一线", "Pembro单药或Pembro+化疗 vs 化疗", "CPS≥1单药OS非劣；联合方案未显示优效", "PD-L1", "CPS≥10", "单药OS富集获益，探索性"],
  ["KEYNOTE-061", "NCT02370498", "PD-L1阳性晚期胃癌/胃食管结合部癌二线", "Pembro vs 紫杉醇", "CPS≥1人群OS未达预设显著性", "PD-L1", "CPS≥10", "OS获益趋势，探索性"],
  ["KEYNOTE-361", "NCT02853305", "局部晚期或转移性尿路上皮癌一线", "Pembro±含铂化疗 vs 化疗", "联合方案PFS/OS未达预设显著性", "铂适用性", "顺铂适用/不适用", "未证实差异性获益"],
  ["LEAP-002", "NCT03713593", "不可切除晚期肝细胞癌一线", "Pembro+仑伐替尼 vs 仑伐替尼", "OS/PFS未越过预设显著性边界", "总体", "ITT", "OS HR 0.84；PFS HR 0.87"],
  ["LEAP-001", "NCT03884101", "晚期或复发性子宫内膜癌一线", "Pembro+仑伐替尼 vs 卡铂/紫杉醇", "主要终点PFS和OS均未达到统计学显著", "错配修复", "pMMR/dMMR", "未确立优于标准化疗"],
  ["LEAP-003", "NCT03820986", "不可切除或晚期黑色素瘤一线", "Pembro+仑伐替尼 vs Pembro+安慰剂", "OS/PFS阴性；模板误写为NSCLC", "总体", "ITT", "未显示临床获益"],
  ["LEAP-006", "NCT03829319", "转移性非鳞非小细胞肺癌一线", "Pembro+仑伐替尼+培美曲塞/铂类 vs Pembro+化疗", "PFS和OS未达到主要终点", "总体", "ITT", "未显示附加获益"],
  ["LEAP-007", "NCT03829332", "PD-L1 TPS≥1%转移性非小细胞肺癌一线", "Pembro+仑伐替尼 vs Pembro", "PFS改善但OS未改善，整体风险获益不支持联合", "PD-L1", "TPS 1–49% / ≥50%", "未确立OS获益"],
  ["LEAP-008", "NCT03976375", "含铂化疗及抗PD-(L)1后进展的转移性非小细胞肺癌", "Pembro+仑伐替尼 vs 多西他赛", "主要终点未达成", "总体", "ITT", "未显示优于多西他赛"],
  ["LEAP-010", "NCT04199104", "PD-L1阳性复发/转移性头颈鳞癌一线", "Pembro+仑伐替尼 vs Pembro", "PFS与OS未显示改善；模板误写为TNBC", "PD-L1", "CPS≥1", "未显示联合获益"],
  ["LEAP-011", "NCT03898180", "含铂不适用的晚期尿路上皮癌一线", "Pembro+仑伐替尼 vs Pembro", "不利风险获益后提前终止；PFS/OS阴性", "总体", "ITT", "PFS HR 0.90"],
  ["LEAP-012", "NCT04246177", "不可切除非转移性肝细胞癌局部治疗", "Pembro+仑伐替尼+TACE vs 安慰剂+TACE", "PFS阳性；首次分析OS尚未达到显著；模板误写为局限期NSCLC", "总体", "ITT", "PFS HR 0.66"],
];

const eligibilityFromRegistry = (protocol) => {
  const text = protocol.eligibilityModule?.eligibilityCriteria ?? "";
  const [inclusion = "", exclusion = ""] = text.split(/Exclusion Criteria:/i);
  const clean = (value) =>
    value
      .replace(/^[\s\S]*?Inclusion Criteria:/i, "")
      .split(/\n\s*[-*]\s*/)
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 8);
  return { keyInclusion: clean(inclusion), keyExclusion: clean(exclusion) };
};

const baselineFromRegistry = (results) => {
  const measures = results?.baselineCharacteristicsModule?.measures ?? [];
  return measures
    .filter((measure) => /Age|Sex|Gender|ECOG|PD-L1/i.test(measure.title))
    .slice(0, 6)
    .map((measure) => {
      const values = measure.classes?.flatMap((item) =>
        item.categories?.flatMap((category) =>
          category.measurements?.map((measurement) => measurement.value),
        ),
      ).filter(Boolean);
      return {
        label: measure.title,
        value: [...new Set(values)].slice(0, 4).join(" / ") || "见注册库结果表",
      };
    });
};

const buildSupplemental = ([name, nct, indication, arms, result, dimension, subgroup, effect]) => {
  const meta = registryMeta(nct);
  if (!meta) throw new Error(`Missing registry record for ${name} (${nct})`);
  const protocol = meta.protocol;
  const eligibility = eligibilityFromRegistry(protocol);
  const primaryOutcomes = protocol.outcomesModule?.primaryOutcomes?.map((item) => item.measure) ?? [];
  const secondaryOutcomes = protocol.outcomesModule?.secondaryOutcomes?.map((item) => item.measure) ?? [];
  const countries = [
    ...new Set(protocol.contactsLocationsModule?.locations?.map((location) => location.country).filter(Boolean) ?? []),
  ];
  const designInfo = protocol.designModule?.designInfo ?? {};
  const design = [
    designInfo.allocation?.replaceAll("_", " "),
    designInfo.interventionModel?.replaceAll("_", " "),
    designInfo.maskingInfo?.masking?.replaceAll("_", " "),
  ].filter(Boolean).join("；");
  const baseline = baselineFromRegistry(meta.results);
  return {
    id: name.toLowerCase(),
    name,
    nct,
    phase: "III期",
    status: meta.status,
    indication,
    design: design || "随机、对照、III期",
    arms,
    population: eligibility.keyInclusion.slice(0, 3).join("；") || indication,
    eligibility: {
      keyInclusion: eligibility.keyInclusion.length ? eligibility.keyInclusion : ["详见ClinicalTrials.gov"],
      keyExclusion: eligibility.keyExclusion.length ? eligibility.keyExclusion : ["详见ClinicalTrials.gov"],
      stratificationFactors: ["详见研究方案；注册库摘要未完整列出时不作推断"],
    },
    subgroupAnalyses: [{
      dimension,
      subgroup,
      n: "未单列",
      endpoint: "主要终点",
      effect,
      ci: "详见原始论文/注册库",
      interactionP: "未报告",
      conclusion: "亚组结果为分层或探索性分析；若无交互检验，不应据此推断治疗效应差异",
    }],
    enrollment: meta.enrollment ?? "未报告",
    primaryEndpoint: primaryOutcomes.join("；") || "未报告",
    secondaryEndpoints: secondaryOutcomes.slice(0, 8),
    startDate: meta.startDate ?? "未报告",
    primaryCompletion: meta.primaryCompletion,
    countries: countries.length ? countries : ["多中心"],
    sponsor: protocol.sponsorCollaboratorsModule?.responsibleParty?.investigatorFullName
      ?? protocol.identificationModule?.organization?.fullName
      ?? "Merck Sharp & Dohme LLC",
    fda: {
      regulatoryId: "BLA 125514",
      designation: "是否支持具体适应症以FDA现行说明书为准",
      submissionStatus: result.includes("阳性") ? "已形成阳性III期证据；具体标签见FDA说明书" : "未据此形成新的阳性注册结论",
      lastVerified: "2026-07-26",
    },
    result,
    source: "ClinicalTrials.gov、FDA现行说明书及同行评议/申办方结果披露；阴性研究予以保留。",
    dataCut: meta.primaryCompletion,
    evidenceLevel: "III期 · 官方注册库核对",
    baselineCharacteristics: baseline.length
      ? baseline
      : [{ label: "结构化基线", value: "注册库暂未发布；避免以计划入组标准代替实际基线" }],
    efficacyHighlights: [{ label: "主要结论", value: result }],
    safetyHighlights: [{ label: "安全性", value: "详见注册库不良事件模块及正式论文；本条不以方案期风险替代实际发生率" }],
    sources: [
      { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/study/${nct}` },
      {
        label: "FDA KEYTRUDA说明书",
        url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/125514s173lbl.pdf",
      },
    ],
  };
};

const trials = [...detailedTrials, ...supplemental.map(buildSupplemental)];
const uniqueNcts = new Set(trials.map((trial) => trial.nct));
if (uniqueNcts.size !== trials.length) {
  throw new Error("Duplicate ClinicalTrials.gov identifiers detected");
}

const company = {
  id: "merck",
  name: "Merck & Co. / MSD",
  ticker: "MRK",
  focus: "肿瘤免疫与PD-1通路",
  pipelines: [{
    id: "pembrolizumab",
    code: "Pembrolizumab / Keytruda（K药）",
    genericName: "Pembrolizumab（帕博利珠单抗）",
    target: "PD-1",
    modality: "人源化IgG4抗PD-1单克隆抗体",
    stage: "已上市 / III期全景",
    indications: [
      "黑色素瘤",
      "非小细胞肺癌",
      "三阴性乳腺癌",
      "头颈鳞癌",
      "胃癌/胃食管结合部癌",
      "食管癌",
      "结直肠癌",
      "宫颈癌",
      "子宫内膜癌",
      "尿路上皮癌",
      "肾细胞癌",
      "肝细胞癌",
    ],
    trials,
  }],
};

writeFileSync(outputPath, `${JSON.stringify(company, null, 2)}\n`);
console.log(`Wrote ${trials.length} pembrolizumab phase III trials to ${outputPath}`);

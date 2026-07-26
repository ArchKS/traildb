import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "app/venetoclax-mds.json";

if (!inputPath) {
  throw new Error("用法：node scripts/import-venetoclax-mds.mjs <ClinicalTrials.gov JSON> [输出文件]");
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const dataCut = "2026-07-26";
const excluded = new Set([
  // 下列登记虽然检索到 Venetoclax 和 MDS，但 MDS 队列并不接受 Venetoclax。
  "NCT03969446",
  "NCT05275439",
  "NCT05673057",
  "NCT07153497",
]);

const phaseMap = {
  PHASE1: "I期",
  PHASE2: "II期",
  PHASE3: "III期",
};

const statusMap = {
  NOT_YET_RECRUITING: "尚未招募",
  RECRUITING: "招募中",
  ENROLLING_BY_INVITATION: "邀请入组",
  ACTIVE_NOT_RECRUITING: "活跃，未招募",
  SUSPENDED: "暂停",
  TERMINATED: "已终止",
  COMPLETED: "已完成",
  WITHDRAWN: "已撤回",
  UNKNOWN: "状态未知",
};

const countryMap = {
  "United States": "美国",
  China: "中国",
  Germany: "德国",
  France: "法国",
  Italy: "意大利",
  Spain: "西班牙",
  Canada: "加拿大",
  Australia: "澳大利亚",
  Austria: "奥地利",
  Belgium: "比利时",
  Denmark: "丹麦",
  Finland: "芬兰",
  Netherlands: "荷兰",
  Norway: "挪威",
  Sweden: "瑞典",
  Switzerland: "瑞士",
  Poland: "波兰",
  Japan: "日本",
  "Korea, Republic of": "韩国",
  Taiwan: "中国台湾",
  "United Kingdom": "英国",
  Israel: "以色列",
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hasVenetoclax(value = "") {
  return /venetoclax|ABT-199|GDC-0199/i.test(value);
}

function translateDrug(value = "") {
  return value
    .replace(/^(Drug|Biological|Combination Product|Radiation|Procedure|Other):\s*/i, "")
    .replace(/Venetoclax/gi, "维奈克拉")
    .replace(/Azacitidine|Azacytidine/gi, "阿扎胞苷")
    .replace(/Decitabine/gi, "地西他滨")
    .replace(/Cedazuridine/gi, "西达尿苷")
    .replace(/Cytarabine|Ara-C/gi, "阿糖胞苷")
    .replace(/Busulfan/gi, "白消安")
    .replace(/Fludarabine/gi, "氟达拉滨")
    .replace(/Cladribine/gi, "克拉屈滨")
    .replace(/Idarubicin/gi, "伊达比星")
    .replace(/Daunorubicin/gi, "柔红霉素")
    .replace(/氟达拉滨 Phosphate/gi, "磷酸氟达拉滨")
    .replace(/Pembrolizumab/gi, "帕博利珠单抗")
    .replace(/Gilteritinib/gi, "吉瑞替尼")
    .replace(/Quizartinib/gi, "奎扎替尼")
    .replace(/Sabatolimab/gi, "Sabatolimab（TIM-3抗体）")
    .replace(/Trametinib/gi, "曲美替尼")
    .replace(/Navitoclax/gi, "Navitoclax（BCL-XL/BCL-2抑制剂）")
    .replace(/Selinexor/gi, "塞利尼索")
    .replace(/Eltanexor/gi, "Eltanexor（XPO1抑制剂）")
    .replace(/Omacetaxine/gi, "高三尖杉酯碱")
    .replace(/Mepesuccinate/gi, "")
    .replace(/Midostaurin/gi, "米哚妥林")
    .replace(/Thiotepa/gi, "噻替派")
    .replace(/Amsacrine/gi, "安吖啶")
    .replace(/Tacrolimus/gi, "他克莫司")
    .replace(/Mycophenolate Mofetil/gi, "吗替麦考酚酯")
    .replace(/Unrelated Umbilical Cord Blood/gi, "非亲缘脐带血")
    .replace(/Decetabine/gi, "地西他滨")
    .replace(/PD-1 inhibitor/gi, "PD-1抑制剂")
    .replace(/Akt\/ERK Inhibitor ONC201/gi, "ONC201（Akt/ERK通路药物）")
    .replace(/GPBMC infusion/gi, "G-CSF动员外周血单个核细胞输注")
    .replace(/VEN \(维奈克拉\)/gi, "维奈克拉")
    .replace(/Oral Tablet/gi, "")
    .replace(/\(Part 2 - recruiting\)/gi, "")
    .replace(/Sapacitabine/gi, "Sapacitabine（核苷类似物）")
    .replace(/Onureg/gi, "口服阿扎胞苷")
    .replace(/Standard chemotherapy/gi, "标准化疗")
    .replace(/Total Body Irradiation/gi, "全身照射")
    .replace(/Allo-?HSCT/gi, "异基因造血干细胞移植")
    .replace(/\b(?:in combination with|combined with|plus|and)\b/gi, " + ")
    .replace(/\bor\b/gi, "或")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s+/g, " ")
    .trim();
}

function translateOutcome(value = "") {
  if (!value) return "安全性、耐受性及初步疗效";
  if (/overall survival|\bOS\b/i.test(value)) return "总生存期（OS）";
  if (/event.free survival|\bEFS\b/i.test(value)) return "无事件生存期（EFS）";
  if (/progression.free survival|\bPFS\b/i.test(value)) return "无进展生存期（PFS）";
  if (/relapse.free survival|\bRFS\b/i.test(value)) return "无复发生存期（RFS）";
  if (/complete remission|\bCR\b/i.test(value)) return "完全缓解率（CR）";
  if (/overall response|\bORR\b|modified overall response/i.test(value)) return "总体缓解率（ORR/mOR）";
  if (/dose.limiting|DLT/i.test(value)) return "剂量限制性毒性（DLT）";
  if (/recommended.*dose|RP2D|maximum tolerated/i.test(value)) return "推荐II期剂量/最大耐受剂量";
  if (/adverse event|safety|tolerability/i.test(value)) return "安全性与耐受性";
  if (/transfusion independence/i.test(value)) return "输血独立率";
  if (/engraftment/i.test(value)) return "造血重建/植入";
  return value.length > 54 ? `${value.slice(0, 52)}…` : value;
}

function phaseLabel(phases = []) {
  if (phases.length > 1 && phases.every((phase) => phaseMap[phase])) {
    return `${phases.map((phase) => phaseMap[phase].replace("期", "")).join("/")}期`;
  }
  return phases.map((phase) => phaseMap[phase] ?? phase).join("/");
}

function indicationLabel(title = "") {
  if (/therapy.related|secondary myelodysplastic/i.test(title)) return "治疗相关或继发性MDS";
  if (/relapsed|refractory|R\/R/i.test(title)) return "复发/难治性MDS";
  if (/transplant|HSCT|conditioning|maintenance/i.test(title)) return "MDS移植桥接/预处理/维持";
  if (/treatment.na.ve|previously untreated|newly diagnosed|untreated/i.test(title)) return "初治高危MDS";
  if (/MDS\/MPN|CMML/i.test(title)) return "MDS/MPN或CMML";
  if (/AML.*MDS|MDS.*AML/i.test(title)) return "AML/MDS";
  return "MDS";
}

function studyCategory(title = "") {
  if (/transplant|HSCT|conditioning|maintenance/i.test(title)) return "移植/维持";
  if (/AML|acute myeloid|CMML|MDS\/MPN|myeloid malignan/i.test(title)) return "AML/MDS篮式研究";
  return "MDS专门研究";
}

function populationText(title, ageModule = {}) {
  const indication = indicationLabel(title);
  const age = ageModule.minimumAge
    ? `${ageModule.minimumAge}${ageModule.maximumAge ? `至${ageModule.maximumAge}` : "以上"}`
    : "成人";
  if (indication === "MDS移植桥接/预处理/维持") {
    return `${age}MDS或相关髓系肿瘤患者，拟接受异基因造血干细胞移植、桥接治疗或移植后维持；具体疾病状态和移植条件以方案为准`;
  }
  if (indication === "AML/MDS" || indication === "MDS/MPN或CMML") {
    return `${age}${indication}患者；MDS患者须进入含维奈克拉的治疗队列，并符合相应风险分层、既往治疗和器官功能要求`;
  }
  return `${age}${indication}患者；骨髓原始细胞、IPSS/IPSS-R风险、既往HMA治疗及移植适合性须符合登记方案`;
}

function designText(design = {}) {
  const allocation = design.designInfo?.allocation;
  const masking = design.designInfo?.maskingInfo?.masking;
  const model = design.designInfo?.interventionModel;
  return [
    allocation === "RANDOMIZED" ? "随机" : allocation === "NON_RANDOMIZED" ? "非随机" : "非随机/未说明分配",
    masking === "NONE" ? "开放标签" : masking ? "设盲" : "开放标签或未说明",
    model === "PARALLEL" ? "平行分组" : model === "SINGLE_GROUP" ? "单组" : "多队列/剂量探索",
    phaseLabel(design.phases),
  ].join("、");
}

function regimenFor(study) {
  const module = study.protocolSection.armsInterventionsModule ?? {};
  const venArms = (module.armGroups ?? []).filter((arm) =>
    (arm.interventionNames ?? []).some(hasVenetoclax),
  );
  const names = unique(
    venArms
      .flatMap((arm) => arm.interventionNames ?? [])
      .filter((name) => /^(Drug|Biological|Combination Product):/i.test(name))
      .map(translateDrug),
  );
  if (!names.length) {
    return "含维奈克拉的试验治疗方案";
  }
  return names.slice(0, 7).join(" + ");
}

const keyOverrides = {
  NCT02942290: {
    name: "M15-531 / 初治高危MDS",
    result: "截至2023-05，RP2D人群107例：mOR 80.4%，CR 29.9%，mCR 50.5%；中位OS 26.0个月。该早期单臂高缓解率未在后续VERONA III期转化为显著OS获益。",
    dataCut: "2023-05-31",
    evidenceLevel: "Ib期 · 同行评议完整结果",
    baselineCharacteristics: [
      { label: "年龄", value: "中位68岁（26–87）" },
      { label: "男性", value: "69.2%（74/107）" },
      { label: "IPSS-R高/极高危", value: "86.0%（92/107）" },
      { label: "骨髓原始细胞", value: "中位11.0%（1–19.5）" },
      { label: "ECOG 0/1/2", value: "52.8% / 40.6% / 6.6%" },
      { label: "TP53突变", value: "23.8%（20/84可评估）" },
      { label: "基线输血依赖", value: "55.1%（59/107）" },
    ],
    efficacyHighlights: [
      { label: "mOR", value: "80.4%", context: "CR+mCR+PR" },
      { label: "CR / mCR", value: "29.9% / 50.5%" },
      { label: "中位OS", value: "26.0个月", context: "95% CI 18.1–51.5" },
      { label: "输血依赖转独立", value: "40.7%", context: "24/59" },
      { label: "血液学改善", value: "49.0%", context: "51/104" },
    ],
    safetyHighlights: [
      { label: "中性粒细胞减少", value: "48.6%" },
      { label: "血小板减少", value: "44.9%" },
      { label: "发热性中性粒细胞减少", value: "42.1%" },
      { label: "研究设计调整", value: "早期28天给药出现2例致死性脓毒症后，改为每周期14天" },
    ],
    subgroupAnalyses: [
      { dimension: "基因突变", subgroup: "TP53突变", n: "20", endpoint: "CR / OS", effect: "CR 25%；中位OS 11.2个月", ci: "CR 95% CI 8.7–49.1；OS 95% CI 5.7–18.1", interactionP: "未报告", conclusion: "较总体人群OS数值更短；探索性小样本" },
      { dimension: "输血状态", subgroup: "基线RBC和/或血小板输血依赖", n: "59", endpoint: "输血独立", effect: "40.7%转为输血独立", ci: "未报告", interactionP: "未报告", conclusion: "24例获得输血独立，其中11例同时达到CR" },
      { dimension: "预后因素", subgroup: "ECOG与基线骨髓原始细胞", n: "107", endpoint: "OS", effect: "单/多因素分析提示可能影响OS", ci: "未报告", interactionP: "未报告", conclusion: "探索性分析，受样本量限制，不可视为确证性预测标志物" },
    ],
    sources: [
      { label: "ClinicalTrials.gov", url: "https://clinicaltrials.gov/study/NCT02942290" },
      { label: "Blood 2025完整论文", url: "https://pubmed.ncbi.nlm.nih.gov/39652823/" },
    ],
  },
  NCT02966782: {
    name: "M15-522 / R/R MDS",
    result: "Venetoclax+阿扎胞苷队列44例：37例可评估者mORR 38.6%，CR 6.8%，mCR 31.8%；中位OS 12.6个月、中位PFS 8.6个月。Venetoclax单药活性有限。",
    dataCut: "2021-05",
    evidenceLevel: "Ib期 · 同行评议完整结果",
    baselineCharacteristics: [
      { label: "年龄", value: "中位74岁（44–91）" },
      { label: "男性", value: "86.3%（38/44）" },
      { label: "ECOG 0/1/2", value: "22.7% / 61.3% / 15.9%" },
      { label: "骨髓原始细胞≥5%", value: "75.0%（33/44）" },
      { label: "IPSS-R高/极高危", value: "72%" },
      { label: "既往HMA>6周期", value: "65.1%" },
    ],
    efficacyHighlights: [
      { label: "mORR", value: "38.6%", context: "17/44" },
      { label: "CR / mCR", value: "6.8% / 31.8%" },
      { label: "中位DoR", value: "8.6个月", context: "95% CI 6.0–13.3" },
      { label: "中位OS", value: "12.6个月", context: "95% CI 9.1–17.2" },
      { label: "中位PFS", value: "8.6个月", context: "95% CI 5.4–14.3" },
    ],
    safetyHighlights: [
      { label: "主要风险", value: "中性粒细胞减少、血小板减少及感染" },
      { label: "TLS", value: "未发生" },
      { label: "给药场景", value: "可门诊治疗，未采用剂量爬坡" },
    ],
    subgroupAnalyses: [
      { dimension: "基因突变", subgroup: "IDH2突变", n: "6", endpoint: "ORR", effect: "83%", ci: "未报告", interactionP: "未报告", conclusion: "探索性小样本，不能证明预测性" },
      { dimension: "基因突变", subgroup: "TP53突变", n: "5", endpoint: "ORR", effect: "20%", ci: "未报告", interactionP: "未报告", conclusion: "缓解率较低，且论文提示OS较短" },
      { dimension: "基因突变", subgroup: "RUNX1突变", n: "11", endpoint: "ORR", effect: "54%", ci: "未报告", interactionP: "未报告", conclusion: "探索性分析" },
      { dimension: "基因突变", subgroup: "TET2 / DNMT3A突变", n: "6 / 7", endpoint: "ORR", effect: "33% / 57%", ci: "未报告", interactionP: "未报告", conclusion: "样本量有限，跨亚组比较需谨慎" },
    ],
    sources: [
      { label: "ClinicalTrials.gov", url: "https://clinicaltrials.gov/study/NCT02966782" },
      { label: "American Journal of Hematology 2023", url: "https://pubmed.ncbi.nlm.nih.gov/36309981/" },
    ],
  },
  NCT04401748: {
    name: "VERONA",
    result: "全球随机III期未达到OS主要终点：Venetoclax+阿扎胞苷 vs 安慰剂+阿扎胞苷，OS HR 0.908，分层log-rank P=0.3772；未观察到新的安全性信号。",
    dataCut: "2025-06-16",
    evidenceLevel: "III期 · OS主要终点阴性",
    baselineCharacteristics: [
      { label: "随机人数", value: "509例（256 vs 253）" },
      { label: "年龄", value: "两组中位均72岁" },
      { label: "ECOG 0–1", value: "93% vs 92%" },
      { label: "ECOG 2", value: "7% vs 8%" },
      { label: "地区", value: "北美22% vs 22%；其他地区78% vs 78%" },
    ],
    efficacyHighlights: [
      { label: "OS HR", value: "0.908", context: "P=0.3772，未达主要终点" },
      { label: "结论", value: "未证明总生存获益" },
    ],
    safetyHighlights: [
      { label: "总体安全性", value: "未发现新的安全性信号" },
    ],
    subgroupAnalyses: [
      { dimension: "总体亚组", subgroup: "预设人口学与疾病亚组", n: "509", endpoint: "OS", effect: "完整亚组数据已会议披露，未改变总体OS阴性结论", ci: "详见会议摘要", interactionP: "未形成获益人群结论", conclusion: "不能依据早期单臂缓解率推断生存获益" },
    ],
    sources: [
      { label: "ClinicalTrials.gov", url: "https://clinicaltrials.gov/study/NCT04401748" },
      { label: "AbbVie VERONA顶线结果", url: "https://news.abbvie.com/2025-06-16-AbbVie-Provides-Update-on-VERONA-Trial-for-Newly-Diagnosed-Higher-Risk-Myelodysplastic-Syndromes" },
    ],
  },
};

const trials = payload.studies
  .filter((study) => {
    const protocol = study.protocolSection ?? {};
    const nct = protocol.identificationModule?.nctId;
    const title = `${protocol.identificationModule?.briefTitle ?? ""} ${protocol.identificationModule?.officialTitle ?? ""}`;
    const phases = protocol.designModule?.phases ?? [];
    const interventions = protocol.armsInterventionsModule?.interventions ?? [];
    return nct
      && !excluded.has(nct)
      && /MDS|myelodysplastic/i.test(title)
      && phases.some((phase) => /^PHASE[123]$/.test(phase))
      && interventions.some((item) => hasVenetoclax(item.name));
  })
  .map((study) => {
    const protocol = study.protocolSection;
    const identification = protocol.identificationModule;
    const status = protocol.statusModule ?? {};
    const design = protocol.designModule ?? {};
    const contacts = protocol.contactsLocationsModule ?? {};
    const outcomes = protocol.outcomesModule ?? {};
    const sponsor = protocol.sponsorCollaboratorsModule?.leadSponsor?.name ?? "研究者/合作机构";
    const title = identification.briefTitle ?? identification.officialTitle ?? identification.nctId;
    const nct = identification.nctId;
    const regimen = regimenFor(study);
    const countries = unique(
      (contacts.locations ?? []).map((location) => countryMap[location.country] ?? location.country),
    );
    const primaryOutcomes = (outcomes.primaryOutcomes ?? []).map((item) => translateOutcome(item.measure));
    const secondaryOutcomes = (outcomes.secondaryOutcomes ?? [])
      .map((item) => translateOutcome(item.measure))
      .filter((item, index, array) => array.indexOf(item) === index)
      .slice(0, 6);
    const allocation = design.designInfo?.allocation;
    const override = keyOverrides[nct] ?? {};
    const base = {
      id: `ven-mds-${nct.toLowerCase()}`,
      name: identification.acronym
        ? `${identification.acronym} / ${regimen}`
        : `${nct} / ${regimen}`,
      nct,
      phase: phaseLabel(design.phases ?? []),
      status: statusMap[status.overallStatus] ?? status.overallStatus ?? "状态未报告",
      indication: indicationLabel(title),
      design: designText(design),
      arms: `含维奈克拉治疗臂：${regimen}。多臂研究的非维奈克拉对照或单药队列详见原始登记。`,
      population: populationText(title, protocol.eligibilityModule ?? {}),
      eligibility: {
        keyInclusion: [
          "MDS、MDS-EB2/MDS-AML或相关髓系肿瘤诊断符合研究方案",
          protocol.eligibilityModule?.minimumAge
            ? `年龄${protocol.eligibilityModule.minimumAge}${protocol.eligibilityModule.maximumAge ? `至${protocol.eligibilityModule.maximumAge}` : "以上"}`
            : "年龄满足成人或方案规定范围",
          "风险分层、既往治疗、体能状态与器官功能符合对应队列要求",
        ],
        keyExclusion: [
          "活动性不可控感染或严重器官功能异常",
          "不符合方案规定的既往治疗、移植或合并用药要求",
          "妊娠、哺乳或研究者判断不适合参加",
        ],
        stratificationFactors: allocation === "RANDOMIZED"
          ? ["疾病风险/分型", "既往治疗或移植状态", "地区/研究中心；以登记方案为准"]
          : ["非随机剂量探索或单臂研究，无正式随机分层"],
      },
      subgroupAnalyses: [],
      enrollment: design.enrollmentInfo?.count ?? "未报告",
      primaryEndpoint: primaryOutcomes.join("；") || "安全性、耐受性及初步疗效",
      secondaryEndpoints: secondaryOutcomes.length
        ? secondaryOutcomes
        : ["缓解率", "缓解持续时间", "总生存期", "安全性"],
      startDate: status.startDateStruct?.date ?? "未报告",
      primaryCompletion: status.primaryCompletionDateStruct?.date ?? "未报告",
      countries: countries.length > 8 ? [...countries.slice(0, 7), "其他国家/地区"] : countries,
      sponsor,
      fda: {
        regulatoryId: "NDA 208573",
        designation: "Venetoclax尚未获FDA批准用于MDS",
        submissionStatus: "MDS为研究性用途；VERONA III期OS主要终点阴性",
        lastVerified: dataCut,
      },
      result: ["COMPLETED", "TERMINATED", "WITHDRAWN"].includes(status.overallStatus)
        ? "登记状态已结束或终止；除非本页另列同行评议/会议结果，否则尚无可核验的MDS队列完整疗效、基线或亚组数据。"
        : "研究进行中或尚未开始；暂无成熟的MDS队列疗效、基线及亚组结果。",
      source: "ClinicalTrials.gov官方登记；已逐项确认MDS患者可进入含维奈克拉治疗臂，并排除仅在AML队列使用维奈克拉的研究。",
      dataCut,
      evidenceLevel: `${phaseLabel(design.phases ?? [])} · ${statusMap[status.overallStatus] ?? "登记研究"}`,
      baselineCharacteristics: [],
      efficacyHighlights: [],
      safetyHighlights: [],
      sources: [
        { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/study/${nct}` },
      ],
      milestones: [
        ...(status.startDateStruct?.date ? [{ date: status.startDateStruct.date, event: "研究启动" }] : []),
        ...(status.primaryCompletionDateStruct?.date
          ? [{ date: status.primaryCompletionDateStruct.date, event: "主要完成时间（登记值）" }]
          : []),
      ],
      resultNotes: [
        "仅收录I–III期人体干预研究；不含临床前、实验室或观察性研究。",
        "多疾病篮式研究仅代表MDS患者存在含维奈克拉治疗臂，不等于已获得独立MDS疗效结论。",
      ],
      studyCategory: studyCategory(title),
    };
    return { ...base, ...override };
  })
  .sort((a, b) => a.nct.localeCompare(b.nct));

fs.writeFileSync(outputPath, `${JSON.stringify(trials, null, 2)}\n`);
console.log(`已生成 ${trials.length} 项 Venetoclax-MDS I–III期临床：${outputPath}`);

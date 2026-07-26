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

const interventionNames = [
  [/sonrotoclax|sotoclax|bgb-11417/gi, "索托克拉"],
  [/mesutoclax|icp-248/gi, "ICP-248（Mesutoclax）"],
  [/zanubrutinib|bgb-3111/gi, "泽布替尼"],
  [/orelabrutinib/gi, "奥布替尼"],
  [/venetoclax/gi, "维奈克拉"],
  [/acalabrutinib/gi, "阿可替尼"],
  [/obinutuzumab/gi, "奥妥珠单抗"],
  [/rituximab/gi, "利妥昔单抗"],
  [/dexamethasone/gi, "地塞米松"],
  [/carfilzomib/gi, "卡非佐米"],
  [/daratumumab/gi, "达雷妥尤单抗"],
  [/pomalidomide/gi, "泊马度胺"],
  [/azacitidine/gi, "阿扎胞苷"],
  [/bendamustine/gi, "苯达莫司汀"],
  [/cytarabine/gi, "阿糖胞苷"],
  [/tislelizumab/gi, "替雷利珠单抗"],
  [/pirtobrutinib/gi, "匹妥布替尼"],
  [/blinatumomab/gi, "贝林妥欧单抗"],
  [/catadegbrutinib/gi, "Catadegbrutinib（BTK降解剂）"],
  [/mosunetuzumab/gi, "莫妥珠单抗"],
  [/glofitamab/gi, "格菲妥单抗"],
  [/phenytoin/gi, "苯妥英"],
  [/itraconazole/gi, "伊曲康唑"],
  [/posaconazole/gi, "泊沙康唑"],
  [/gilteritinib/gi, "吉瑞替尼"],
  [/quizartinib dihydrochloride/gi, "盐酸奎扎替尼"],
  [/ivosidenib/gi, "艾伏尼布"],
  [/idarubicin\/daunorubicin/gi, "伊达比星/柔红霉素"],
  [/anthracycline/gi, "蒽环类药物"],
  [/polatuzumab vedotin/gi, "泊洛妥珠单抗"],
  [/cyclophosphamide/gi, "环磷酰胺"],
  [/doxorubicin/gi, "多柔比星"],
  [/prednisone|prednisolone/gi, "泼尼松"],
  [/bgb-16673/gi, "BGB-16673（BTK降解剂）"],
  [/bcl-2 indibitor|bcl-2 inhibitor/gi, "BCL-2抑制剂"],
  [/cm336\s*\(bcma\/cd3 bispecific antibody\)/gi, "CM336（BCMA/CD3双特异性抗体）"],
  [/car-t cell therapy/gi, "CAR-T细胞治疗"],
  [/computed tomography/gi, "计算机断层扫描（CT）"],
  [/bone marrow aspiration/gi, "骨髓穿刺"],
  [/bone marrow biopsy/gi, "骨髓活检"],
  [/biospecimen collection/gi, "生物样本采集"],
  [/magnetic resonance imaging/gi, "磁共振成像（MRI）"],
  [/gastrointestinal endoscopy/gi, "胃肠镜检查"],
  [/questionnaire administration|survey administration/gi, "问卷评估"],
  [/biopsy/gi, "活检"],
  [/allo-hsct/gi, "异基因造血干细胞移植"],
  [/anti-cd20(?: monoclonal antibody| mab)?/gi, "抗CD20单抗"],
  [/^cd20$/gi, "抗CD20单抗"],
  [/chemotherapy/gi, "化疗"],
  [/placebo/gi, "安慰剂"],
];

const translateIntervention = (value = "") => {
  let translated = value.replace(/^(Drug|Biological|Other|Procedure):\s*/i, "");
  for (const [pattern, replacement] of interventionNames) {
    translated = translated.replace(pattern, replacement);
  }
  return clean(
    translated
      .replace(/tablet for oral suspension/gi, "口服混悬制剂")
      .replace(/\btablet\b/gi, "片剂")
      .replace(/\bin combination with\b/gi, "联合")
      .replace(/\bcombined with\b/gi, "联合")
      .replace(/\bregimen\b/gi, "方案")
      .replace(/(\d+) cycles of/gi, "$1个周期")
      .replace(/\bfollowed by\b/gi, "，之后接受")
      .replace(/\bmaintenance until disease progression\b/gi, "维持治疗直至疾病进展")
      .replace(/\band\b/gi, "与"),
  );
};

const armSummary = (protocol) => {
  const arms = protocol.armsInterventionsModule?.armGroups ?? [];
  if (!arms.length) {
    return unique(
      (protocol.armsInterventionsModule?.interventions ?? []).map((item) => translateIntervention(item.name)),
    ).join(" + ") || "治疗方案详见研究方案";
  }
  return arms
    .map((arm, index) => {
      const names = unique((arm.interventionNames ?? []).map(translateIntervention));
      return `第${index + 1}组：${names.join(" + ") || "方案规定的研究治疗"}`;
    })
    .join("；")
    .slice(0, 1800);
};

const designSummary = (protocol) => {
  const design = protocol.designModule?.designInfo ?? {};
  const allocation = {
    RANDOMIZED: "随机",
    NON_RANDOMIZED: "非随机",
    NA: "不适用",
  }[design.allocation] ?? "未说明随机方式";
  const model = {
    PARALLEL: "平行分组",
    SINGLE_GROUP: "单组",
    CROSSOVER: "交叉设计",
    SEQUENTIAL: "序贯设计",
    FACTORIAL: "析因设计",
  }[design.interventionModel] ?? "干预性研究";
  const masking = {
    NONE: "开放标签",
    SINGLE: "单盲",
    DOUBLE: "双盲",
    TRIPLE: "三盲",
    QUADRUPLE: "四盲",
  }[design.maskingInfo?.masking] ?? "盲法未说明";
  return [
    allocation,
    model,
    masking,
    "治疗性临床研究",
  ].join("、");
};

const eligibilityChinese = (protocol, indication) => {
  const eligibility = protocol.eligibilityModule ?? {};
  const healthy = eligibility.healthyVolunteers || indication.includes("健康受试者");
  const age = [
    eligibility.minimumAge ? `最低年龄${eligibility.minimumAge.replace("Years", "岁")}` : "",
    eligibility.maximumAge ? `最高年龄${eligibility.maximumAge.replace("Years", "岁")}` : "",
  ].filter(Boolean).join("，");
  if (healthy) {
    return {
      keyInclusion: [
        "经病史、体格检查、生命体征、心电图及实验室检查确认健康",
        age || "年龄符合方案规定",
        "体重指数及其他药代研究指标符合方案要求",
        "能够理解研究并签署知情同意书",
      ],
      keyExclusion: [
        "存在可能影响药物吸收、代谢、安全性或结果解释的重要疾病",
        "近期使用方案禁止的处方药、非处方药或研究药物",
        "实验室检查、心电图或生命体征存在有临床意义的异常",
        "研究者判断不适合参加研究",
      ],
    };
  }
  return {
    keyInclusion: [
      `经病理、流式细胞术或相应诊断标准确认${indication}`,
      age || "成人患者，年龄符合方案规定",
      "疾病分期、既往治疗线数及可测量病灶符合对应队列要求",
      "ECOG体能状态、预期生存期及主要器官功能符合方案要求",
      "能够口服研究药物并签署知情同意书",
    ],
    keyExclusion: [
      "活动性中枢神经系统受累或方案明确排除的疾病转化",
      "未控制的活动性感染或其他严重合并症",
      "既往治疗毒性尚未恢复至方案允许范围",
      "近期接受方案禁止的抗肿瘤治疗、移植或研究药物",
      "妊娠、哺乳或无法执行方案规定避孕措施",
      "研究者判断可能增加风险或干扰疗效、安全性评价",
    ],
  };
};

const endpointChinese = (value = "") => {
  const text = value.toUpperCase();
  const labels = [];
  const add = (condition, label) => {
    if (condition) labels.push(label);
  };
  add(/DOSE[- ]LIMITING|DLT/.test(text), "剂量限制性毒性（DLT）");
  add(/MAXIMUM TOLERATED|MTD/.test(text), "最大耐受剂量（MTD）");
  add(/RECOMMENDED.*DOSE|RP2D|RDE/.test(text), "推荐II期剂量（RP2D）");
  add(/ADVERSE EVENT|TEAE|SAE|SAFETY|TOLERABILITY/.test(text), "不良事件与安全性");
  add(/OVERALL RESPONSE|OBJECTIVE RESPONSE|ORR/.test(text), "客观缓解率（ORR）");
  add(/COMPLETE RESPONSE|COMPLETE REMISSION|CRR/.test(text), "完全缓解率（CR/CRR）");
  add(/VERY GOOD PARTIAL RESPONSE|VGPR/.test(text), "VGPR及以上缓解率");
  add(/PROGRESSION[- ]FREE|PFS/.test(text), "无进展生存期（PFS）");
  add(/EVENT[- ]FREE|EFS/.test(text), "无事件生存期（EFS）");
  add(/OVERALL SURVIVAL|\bOS\b/.test(text), "总生存期（OS）");
  add(/DURATION OF RESPONSE|\bDOR\b/.test(text), "缓解持续时间（DoR）");
  add(/TIME TO.*RESPONSE|\bTTR\b/.test(text), "至缓解时间（TTR）");
  add(/MINIMAL RESIDUAL|MRD/.test(text), "微小残留病灶（MRD）阴性率");
  add(/AREA UNDER|AUC/.test(text), "药时曲线下面积（AUC）");
  add(/MAXIMUM.*CONCENTRATION|CMAX/.test(text), "峰浓度（Cmax）");
  add(/TIME OF.*MAXIMUM|TMAX/.test(text), "达峰时间（Tmax）");
  add(/HALF[- ]LIFE|T1\/2/.test(text), "消除半衰期（t1/2）");
  add(/CLEARANCE|CL\/F/.test(text), "表观清除率（CL/F）");
  add(/VOLUME OF DISTRIBUTION|VZ\/F/.test(text), "表观分布容积（Vz/F）");
  add(/TROUGH|CTROUGH/.test(text), "谷浓度（Ctrough）");
  add(/QUALITY OF LIFE|EQ-5D|FACT-|QLQ/.test(text), "患者报告结局与生活质量");
  add(/ORGAN RESPONSE/.test(text), "器官缓解");
  add(/CAR-T/.test(text), "CAR-T治疗后完全缓解");
  return unique(labels);
};

const outcomeSummary = (outcomes, fallback) => {
  const labels = unique(outcomes.flatMap((item) => endpointChinese(item.measure ?? item)));
  return labels.length ? labels : [fallback];
};

const countryNames = {
  Australia: "澳大利亚",
  Canada: "加拿大",
  China: "中国",
  France: "法国",
  Germany: "德国",
  Italy: "意大利",
  "New Zealand": "新西兰",
  Poland: "波兰",
  "Puerto Rico": "波多黎各",
  Spain: "西班牙",
  Sweden: "瑞典",
  Ukraine: "乌克兰",
  "United Kingdom": "英国",
  "United States": "美国",
};

const sponsorNames = {
  "BeOne Medicines": "百济神州（BeOne Medicines）",
  "BeOne Medicines USA Inc.": "百济神州美国公司",
  "BeiGene": "百济神州",
  "BeiGene, Ltd.": "百济神州",
  "Beijing InnoCare Pharma Tech Co., Ltd.": "北京诺诚健华医药科技有限公司",
  "InnoCare Pharma Inc.": "诺诚健华医药公司",
  "Canadian Cancer Trials Group": "加拿大癌症临床试验组",
  "Institute of Hematology & Blood Diseases Hospital, China": "中国医学科学院血液病医院",
};

const baselineFromResults = (results) => {
  const baselineLabel = (value = "") => {
    const text = value.toUpperCase();
    if (/AGE/.test(text)) return "年龄";
    if (/SEX|GENDER/.test(text)) return "性别";
    if (/ECOG/.test(text)) return "ECOG体能状态";
    if (/IGHV/.test(text)) return "IGHV突变状态";
    if (/TP53/.test(text)) return "TP53突变状态";
    if (/17P/.test(text)) return "del(17p)状态";
    if (/PRIOR/.test(text)) return "既往治疗情况";
    return "基线特征";
  };
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
        label: baselineLabel(measure.title),
        value: unique(values ?? []).slice(0, 5).join(" / ") || "见注册库结果表",
      };
    });
  return selected.length
    ? selected
    : [{ label: "实际入组基线", value: "尚未在注册库发布结构化结果；不以计划入组标准代替实际基线" }];
};

const publicResults = {
  NCT05471843: {
    result: "R/R MCL、既往抗CD20及BTK抑制剂治疗后：IRC ORR 52.4%，CR 15.5%，中位DoR 15.8个月；支持美国FDA加速批准。",
    efficacy: [
      ["IRC ORR", "52.4%（95%CI 42.4–62.4）", "Part 2，320 mg，n=103"],
      ["IRC CR率", "15.5%（95%CI 9.1–24.0）"],
      ["研究者评估ORR", "47.6%（95%CI 37.6–57.6）"],
      ["中位至缓解时间", "1.9个月（1.6–6.2）"],
      ["中位DoR", "15.8个月（95%CI 7.4–NE）"],
      ["9个月持续缓解率", "63%"],
      ["中位PFS", "6.5个月（95%CI 4.0–10.4）"],
      ["中位OS", "未达到（95%CI 14.8–NE）"],
      ["12个月OS率", "67.4%"],
    ],
    safety: [
      ["任何TEAE", "96.5%；≥3级52.2%", "安全性集n=115"],
      ["中性粒细胞减少", "35.7%"],
      ["血小板减少", "24.3%"],
      ["贫血", "24.3%"],
      ["感染", "39.1%"],
      ["TLS", "7.0%（临床2例、实验室6例）", "均缓解，无TLS导致停药或死亡"],
      ["发热性中性粒细胞减少", "1.7%"],
      ["TEAE导致停药", "13.9%"],
      ["TEAE导致死亡", "13.0%"],
    ],
    baseline: [
      ["总入组", "125例", "160 mg n=10；320 mg n=115"],
      ["疗效可评估", "103例", "Part 2，320 mg RP2D"],
      ["中位年龄", "68岁（39–85）"],
      ["≥65岁", "64.3%"],
      ["既往治疗", "中位3线"],
      ["Stage IV", "78.3%"],
      ["中高危MIPI", "69.6%"],
      ["Ki-67 ≥30%", "53.0%"],
      ["大肿块（≥5 cm）", "40.0%"],
      ["末线难治", "87.0%"],
    ],
    subgroups: [
      ["分子高危", "TP53突变", "n=22", "IRC ORR", "59.1%", "95%CI 36.4–79.3", "含3例CR"],
      ["肿瘤负荷", "大肿块（LDi ≥5 cm）", "未单列", "IRC ORR", "54.8%", "未报告", "探索性分析"],
      ["年龄", "≥65岁", "未单列", "IRC ORR", "52.3%", "未报告", "与总体结果接近"],
      ["既往疗效", "末线难治", "未单列", "IRC ORR", "49.4%", "未报告", "探索性分析"],
      ["增殖指数", "Ki-67 ≥30%", "未单列", "IRC ORR", "47.2%", "未报告", "探索性分析"],
      ["既往线数", "≥3线", "未单列", "IRC ORR", "46.8%", "未报告", "探索性分析"],
      ["预后评分", "高s-MIPI", "未单列", "IRC ORR", "40.0%", "未报告", "探索性分析"],
      ["既往治疗", "既往匹妥布替尼", "n=14", "IRC ORR", "50.0%", "未报告", "小样本，谨慎解释"],
      ["既往线数", "<3线", "未单列", "IRC ORR", "61.0%", "95%CI 44.5–75.8", "探索性分析"],
    ],
    milestones: [
      ["2025-02-04", "关键数据截止，Part 2完成入组"],
      ["2025-12", "ASH 2025口头报告"],
      ["2025-11", "FDA授予优先审评"],
      ["2026-05-13", "FDA加速批准BEQALZI用于既往至少2线且含BTKi的R/R MCL"],
    ],
    notes: [
      "推荐方案为4周剂量递增至320 mg，每日一次口服直至疾病进展或不可耐受。",
      "Part 1未观察到DLT，未达到MTD，320 mg确定为RP2D。",
      "确证性III期CELESTIAL-RRMCL（NCT06742996）正在进行。",
    ],
    source: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-sonrotoclax-relapsed-or-refractory-mantle-cell-lymphoma",
  },
  NCT05479994: {
    result: "中国注册性II期R/R CLL/SLL研究：IRC ORR 76.0%，CR/CRi 19.0%，最佳外周血uMRD4率49.0%；支持中国获批。",
    efficacy: [
      ["IRC ORR", "76.0%"],
      ["CR/CRi", "19.0%"],
      ["中位至缓解时间", "3.7个月"],
      ["最佳外周血uMRD4", "49.0%（49/100）"],
      ["中位至uMRD4时间", "5.8个月（3–12）"],
      ["中位DoR", "未达到"],
      ["中位PFS", "未达到"],
      ["中位OS", "未达到"],
    ],
    safety: [
      ["中性粒细胞减少", "54.0%；≥3级33.0%"],
      ["血小板减少", "41.0%；≥3级11.0%"],
      ["贫血", "33.0%"],
      ["高尿酸血症", "33.0%"],
      ["白细胞减少", "30.0%；≥3级10.0%"],
      ["≥3级肺炎", "17.0%"],
      ["≥3级TEAE", "61.0%"],
      ["TLS", "无临床TLS；实验室TLS 4.0%"],
      ["停药/死亡", "停药6.0%；死亡5.0%（均判定与治疗无关）"],
    ],
    baseline: [
      ["总入组", "100例", "中国R/R CLL/SLL"],
      ["既往BTKi+抗CD20", "46.0%"],
      ["既往≥3线", "27.0%"],
      ["del(17p)和/或TP53突变", "38.1%"],
      ["IGHV未突变", "62.8%"],
      ["BTK基因突变", "25.5%"],
    ],
    subgroups: [
      ["IGHV状态", "IGHV未突变", "n=27", "研究者评估ORR", "74.1%（20/27）", "未报告", "与总体结果方向一致"],
      ["分子高危", "del(17p)和/或TP53突变", "n=37", "研究者评估ORR", "70.3%（26/37）", "未报告", "探索性亚组"],
      ["耐药机制", "BTK基因突变", "n=25", "研究者评估ORR", "72.0%（18/25）", "未报告", "探索性亚组"],
    ],
    milestones: [
      ["2025-12", "ASH 2025公布主要分析结果"],
      ["2026-01-06", "中国批准R/R CLL/SLL适应症"],
    ],
    notes: ["患者既往BTK抑制剂和免疫化疗不耐受或治疗失败，且既往未使用BCL-2抑制剂。"],
    source: "https://ir.beonemedicines.com/news/beone-medicines-novel-bcl2-inhibitor-sonrotoclax-achieves-first-in-world-approval-in-rr-mcl-and-rr-cllsll/562da165-f6a9-48d0-a357-aca27ac112ca",
  },
  NCT04277637: {
    result: "初治CLL/SLL的Sonrotoclax+Zanubrutinib队列：ORR 100%、CR 59.5%、最佳uMRD4 98.8%；TP53突变/del(17p)人群最佳uMRD 92.9%。",
    efficacy: [
      ["ORR", "100%"],
      ["CR率", "59.5%"],
      ["最佳uMRD4", "98.8%"],
      ["达到uMRD4中位时间", "联合治疗后4.5个月"],
      ["320 mg组疾病进展", "0例", "包括选择性停药患者"],
    ],
    safety: [["安全性", "与既往联合研究一致；需注意中性粒细胞减少和TLS监测"]],
    baseline: [
      ["总入组", "137例", "160 mg n=51；320 mg n=86"],
      ["中位年龄", "62岁（32–84）"],
      ["男性", "71.5%"],
      ["del(17p)", "9.0%"],
      ["TP53突变", "22.0%"],
      ["del(11q)", "17.2%"],
      ["IGHV未突变", "59.8%"],
      ["高肿瘤负荷", "29.3%"],
      ["中位随访", "约34个月", "ASCO 2026更新"],
    ],
    subgroups: [
      ["IGHV状态", "IGHV突变型", "未单列", "最佳uMRD4", "91.7%", "未报告", "探索性分析"],
      ["IGHV状态", "IGHV未突变型", "未单列", "最佳uMRD4", "96.8%", "未报告", "探索性分析"],
      ["分子高危", "TP53突变和/或del(17p)", "未单列", "最佳uMRD4", "92.9%", "未报告", "高危患者仍显示深度缓解"],
      ["分子低危", "无TP53突变/del(17p)", "未单列", "最佳uMRD4", "97.7%", "未报告", "探索性分析"],
    ],
    milestones: [
      ["2024-08-23", "既往披露数据截止"],
      ["2026-06", "ASCO 2026更新约34个月随访数据"],
    ],
    notes: [
      "泽布替尼导入8–12周后联合Sonrotoclax；320 mg为推荐II期剂量。",
      "跨剂量队列最佳uMRD4为98.8%，并非所有指标均来自同一时间点。",
    ],
    source: "https://ir.beonemedicines.com/news/beone-medicines-establishes-standard-for-long-term-disease-control-in-cll-with-brukinsa-78-month-data-at/b4bd2456-0171-42db-b7ff-3dc5dea831a2",
  },
  NCT04973605: {
    result: "t(11;14)阳性R/R多发性骨髓瘤早期队列中，Sonrotoclax联合卡非佐米和地塞米松的ORR为84%；样本量仅19例。",
    efficacy: [
      ["ORR", "84%（95%CI 60–97）", "疗效可评估n=19"],
      ["CR/sCR", "32%（95%CI 13–57）"],
      ["中位至缓解时间", "1.0个月（0.9–6.1）"],
      ["中位DoR", "未达到"],
      ["中位PFS", "未达到"],
    ],
    safety: [
      ["DLT", "2例", "3级血小板减少、急性肾损伤"],
      ["严重TEAE", "40%"],
      ["肺炎", "15%"],
      ["治疗相关停药/减量", "未观察到"],
    ],
    baseline: [
      ["疗效可评估", "19例"],
      ["生物标志物", "t(11;14)阳性"],
      ["疾病状态", "复发/难治性多发性骨髓瘤"],
    ],
    subgroups: [],
    milestones: [
      ["2025-12", "ASH 2025公布早期联合队列数据"],
      ["2026H2", "公司计划启动t(11;14) R/R MM III期研究"],
    ],
    notes: ["早期单臂小样本结果，尚不能与其他方案进行确定性比较。"],
    source: "https://ir.beonemedicines.com/news/sonrotoclax-data-at-ash-2025-confirm-foundational-potential-across-b-cell-malignancies/4c69168c-15f1-4af8-98f3-38d14b8d32cd",
  },
  NCT05728658: {
    result: "Mesutoclax单药/联合早期研究：BTKi难治R/R MCL亚组ORR 84%、CR 36%；R/R CLL/SLL与MCL多个队列显示活性。",
    efficacy: [
      ["BTKi难治R/R MCL ORR", "84%"],
      ["BTKi难治R/R MCL CR", "36%"],
      ["R/R MCL总体ORR", "87.5%"],
      ["R/R MCL总体CRR", "46.9%"],
      ["R/R CLL/SLL ORR", "100%（早期小样本）"],
    ],
    safety: [
      ["DLT", "未观察到"],
      ["MTD", "爬坡至150 mg仍未达到"],
      ["总体安全性", "公司披露耐受性与PK特征良好；TLS采用剂量爬坡管理"],
    ],
    baseline: [
      ["阶段性入组", "81例", "CLL/SLL、MCL及其他NHL亚型"],
      ["推荐剂量", "125 mg每日一次"],
      ["BTKi难治R/R MCL", "25例"],
    ],
    subgroups: [
      ["疾病/既往BTKi", "R/R MCL总体", "未单列", "ORR/CRR", "87.5% / 46.9%", "未报告", "早期单臂研究"],
      ["既往BTKi反应", "BTKi难治R/R MCL", "n=25", "ORR/CRR", "84.0% / 36.0%", "未报告", "注册性开发所聚焦人群"],
      ["疾病/既往BTKi", "R/R CLL/SLL", "早期小样本", "ORR", "100%", "未报告", "样本量小，结果需后续验证"],
    ],
    milestones: [
      ["2025-05", "CDE授予BTKi难治R/R MCL突破性治疗品种认定"],
      ["2025-12", "ASH 2025更新R/R MCL数据"],
      ["2026", "BTKi经治R/R MCL单臂注册研究推进中"],
    ],
    notes: ["不同疾病及既往BTKi暴露亚组来自同一早期篮式研究，不能简单合并比较。"],
    source: "https://www.innocarepharma.com/en/news/activity/en020260325-InnoCare-2025-Annual-Results",
  },
  NCT06378138: {
    result: "初治CLL/SLL的Mesutoclax+奥布替尼固定疗程：ORR 100%、靶病灶CR 57.1%、36周外周血uMRD 65%，未观察到TLS。",
    efficacy: [
      ["100 mg组ORR", "95.2%（n=21）"],
      ["125 mg组ORR", "100%（n=21）"],
      ["总体ORR", "97.6%（N=42）"],
      ["125 mg组24周CRR", "23.8%"],
      ["125 mg组靶病灶CRR", "57.1%"],
      ["125 mg组36周外周血uMRD", "65%"],
      ["12个月PFS率", "100%"],
    ],
    safety: [
      ["TLS", "0例（N=42）"],
      ["≥3级中性粒细胞减少", "35.0%", "60例B细胞恶性肿瘤联合汇总分析"],
      ["≥3级血小板减少", "11.7%", "60例联合汇总分析"],
      ["≥3级贫血", "0%", "60例联合汇总分析"],
      ["TEAE导致停药/死亡", "0%", "60例联合汇总分析"],
    ],
    baseline: [
      ["总入组", "42例", "初治CLL/SLL；100 mg n=21，125 mg n=21"],
      ["中高危TLS风险", "76.2%（32/42）"],
      ["TP53突变/del(17p)", "14.3%（6/42）"],
    ],
    subgroups: [
      ["剂量", "100 mg", "n=21", "ORR", "95.2%", "未报告", "早期剂量队列"],
      ["剂量", "125 mg", "n=21", "ORR/靶病灶CRR/uMRD", "100% / 57.1% / 65%", "未报告", "uMRD为36周外周血结果"],
      ["风险特征", "中高危TLS风险", "n=32", "TLS", "0例", "不适用", "需结合导入和预防策略解释"],
      ["分子高危", "TP53突变和/或del(17p)", "n=6", "疗效", "公司称与总体一致", "未报告", "未披露独立效应值"],
    ],
    milestones: [
      ["2025-03", "注册性III期首例患者入组"],
      ["2025-06", "EHA首次披露II期结果"],
      ["2026-02", "III期注册研究完成患者入组"],
      ["2026-06", "ASCO 2026更新联合队列数据"],
    ],
    notes: ["奥布替尼导入后联合ICP-248固定疗程；达到方案规定的MRD目标后可按方案停药。"],
    source: "https://www.innocarepharma.com/uploads/2026-04-23/InnoCare-2026-Q1-Results-NDR_EN.pdf",
  },
  NCT06656494: {
    result: "Mesutoclax+阿扎胞苷：初治MDS可评估患者ORR 100%；初治AML cCR 81.8%，其中MRD阴性率86.5%。数据仍属I期非随机研究。",
    efficacy: [
      ["初治MDS ORR", "100%"],
      ["初治MDS CR", "40%（IWG 2006）"],
      ["初治MDS骨髓CR", "60%（IWG 2006）"],
      ["初治MDS复合CR", "90%（IWG 2023）"],
      ["初治AML cCR", "81.8%"],
      ["AML cCR患者MRD阴性", "86.5%"],
      ["AML第1周期达cCR", "83%（在cCR应答者中）"],
      ["125 mg组6个月DoR率", "93.3%"],
      ["125 mg组6个月OS率", "90.5%"],
    ],
    safety: [
      ["DLT", "未观察到"],
      ["MTD", "未达到"],
      ["TLS", "未观察到"],
      ["30/60天死亡率", "0% / 0%"],
      ["非血液学AE", "多数为1–2级"],
    ],
    baseline: [
      ["研究人群", "初治AML、初治MDS及部分R/R AML"],
      ["治疗方案", "ICP-248联合阿扎胞苷"],
      ["AML数据截止", "2026-04-13"],
      ["MDS数据截止", "2026-04-20"],
    ],
    subgroups: [
      ["疾病类型", "初治AML", "可评估人群", "cCR/MRD阴性", "81.8% / 86.5%", "未报告", "I期非随机数据"],
      ["分子高危", "TP53突变初治AML", "未单列", "cCR/6个月DoR", "71.4% / >50%", "未报告", "小样本探索性亚组"],
      ["疾病类型", "初治MDS", "可评估人群", "ORR/复合CR", "100% / 90%", "未报告", "分别按IWG 2006与2023标准"],
    ],
    milestones: [
      ["2025-12", "ASH 2025披露早期数据"],
      ["2026-06-02", "ASCO 2026口头报告更新AML/MDS结果"],
    ],
    notes: [
      "AML与MDS结果来自同一早期研究的不同疾病队列，评价标准不同。",
      "结果成熟度仍有限，长期DoR、PFS、OS与骨髓抑制风险仍需随访。",
    ],
    source: "https://www.innocarepharma.com/en/news/activity/en020260603",
  },
};

const sonrotoclaxKeyTrials = new Set([
  "NCT04277637",
  "NCT04973605",
  "NCT05471843",
  "NCT05479994",
  "NCT06073821",
  "NCT06742996",
  "NCT06943872",
  "NCT07277231",
  "NCT07321652",
]);

const sonrotoclaxPharmacologyTrials = new Set([
  "NCT05844111",
  "NCT06543043",
  "NCT07141511",
  "NCT07628881",
]);

const classifyStudy = ({ nct, program, healthy, rawSponsor, phases }) => {
  if (program === "sonrotoclax") {
    if (sonrotoclaxKeyTrials.has(nct)) return "关键注册/读出";
    if (healthy || sonrotoclaxPharmacologyTrials.has(nct)) return "药理/药代";
    if (/BeOne|BeiGene/i.test(rawSponsor ?? "")) return "公司探索";
    return "研究者发起";
  }
  if (["NCT05728658", "NCT06378138", "NCT06656494", "NCT07082686"].includes(nct)) {
    return "关键注册/读出";
  }
  if (phases.includes("PHASE3")) return "关键注册/读出";
  return "公司探索";
};

const makeTrial = (study, program) => {
  const protocol = study.protocolSection;
  const nct = protocol.identificationModule.nctId;
  const indication = diseaseLabel(study);
  const eligibility = eligibilityChinese(protocol, indication);
  const primary = outcomeSummary(
    protocol.outcomesModule?.primaryOutcomes ?? [],
    "主要安全性、剂量探索或疗效终点（详见注册方案）",
  );
  const secondary = outcomeSummary(
    protocol.outcomesModule?.secondaryOutcomes ?? [],
    "注册库尚未列出次要终点",
  );
  const aliases = protocol.identificationModule?.secondaryIdInfos?.map((item) => item.id) ?? [];
  const shortName =
    protocol.identificationModule?.acronym ??
    protocol.identificationModule?.orgStudyIdInfo?.id ??
    nct;
  const readout = publicResults[nct];
  const countries = unique(
    protocol.contactsLocationsModule?.locations?.map((location) => location.country) ?? [],
  ).map((country) => countryNames[country] ?? "其他国家/地区");
  const phase = phaseLabel(protocol.designModule?.phases ?? []);
  const isSonrotoclax = program === "sonrotoclax";
  const approvedTrial = nct === "NCT05471843";
  const healthy = indication.includes("健康受试者");
  const rawSponsor = protocol.sponsorCollaboratorsModule?.leadSponsor?.name
    ?? protocol.identificationModule?.organization?.fullName;
  const sponsor = sponsorNames[rawSponsor]
    ?? (isSonrotoclax ? "百济神州（BeOne Medicines）" : "诺诚健华");
  const studyCategory = classifyStudy({
    nct,
    program,
    healthy,
    rawSponsor,
    phases: protocol.designModule?.phases ?? [],
  });
  const subgroups = readout?.subgroups
    ?? (readout?.subgroup ? [readout.subgroup] : []);
  return {
    id: `${program}-${nct.toLowerCase()}`,
    name: `${shortName} / ${indication}`,
    nct,
    phase,
    status: nct === "NCT06378138"
      ? "已完成入组（随访中）"
      : statusMap[protocol.statusModule?.overallStatus] ?? protocol.statusModule?.overallStatus ?? "未报告",
    indication,
    design: designSummary(protocol),
    arms: armSummary(protocol),
    population: healthy
      ? "健康成人受试者；年龄、体重指数、实验室检查及其他药代研究条件符合方案要求"
      : `${indication}患者；疾病分期、既往治疗线数、可测量病灶、体能状态及器官功能符合对应队列要求`,
    eligibility: {
      keyInclusion: eligibility.keyInclusion,
      keyExclusion: eligibility.keyExclusion,
      stratificationFactors: ["若为随机研究，具体分层因素以完整研究方案/SAP为准；注册摘要未披露时不作推断"],
    },
    subgroupAnalyses: subgroups.length
      ? subgroups.map(([dimension, subgroup, n, endpoint, effect, ci, conclusion]) => ({
          dimension,
          subgroup,
          n,
          endpoint,
          effect,
          ci: ci ?? "未报告",
          interactionP: "未报告",
          conclusion: conclusion ?? "早期或探索性亚组；未报告交互检验时不能推断亚组间治疗效应差异",
        }))
      : [{
          dimension: "公开结果状态",
          subgroup: "预设队列/亚组",
          n: "尚未公开",
          endpoint: primary.join("；"),
          effect: "尚无可核验的公开亚组结果",
          ci: "未报告",
          interactionP: "未报告",
          conclusion: "研究尚未读出或结果未公开，不以计划入组特征替代实际亚组分析",
        }],
    enrollment: protocol.designModule?.enrollmentInfo?.count ?? "未报告",
    primaryEndpoint: primary.join("；"),
    secondaryEndpoints: secondary.slice(0, 12),
    startDate: protocol.statusModule?.startDateStruct?.date ?? "未报告",
    primaryCompletion: protocol.statusModule?.primaryCompletionDateStruct?.date ?? "未报告",
    countries: countries.length ? countries : ["注册库未列出"],
    sponsor,
    fda: isSonrotoclax
      ? {
          regulatoryId: "NDA 220711",
          designation: approvedTrial ? "突破性疗法、快速通道、孤儿药；加速批准" : "Sonrotoclax已获FDA批准用于特定R/R MCL人群；本研究适应症须单独判断",
          submissionStatus: approvedTrial ? "2026-05-13 FDA加速批准R/R MCL" : "该研究是否支持标签扩展尚待结果与监管审评",
          lastVerified: "2026-07-26",
        }
      : {
          regulatoryId: "尚无FDA批准编号",
          designation: /套细胞淋巴瘤/.test(indication) ? "中国NMPA突破性治疗品种（BTKi治疗后R/R MCL）" : "未见该研究对应FDA特殊资格公开披露",
          submissionStatus: "在研；尚未获FDA/NMPA上市批准",
          lastVerified: "2026-07-26",
        },
    result: readout?.result ?? "尚无可核验的公开临床结果；保留注册设计、入组人群和时间轴，待正式读出后更新。",
    source: "ClinicalTrials.gov官方注册记录；公司官方披露/监管文件仅在可对应到具体研究时补充。数据按NCT号去重。",
    dataCut: readout ? "最新公开披露截至2026-07-26" : "注册状态核对：2026-07-26",
    evidenceLevel: readout ? `${phase} · 官方披露/监管结果` : `${phase} · 注册设计（暂无公开结果）`,
    baselineCharacteristics: readout?.baseline
      ? readout.baseline.map(([label, value, context]) => ({ label, value, context }))
      : baselineFromResults(study.resultsSection),
    efficacyHighlights: readout
      ? readout.efficacy.map(([label, value, context]) => ({ label, value, context }))
      : [{ label: "疗效结果", value: "尚未公开" }],
    safetyHighlights: readout
      ? readout.safety.map(([label, value, context]) => ({ label, value, context }))
      : [{ label: "安全性结果", value: "尚未公开；仅列方案监测终点不等同于实际发生率" }],
    pkHighlights: aliases.length
      ? [{ label: "其他登记/方案号", value: aliases.slice(0, 5).join("；") }]
      : undefined,
    sources: [
      { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/study/${nct}` },
      ...(readout ? [{ label: "对应公开结果", url: readout.source }] : []),
    ],
    milestones: readout?.milestones?.map(([date, event]) => ({ date, event })),
    resultNotes: readout?.notes,
    studyCategory,
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
  arms: "ICP-248（Mesutoclax）联合奥布替尼，对比匹妥布替尼；最终方案以公开登记为准",
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
  studyCategory: "关键注册/读出",
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

"use client";

import { useMemo, useRef, useState } from "react";

type StrokeSystem = "kangxi" | "modern";
type ElementValue = "wood" | "fire" | "earth" | "metal" | "water";
type Rarity = "common" | "uncommon" | "rare";
type PositionForm = { strokeSystem: StrokeSystem; strokes: string; element: ElementValue | ""; excludedChars?: string };
type FormState = {
  surname: string;
  givenNameLength: 1 | 2 | 3;
  positions: PositionForm[];
  totalStrokes: string;
  hardExcludedChars: string;
  rarity: Rarity | "";
  styles: string[];
  avoidNegativeHomophones: boolean;
  avoidDifficultCharacters: boolean;
  fixedCharacters: Array<string | null>;
  poolOffsets: number[];
  resultOffset: number;
};

type CharacterFact = {
  char: string;
  meaning?: string;
  tags: string[];
  rarityBand?: Rarity;
  strokes: Partial<Record<StrokeSystem, number>>;
};

type RankedResult = {
  name: string;
  score: number;
  totalStrokes?: number;
  scoreBreakdown: Record<string, number>;
  characters: CharacterFact[];
};

type ResponseShape = {
  datasetVersion: string;
  results: RankedResult[];
  counts: { inputCharacters: number; positionCandidates: number[]; hardConstraintMatches: number; combinations: number };
  pendingCombinations: number;
  nextCursor: string | null;
  pools: Array<{ position: number; total: number; nextOffset: number | null; items: Array<{ character: CharacterFact; matchingCombinations: number; pendingCombinations: number; missing: string[]; score?: number; bestName?: string }> }>;
  pendingPools: Array<{ position: number; total: number; nextOffset: number | null; items: Array<{ character: CharacterFact; matchingCombinations: number; pendingCombinations: number; missing: string[]; score?: number; bestName?: string }> }>;
  cached?: boolean;
};

const styles = [
  { value: "modern", label: "現代" },
  { value: "gentle", label: "溫柔" },
  { value: "classic", label: "典雅" },
  { value: "neutral", label: "中性" },
];

const elements: Array<{ value: ElementValue; label: string }> = [
  { value: "wood", label: "木" }, { value: "fire", label: "火" },
  { value: "earth", label: "土" }, { value: "metal", label: "金" },
  { value: "water", label: "水" },
];

const rarityLabels: Record<Rarity, string> = {
  common: "常見好讀", uncommon: "少見有辨識度", rare: "罕見獨特",
};

const breakdownLabels: Record<string, string> = {
  rarity: "稀有度", style: "風格契合", easeOfInput: "易讀易寫",
  softExclusions: "避用字", negativeHomophones: "諧音檢查", repetition: "字形變化",
};

const emptyPosition = (): PositionForm => ({ strokeSystem: "kangxi", strokes: "", element: "", excludedChars: "" });
const initialForm: FormState = {
  surname: "陳", givenNameLength: 2, positions: [emptyPosition(), emptyPosition()],
  totalStrokes: "", hardExcludedChars: "", rarity: "uncommon",
  styles: ["modern", "gentle"], avoidNegativeHomophones: true, avoidDifficultCharacters: true,
  fixedCharacters: [null, null],
  poolOffsets: [0, 0],
  resultOffset: 0,
};

function parseNumbers(value: string): number[] | undefined {
  const values = value.split(/[,，、\s]+/).map(Number).filter((value) => Number.isInteger(value) && value > 0);
  return values.length ? [...new Set(values)] : undefined;
}

function parseCharacters(value: string): string[] {
  return [...new Set([...value].filter((char) => /\p{Script=Han}/u.test(char)))];
}

function buildConstraints(form: FormState) {
  const total = parseNumbers(form.totalStrokes);
  return {
    schemaVersion: 1 as const,
    surname: form.surname.trim(),
    givenNameLength: form.givenNameLength,
    positions: form.positions.map((position) => {
      const strokeValues = parseNumbers(position.strokes);
      const excludedChars = parseCharacters(position.excludedChars || "");
      return {
        strokeSystem: position.strokeSystem,
        ...(strokeValues ? { strokes: { values: strokeValues } } : {}),
        ...(position.element ? { element: { school: "radical" as const, values: [position.element] } } : {}),
        ...(excludedChars.length > 0 ? { excludedChars } : {}),
      };
    }),
    ...(total ? { totalStrokes: { values: total } } : {}),
    hardExcludedChars: parseCharacters(form.hardExcludedChars),
    preferences: {
      ...(form.rarity ? { rarity: form.rarity } : {}),
      styles: form.styles,
      avoidNegativeHomophones: form.avoidNegativeHomophones,
      avoidDifficultCharacters: form.avoidDifficultCharacters,
    },
  };
}

function Icon({ name, size = 20 }: { name: "arrow" | "check" | "code" | "edit" | "info" | "reset" | "search"; size?: number }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    code: <><path d="m8 9-3 3 3 3" /><path d="m16 9 3 3-3 3" /><path d="m14 5-4 14" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
    reset: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  };
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="form-section-heading"><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></div>;
}

function PositionEditor({ index, value, onChange }: { index: number; value: PositionForm; onChange: (value: PositionForm) => void }) {
  return <fieldset className="position-card">
    <legend><span className="position-index">{String(index + 1).padStart(2, "0")}</span>名字第 {index + 1} 字</legend>
    <div className="field-grid">
      <div className="field"><label htmlFor={`stroke-system-${index}`}>筆畫系統</label><select id={`stroke-system-${index}`} value={value.strokeSystem} onChange={(event) => onChange({ ...value, strokeSystem: event.target.value as StrokeSystem })}><option value="kangxi">康熙筆畫</option><option value="modern">現代筆畫</option></select></div>
      <div className="field"><label htmlFor={`strokes-${index}`}>指定筆畫 <span>選填</span></label><input id={`strokes-${index}`} value={value.strokes} onChange={(event) => onChange({ ...value, strokes: event.target.value })} inputMode="numeric" placeholder="例如 8、10" aria-describedby={`strokes-help-${index}`} /><small id={`strokes-help-${index}`}>可用逗號輸入多個數字</small></div>
    </div>
    <div className="field element-field">
      <span className="field-label" id={`element-label-${index}`}>五行部首 <span>選填</span></span>
      <div className="choice-row" role="group" aria-labelledby={`element-label-${index}`}>
        <button type="button" className={!value.element ? "choice-chip active" : "choice-chip"} aria-pressed={!value.element} onClick={() => onChange({ ...value, element: "" })}>不限</button>
        {elements.map((option) => <button type="button" key={option.value} className={value.element === option.value ? "choice-chip active" : "choice-chip"} aria-pressed={value.element === option.value} onClick={() => onChange({ ...value, element: option.value })}>{option.label}</button>)}
      </div>
    </div>
    <div className="field">
      <label htmlFor={`excluded-${index}`}>單字避用 <span>選填</span></label>
      <input id={`excluded-${index}`} value={value.excludedChars || ""} onChange={(event) => onChange({ ...value, excludedChars: event.target.value })} placeholder="例如：文、明" aria-describedby={`excluded-help-${index}`} />
      <small id={`excluded-help-${index}`}>防字輩，避免這些字出現在第 {index + 1} 字</small>
    </div>
  </fieldset>;
}

function Toggle({ id, checked, label, description, onChange }: { id: string; checked: boolean; label: string; description: string; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row" htmlFor={id}><span><strong>{label}</strong><small>{description}</small></span><span className="toggle-control"><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden="true"><span /></span></span></label>;
}

function Results({ data, fixedCharacters, onFix, onMore, onMoreResults }: { data: ResponseShape; fixedCharacters: Array<string | null>; onFix: (position: number, character: string | null) => void; onMore: (position: number, offset: number) => void; onMoreResults: (offset: number) => void }) {
  return <section className="results-section" id="results" aria-labelledby="results-title">
    <div className="results-heading"><div><p className="section-kicker">03 · 推薦結果</p><h2 id="results-title">為你找到 {data.results.length} 組名字</h2><p>從 {data.counts.combinations.toLocaleString("zh-TW")} 種組合中，篩出 {data.counts.hardConstraintMatches.toLocaleString("zh-TW")} 組符合硬性條件的結果。</p></div><div className="dataset-note"><span className="status-dot" />{data.datasetVersion}{data.cached ? " · 快取結果" : " · 即時計算"}</div></div>
    <div className="exploration-pools"><div className="pool-heading"><div><h3>先選你喜歡的字</h3><p>兩邊都可以先選；固定後，另一邊會只列出能搭配的字。偏好只影響排序。</p></div>{data.pendingCombinations > 0 && <span className="pending-note">另有 {data.pendingCombinations.toLocaleString("zh-TW")} 組待確認資料</span>}</div>{data.pools.map((pool) => <div className="character-pool" key={pool.position}><div className="pool-title"><strong>名字第 {pool.position + 1} 字</strong><span>{fixedCharacters[pool.position] ? `已固定「${fixedCharacters[pool.position]}」` : `可選 ${pool.total.toLocaleString("zh-TW")} 字`}</span></div><div className="pool-chips">{pool.items.map((item) => { const active = fixedCharacters[pool.position] === item.character.char; return <button type="button" aria-label={active ? `解除固定${item.character.char}` : `固定${item.character.char}`} className={active ? "pool-chip active" : "pool-chip"} key={item.character.char} onClick={() => onFix(pool.position, active ? null : item.character.char)}><strong>{item.character.char}</strong><span>{active ? "解除固定" : item.bestName ? `例：${item.bestName}` : item.missing.length ? "待確認" : `${item.matchingCombinations.toLocaleString("zh-TW")} 組`}</span></button>; })}</div>{pool.nextOffset !== null && <button type="button" className="pool-more" onClick={() => onMore(pool.position, pool.nextOffset!)}>載入更多候選（下一頁）</button>}</div>)}</div>
    {data.pendingPools.some((pool) => pool.total > 0) && <div className="pending-pools"><strong>待確認字池</strong><p>這些字缺少目前條件所需的康熙筆畫或五行資料，因此不會冒充已符合結果。</p>{data.pendingPools.map((pool) => pool.total > 0 && <div className="pending-row" key={pool.position}>第 {pool.position + 1} 字：{pool.items.map((item) => item.character.char).join("、")}{pool.nextOffset !== null && " …"}</div>)}</div>}
    {data.results.length === 0 ? <div className="empty-state"><div className="empty-mark"><Icon name="search" size={28} /></div><h3>目前沒有完全符合的名字</h3><p>已保留目前選定的字與必要條件；請調整條件或解除固定字。</p><a href="#solver">返回調整條件</a></div> :
      <ol className="result-grid">{data.results.map((item, index) => {
        const breakdown = Object.entries(item.scoreBreakdown).filter(([key, value]) => key !== "total" && value !== 0);
        return <li className={index === 0 ? "result-card featured" : "result-card"} key={`${item.name}-${index}`}>
          <div className="result-topline"><span className="rank">{String(index + 1).padStart(2, "0")}</span>{index === 0 && <span className="recommend-badge"><Icon name="check" size={15} /> 首選推薦</span>}<span className="score">契合分數 <strong>{item.score}</strong></span></div>
          <h3>{item.name}</h3>
          <div className="character-facts">{item.characters.map((character, charIndex) => <div key={`${character.char}-${charIndex}`}><strong>{character.char}</strong><span>{character.meaning || "字義資料整理中"}</span></div>)}</div>
          <div className="result-meta">{item.totalStrokes !== undefined && <span>{item.totalStrokes} 畫</span>}{item.characters[0]?.rarityBand && <span>{rarityLabels[item.characters[0].rarityBand]}</span>}{breakdown.slice(0, 2).map(([key, value]) => <span key={key}>{breakdownLabels[key] ?? key} {value > 0 ? `+${value}` : value}</span>)}</div>
        </li>;
      })}</ol>}{data.nextCursor !== null && <button type="button" className="pool-more result-more" onClick={() => onMoreResults(Number(data.nextCursor))}>載入更多完整組合</button>}
    <p className="result-disclaimer"><Icon name="info" size={17} /> 資料池涵蓋 CNS 標準 Unicode 漢字；缺少康熙筆畫或五行資料的字會標示待確認，不會被冒充為已確認結果。</p>
  </section>;
}

export default function HomePage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [mode, setMode] = useState<"guided" | "json">("guided");
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(buildConstraints(initialForm), null, 2));
  const [result, setResult] = useState<ResponseShape>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => {
    const chosenElements = form.positions.map((position) => position.element && elements.find((item) => item.value === position.element)?.label).filter(Boolean);
    return {
      fullName: `${form.surname || "姓"}${"○".repeat(form.givenNameLength)}`,
      elements: chosenElements.length ? chosenElements.join("、") : "不限制",
      strokes: form.positions.some((position) => position.strokes) ? form.positions.map((position) => position.strokes || "不限").join(" / ") : "不限制",
      styles: form.styles.length ? styles.filter((item) => form.styles.includes(item.value)).map((item) => item.label).join("、") : "不限制",
    };
  }, [form]);

  function updateLength(length: 1 | 2 | 3) {
    setForm((current) => ({ ...current, givenNameLength: length, positions: Array.from({ length }, (_, index) => current.positions[index] ?? emptyPosition()), fixedCharacters: Array.from({ length }, (_, index) => current.fixedCharacters[index] ?? null), poolOffsets: Array.from({ length }, (_, index) => current.poolOffsets[index] ?? 0), resultOffset: 0 }));
  }
  function updatePosition(index: number, position: PositionForm) {
    setForm((current) => ({ ...current, positions: current.positions.map((item, itemIndex) => itemIndex === index ? position : item) }));
  }
  function toggleStyle(value: string) {
    setForm((current) => ({ ...current, styles: current.styles.includes(value) ? current.styles.filter((item) => item !== value) : [...current.styles, value] }));
  }
  function switchMode(next: "guided" | "json") {
    if (next === "json") setJsonInput(JSON.stringify(buildConstraints(form), null, 2));
    setMode(next); setError(undefined);
  }
  function reset() {
    setForm(initialForm); setJsonInput(JSON.stringify(buildConstraints(initialForm), null, 2)); setResult(undefined); setError(undefined);
  }

  async function submit(nextForm: FormState = form, appendPosition?: number, appendResults = false) {
    setError(undefined);
    if (mode === "guided" && !nextForm.surname.trim()) {
      setError("請先輸入姓氏，再產生名字推薦。"); document.getElementById("surname")?.focus(); return;
    }
    setLoading(true);
    try {
      const constraints = mode === "json" ? JSON.parse(jsonInput) : buildConstraints(nextForm);
      const response = await fetch("/api/v1/solve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ constraints, limit: 12, offset: nextForm.resultOffset, fixedCharacters: nextForm.fixedCharacters, poolLimit: 24, poolOffsets: nextForm.poolOffsets }) });
      const data = await response.json();
      if (!response.ok) {
        const issue = data.issues?.[0];
        throw new Error(issue ? `條件格式有誤：${issue.message}` : data.error === "rate_limited" ? "操作太頻繁，請稍後再試。" : "目前無法完成計算，請檢查條件後重試。");
      }
      const typedData = data as ResponseShape;
      setResult((current) => {
        if (!current) return typedData;
        const next = { ...typedData };
        if (appendPosition !== undefined) next.pools = typedData.pools.map((pool) => pool.position === appendPosition ? { ...pool, items: [...(current.pools.find((value) => value.position === pool.position)?.items ?? []), ...pool.items] } : pool);
        if (appendResults) next.results = [...current.results, ...typedData.results];
        return next;
      }); window.setTimeout(() => resultsRef.current?.focus(), 50);
    } catch (reason) {
      setError(reason instanceof SyntaxError ? "JSON 格式不正確，請檢查括號與逗號。" : reason instanceof Error ? reason.message : "發生未預期的錯誤，請再試一次。");
    } finally { setLoading(false); }
  }

  function fixCharacter(position: number, character: string | null) {
    const next = { ...form, fixedCharacters: form.fixedCharacters.map((value, index) => index === position ? character : value), poolOffsets: form.poolOffsets.map(() => 0), resultOffset: 0 };
    setForm(next);
    void submit(next);
  }

  function loadMore(position: number, offset: number) {
    const next = { ...form, poolOffsets: form.poolOffsets.map((value, index) => index === position ? offset : value) };
    setForm(next);
    void submit(next, position);
  }

  function loadMoreResults(offset: number) {
    const next = { ...form, resultOffset: offset };
    setForm(next);
    void submit(next, undefined, true);
  }

  return <>
    <header className="site-header"><a className="brand" href="#top" aria-label="NameSolver 首頁"><span className="brand-mark" aria-hidden="true">名</span><span><strong>NameSolver</strong><small>名字條件探索器</small></span></a><nav aria-label="頁面導覽"><a href="#how-it-works">使用方式</a><a href="#solver">開始探索</a></nav></header>
    <main id="top">
      <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span /> 為台灣繁中姓名設計</p><h1 id="hero-title"><span className="hero-title-line">把心中的期待，</span><em className="hero-title-line">整理成一個好名字。</em></h1><p className="hero-description">從筆畫、五行到<span className="no-break">名字氣質</span>，把<span className="no-break">複雜條件</span>化成<span className="no-break">清楚的選擇</span>。每一個推薦都能<span className="no-break">回溯規則</span>，<span className="no-break">讓你安心比較</span>、<span className="no-break">慢慢決定</span>。</p><a className="hero-cta" href="#solver">開始探索名字 <Icon name="arrow" /></a></div><div className="hero-note" aria-label="產品特色"><span className="note-number">01</span><p>規則透明<br />結果可追溯</p><div className="seal" aria-hidden="true"><span>名</span><small>有所本</small></div></div></section>
      <section className="principles" id="how-it-works" aria-label="使用方式"><article><span>01</span><div><h2>先定必要條件</h2><p>輸入姓氏、名字長度，再依需要指定筆畫與五行。</p></div></article><article><span>02</span><div><h2>補上風格偏好</h2><p>選擇氣質與稀有度，偏好只影響排序，不排除可能性。</p></div></article><article><span>03</span><div><h2>比較推薦依據</h2><p>逐一查看字義、筆畫與得分來源，找到值得留下的名字。</p></div></article></section>
      <section className="solver-shell" id="solver" aria-labelledby="solver-title">
        <div className="solver-header"><div><p className="section-kicker">名字探索工作台</p><h2 id="solver-title">建立你的取名條件</h2></div><button type="button" className="reset-button" onClick={reset}><Icon name="reset" size={18} /> 重設範例</button></div>

        <div className="mode-tabs" role="tablist" aria-label="輸入模式"><button type="button" role="tab" aria-selected={mode === "guided"} className={mode === "guided" ? "active" : ""} onClick={() => switchMode("guided")}><Icon name="edit" size={18} /> 引導設定</button><button type="button" role="tab" aria-selected={mode === "json"} className={mode === "json" ? "active" : ""} onClick={() => switchMode("json")}><Icon name="code" size={18} /> JSON 進階模式</button></div>
        <div className="workspace-layout"><div className="form-column">
          {mode === "guided" ? <>
            <section className="form-section" aria-label="基本結構"><SectionHeading number="01" title="基本結構" description="先從姓氏與名字長度開始。" /><div className="field-grid basic-grid"><div className="field"><label htmlFor="surname">姓氏 <b aria-label="必填">*</b></label><input id="surname" value={form.surname} maxLength={8} autoComplete="family-name" onChange={(event) => setForm({ ...form, surname: event.target.value })} placeholder="例如：陳" /></div><div className="field"><span className="field-label" id="length-label">名字長度</span><div className="segmented" role="group" aria-labelledby="length-label">{([1, 2, 3] as const).map((length) => <button type="button" key={length} aria-pressed={form.givenNameLength === length} className={form.givenNameLength === length ? "active" : ""} onClick={() => updateLength(length)}>{length} 字</button>)}</div></div></div></section>
            <section className="form-section" aria-label="每字條件"><SectionHeading number="02" title="每字條件" description="不確定時維持「不限」即可。" /><div className="positions-stack">{form.positions.map((position, index) => <PositionEditor key={index} index={index} value={position} onChange={(value) => updatePosition(index, value)} />)}</div><details className="advanced-options"><summary>更多硬性條件 <span>總筆畫、全局避用字</span></summary><div className="field-grid"><div className="field"><label htmlFor="total-strokes">名字總筆畫 <span>選填</span></label><input id="total-strokes" inputMode="numeric" value={form.totalStrokes} onChange={(event) => setForm({ ...form, totalStrokes: event.target.value })} placeholder="例如 14、18" /><small>僅計算名字，不含姓氏</small></div><div className="field"><label htmlFor="excluded-chars">全局避用的字 <span>選填</span></label><input id="excluded-chars" value={form.hardExcludedChars} onChange={(event) => setForm({ ...form, hardExcludedChars: event.target.value })} placeholder="例如：豪、強" /><small>所有位置皆避開，可直接連續輸入多個中文字</small></div></div></details></section>
            <section className="form-section" aria-label="排序偏好"><SectionHeading number="03" title="排序偏好" description="偏好只調整推薦順序，不會改變硬性條件。" /><div className="field"><span className="field-label" id="style-label">名字氣質</span><div className="choice-row style-choices" role="group" aria-labelledby="style-label">{styles.map((option) => <button type="button" key={option.value} aria-pressed={form.styles.includes(option.value)} className={form.styles.includes(option.value) ? "choice-chip active" : "choice-chip"} onClick={() => toggleStyle(option.value)}>{form.styles.includes(option.value) && <Icon name="check" size={15} />}{option.label}</button>)}</div></div><div className="field rarity-field"><label htmlFor="rarity">常見程度</label><select id="rarity" value={form.rarity} onChange={(event) => setForm({ ...form, rarity: event.target.value as Rarity | "" })}><option value="">不限制</option><option value="common">常見好讀</option><option value="uncommon">少見有辨識度</option><option value="rare">罕見獨特</option></select></div><div className="toggle-list"><Toggle id="avoid-homophones" checked={form.avoidNegativeHomophones} onChange={(checked) => setForm({ ...form, avoidNegativeHomophones: checked })} label="避開負面諧音" description="降低容易產生不雅聯想的讀音排序" /><Toggle id="avoid-difficult" checked={form.avoidDifficultCharacters} onChange={(checked) => setForm({ ...form, avoidDifficultCharacters: checked })} label="優先容易輸入的字" description="偏好常用輸入法較容易找到的字" /></div></section>
          </> : <section className="json-section" aria-label="JSON 條件"><SectionHeading number="{}" title="constraints.v1" description="直接編輯完整條件，送出前會進行格式驗證。" /><label className="sr-only" htmlFor="json-input">JSON 條件</label><textarea id="json-input" value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} spellCheck={false} /><p className="inline-note"><Icon name="info" size={17} /> 進階模式的變更只套用於本次計算，不會覆蓋引導設定。</p></section>}
          {error && <div className="error-message" role="alert"><Icon name="info" size={19} /><span><strong>還差一點</strong>{error}</span></div>}
          <button type="button" className="submit-button" onClick={() => void submit()} disabled={loading}>{loading ? <><span className="spinner" /> 正在整理候選名字…</> : <>產生名字推薦 <Icon name="arrow" /></>}</button><p className="submit-help">通常在一秒內完成 · 不會儲存個人姓名資料</p>
        </div><aside className="summary-card" aria-label="條件摘要"><div className="summary-label"><span>條件預覽</span><small>即時更新</small></div><div className="name-preview" aria-label={`姓名結構：${summary.fullName}`}>{summary.fullName}</div><dl><div><dt>名字長度</dt><dd>{form.givenNameLength} 字</dd></div><div><dt>指定筆畫</dt><dd>{summary.strokes}</dd></div><div><dt>五行部首</dt><dd>{summary.elements}</dd></div><div><dt>風格偏好</dt><dd>{summary.styles}</dd></div></dl><div className="summary-foot"><Icon name="info" size={17} /><p>條件越多，結果越聚焦；若沒有想法，保持不限也能開始。</p></div></aside></div>
      </section>
      <div ref={resultsRef} tabIndex={-1} className="results-focus">{loading && <section className="loading-results" aria-live="polite" aria-label="正在產生推薦"><div className="skeleton skeleton-title" /><div className="skeleton-grid"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div></section>}{!loading && result && <Results data={result} fixedCharacters={form.fixedCharacters} onFix={fixCharacter} onMore={loadMore} onMoreResults={loadMoreResults} />}</div>
    </main>
    <footer><div className="footer-brand"><span className="brand-mark" aria-hidden="true">名</span><p><strong>NameSolver</strong><br />確定性、可追溯的名字條件探索工具</p></div><p>資料版本 CNS11643 20260805 · 僅供名字靈感探索</p></footer>
  </>;
}

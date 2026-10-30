import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8787;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a precise, polished, conversational business strategy assistant.

PERSONALITY
- Sound calm, perceptive, confident, helpful, and natural.
- Be concise by default. Ask one high-value question at a time.
- Avoid exaggerated claims, unnecessary jargon, and repetitive explanations.
- Never invent facts, statistics, citations, or details about the user.

BUSINESS DISCOVERY
- Understand the business idea and customer problem.
- Identify geography and plausible customer segments.
- Understand revenue model, pricing, budget, founder capabilities, and constraints.
- Compare segments only when enough context is available.
- Recommend a primary segment with reasoning, trade-offs, assumptions, and a validation experiment.
- If essential information is missing, ask one focused question instead of pretending to know it.

SEGMENT ATTRACTIVENESS MATRIX
Score each factor from 1 to 10:
1. SIZE: Potential customer base and demand.
2. GROWTH: Expected growth of the segment.
3. VALUE: Willingness to pay, margins, repeat purchase, and revenue potential.
4. COMPETITION: Ease of winning; higher scores mean less intense competition or a credible advantage.
5. ACCESSIBILITY: Ability to reach, acquire, and serve customers.
6. STRATEGIC FIT: Fit with founder goals, skills, budget, resources, and capabilities.

When appropriate, use a table with columns: Segment | Size | Growth | Value | Competition | Accessibility | Strategic Fit | Total / 60 | Rationale. Calculate the total correctly as the sum of six scores. Label unsupported scores as provisional judgments. Distinguish facts, assumptions, and estimates; never fabricate market data.

REPORT MODE
When the user requests a report, export, or PDF, produce a decision-ready business document rather than a generic essay. Use Markdown headings (##) and real Markdown tables with a header row and separator row. Never emit HTML tags such as <br>.

Use these sections where relevant:
1. Executive decision summary: recommendation, rationale, confidence level, and the next decision.
2. Business brief: separate user-confirmed inputs from unknowns.
3. Customer and problem: ideal customer profile, job-to-be-done, buying trigger, and alternatives.
4. Segment attractiveness matrix: Segment | Size | Growth | Value | Competition | Accessibility | Strategic Fit | Total / 60 | Rationale. Put only a numeric score (1-10) in each of the six score cells; put the explanation in Rationale. Calculate totals exactly.
5. Recommendation: primary and secondary segment, trade-offs, and what would change the recommendation.
6. Go-to-market: positioning, offer, channels, sales motion, and price-testing approach suited to the known context.
7. Economics and feasibility: calculate only from inputs supplied by the user. If inputs are missing, provide the formulas and list the required inputs; do not invent revenue, costs, capex, market size, growth rates, wages, or customer-spend figures.
8. Validation plan: prioritized experiments, hypothesis, method, metric, decision rule, time, and cost category. Any numeric decision threshold must be labelled as a proposed test threshold, not an industry benchmark.
9. Risks and mitigation: use a Markdown table.
10. 30/60/90-day action plan: action, owner/role, output, KPI, and dependency.
11. Evidence, assumptions, and open questions: identify what came from the user, what is an explicitly labelled hypothesis, and what still needs verification.

Accuracy rules: Never fabricate facts, Double check before finalizing, market statistics, sources, or the founder's budget/resources. Do not say figures come from public or industry reports unless a specific source was supplied in the conversation. If evidence is absent, write “Not provided - validate before investing” or label an estimate “illustrative planning assumption, not verified.” Use provisional scores where evidence is thin. Make the report specific to the actual business, reduce generic filler, and make every recommendation actionable. The server exports the response as a formatted PDF.
`;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(GROQ_API_KEY),
    provider: "Groq",
    model: GROQ_MODEL,
    elevenLabsConfigured: Boolean(ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID),
    pdfExportConfigured: true,
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Send a non-empty messages array." });
    }
    if (!GROQ_API_KEY) {
      return res.status(503).json({ error: "Groq is not configured. Add GROQ_API_KEY to the project root .env file and restart the server." });
    }

    const safeMessages = messages.slice(-24).map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content ?? "").slice(0, 8000),
    })).filter((message) => message.content.trim().length > 0);

    if (!safeMessages.length) {
      return res.status(400).json({ error: "No usable message text was provided." });
    }

    const latestUserText = safeMessages.filter((message) => message.role === "user").at(-1)?.content || "";
    const reportMode = /\b(pdf|report|export|download)\b/i.test(latestUserText);
    const reportInstructions = `

REPORT OUTPUT REQUIREMENTS (follow strictly):
- Produce a polished, specific, decision-ready business report with concise but substantive analysis.
- Use Markdown headings (##) and valid Markdown tables with a header row and a separator row. Never use HTML tags.
- Start with Executive Summary and a clear recommendation/confidence level; finish with prioritized next steps.
- If the report is about customer segments, include a six-factor 1-10 attractiveness matrix. In the six score columns put numeric scores only; explain each score in Rationale; total must equal the six scores.
- Separate user-confirmed facts, assumptions/hypotheses, and unknowns. Never invent market-size numbers, growth rates, customer spending, capital budgets, staffing, lease costs, citations, or sources.
- If figures are not provided or verified, say “Not provided - validate before investing.” Do not describe unsupported figures as being from public or industry reports.
- Include a practical validation plan with experiments, metrics, decision rules and proposed timing. Label any numeric thresholds as proposed test thresholds, not industry benchmarks.
- Include key risks and mitigations, and a 30/60/90-day action plan where appropriate.
- Use only information in the conversation unless the user explicitly asks for research. The source basis and evidence gaps must be stated.
`;
    if (reportMode && safeMessages.length) {
      safeMessages[safeMessages.length - 1].content += reportInstructions;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
        temperature: 0.35,
        max_completion_tokens: reportMode ? 3500 : 1600,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = data?.error?.message || `Groq returned HTTP ${response.status}.`;
      console.error("Groq API error:", response.status, providerMessage);
      return res.status(response.status === 429 ? 429 : 502).json({ error: providerMessage });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "Groq returned an empty response. Try again." });
    }
    return res.json({ reply: reply.trim() });
  } catch (error) {
    console.error("Groq server error:", error?.message || error);
    return res.status(500).json({ error: "J.A.R.V.I.S. could not contact Groq. Check the server terminal." });
  }
});

function asciiSafe(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?\s*>/gi, " / ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, " ");
}

function pdfEscape(value) {
  return asciiSafe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function cleanInlineMarkdown(value) {
  return asciiSafe(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTableRow(line) {
  let value = String(line ?? "").trim();
  if (!value.includes("|")) return null;
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  const cells = value.split("|").map(cleanInlineMarkdown);
  return cells.length >= 2 ? cells : null;
}

function isTableSeparator(line) {
  const value = String(line ?? "").trim();
  return value.includes("|") && /^[\s|:\-]+$/.test(value) && value.includes("-");
}

function isHeading(line) {
  return /^#{1,6}\s+/.test(line) || /^\*\*[^*]{2,100}\*\*$/.test(line) || /^\d{1,2}[.)]\s+[A-Z][A-Z0-9 /&()\-:]{3,}$/.test(line);
}

function parseReportBlocks(content) {
  const lines = String(content ?? "")
    .slice(0, 50000)
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i].trim();
    if (!raw || /^```/.test(raw) || /^\|?\s*:?-{2,}/.test(raw) && raw.includes("|")) {
      i += 1;
      continue;
    }

    if (/^#{1,6}\s+/.test(raw) || /^\*\*[^*]{2,100}\*\*$/.test(raw) || /^\d{1,2}[.)]\s+[A-Z][A-Z0-9 /&()\-:]{3,}$/.test(raw)) {
      const heading = cleanInlineMarkdown(raw.replace(/^#{1,6}\s+/, "").replace(/^\*\*|\*\*$/g, ""));
      blocks.push({ type: "heading", text: heading });
      i += 1;
      continue;
    }

    const firstCells = splitTableRow(raw);
    const nextIsSeparator = i + 1 < lines.length && isTableSeparator(lines[i + 1]);
    if (firstCells && (nextIsSeparator || (i + 1 < lines.length && splitTableRow(lines[i + 1])))) {
      const tableRows = [];
      while (i < lines.length) {
        const tableLine = lines[i].trim();
        if (isTableSeparator(tableLine)) {
          i += 1;
          continue;
        }
        const cells = splitTableRow(tableLine);
        if (!cells) break;
        tableRows.push(cells);
        i += 1;
      }
      if (tableRows.length) {
        const width = Math.max(...tableRows.map((row) => row.length));
        const normalizedRows = tableRows.map((row) => {
          const padded = [...row];
          while (padded.length < width) padded.push("");
          return padded.slice(0, width);
        });
        blocks.push({ type: "table", headers: normalizedRows[0], rows: normalizedRows.slice(1) });
      }
      continue;
    }

    if (/^(?:[-*+]\s+|\d+[.)]\s+)/.test(raw) || /^•\s+/.test(raw)) {
      const items = [];
      while (i < lines.length) {
        const value = lines[i].trim();
        const match = value.match(/^(?:[-*+]\s+|\d+[.)]\s+|•\s+)(.*)$/);
        if (!match) break;
        items.push(cleanInlineMarkdown(match[1]));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph = [cleanInlineMarkdown(raw)];
    i += 1;
    while (i < lines.length) {
      const value = lines[i].trim();
      if (!value || /^```/.test(value) || isHeading(value) || /^(?:[-*+]\s+|\d+[.)]\s+|•\s+)/.test(value)) break;
      if (splitTableRow(value) && (isTableSeparator(lines[i + 1] || "") || splitTableRow(lines[i + 1] || ""))) break;
      paragraph.push(cleanInlineMarkdown(value));
      i += 1;
    }
    const text = paragraph.filter(Boolean).join(" ").trim();
    if (text) blocks.push({ type: "paragraph", text });
  }
  return blocks;
}

function buildReportPdf(title, content) {
  const reportTitle = cleanInlineMarkdown(title || "Business Strategy Report").slice(0, 140);
  const blocks = parseReportBlocks(content);
  const pages = [];
  const pageWidth = 595;
  const pageHeight = 842;
  const left = 52;
  const right = 543;
  const contentWidth = right - left;
  const bottomLimit = 62;
  const gold = [0.72, 0.43, 0.10];
  const dark = [0.12, 0.14, 0.16];
  const body = [0.19, 0.21, 0.23];
  const muted = [0.38, 0.40, 0.42];
  const border = [0.82, 0.82, 0.79];
  const pale = [0.97, 0.96, 0.93];
  const white = [1, 1, 1];
  let page;

  const color = (rgb) => rgb.map((v) => Number(v).toFixed(3)).join(" ");
  const commandRect = (x, y, w, h, fill) => {
    page.commands.push(`q ${color(fill)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
  };
  const commandLine = (x1, y1, x2, y2, stroke = border, width = 0.55) => {
    page.commands.push(`q ${color(stroke)} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  };
  const commandText = (value, x, y, size = 9, bold = false, fill = body) => {
    const clean = pdfEscape(value);
    page.commands.push(`${color(fill)} rg BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${clean}) Tj ET`);
  };
  const wrapText = (value, maxWidth, size) => {
    const words = asciiSafe(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    const estimateWidth = (s) => [...s].reduce((sum, ch) => sum + (/[il.,'!|:;]/.test(ch) ? 0.27 : /[MW@%]/.test(ch) ? 0.88 : /[A-Z]/.test(ch) ? 0.62 : 0.51) * size, 0);
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (estimateWidth(`${current} ${word}`) <= maxWidth) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
      while (estimateWidth(current) > maxWidth && current.length > 1) {
        let cut = Math.max(1, Math.floor(current.length * maxWidth / estimateWidth(current)));
        while (cut > 1 && estimateWidth(current.slice(0, cut)) > maxWidth) cut -= 1;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const createPage = (first = false) => {
    page = { commands: [], y: first ? 663 : 742, first };
    pages.push(page);
    commandRect(0, 0, pageWidth, pageHeight, white);
    commandText("J.A.R.V.I.S.  /  STRATEGY INTELLIGENCE", left, 810, 8.2, true, gold);
    commandText("CONFIDENTIAL WORKING DOCUMENT", 399, 810, 7.5, false, muted);
    commandLine(left, 796, right, 796, gold, 0.9);

    if (first) {
      const titleLines = wrapText(reportTitle, contentWidth, 21).slice(0, 2);
      let titleY = 756;
      for (const titleLine of titleLines) {
        commandText(titleLine, left, titleY, 21, true, dark);
        titleY -= 26;
      }
      const dateText = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
      commandText(`Prepared by J.A.R.V.I.S.  |  ${dateText}`, left, titleY - 3, 9, false, muted);
      commandLine(left, titleY - 17, right, titleY - 17, [0.87, 0.84, 0.77], 0.7);
      page.y = titleY - 38;
    } else {
      commandText(wrapText(reportTitle, 430, 10)[0], left, 774, 10, true, dark);
      page.y = 750;
    }
  };

  const nextPage = () => createPage(false);
  const ensureSpace = (height) => {
    if (page.y - height < bottomLimit) nextPage();
  };

  createPage(true);

  const drawParagraph = (value, options = {}) => {
    const size = options.size ?? 9.2;
    const lineHeight = options.lineHeight ?? 13.3;
    const x = options.x ?? left;
    const maxWidth = options.maxWidth ?? contentWidth;
    const fill = options.fill ?? body;
    const bold = options.bold ?? false;
    const lines = wrapText(value, maxWidth, size);
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      commandText(line, x, page.y, size, bold, fill);
      page.y -= lineHeight;
    }
    page.y -= options.after ?? 4;
  };

  const drawHeading = (value) => {
    ensureSpace(32);
    page.y -= 4;
    commandRect(left, page.y - 3, 3, 14, gold);
    const headingLines = wrapText(value, contentWidth - 15, 10.6);
    for (const [idx, line] of headingLines.entries()) {
      commandText(line, left + 11, page.y - idx * 13, 10.6, true, dark);
    }
    page.y -= headingLines.length * 13 + 7;
  };

  const chooseWidths = (headers) => {
    const count = headers.length;
    if (count === 9 && /segment/i.test(headers[0] || "") && headers.some((h) => /strategic fit/i.test(h)) && headers.some((h) => /rationale/i.test(h))) {
      return [75, 34, 34, 34, 49, 48, 50, 44, 123];
    }
    if (count === 2) return [Math.round(contentWidth * 0.29), contentWidth - Math.round(contentWidth * 0.29)];
    if (count === 4 && headers.some((h) => /likelihood/i.test(h)) && headers.some((h) => /mitigation/i.test(h))) {
      return [136, 63, 62, contentWidth - 261];
    }
    const weights = headers.map((header) => {
      const h = header.toLowerCase();
      if (/rationale|mitigation|detail|action|output|recommendation|evidence|next step|validation|description|why|notes|risk/i.test(h)) return 2.2;
      if (/segment|customer|category|owner|phase|timing/i.test(h)) return 1.45;
      if (/size|growth|value|competition|accessibility|strategic fit|total|score|likelihood|impact|kpi|cost/i.test(h)) return 0.82;
      return 1.1;
    });
    const min = Math.min(44, contentWidth / count);
    const remaining = contentWidth - min * count;
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => min + remaining * w / weightSum);
    widths[widths.length - 1] += contentWidth - widths.reduce((a, b) => a + b, 0);
    return widths;
  };

  const drawTable = (headers, dataRows) => {
    if (!headers?.length) return;
    const widths = chooseWidths(headers);
    const fontSize = headers.length >= 7 ? 6.7 : headers.length >= 5 ? 7.2 : 8.0;
    const leading = fontSize + 1.8;
    const padX = 4.4;
    const padY = 4.2;
    const wrapRow = (row) => row.map((cell, idx) => wrapText(cell, Math.max(18, widths[idx] - padX * 2), fontSize));
    const drawTableRow = (cells, isHeader, rowIndex) => {
      const cellLines = wrapRow(cells);
      const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length));
      const rowHeight = maxLines * leading + padY * 2;
      if (page.y - rowHeight < bottomLimit) {
        nextPage();
        if (!isHeader) drawTableRow(headers, true, 0);
      }
      const yTop = page.y + 3;
      const yBottom = yTop - rowHeight;
      commandRect(left, yBottom, contentWidth, rowHeight, isHeader ? dark : rowIndex % 2 === 0 ? pale : white);
      commandLine(left, yTop, right, yTop, border, 0.45);
      commandLine(left, yBottom, right, yBottom, border, 0.45);
      let x = left;
      for (let col = 0; col < cells.length; col++) {
        commandLine(x, yBottom, x, yTop, border, 0.4);
        const lines = cellLines[col] || [""];
        const textY = yTop - padY - fontSize;
        lines.forEach((line, lineIndex) => {
          commandText(line, x + padX, textY - lineIndex * leading, fontSize, isHeader, isHeader ? [0.96, 0.77, 0.43] : body);
        });
        x += widths[col];
      }
      commandLine(right, yBottom, right, yTop, border, 0.4);
      page.y = yBottom - 1.4;
    };

    drawTableRow(headers, true, 0);
    dataRows.forEach((row, rowIndex) => {
      const normalized = [...row];
      while (normalized.length < headers.length) normalized.push("");
      drawTableRow(normalized.slice(0, headers.length), false, rowIndex + 1);
    });
    page.y -= 10;
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      drawHeading(block.text);
    } else if (block.type === "paragraph") {
      drawParagraph(block.text);
    } else if (block.type === "list") {
      for (const item of block.items) {
        const lines = wrapText(item, contentWidth - 20, 9.0);
        for (const [index, line] of lines.entries()) {
          ensureSpace(13.2);
          if (index === 0) commandText("-", left + 4, page.y, 9.0, true, gold);
          commandText(line, left + 17, page.y, 9.0, false, body);
          page.y -= 13.2;
        }
        page.y -= 1.5;
      }
      page.y -= 3;
    } else if (block.type === "table") {
      drawTable(block.headers, block.rows);
    }
  }

  if (blocks.length === 0) {
    drawParagraph("No report content was provided.");
  }

  pages.forEach((entry, index) => {
    const originalPage = page;
    page = entry;
    commandLine(left, 44, right, 44, [0.75, 0.71, 0.63], 0.5);
    commandText("J.A.R.V.I.S.  |  Prepared from the conversation context supplied by the user", left, 29, 7.0, false, muted);
    commandText(`PAGE ${index + 1} OF ${pages.length}`, 489, 29, 7.0, true, gold);
    page = originalPage;
  });

  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  pages.forEach((pageEntry, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const stream = pageEntry.commands.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n%JARVIS\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

app.post("/api/report", (req, res) => {
  try {
    const { title, content } = req.body ?? {};
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Provide report content to export." });
    }
    const pdf = buildReportPdf(title, content);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="JARVIS-business-strategy-report.pdf"');
    res.setHeader("Content-Length", pdf.length);
    res.setHeader("Cache-Control", "no-store");
    return res.send(pdf);
  } catch (error) {
    console.error("PDF report error:", error?.message || error);
    return res.status(500).json({ error: "Could not generate the PDF report." });
  }
});

app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body ?? {};
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) return res.status(204).end();
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Provide text to synthesize." });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("ElevenLabs API error:", response.status, details.slice(0, 1000));
      return res.status(502).json({ error: `ElevenLabs returned HTTP ${response.status}. Check the API key, Voice ID, permissions, and account limits.` });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.length);
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio);
  } catch (error) {
    console.error("ElevenLabs TTS error:", error?.message || error);
    return res.status(500).json({ error: "Could not generate speech through ElevenLabs." });
  }
});

app.listen(PORT, () => {
  console.log(`J.A.R.V.I.S. server running at http://localhost:${PORT}`);
  console.log(`AI provider: Groq (${GROQ_MODEL})`);
  console.log(`Groq configured: ${Boolean(GROQ_API_KEY)}`);
  console.log(`ElevenLabs configured: ${Boolean(ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID)}`);
});

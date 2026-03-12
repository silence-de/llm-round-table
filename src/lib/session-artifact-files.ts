import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { ActionItem, DecisionSummary } from './decision/types';
import { classifyEvidenceStatus } from './decision/utils';
import type { ResearchEvaluation, ResearchSource } from './search/types';
import { findResearchSourceByCitation } from './search/utils';

const PDF_OUTPUT_DIR = path.join(process.cwd(), 'output', 'pdf');
const moduleRequire = createRequire(import.meta.url);
const PDF_FONTS = {
  body: 'RoundTableBody',
  bold: 'RoundTableBold',
};
const PDF_FONT_CANDIDATES = [
  process.env.ROUND_TABLE_PDF_CJK_FONT?.trim() || '',
  resolveModuleAssetPath('next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf'),
  path.join(process.cwd(), 'public', 'fonts', 'NotoSansSC-Regular.ttf'),
  path.join(
    process.cwd(),
    'node_modules',
    'next',
    'dist',
    'compiled',
    '@vercel',
    'og',
    'noto-sans-v27-latin-regular.ttf'
  ),
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/NISC18030.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
  '/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf',
  '/usr/share/fonts/truetype/noto/NotoSansSC-Regular.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
].filter(Boolean);
const PALETTE = {
  ink: '#16202A',
  muted: '#5A6874',
  accent: '#2F5E73',
  border: '#D8CCBF',
  panel: '#FFFDFC',
  panelAlt: '#F4EEE7',
  canvas: '#F7F2EB',
};

const PAGE = {
  margin: 48,
  headerHeight: 56,
  footerHeight: 28,
};

interface SessionArtifactDetailLike {
  session: {
    id: string;
    topic: string;
    decisionStatus: string;
    goal: string;
    constraints: string;
    timeHorizon: string;
    nonNegotiables: string;
    acceptableDownside: string;
    reviewAt?: string | null;
    outcomeSummary?: string;
    actualOutcome?: string;
    outcomeConfidence?: number;
    retrospectiveNote?: string;
  };
  decisionSummary: DecisionSummary | null;
  actionItems: ActionItem[];
  researchRun: {
    status?: string;
    evaluation: ResearchEvaluation | null;
    sources: ResearchSource[];
  } | null;
  unresolvedEvidence?: Array<{
    claim: string;
    sourceIds: string[];
    gapReason: string;
  }>;
  parentReviewComparison?: {
    topic: string;
    recommendedOption: string;
    predictedConfidence: number;
    outcomeSummary?: string;
    actualOutcome?: string;
    outcomeConfidence?: number;
    retrospectiveNote?: string;
  } | null;
}

interface FlowState {
  y: number;
  sectionTitle: string;
  generatedAt: string;
}

interface CardItem {
  label?: string;
  text: string;
  tone?: 'default' | 'muted' | 'warning' | 'accent';
}

export async function buildSessionArtifactFile(detail: SessionArtifactDetailLike) {
  if (!detail.decisionSummary) {
    throw new Error('decision summary required before exporting artifact files');
  }

  fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
  const filePath = path.join(
    PDF_OUTPUT_DIR,
    `${sanitizeFilename(`${detail.session.id}-decision-dossier`)}.pdf`
  );
  await writeDecisionPdf(detail, filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    contentType: 'application/pdf',
  };
}

async function writeDecisionPdf(detail: SessionArtifactDetailLike, outputPath: string) {
  await new Promise<void>((resolve, reject) => {
    const generatedAt = new Date().toISOString();
    const summary = detail.decisionSummary;
    if (!summary) {
      reject(new Error('decision summary required before exporting artifact files'));
      return;
    }
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE.margin,
      info: {
        Title: `${detail.session.topic} - Decision Dossier`,
        Author: 'Round Table',
        Subject: detail.session.topic,
        Keywords: 'decision dossier, round table, personal decision assistant',
      },
    });
    registerPdfFonts(doc);
    const stream = fs.createWriteStream(outputPath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.pipe(stream);

    renderCoverPage(doc, detail, summary, generatedAt);
    doc.addPage();

    let flow = startFlowPage(doc, 'Decision Frame', generatedAt);
    flow = renderSectionCard(doc, flow, 'Decision frame', [
      { label: 'Goal', text: detail.session.goal || 'No explicit goal captured.' },
      {
        label: 'Constraints',
        text: detail.session.constraints || 'No explicit constraints captured.',
      },
      {
        label: 'Personal guardrails',
        text: [
          detail.session.timeHorizon || 'Time horizon not set.',
          detail.session.nonNegotiables || 'No non-negotiables recorded.',
          detail.session.acceptableDownside || 'No downside floor recorded.',
          detail.session.reviewAt ? `Review at ${detail.session.reviewAt}` : 'No fixed review date.',
        ].join(' | '),
      },
    ]);

    flow = renderSectionCard(doc, flow, 'Recommendation logic', [
      ...summary.why.map((text) => ({ label: 'Why', text })),
      ...summary.alternativesRejected.map((text) => ({
        label: 'Alternative rejected',
        text,
        tone: 'muted' as const,
      })),
      ...summary.risks.map((text) => ({
        label: 'Risk',
        text,
        tone: 'warning' as const,
      })),
      ...summary.openQuestions.map((text) => ({
        label: 'Open question',
        text,
        tone: 'accent' as const,
      })),
    ]);

    flow = renderSectionCard(doc, flow, 'Evidence and trust', buildClaimMap(detail));

    const capturedAppendix = buildVerificationAppendix(detail.researchRun?.sources ?? []);
    if (capturedAppendix.length > 0) {
      flow = renderSectionCard(
        doc,
        flow,
        'Captured signals appendix (manual review)',
        capturedAppendix
      );
    }

    const unresolved = buildUnresolvedGapItems(detail);
    if (unresolved.length > 0) {
      flow = renderSectionCard(doc, flow, 'Unresolved gaps', unresolved);
    }

    renderSectionCard(doc, flow, 'Execution and review', [
      ...buildActionItems(detail),
      ...summary.redLines.map((text) => ({
        label: 'Red line',
        text,
        tone: 'warning' as const,
      })),
      ...summary.revisitTriggers.map((text) => ({
        label: 'Revisit trigger',
        text,
        tone: 'accent' as const,
      })),
      {
        label: 'Outcome review',
        text: [
          detail.session.outcomeSummary || 'No outcome summary yet.',
          detail.session.actualOutcome || 'No actual outcome yet.',
          detail.session.retrospectiveNote || 'No retrospective note yet.',
          `Outcome confidence ${detail.session.outcomeConfidence ?? 0}%`,
        ].join(' | '),
        tone: 'muted',
      },
      {
        label: 'Previous prediction vs reality',
        text: detail.parentReviewComparison
          ? [
              `Prior topic: ${detail.parentReviewComparison.topic}`,
              `Prior recommendation: ${detail.parentReviewComparison.recommendedOption}`,
              `Predicted ${detail.parentReviewComparison.predictedConfidence}% vs outcome ${detail.parentReviewComparison.outcomeConfidence ?? 0}%`,
              detail.parentReviewComparison.outcomeSummary || 'No prior outcome summary.',
              detail.parentReviewComparison.actualOutcome || 'No prior actual outcome.',
              detail.parentReviewComparison.retrospectiveNote || 'No prior retrospective note.',
            ].join(' | ')
          : 'No parent follow-up context for this session.',
      },
    ]);

    doc.end();
  });
}

function renderCoverPage(
  doc: PDFKit.PDFDocument,
  detail: SessionArtifactDetailLike,
  summary: DecisionSummary,
  generatedAt: string
) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(PALETTE.canvas);
  doc.rect(0, 0, doc.page.width, 86).fill(PALETTE.ink);
  doc.fillColor('#F7F2EB').font(PDF_FONTS.bold).fontSize(11).text(
    'Round Table / Trusted personal decision assistant',
    PAGE.margin,
    20
  );
  doc.fillColor('#F7F2EB').font(PDF_FONTS.bold).fontSize(28).text(
    'Decision Dossier',
    PAGE.margin,
    38
  );

  const recommendationWidth = 156;
  const recommendationX = doc.page.width - PAGE.margin - recommendationWidth;
  const bodyY = 120;
  const contentGap = 18;
  const leftWidth = recommendationX - PAGE.margin - contentGap;
  doc.fillColor(PALETTE.ink).font(PDF_FONTS.bold).fontSize(24).text(
    toPdfSafeText(detail.session.topic),
    PAGE.margin,
    bodyY,
    { width: leftWidth, lineGap: 4 }
  );
  const topicBottom = doc.y;
  doc.fillColor(PALETTE.muted).font(PDF_FONTS.body).fontSize(11.5).text(
    toPdfSafeText(summary.summary),
    PAGE.margin,
    topicBottom + 10,
    { width: leftWidth, lineGap: 4 }
  );
  const summaryBottom = doc.y;

  drawCoverRecommendation(
    doc,
    toPdfSafeText(summary.recommendedOption),
    recommendationX,
    bodyY + 4
  );
  const recommendationBottom = bodyY + 4 + 132;
  let cursorY = Math.max(summaryBottom, recommendationBottom) + 18;

  drawCoverMetricGrid(doc, detail, cursorY);
  cursorY += 78;
  if (isResearchCoverageMissing(detail.researchRun)) {
    cursorY = drawCompactSection(
      doc,
      'Research coverage warning',
      [
        'This dossier has limited external evidence.',
        'Recommendations are model-generated and require manual validation before execution.',
      ],
      PAGE.margin,
      cursorY,
      500
    );
    cursorY += 12;
  }
  cursorY = drawCompactSection(doc, 'Confidence summary', [
    `Decision confidence ${summary.confidence}%`,
    `Research confidence ${detail.researchRun?.evaluation?.overallConfidence ?? 0}%`,
    `Decision status ${toPdfSafeText(humanizeStatus(detail.session.decisionStatus))}`,
    detail.session.reviewAt ? `Review date ${toPdfSafeText(detail.session.reviewAt)}` : 'Review date not set.',
  ], PAGE.margin, cursorY, 500);

  cursorY += 12;
  drawCompactSection(
    doc,
    'Next actions preview',
    summary.nextActions.map(toPdfSafeText),
    PAGE.margin,
    cursorY,
    500
  );

  doc.fillColor(PALETTE.muted).font(PDF_FONTS.body).fontSize(9.5).text(
    `Generated ${formatDateTime(generatedAt)}`,
    PAGE.margin,
    doc.page.height - 56
  );
}

function startFlowPage(
  doc: PDFKit.PDFDocument,
  sectionTitle: string,
  generatedAt: string
): FlowState {
  doc.rect(0, 0, doc.page.width, 40).fill(PALETTE.ink);
  doc.fillColor('#F7F2EB').font(PDF_FONTS.bold).fontSize(10).text(
    'Decision Dossier',
    PAGE.margin,
    14
  );
  doc.fillColor(PALETTE.ink).font(PDF_FONTS.bold).fontSize(20).text(
    sectionTitle,
    PAGE.margin,
    56
  );
  doc.fillColor(PALETTE.muted).font(PDF_FONTS.body).fontSize(9.5).text(
    `Generated ${formatDateTime(generatedAt)}`,
    PAGE.margin,
    78
  );

  return {
    y: 104,
    sectionTitle,
    generatedAt,
  };
}

function renderSectionCard(
  doc: PDFKit.PDFDocument,
  flow: FlowState,
  title: string,
  items: CardItem[]
) {
  flow.sectionTitle = title;
  const normalizedItems =
    items.length > 0 ? items.filter((item) => item.text.trim().length > 0) : [];
  if (normalizedItems.length === 0) {
    normalizedItems.push({ text: 'None recorded yet.', tone: 'muted' });
  }

  const cardWidth = doc.page.width - PAGE.margin * 2;
  let index = 0;
  let chunk = 1;

  while (index < normalizedItems.length) {
    const remainingHeight = usableBottom(doc) - flow.y;
    if (remainingHeight < 120) {
      doc.addPage();
      flow = startFlowPage(doc, flow.sectionTitle, flow.generatedAt);
    }

    const titleLabel = chunk === 1 ? title : `${title} (cont.)`;
    const maxHeight = usableBottom(doc) - flow.y;
    const chunkItems: CardItem[] = [];
    let chunkHeight = 56;

    while (index < normalizedItems.length) {
      const nextItem = normalizedItems[index];
      const nextHeight = measureCardItem(doc, nextItem, cardWidth - 28);
      if (chunkItems.length > 0 && chunkHeight + nextHeight > maxHeight) {
        break;
      }
      if (chunkHeight + nextHeight > maxHeight && chunkItems.length === 0) {
        chunkItems.push(nextItem);
        index += 1;
        break;
      }
      chunkItems.push(nextItem);
      chunkHeight += nextHeight;
      index += 1;
    }

    drawSectionCard(doc, titleLabel, chunkItems, PAGE.margin, flow.y, cardWidth, chunkHeight);
    flow.y += chunkHeight + 14;
    chunk += 1;
  }

  return flow;
}

function drawSectionCard(
  doc: PDFKit.PDFDocument,
  title: string,
  items: CardItem[],
  x: number,
  y: number,
  width: number,
  height: number
) {
  doc.save();
  doc.roundedRect(x, y, width, height, 14).fillAndStroke(PALETTE.panel, PALETTE.border);
  doc.restore();

  doc.fillColor(PALETTE.ink).font(PDF_FONTS.bold).fontSize(11).text(toPdfSafeText(title), x + 14, y + 14);
  let cursorY = y + 36;
  for (const item of items) {
    const itemStartY = cursorY;
    const itemHeight = measureCardItem(doc, item, width - 28);
    const accentColor =
      item.tone === 'warning'
        ? '#8C4B1C'
        : item.tone === 'accent'
          ? PALETTE.accent
          : item.tone === 'muted'
            ? PALETTE.muted
            : PALETTE.ink;
    const bodyColor = item.tone === 'muted' ? PALETTE.muted : '#24303A';
    if (item.label) {
      doc.fillColor(accentColor).font(PDF_FONTS.bold).fontSize(10.5).text(
        toPdfSafeText(item.label),
        x + 14,
        cursorY,
        { width: width - 28 }
      );
      cursorY += doc.heightOfString(item.label, {
        width: width - 28,
        lineGap: 1,
      });
    } else {
      doc.fillColor(accentColor).font(PDF_FONTS.bold).fontSize(10.5).text(
        '•',
        x + 14,
        cursorY
      );
    }
    doc.fillColor(bodyColor).font(PDF_FONTS.body).fontSize(10.5).text(
        toPdfSafeText(item.text),
      x + 26,
      cursorY,
      {
        width: width - 40,
        lineGap: 2,
      }
    );
    cursorY = itemStartY + itemHeight;
  }
}

function buildClaimMap(detail: SessionArtifactDetailLike): CardItem[] {
  return detail.decisionSummary!.evidence.map((item) => {
    const status = classifyEvidenceStatus(item);
    const refs = item.sourceIds
      .map((sourceId) => {
        const source = findResearchSourceByCitation(
          sourceId,
          detail.researchRun?.sources ?? []
        );
        if (!source) return sourceId;
        const typeLabel =
          source.sourceType === 'browser_verification' ? 'captured page' : 'source';
        return `${sourceId} ${typeLabel} ${source.domain || source.title}`;
      })
      .join(' | ');
    return {
      label:
        status === 'supported'
          ? 'Supported'
          : status === 'verify'
            ? 'Verify'
            : 'Inference',
      text: refs || item.gapReason || 'Manual verification required.',
      tone:
        status === 'supported'
          ? 'default'
          : status === 'verify'
            ? 'accent'
            : 'warning',
    };
  });
}

function buildVerificationAppendix(sources: ResearchSource[]): CardItem[] {
  return sources
    .filter((source) => source.sourceType === 'browser_verification')
    .flatMap((source) => {
      const fields =
        source.verifiedFields?.map((field) => ({
          label: `${source.citationLabel ?? source.id} ${field.label} (${field.confidence})`,
          text: field.value,
          tone: 'default' as const,
        })) ?? [];
      const notes = source.verificationNotes?.map((note) => ({
        label: `${source.citationLabel ?? source.id} note`,
        text: note,
        tone: 'muted' as const,
      })) ?? [];
      const meta: CardItem[] = [
        {
          label: `${source.citationLabel ?? source.id} page`,
          text: `${source.title} | ${source.url}`,
          tone: 'accent',
        },
        {
          label: `${source.citationLabel ?? source.id} snapshot`,
          text: source.snapshotPath
            ? `${source.captureStatus === 'screenshot' ? 'Live screenshot' : 'Snapshot fallback'} | ${source.snapshotPath}`
            : 'No snapshot persisted.',
          tone: 'muted',
        },
      ];
      return [...meta, ...fields, ...notes];
    });
}

function buildUnresolvedGapItems(detail: SessionArtifactDetailLike): CardItem[] {
  const evidenceGaps =
    detail.decisionSummary?.evidence
      .filter((item) => item.sourceIds.length === 0 || item.gapReason)
      .map((item) => ({
        label: item.sourceIds.length === 0 ? 'Need verification' : 'Partial support',
        text: `${item.claim} | ${item.gapReason || 'No explicit source mapping.'}`,
        tone: 'warning' as const,
      })) ?? [];
  const researchGaps =
    detail.researchRun?.evaluation?.gaps.map((gap) => ({
      label: 'Research gap',
      text: gap,
      tone: 'muted' as const,
    })) ?? [];
  return [...evidenceGaps, ...researchGaps];
}

function buildActionItems(detail: SessionArtifactDetailLike): CardItem[] {
  if (detail.actionItems.length > 0) {
    return detail.actionItems.map((item) => ({
      label: `Action ${item.priority}`,
      text: [item.content, item.owner, item.dueAt ? `due ${String(item.dueAt)}` : '']
        .filter(Boolean)
        .join(' | '),
      tone: item.status === 'verified' ? 'muted' : 'default',
    }));
  }

  return detail.decisionSummary!.nextActions.map((item) => ({
    label: 'Next action',
    text: item,
  }));
}

function drawCoverRecommendation(
  doc: PDFKit.PDFDocument,
  recommendation: string,
  x: number,
  y: number
) {
  doc.save();
  doc.roundedRect(x, y, 156, 132, 14).fill(PALETTE.ink);
  doc.restore();
  doc.fillColor('#CFE1E9').font(PDF_FONTS.bold).fontSize(9).text(
    'Recommended path',
    x + 14,
    y + 14
  );
  doc.fillColor('#FFFFFF').font(PDF_FONTS.bold).fontSize(16).text(
    toPdfSafeText(recommendation || 'No recommendation'),
    x + 14,
    y + 36,
    { width: 128, lineGap: 3 }
  );
}

function drawCoverMetricGrid(
  doc: PDFKit.PDFDocument,
  detail: SessionArtifactDetailLike,
  y: number
) {
  const metrics = [
    ['Decision', `${detail.decisionSummary?.confidence ?? 0}%`],
    ['Research', `${detail.researchRun?.evaluation?.overallConfidence ?? 0}%`],
    ['Outcome', `${detail.session.outcomeConfidence ?? 0}%`],
    ['Status', humanizeStatus(detail.session.decisionStatus)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = PAGE.margin + index * 124;
    doc.save();
    doc.roundedRect(x, y, 112, 62, 10).fillAndStroke('#FCF8F2', PALETTE.border);
    doc.restore();
    doc.fillColor(PALETTE.muted).font(PDF_FONTS.bold).fontSize(8).text(toPdfSafeText(label), x + 10, y + 10);
    doc.fillColor(PALETTE.ink).font(PDF_FONTS.bold).fontSize(14).text(toPdfSafeText(value), x + 10, y + 28, {
      width: 92,
    });
  });
}

function drawCompactSection(
  doc: PDFKit.PDFDocument,
  title: string,
  lines: string[],
  x: number,
  y: number,
  width: number
) {
  const safeLines = lines.length > 0 ? lines : ['None'];
  const heights = safeLines.map((line) =>
    Math.max(
      16,
      doc.heightOfString(line, {
        width: width - 40,
        lineGap: 2,
      }) + 4
    )
  );
  const height = 40 + heights.reduce((sum, value) => sum + value, 0);
  doc.save();
  doc.roundedRect(x, y, width, height, 14).fillAndStroke(PALETTE.panelAlt, PALETTE.border);
  doc.restore();
  doc.fillColor(PALETTE.ink).font(PDF_FONTS.bold).fontSize(11).text(toPdfSafeText(title), x + 14, y + 14);
  let cursorY = y + 34;
  safeLines.forEach((line, index) => {
    doc.fillColor(PALETTE.ink).font(PDF_FONTS.bold).fontSize(10.5).text('•', x + 14, cursorY);
    doc.fillColor('#24303A').font(PDF_FONTS.body).fontSize(10.5).text(toPdfSafeText(line), x + 26, cursorY, {
      width: width - 40,
      lineGap: 2,
    });
    cursorY += heights[index];
  });
  return y + height;
}

function measureCardItem(
  doc: PDFKit.PDFDocument,
  item: CardItem,
  width: number
) {
  const safeLabel = item.label ? toPdfSafeText(item.label) : '';
  const safeText = toPdfSafeText(item.text);
  const labelHeight = item.label
    ? doc.font(PDF_FONTS.bold).fontSize(10.5).heightOfString(safeLabel, {
        width,
        lineGap: 1,
      })
    : 0;
  const bodyHeight = doc.font(PDF_FONTS.body).fontSize(10.5).heightOfString(safeText, {
    width: width - 12,
    lineGap: 2,
  });
  return Math.max(24, labelHeight + bodyHeight + 12);
}

function usableBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - PAGE.margin - PAGE.footerHeight - 14;
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function humanizeStatus(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDateTime(value: number | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function toPdfSafeText(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function registerPdfFonts(doc: PDFKit.PDFDocument) {
  const uniqueCandidates = Array.from(new Set(PDF_FONT_CANDIDATES));
  for (const candidate of uniqueCandidates) {
    if (!isPdfFontFilePath(candidate) || !fs.existsSync(candidate)) {
      continue;
    }
    try {
      const fontBuffer = fs.readFileSync(candidate);
      doc.registerFont(PDF_FONTS.body, fontBuffer);
      doc.registerFont(PDF_FONTS.bold, fontBuffer);
      return;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    'No usable PDF font file found. Set ROUND_TABLE_PDF_CJK_FONT to a valid .ttf/.otf font path.'
  );
}

function isPdfFontFilePath(value: string) {
  return /\.(ttf|otf)$/i.test(value);
}

function resolveModuleAssetPath(specifier: string) {
  try {
    return moduleRequire.resolve(specifier);
  } catch {
    return '';
  }
}

function isResearchCoverageMissing(detail: SessionArtifactDetailLike['researchRun']) {
  if (!detail) return true;
  if (detail.status === 'skipped' || detail.status === 'failed') return true;
  return detail.sources.filter((source) => source.selected).length === 0;
}

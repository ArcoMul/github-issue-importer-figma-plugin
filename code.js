figma.showUI(__html__, { width: 420, height: 560, title: 'GitHub Issue Importer' });

const FRAME_WIDTH = 800;
const FRAME_PADDING = 32;
const HEADING_SPACER = 12;
const FONT_SIZE_TITLE = 28;
const FONT_SIZE_BODY = 14;
const FONT_SIZE_CODE = 13;
const LINE_HEIGHT_BODY = 22;
const LINE_HEIGHT_CODE = 20;
const HEADING_SIZES = { 1: 24, 2: 20, 3: 16 };

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'load-settings': {
      const [token, repo] = await Promise.all([
        figma.clientStorage.getAsync('gh_pat'),
        figma.clientStorage.getAsync('gh_repo'),
      ]);
      figma.ui.postMessage({
        type: 'settings-loaded',
        token: token || '',
        repo: repo || '',
        selectedIssueNumber: getSelectedIssueNumber(),
      });
      break;
    }
    case 'save-settings': {
      await Promise.all([
        figma.clientStorage.setAsync('gh_pat', msg.token),
        figma.clientStorage.setAsync('gh_repo', msg.repo),
      ]);
      break;
    }
    case 'insert-issue': {
      try {
        await insertIssue(msg.issueNumber, msg.title, msg.blocks);
        figma.ui.postMessage({ type: 'insert-complete' });
      } catch (err) {
        figma.ui.postMessage({ type: 'insert-error', message: err.message });
      }
      break;
    }
    case 'close': {
      figma.closePlugin();
      break;
    }
  }
};

figma.on('selectionchange', () => {
  figma.ui.postMessage({
    type: 'selection-changed',
    selectedIssueNumber: getSelectedIssueNumber(),
  });
});

/**
 * Returns the issue number from the selected frame's name (e.g. "#42: title" → "42"),
 * or null if no matching frame is selected.
 */
function getSelectedIssueNumber() {
  const selection = figma.currentPage.selection;
  if (selection.length > 0 && selection[0].type === 'FRAME') {
    const match = selection[0].name.match(/^#(\d+):/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Renders a parsed issue into the canvas: loads fonts, builds the frame,
 * appends the title and all content blocks, then scrolls the viewport to the result.
 */
async function insertIssue(issueNumber, title, blocks) {
  await loadAllFonts();
  const frame = getOrCreateFrame(issueNumber, title);

  frame.appendChild(createTitleNode(title));

  for (const block of blocks) {
    if (block.type === 'blank') continue;
    const node = createBlockNode(block);
    if (node !== null) {
      if (block.type === 'heading') frame.appendChild(createSpacer(HEADING_SPACER));
      frame.appendChild(node);
    }
  }

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
}

/**
 * Pre-loads all font variants used by the plugin in parallel.
 * Must resolve before any text node is created.
 */
async function loadAllFonts() {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Italic' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold Italic' }),
    figma.loadFontAsync({ family: 'Courier New', style: 'Regular' }),
  ]);
}

/**
 * Returns the currently selected frame (clearing its children) or creates a new
 * 800 px auto-layout frame centred in the viewport.
 */
function getOrCreateFrame(issueNumber, title) {
  const selection = figma.currentPage.selection;
  let frame;

  if (selection.length > 0 && selection[0].type === 'FRAME') {
    frame = selection[0];
    for (const child of [...frame.children]) {
      child.remove();
    }
  } else {
    frame = figma.createFrame();
    const center = figma.viewport.center;
    frame.x = center.x - FRAME_WIDTH / 2;
    frame.y = center.y - 200;
  }

  frame.name = `#${issueNumber}: ${title.substring(0, 50)}`;
  frame.layoutMode = 'VERTICAL';
  frame.resize(FRAME_WIDTH, 100);
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.itemSpacing = 12;
  frame.paddingTop = FRAME_PADDING;
  frame.paddingBottom = FRAME_PADDING;
  frame.paddingLeft = FRAME_PADDING;
  frame.paddingRight = FRAME_PADDING;
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  return frame;
}

/**
 * Creates a text node with shared layout properties (STRETCH, WIDTH_AND_HEIGHT resize).
 * All parameters are optional and fall back to body-text defaults.
 */
function makeTextNode({
  family = 'Inter',
  style = 'Regular',
  size = FONT_SIZE_BODY,
  lineHeight = null,
  color = { r: 0.2, g: 0.2, b: 0.2 },
} = {}) {
  const node = figma.createText();
  node.fontName = { family, style };
  node.fontSize = size;
  if (lineHeight !== null) {
    node.lineHeight = { value: lineHeight, unit: 'PIXELS' };
  }
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.layoutAlign = 'STRETCH';
  node.fills = [{ type: 'SOLID', color }];
  return node;
}

/**
 * Dispatches a parsed block to its specific renderer.
 * Returns null for unknown or blank block types.
 */
function createBlockNode(block) {
  switch (block.type) {
    case 'heading':
      return createHeadingNode(block);
    case 'paragraph':
      return createParagraphNode(block);
    case 'codeBlock':
      return createCodeBlockNode(block);
    case 'listGroup':
      return createListGroupNode(block);
    case 'blockquote':
      return createBlockquoteNode(block);
    case 'horizontalRule':
      return createHorizontalRuleNode();
    default:
      return null;
  }
}

/**
 * Creates a bold title text node for the issue title.
 */
function createTitleNode(title) {
  const node = makeTextNode({
    style: 'Bold',
    size: FONT_SIZE_TITLE,
    color: { r: 0.067, g: 0.067, b: 0.067 },
  });
  node.characters = title;
  return node;
}

/**
 * Creates a bold heading text node sized by level (H1–H3).
 */
function createHeadingNode(block) {
  const node = makeTextNode({
    style: 'Bold',
    size: HEADING_SIZES[block.level] || 16,
    color: { r: 0.067, g: 0.067, b: 0.067 },
  });
  node.characters = block.segments.map((s) => s.text).join('');
  applyInlineFormatting(node, block.segments);
  return node;
}

/**
 * Creates a body-text paragraph node with inline formatting applied.
 */
function createParagraphNode(block) {
  const node = makeTextNode({ lineHeight: LINE_HEIGHT_BODY });
  node.characters = block.segments.map((s) => s.text).join('');
  applyInlineFormatting(node, block.segments);
  return node;
}

/**
 * Creates a fenced code block as a grey rounded frame containing a monospace text node.
 */
function createCodeBlockNode(block) {
  const codeFrame = figma.createFrame();
  codeFrame.layoutMode = 'VERTICAL';
  codeFrame.resize(FRAME_WIDTH - FRAME_PADDING * 2, 40);
  codeFrame.primaryAxisSizingMode = 'AUTO';
  codeFrame.counterAxisSizingMode = 'FIXED';
  codeFrame.paddingTop = 12;
  codeFrame.paddingBottom = 12;
  codeFrame.paddingLeft = 16;
  codeFrame.paddingRight = 16;
  codeFrame.cornerRadius = 6;
  codeFrame.fills = [{ type: 'SOLID', color: { r: 0.953, g: 0.953, b: 0.953 } }];
  codeFrame.layoutAlign = 'STRETCH';

  const textNode = makeTextNode({
    family: 'Courier New',
    size: FONT_SIZE_CODE,
    lineHeight: LINE_HEIGHT_CODE,
    color: { r: 0.15, g: 0.15, b: 0.15 },
  });
  textNode.characters = block.text;

  codeFrame.appendChild(textNode);
  return codeFrame;
}

/**
 * Creates a single text node for a group of consecutive list items,
 * joined with newlines and prefixed with bullets or numbers.
 */
function createListGroupNode(block) {
  const node = makeTextNode({ lineHeight: LINE_HEIGHT_BODY });

  let fullText = '';
  const formattingItems = [];

  for (let idx = 0; idx < block.items.length; idx++) {
    const item = block.items[idx];
    const indent = '    '.repeat(item.indent || 0);
    const prefix = item.ordered ? `${item.index}. ` : '• ';
    const offset = fullText.length + indent.length + prefix.length;
    fullText += indent + prefix + item.segments.map((s) => s.text).join('');
    if (idx < block.items.length - 1) fullText += '\n';
    formattingItems.push({ offset, segments: item.segments });
  }

  node.characters = fullText;

  for (const { offset, segments } of formattingItems) {
    applyInlineFormatting(node, segments, offset);
  }

  return node;
}

/**
 * Creates an italic, grey text node for a blockquote.
 */
function createBlockquoteNode(block) {
  const node = makeTextNode({
    style: 'Italic',
    lineHeight: LINE_HEIGHT_BODY,
    color: { r: 0.45, g: 0.45, b: 0.45 },
  });
  node.characters = block.segments.map((s) => s.text).join('');
  applyInlineFormatting(node, block.segments);
  return node;
}

/**
 * Creates an invisible fixed-height frame used to add extra space above headings.
 */
function createSpacer(height) {
  const spacer = figma.createFrame();
  spacer.name = '.spacer';
  spacer.resize(1, height);
  spacer.fills = [];
  spacer.layoutAlign = 'STRETCH';
  return spacer;
}

/**
 * Creates a light grey em-dash string as a visual horizontal rule.
 */
function createHorizontalRuleNode() {
  const node = makeTextNode({ color: { r: 0.8, g: 0.8, b: 0.8 } });
  node.characters = '────────────────────────────────────────────────────';
  return node;
}

/**
 * Walks a segments array and applies character-range formatting (bold, italic,
 * code, strikethrough, hyperlinks) to an existing text node.
 * offset shifts all ranges for nodes where text is preceded by a prefix (e.g. list bullets).
 */
function applyInlineFormatting(textNode, segments, offset = 0) {
  let cursor = offset;

  for (const seg of segments) {
    const start = cursor;
    const end = cursor + seg.text.length;
    cursor = end;

    if (seg.text.length === 0) continue;

    if (seg.bold && seg.italic) {
      textNode.setRangeFontName(start, end, { family: 'Inter', style: 'Bold Italic' });
    } else if (seg.bold) {
      textNode.setRangeFontName(start, end, { family: 'Inter', style: 'Bold' });
    } else if (seg.italic) {
      textNode.setRangeFontName(start, end, { family: 'Inter', style: 'Italic' });
    }

    if (seg.code) {
      textNode.setRangeFontName(start, end, { family: 'Courier New', style: 'Regular' });
      textNode.setRangeFontSize(start, end, FONT_SIZE_CODE);
      textNode.setRangeFills(start, end, [{ type: 'SOLID', color: { r: 0.78, g: 0.18, b: 0.18 } }]);
    }

    if (seg.strikethrough) {
      textNode.setRangeTextDecoration(start, end, 'STRIKETHROUGH');
    }

    if (seg.link) {
      textNode.setRangeHyperlink(start, end, { type: 'URL', value: seg.link });
      textNode.setRangeFills(start, end, [{ type: 'SOLID', color: { r: 0.09, g: 0.46, b: 0.82 } }]);
    }
  }
}

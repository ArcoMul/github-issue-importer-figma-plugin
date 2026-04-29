figma.showUI(__html__, { width: 420, height: 560, title: 'GitHub Issue Importer' });

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'load-settings': {
      const [token, repo] = await Promise.all([
        figma.clientStorage.getAsync('gh_pat'),
        figma.clientStorage.getAsync('gh_repo'),
      ]);
      figma.ui.postMessage({ type: 'settings-loaded', token: token || '', repo: repo || '' });
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

async function insertIssue(issueNumber, title, blocks) {
  await loadAllFonts();
  const frame = getOrCreateFrame(issueNumber, title);

  const titleNode = createTitleNode(title);
  frame.appendChild(titleNode);

  for (const block of blocks) {
    if (block.type === 'blank') continue;
    const node = createBlockNode(block);
    if (node !== null) {
      if (block.type === 'heading') frame.appendChild(createSpacer(12));
      frame.appendChild(node);
    }
  }

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
}

async function loadAllFonts() {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Italic' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold Italic' }),
    figma.loadFontAsync({ family: 'Courier New', style: 'Regular' }),
  ]);
}

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
    frame.x = center.x - 400;
    frame.y = center.y - 200;
  }

  frame.name = `#${issueNumber}: ${title.substring(0, 50)}`;
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(800, 100);
  frame.itemSpacing = 12;
  frame.paddingTop = 32;
  frame.paddingBottom = 32;
  frame.paddingLeft = 32;
  frame.paddingRight = 32;
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  return frame;
}

function createTitleNode(title) {
  const node = figma.createText();
  node.fontName = { family: 'Inter', style: 'Bold' };
  node.fontSize = 28;
  node.characters = title;
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.layoutAlign = 'STRETCH';
  node.fills = [{ type: 'SOLID', color: { r: 0.067, g: 0.067, b: 0.067 } }];
  return node;
}

function createBlockNode(block) {
  switch (block.type) {
    case 'heading':
      return createHeadingNode(block);
    case 'paragraph':
      return createParagraphNode(block);
    case 'codeBlock':
      return createCodeBlockNode(block);
    case 'listItem':
      return createListItemNode(block);
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

function createHeadingNode(block) {
  const sizes = { 1: 24, 2: 20, 3: 16 };
  const node = figma.createText();
  node.fontName = { family: 'Inter', style: 'Bold' };
  node.fontSize = sizes[block.level] || 16;
  node.characters = block.segments.map(s => s.text).join('');
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.layoutAlign = 'STRETCH';
  node.fills = [{ type: 'SOLID', color: { r: 0.067, g: 0.067, b: 0.067 } }];
  applyInlineFormatting(node, block.segments);
  return node;
}

function createParagraphNode(block) {
  const node = figma.createText();
  node.fontName = { family: 'Inter', style: 'Regular' };
  node.fontSize = 14;
  node.lineHeight = { value: 22, unit: 'PIXELS' };
  node.characters = block.segments.map(s => s.text).join('');
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.layoutAlign = 'STRETCH';
  node.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
  applyInlineFormatting(node, block.segments);
  return node;
}

function createCodeBlockNode(block) {
  const codeFrame = figma.createFrame();
  codeFrame.layoutMode = 'VERTICAL';
  codeFrame.primaryAxisSizingMode = 'AUTO';
  codeFrame.counterAxisSizingMode = 'FIXED';
  codeFrame.resize(736, 40);
  codeFrame.paddingTop = 12;
  codeFrame.paddingBottom = 12;
  codeFrame.paddingLeft = 16;
  codeFrame.paddingRight = 16;
  codeFrame.cornerRadius = 6;
  codeFrame.fills = [{ type: 'SOLID', color: { r: 0.953, g: 0.953, b: 0.953 } }];
  codeFrame.layoutAlign = 'STRETCH';

  const textNode = figma.createText();
  textNode.fontName = { family: 'Courier New', style: 'Regular' };
  textNode.fontSize = 13;
  textNode.lineHeight = { value: 20, unit: 'PIXELS' };
  textNode.characters = block.text;
  textNode.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 } }];
  textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
  textNode.layoutAlign = 'STRETCH';

  codeFrame.appendChild(textNode);
  return codeFrame;
}

function createListItemNode(block) {
  const node = figma.createText();
  node.fontName = { family: 'Inter', style: 'Regular' };
  node.fontSize = 14;
  node.lineHeight = { value: 22, unit: 'PIXELS' };

  const indent = '    '.repeat(block.indent || 0);
  const prefix = block.ordered ? `${block.index}. ` : '• ';
  const bodyText = block.segments.map(s => s.text).join('');
  node.characters = indent + prefix + bodyText;
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.layoutAlign = 'STRETCH';
  node.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];

  const offset = indent.length + prefix.length;
  applyInlineFormatting(node, block.segments, offset);
  return node;
}

function createListGroupNode(block) {
  const node = figma.createText();
  node.fontName = { family: 'Inter', style: 'Regular' };
  node.fontSize = 14;
  node.lineHeight = { value: 22, unit: 'PIXELS' };
  node.layoutAlign = 'STRETCH';
  node.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];

  let fullText = '';
  const formattingItems = [];

  for (let idx = 0; idx < block.items.length; idx++) {
    const item = block.items[idx];
    const indent = '    '.repeat(item.indent || 0);
    const prefix = item.ordered ? `${item.index}. ` : '• ';
    const offset = fullText.length + indent.length + prefix.length;
    fullText += indent + prefix + item.segments.map(s => s.text).join('');
    if (idx < block.items.length - 1) fullText += '\n';
    formattingItems.push({ offset, segments: item.segments });
  }

  node.characters = fullText;
  node.textAutoResize = 'WIDTH_AND_HEIGHT';

  for (const { offset, segments } of formattingItems) {
    applyInlineFormatting(node, segments, offset);
  }

  return node;
}

function createBlockquoteNode(block) {
  const node = figma.createText();
  node.fontName = { family: 'Inter', style: 'Italic' };
  node.fontSize = 14;
  node.lineHeight = { value: 22, unit: 'PIXELS' };
  node.characters = block.segments.map(s => s.text).join('');
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.layoutAlign = 'STRETCH';
  node.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.45, b: 0.45 } }];
  applyInlineFormatting(node, block.segments);
  return node;
}

function createSpacer(height) {
  const spacer = figma.createFrame();
  spacer.name = '.spacer';
  spacer.resize(1, height);
  spacer.fills = [];
  spacer.layoutAlign = 'STRETCH';
  return spacer;
}

function createHorizontalRuleNode() {
  const node = figma.createText();
  node.fontName = { family: 'Inter', style: 'Regular' };
  node.fontSize = 14;
  node.characters = '────────────────────────────────────────────────────';
  node.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  node.textAutoResize = 'WIDTH_AND_HEIGHT';
  node.layoutAlign = 'STRETCH';
  return node;
}

function applyInlineFormatting(textNode, segments, offset) {
  offset = offset || 0;
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
      textNode.setRangeFontSize(start, end, 13);
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

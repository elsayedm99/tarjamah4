import mammoth from 'mammoth';

interface DocxParseResult {
  /** Full text of the document */
  text: string;
  /** HTML representation of the document */
  html: string;
  /** Text split into logical sections (approximating pages) */
  sections: string[];
}

/**
 * Parse a DOCX file and extract its content.
 * Returns the full text, HTML, and sections (approximated page breaks).
 */
export async function parseDocx(file: File): Promise<DocxParseResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Extract HTML (preserves structure: headings, tables, lists)
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = htmlResult.value;

  // Extract raw text
  const textResult = await mammoth.extractRawText({ arrayBuffer });
  const text = textResult.value;

  // Split into sections
  // DOCX doesn't have explicit page breaks accessible via mammoth,
  // so we approximate by splitting on large paragraph groups.
  // We aim for ~3000 characters per section (roughly one page).
  const sections = splitIntoSections(text, 3000);

  return { text, html, sections };
}

/**
 * Split text into sections of approximately `targetLength` characters,
 * breaking at paragraph boundaries.
 */
function splitIntoSections(text: string, targetLength: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const sections: string[] = [];
  let currentSection = '';

  for (const paragraph of paragraphs) {
    if (
      currentSection.length > 0 &&
      currentSection.length + paragraph.length > targetLength
    ) {
      sections.push(currentSection.trim());
      currentSection = paragraph;
    } else {
      currentSection += (currentSection ? '\n\n' : '') + paragraph;
    }
  }

  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }

  return sections;
}

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import puppeteer from 'puppeteer';

async function convertLaTeXToHTML(latexContent: string): Promise<string> {
  // Simple LaTeX to HTML conversion (basic)
  let html = latexContent
    .replace(/\\section\{([^}]+)\}/g, '<h2>$1</h2>')
    .replace(/\\subsection\{([^}]+)\}/g, '<h3>$1</h3>')
    .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
    .replace(/\\begin\{itemize\}/g, '<ul>')
    .replace(/\\end\{itemize\}/g, '</ul>')
    .replace(/\\item\s+/g, '<li>')
    .replace(/\\par/g, '<p>')
    .replace(/\\\\/g, '<br>');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h3 { color: #555; margin-top: 30px; }
    ul { margin: 20px 0; }
    li { margin: 10px 0; }
    strong { font-weight: bold; }
    em { font-style: italic; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

async function compileToPDF(latexPath: string) {
  try {
    const latexContent = await readFile(latexPath, 'utf-8');
    const pdfPath = latexPath.replace('.tex', '.pdf');
    
    // Convert LaTeX to HTML
    const html = await convertLaTeXToHTML(latexContent);
    const htmlPath = latexPath.replace('.tex', '.html');
    await writeFile(htmlPath, html);
    
    // Use Puppeteer to convert HTML to PDF
    console.log('📄 Converting HTML to PDF...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle0' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    await browser.close();
    
    console.log(`✅ PDF generated: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    throw error;
  }
}

const latexFile = process.argv[2] || 'data/reports/da9f10a1-5b9c-4f83-ab5c-dee514fde605_review.tex';
compileToPDF(resolve(latexFile)).catch(console.error);

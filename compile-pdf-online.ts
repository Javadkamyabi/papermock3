import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

async function compileLaTeXOnline(latexPath: string) {
  try {
    const latexContent = await readFile(latexPath, 'utf-8');
    const pdfPath = latexPath.replace('.tex', '.pdf');
    
    // Try latexonline.cc API
    console.log('📄 Compiling via latexonline.cc...');
    const response = await fetch('https://latexonline.cc/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `text=${encodeURIComponent(latexContent)}`,
    });

    if (response.ok) {
      const pdfBuffer = await response.arrayBuffer();
      await writeFile(pdfPath, Buffer.from(pdfBuffer));
      console.log(`✅ PDF generated: ${pdfPath}`);
      return pdfPath;
    } else {
      throw new Error(`API returned status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Online compilation failed:', error);
    throw error;
  }
}

const latexFile = process.argv[2] || 'data/reports/da9f10a1-5b9c-4f83-ab5c-dee514fde605_review.tex';
compileLaTeXOnline(resolve(latexFile)).catch(console.error);

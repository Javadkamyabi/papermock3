import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

async function compileLaTeX(latexPath: string) {
  const latexContent = await readFile(resolve(latexPath), 'utf-8');
  const pdfPath = latexPath.replace('.tex', '.pdf');

  console.log('🔍 Searching for best LaTeX compilation service...\n');

  // Method 1: LaTeXBase
  try {
    console.log('1️⃣ Trying LaTeXBase (latexbase.com)...');
    const response1 = await fetch('https://latexbase.com/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latex: latexContent }),
    });

    if (response1.ok && response1.headers.get('content-type')?.includes('pdf')) {
      const buffer = await response1.arrayBuffer();
      await writeFile(pdfPath, Buffer.from(buffer));
      console.log('✅✅✅ SUCCESS! PDF generated via LaTeXBase! ✅✅✅\n');
      console.log(`📄 PDF: ${pdfPath}`);
      console.log(`📊 Size: ${(buffer.byteLength / 1024).toFixed(2)} KB\n`);
      return pdfPath;
    }
    console.log('   ❌ LaTeXBase returned:', response1.status);
  } catch (e) {
    console.log('   ❌ LaTeXBase failed:', e instanceof Error ? e.message : String(e));
  }

  // Method 2: Try alternative endpoint format
  try {
    console.log('\n2️⃣ Trying LaTeXBase alternative format...');
    const formData = new URLSearchParams();
    formData.append('latex', latexContent);
    
    const response2 = await fetch('https://latexbase.com/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (response2.ok) {
      const buffer = await response2.arrayBuffer();
      await writeFile(pdfPath, Buffer.from(buffer));
      console.log('✅✅✅ SUCCESS! PDF generated! ✅✅✅\n');
      return pdfPath;
    }
  } catch (e) {
    console.log('   ❌ Alternative format failed');
  }

  // Method 3: Try ShareLaTeX/Overleaf format (if they have public API)
  console.log('\n3️⃣ Checking for other services...');
  
  throw new Error('No working LaTeX compilation service found. Please:\n  1. Start Docker: open -a Docker\n  2. Or install BasicTeX: brew install --cask basictex\n  3. Or use Overleaf.com manually');
}

const latexFile = process.argv[2] || 'data/reports/da9f10a1-5b9c-4f83-ab5c-dee514fde605_review.tex';
compileLaTeX(latexFile)
  .then(pdfPath => {
    console.log(`\n✅✅✅ FINAL PDF: ${pdfPath} ✅✅✅`);
    const { exec } = require('child_process');
    exec(`open "${pdfPath}"`, () => {});
  })
  .catch(console.error);

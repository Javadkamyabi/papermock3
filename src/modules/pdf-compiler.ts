/**
 * PDF Compiler Module
 * Compiles LaTeX files to PDF using available tools (pdflatex, Docker, etc.)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { writeFile } from 'fs/promises';

const execAsync = promisify(exec);

export interface PDFCompilerResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
  method?: string;
}

/**
 * Compile LaTeX file to PDF
 */
export async function compileLaTeXToPDF(
  latexFilePath: string,
  outputDir?: string
): Promise<PDFCompilerResult> {
  const latexPath = resolve(latexFilePath);
  const dir = outputDir ? resolve(outputDir) : resolve(latexPath, '..');
  const fileName = latexPath.split('/').pop()?.replace('.tex', '') || 'output';
  const pdfPath = resolve(dir, `${fileName}.pdf`);

  // Method 1: Try pdflatex directly
  try {
    await execAsync('which pdflatex');
    console.log('  [PDF Compiler] Using pdflatex...');
    await execAsync(`cd "${dir}" && pdflatex -interaction=nonstopmode "${fileName}.tex"`, {
      cwd: dir,
    });
    await execAsync(`cd "${dir}" && pdflatex -interaction=nonstopmode "${fileName}.tex"`, {
      cwd: dir,
    });
    if (existsSync(pdfPath)) {
      return {
        success: true,
        pdfPath,
        method: 'pdflatex',
      };
    }
  } catch (error) {
    // Continue to next method
  }

  // Method 2: Try pdflatex from /Library/TeX/texbin (MacTeX/BasicTeX)
  try {
    const texbinPath = '/Library/TeX/texbin/pdflatex';
    if (existsSync(texbinPath)) {
      console.log('  [PDF Compiler] Using pdflatex from /Library/TeX/texbin...');
      await execAsync(`cd "${dir}" && ${texbinPath} -interaction=nonstopmode "${fileName}.tex"`, {
        cwd: dir,
      });
      await execAsync(`cd "${dir}" && ${texbinPath} -interaction=nonstopmode "${fileName}.tex"`, {
        cwd: dir,
      });
      if (existsSync(pdfPath)) {
        return {
          success: true,
          pdfPath,
          method: 'pdflatex (texbin)',
        };
      }
    }
  } catch (error) {
    // Continue to next method
  }

  // Method 3: Try Docker (check if Docker daemon is running)
  try {
    // Check if Docker is available and daemon is running
    await execAsync('docker ps >/dev/null 2>&1');
    console.log('  [PDF Compiler] Using Docker with texlive...');
    
    // First compilation pass
    try {
      await execAsync(
        `docker run --rm -v "${dir}:/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${fileName}.tex"`,
        { cwd: dir, maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );
    } catch (e) {
      // First pass may have warnings, continue to second pass
    }
    
    // Second compilation pass (for references, TOC, etc.)
    try {
      await execAsync(
        `docker run --rm -v "${dir}:/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${fileName}.tex"`,
        { cwd: dir, maxBuffer: 10 * 1024 * 1024 }
      );
    } catch (e) {
      // Second pass may also have warnings, check if PDF was created
    }
    
    if (existsSync(pdfPath)) {
      return {
        success: true,
        pdfPath,
        method: 'docker',
      };
    }
  } catch (error) {
    // Docker not available or daemon not running
    // Continue to next method
  }

  // Method 4: Try with path_helper (for BasicTeX after installation)
  try {
    await execAsync('eval "$(/usr/libexec/path_helper)" && pdflatex -version');
    console.log('  [PDF Compiler] Using pdflatex with path_helper...');
    await execAsync(
      `cd "${dir}" && eval "$(/usr/libexec/path_helper)" && pdflatex -interaction=nonstopmode "${fileName}.tex"`,
      { cwd: dir }
    );
    await execAsync(
      `cd "${dir}" && eval "$(/usr/libexec/path_helper)" && pdflatex -interaction=nonstopmode "${fileName}.tex"`,
      { cwd: dir }
    );
    if (existsSync(pdfPath)) {
      return {
        success: true,
        pdfPath,
        method: 'pdflatex (path_helper)',
      };
    }
  } catch (error) {
    // Continue
  }

  return {
    success: false,
    error: 'No LaTeX compiler available. Please install BasicTeX (brew install --cask basictex) or use Docker.',
  };
}

/**
 * Standalone function to compile a LaTeX file
 */
export async function compilePDF(latexFilePath: string): Promise<void> {
  const result = await compileLaTeXToPDF(latexFilePath);
  
  if (result.success && result.pdfPath) {
    const stats = statSync(result.pdfPath);
    console.log('');
    console.log('✅ PDF generated successfully!');
    console.log(`📄 PDF Location: ${result.pdfPath}`);
    console.log(`📊 PDF Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`🔧 Method: ${result.method}`);
  } else {
    console.log('');
    console.log('⚠️  Could not compile PDF automatically.');
    console.log(`📄 LaTeX file: ${latexFilePath}`);
    console.log('');
    console.log('Options:');
    console.log('  1. Install BasicTeX: brew install --cask basictex');
    console.log('  2. Use Overleaf.com (upload the .tex file)');
    console.log('  3. Use Docker: docker run --rm -v "$(pwd):/workdir" texlive/texlive:latest pdflatex ...');
    if (result.error) {
      console.log(`\nError: ${result.error}`);
    }
  }
}


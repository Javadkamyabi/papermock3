#!/bin/bash
# Helper script to compile LaTeX to PDF

DOC_ID="5fafe711-f315-4087-af1e-4c8a13878b70"
LATEX_FILE="data/reports/${DOC_ID}_review.tex"
PDF_FILE="data/reports/${DOC_ID}_review.pdf"

echo "=========================================="
echo "LaTeX to PDF Compilation Helper"
echo "=========================================="
echo ""

if [ ! -f "$LATEX_FILE" ]; then
    echo "❌ LaTeX file not found: $LATEX_FILE"
    exit 1
fi

echo "✅ LaTeX file found: $LATEX_FILE"
echo ""

# Try Docker first
if docker ps >/dev/null 2>&1; then
    echo "Using Docker to compile..."
    cd data/reports
    docker run --rm -v "$(pwd):/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${DOC_ID}_review.tex" 2>&1 | tail -10
    docker run --rm -v "$(pwd):/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${DOC_ID}_review.tex" 2>&1 | tail -5
    cd ../..
    if [ -f "$PDF_FILE" ]; then
        echo ""
        echo "✅ PDF GENERATED!"
        ls -lh "$PDF_FILE"
        echo ""
        echo "📄 PDF Location: $(pwd)/$PDF_FILE"
        open "$PDF_FILE" 2>/dev/null || echo "Open manually: $(pwd)/$PDF_FILE"
        exit 0
    fi
fi

# Try pdflatex if available
if command -v pdflatex >/dev/null 2>&1 || [ -f "/Library/TeX/texbin/pdflatex" ]; then
    echo "Using local pdflatex..."
    cd data/reports
    pdflatex -interaction=nonstopmode "${DOC_ID}_review.tex" >/dev/null 2>&1
    pdflatex -interaction=nonstopmode "${DOC_ID}_review.tex" >/dev/null 2>&1
    cd ../..
    if [ -f "$PDF_FILE" ]; then
        echo ""
        echo "✅ PDF GENERATED!"
        ls -lh "$PDF_FILE"
        echo ""
        echo "📄 PDF Location: $(pwd)/$PDF_FILE"
        open "$PDF_FILE" 2>/dev/null || echo "Open manually: $(pwd)/$PDF_FILE"
        exit 0
    fi
fi

# If compilation failed, provide instructions
echo ""
echo "⚠️  Could not compile automatically. Here are your options:"
echo ""
echo "OPTION 1: Overleaf (Easiest - No Installation)"
echo "  1. Go to: https://www.overleaf.com"
echo "  2. Sign up/login (free)"
echo "  3. Click 'New Project' > 'Blank Project'"
echo "  4. Delete default content"
echo "  5. Copy and paste contents of: $LATEX_FILE"
echo "  6. Click 'Recompile' → PDF downloads automatically"
echo ""
echo "OPTION 2: Install BasicTeX (For Local Compilation)"
echo "  Run: brew install --cask basictex"
echo "  Then: cd data/reports && pdflatex ${DOC_ID}_review.tex"
echo ""
echo "OPTION 3: Use Docker (If Available)"
echo "  docker run --rm -v \"\$(pwd)/data/reports:/workdir\" texlive/texlive:latest pdflatex ${DOC_ID}_review.tex"
echo ""
echo "LaTeX file location:"
echo "  $(pwd)/$LATEX_FILE"

#!/bin/bash
# Automated PDF Compiler using Docker
# Usage: ./compile-pdf.sh <document_id>

DOC_ID="${1:-da9f10a1-5b9c-4f83-ab5c-dee514fde605}"
REPORTS_DIR="$(pwd)/data/reports"
TEX_FILE="${REPORTS_DIR}/${DOC_ID}_review.tex"
PDF_FILE="${REPORTS_DIR}/${DOC_ID}_review.pdf"

if [ ! -f "$TEX_FILE" ]; then
    echo "❌ LaTeX file not found: $TEX_FILE"
    exit 1
fi

echo "=== Compiling LaTeX to PDF using Docker ==="
echo "LaTeX file: $TEX_FILE"
echo ""

cd "$REPORTS_DIR"

# First pass
echo "📄 First compilation pass..."
docker run --rm -v "$(pwd):/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${DOC_ID}_review.tex" > /dev/null 2>&1

# Second pass (for references, TOC, etc.)
echo "📄 Second compilation pass..."
docker run --rm -v "$(pwd):/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${DOC_ID}_review.tex" > /dev/null 2>&1

if [ -f "${DOC_ID}_review.pdf" ]; then
    echo ""
    echo "✅✅✅ PDF GENERATED SUCCESSFULLY! ✅✅✅"
    echo ""
    ls -lh "${DOC_ID}_review.pdf"
    echo ""
    echo "📄 PDF Location:"
    echo "$PDF_FILE"
    echo ""
    echo "Full absolute path:"
    realpath "${DOC_ID}_review.pdf" 2>/dev/null || echo "$PDF_FILE"
    echo ""
    echo "File size: $(ls -lh ${DOC_ID}_review.pdf | awk '{print $5}')"
    echo ""
    echo "✅ Opening PDF..."
    open "${DOC_ID}_review.pdf" 2>/dev/null || echo "Please open manually: $PDF_FILE"
else
    echo "❌ PDF compilation failed"
    echo "Check the log file for errors: ${DOC_ID}_review.log"
    exit 1
fi

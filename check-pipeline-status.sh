#!/bin/bash
# Check pipeline status

echo "Checking pipeline status..."
echo ""

# Check for LaTeX files
echo "LaTeX files:"
ls -lh data/reports/*.tex 2>/dev/null | tail -5 || echo "  No LaTeX files found"

echo ""
echo "PDF files:"
ls -lh data/reports/*.pdf 2>/dev/null | tail -5 || echo "  No PDF files found"

echo ""
echo "Recent assessments:"
ls -lt data/assessments.json 2>/dev/null && echo "  Assessments file exists" || echo "  No assessments file"


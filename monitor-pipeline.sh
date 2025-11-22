#!/bin/bash
# Real-time pipeline monitor with detailed second-by-second logs

LOG_FILE="/tmp/full-pipeline-final.log"
ASSESSMENTS_FILE="data/assessments.json"

echo "=========================================="
echo "Pipeline Real-Time Monitor"
echo "=========================================="
echo ""

# Function to show current status
show_status() {
    clear
    echo "=========================================="
    echo "Pipeline Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    # Check if pipeline is running
    if ps aux | grep -q "[r]un-full-pipeline"; then
        echo "✅ Pipeline Process: RUNNING"
        ps aux | grep "[r]un-full-pipeline" | grep -v grep | head -1 | awk '{print "   PID: "$2" | CPU: "$3"% | MEM: "$4"%"}'
    else
        echo "❌ Pipeline Process: NOT RUNNING"
    fi
    echo ""
    
    # Show latest log entries
    echo "--- Latest Log Output (last 20 lines) ---"
    if [ -f "$LOG_FILE" ]; then
        tail -20 "$LOG_FILE" 2>/dev/null | sed 's/^/   /'
    else
        echo "   No log file found"
    fi
    echo ""
    
    # Show module completion status
    echo "--- Module Completion Status ---"
    if [ -f "$ASSESSMENTS_FILE" ]; then
        node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$ASSESSMENTS_FILE', 'utf-8'));
        const recent = data.filter(a => {
            const date = new Date(a.assessmentDate);
            const now = new Date();
            return (now - date) < 3600000; // Last hour
        });
        
        const modules = {};
        recent.forEach(a => {
            if (!modules[a.moduleName]) {
                modules[a.moduleName] = { count: 0, latest: a.assessmentDate };
            }
            modules[a.moduleName].count++;
            if (a.assessmentDate > modules[a.moduleName].latest) {
                modules[a.moduleName].latest = a.assessmentDate;
            }
        });
        
        const moduleOrder = [
            'IngestionAndAppropriateness',
            'StructuralScanner',
            'CitationIntegrity',
            'PdfPageSplitter',
            'WritingIssueScanner',
            'WritingQualitySummary',
            'ArgumentationAndClaimSupportAnalyzer',
            'MethodologyQualityAnalyzer',
            'DatasetAndDataReliabilityAnalyzer',
            'NoveltyAndContributionAnalyzer',
            'LiteratureReviewAnalyzer',
            'AIBC-CoherenceAnalyzer',
            'ResultsAndStatisticalSoundnessAnalyzer',
            'RobustnessAndGeneralizationAnalyzer',
            'EthicsReproducibilityTransparencyAnalyzer',
            'FinalReportComposer',
            'PDFReportLayoutGenerator'
        ];
        
        moduleOrder.forEach((name, idx) => {
            const mod = modules[name];
            if (mod) {
                const time = new Date(mod.latest).toLocaleTimeString();
                console.log(\`   \${(idx+1).toString().padStart(2)}\. \${name.padEnd(45)} ✓ (\${mod.count} runs, latest: \${time})\`);
            } else {
                console.log(\`   \${(idx+1).toString().padStart(2)}\. \${name.padEnd(45)} ⏳ Pending\`);
            }
        });
        " 2>/dev/null || echo "   Error reading assessments"
    else
        echo "   No assessments file found"
    fi
    echo ""
    
    # Show file generation status
    echo "--- Generated Files ---"
    if [ -d "data/reports" ]; then
        echo "   LaTeX files:"
        ls -lth data/reports/*.tex 2>/dev/null | head -3 | awk '{print "      "$9" ("$5" - "$6" "$7" "$8")"}' || echo "      None"
        echo "   PDF files:"
        ls -lth data/reports/*.pdf 2>/dev/null | head -3 | awk '{print "      "$9" ("$5" - "$6" "$7" "$8")"}' || echo "      None"
    fi
    echo ""
    
    # Check for errors
    if [ -f "$LOG_FILE" ]; then
        ERROR_COUNT=$(grep -c "❌\|Error\|failed" "$LOG_FILE" 2>/dev/null || echo "0")
        if [ "$ERROR_COUNT" -gt 0 ]; then
            echo "--- Recent Errors ---"
            grep "❌\|Error\|failed" "$LOG_FILE" 2>/dev/null | tail -3 | sed 's/^/   /'
            echo ""
        fi
    fi
    
    # Check completion
    if [ -f "$LOG_FILE" ]; then
        if grep -q "🎉\|Pipeline completed\|PDF generated" "$LOG_FILE" 2>/dev/null; then
            echo "=========================================="
            echo "✅ PIPELINE COMPLETED!"
            echo "=========================================="
            grep "🎉\|Pipeline completed\|PDF generated" "$LOG_FILE" 2>/dev/null | tail -5 | sed 's/^/   /'
            return 1
        elif grep -q "Pipeline failed" "$LOG_FILE" 2>/dev/null; then
            echo "=========================================="
            echo "❌ PIPELINE FAILED!"
            echo "=========================================="
            grep "Pipeline failed" "$LOG_FILE" 2>/dev/null | tail -5 | sed 's/^/   /'
            return 1
        fi
    fi
    
    return 0
}

# Monitor loop
echo "Starting real-time monitoring..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
    show_status
    if [ $? -eq 1 ]; then
        break
    fi
    sleep 2
done

echo ""
echo "Monitoring stopped."


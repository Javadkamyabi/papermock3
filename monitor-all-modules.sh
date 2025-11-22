#!/bin/bash
# Monitor all modules test execution

LOG_FILE="/tmp/full-pipeline-all-modules-test.log"

echo "=========================================="
echo "All Modules Test Monitor"
echo "=========================================="
echo ""

while true; do
    clear
    echo "=========================================="
    echo "All Modules Test - $(date '+%H:%M:%S')"
    echo "=========================================="
    echo ""
    
    # Check if pipeline is running
    if ps aux | grep -q "[r]un-full-pipeline"; then
        echo "✅ Pipeline RUNNING"
        ps aux | grep "[r]un-full-pipeline" | grep -v grep | head -1 | awk '{print "   PID: "$2" | CPU: "$3"% | MEM: "$4"%"}'
    else
        echo "❌ Pipeline NOT running"
    fi
    
    echo ""
    echo "=== Progress ==="
    completed=$(grep -c "✓ Module.*completed" "$LOG_FILE" 2>/dev/null || echo "0")
    echo "Completed: $completed / 16 modules"
    echo ""
    
    echo "=== Latest Activity ==="
    tail -12 "$LOG_FILE" 2>/dev/null | tail -8
    
    echo ""
    echo "=== Module Status ==="
    modules=("1:IngestionAndAppropriateness" "2:StructuralScanner" "3:CitationIntegrity" "4A:PdfPageSplitter" "4B:WritingIssueScanner" "5:WritingQualitySummary" "6:ArgumentationAnalyzer" "7:MethodologyAnalyzer" "8:DatasetAnalyzer" "9:NoveltyAnalyzer" "10:LiteratureReview" "11:AIBC-Coherence" "12:ResultsAnalyzer" "13:RobustnessAnalyzer" "14:EthicsAnalyzer" "15:FinalReportComposer" "16:PDFLayoutGenerator")
    
    for module in "${modules[@]}"; do
        num=$(echo $module | cut -d: -f1)
        name=$(echo $module | cut -d: -f2)
        if grep -q "Step $num\|Module $num" "$LOG_FILE" 2>/dev/null; then
            if grep -q "✓ Module.*completed" "$LOG_FILE" 2>/dev/null && grep -A 1 "Step $num\|Module $num" "$LOG_FILE" 2>/dev/null | grep -q "✓"; then
                echo "  [$num] $name ✅"
            else
                echo "  [$num] $name ⏳ Running..."
            fi
        else
            echo "  [$num] $name ⏸️  Pending"
        fi
    done
    
    echo ""
    
    # Check for completion or failure
    if grep -q "🎉\|Pipeline completed\|PDF generated" "$LOG_FILE" 2>/dev/null; then
        echo "✅ PIPELINE COMPLETED!"
        echo ""
        tail -20 "$LOG_FILE" 2>/dev/null | tail -15
        break
    elif grep -q "Pipeline failed" "$LOG_FILE" 2>/dev/null; then
        echo "❌ PIPELINE FAILED"
        echo ""
        tail -15 "$LOG_FILE" 2>/dev/null
        break
    fi
    
    echo "Refreshing in 5 seconds... (Ctrl+C to stop)"
    sleep 5
done

echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="


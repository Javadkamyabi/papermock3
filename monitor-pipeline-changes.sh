#!/bin/bash
# Pipeline monitor that updates only on changes - shows current module and step

LOG_FILE="/tmp/full-pipeline-final.log"
LAST_SIZE=0

echo "=========================================="
echo "Pipeline Progress Monitor"
echo "=========================================="
echo "Watching for changes in pipeline execution..."
echo ""

show_progress() {
    local current_size=$(wc -c < "$LOG_FILE" 2>/dev/null || echo "0")
    
    if [ "$current_size" -gt "$LAST_SIZE" ]; then
        clear
        echo "=========================================="
        echo "Pipeline Progress - $(date '+%H:%M:%S')"
        echo "=========================================="
        echo ""
        
        # Extract current step and module
        local current_line=$(tail -1 "$LOG_FILE" 2>/dev/null)
        local step_info=$(grep -E "Step [0-9]+/16" "$LOG_FILE" 2>/dev/null | tail -1)
        local completed_modules=$(grep -c "✓ Module.*completed" "$LOG_FILE" 2>/dev/null || echo "0")
        local failed=$(grep -c "❌\|Pipeline failed" "$LOG_FILE" 2>/dev/null || echo "0")
        
        echo "📍 CURRENT STATUS:"
        if [ "$failed" -gt 0 ]; then
            echo "   ❌ PIPELINE FAILED"
            echo ""
            echo "   Last error:"
            grep "❌\|Pipeline failed\|Error:" "$LOG_FILE" 2>/dev/null | tail -1 | sed 's/^/   /'
        elif grep -q "🎉\|Pipeline completed\|PDF generated" "$LOG_FILE" 2>/dev/null; then
            echo "   ✅ PIPELINE COMPLETED!"
            echo ""
            echo "   Final status:"
            grep "🎉\|Pipeline completed\|PDF generated" "$LOG_FILE" 2>/dev/null | tail -3 | sed 's/^/   /'
        else
            echo "   🔄 RUNNING"
            echo ""
            if [ -n "$step_info" ]; then
                echo "   $step_info" | sed 's/^/   /'
            fi
            echo "   Completed modules: $completed_modules / 16"
        fi
        echo ""
        
        echo "--- Current Activity ---"
        tail -5 "$LOG_FILE" 2>/dev/null | sed 's/^/   /'
        echo ""
        
        echo "--- Module Progress ---"
        local modules=(
            "1:IngestionAndAppropriateness"
            "2:StructuralScanner"
            "3:CitationIntegrity"
            "4A:PdfPageSplitter"
            "4B:WritingIssueScanner"
            "5:WritingQualitySummary"
            "6:ArgumentationAndClaimSupportAnalyzer"
            "7:MethodologyQualityAnalyzer"
            "8:DatasetAndDataReliabilityAnalyzer"
            "9:NoveltyAndContributionAnalyzer"
            "10:LiteratureReviewAnalyzer"
            "11:AIBC-CoherenceAnalyzer"
            "12:ResultsAndStatisticalSoundnessAnalyzer"
            "13:RobustnessAndGeneralizationAnalyzer"
            "14:EthicsReproducibilityTransparencyAnalyzer"
            "15:FinalReportComposer"
            "16:PDFReportLayoutGenerator"
        )
        
        for module_info in "${modules[@]}"; do
            local num=$(echo "$module_info" | cut -d: -f1)
            local name=$(echo "$module_info" | cut -d: -f2)
            
            if grep -q "✓ Module $num\|✓ $name\|Step $num/16.*completed" "$LOG_FILE" 2>/dev/null; then
                echo "   [$num] $name  ✅ COMPLETED"
            elif grep -q "Step $num/16\|Module $num\|$name" "$LOG_FILE" 2>/dev/null | grep -q "Running\|Processing"; then
                echo "   [$num] $name  🔄 RUNNING NOW"
            elif [ "$completed_modules" -ge "$num" ] 2>/dev/null; then
                echo "   [$num] $name  ✅ COMPLETED"
            else
                echo "   [$num] $name  ⏳ PENDING"
            fi
        done
        echo ""
        
        # Show process info
        if ps aux | grep -q "[r]un-full-pipeline"; then
            local pid=$(ps aux | grep "[r]un-full-pipeline" | grep -v grep | head -1 | awk '{print $2}')
            local cpu=$(ps aux | grep "[r]un-full-pipeline" | grep -v grep | head -1 | awk '{print $3}')
            local mem=$(ps aux | grep "[r]un-full-pipeline" | grep -v grep | head -1 | awk '{print $4}')
            echo "--- Process Info ---"
            echo "   PID: $pid | CPU: $cpu% | MEM: $mem%"
        else
            echo "--- Process Info ---"
            echo "   ❌ Process not running"
        fi
        echo ""
        
        LAST_SIZE=$current_size
        return 0
    fi
    
    return 1
}

# Initial display
if [ -f "$LOG_FILE" ]; then
    show_progress
fi

# Watch for changes
echo "Monitoring started. Waiting for pipeline activity..."
echo ""

while true; do
    if [ -f "$LOG_FILE" ]; then
        if show_progress; then
            echo "⏱️  Waiting for next update..."
        fi
    else
        echo "⏳ Waiting for log file to be created..."
    fi
    
    # Check if pipeline finished
    if [ -f "$LOG_FILE" ]; then
        if grep -q "🎉\|Pipeline completed\|PDF generated" "$LOG_FILE" 2>/dev/null; then
            show_progress
            echo ""
            echo "=========================================="
            echo "✅ MONITORING COMPLETE - Pipeline finished!"
            echo "=========================================="
            break
        elif grep -q "Pipeline failed" "$LOG_FILE" 2>/dev/null; then
            show_progress
            echo ""
            echo "=========================================="
            echo "❌ MONITORING COMPLETE - Pipeline failed!"
            echo "=========================================="
            break
        fi
    fi
    
    sleep 1
done


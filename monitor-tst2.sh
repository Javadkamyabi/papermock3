#!/bin/bash
# Monitor TST2.pdf pipeline execution

LOG_FILE="/tmp/pipeline-tst2.log"

echo "=========================================="
echo "TST2.pdf Pipeline Monitor"
echo "=========================================="
echo ""

while true; do
    clear
    echo "=========================================="
    echo "TST2.pdf Pipeline - $(date '+%H:%M:%S')"
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
    for i in {1..16}; do
        if grep -q "Step $i" "$LOG_FILE" 2>/dev/null; then
            if grep -A 1 "Step $i" "$LOG_FILE" 2>/dev/null | grep -q "✓"; then
                echo "  [$i] ✅"
            else
                echo "  [$i] ⏳ Running..."
            fi
        else
            echo "  [$i] ⏸️  Pending"
        fi
    done
    
    echo ""
    
    # Check for errors
    if grep -qi "error\|failed\|exception" "$LOG_FILE" 2>/dev/null | tail -1; then
        echo "⚠️  ERRORS DETECTED!"
        grep -i "error\|failed" "$LOG_FILE" 2>/dev/null | tail -3
    fi
    
    # Check for completion or failure
    if grep -q "🎉\|Pipeline completed\|PDF generated\|pdf_path" "$LOG_FILE" 2>/dev/null; then
        echo "✅ PIPELINE COMPLETED!"
        echo ""
        tail -20 "$LOG_FILE" 2>/dev/null | tail -15
        
        # Extract PDF path
        PDF_PATH=$(grep -o "pdf_path.*\|PDF.*data/reports.*\.pdf" "$LOG_FILE" 2>/dev/null | tail -1)
        if [ -n "$PDF_PATH" ]; then
            echo ""
            echo "📄 PDF Location: $PDF_PATH"
        fi
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
echo "Monitor Complete!"
echo "=========================================="


#!/bin/bash
# Monitor the full pipeline test

LOG_FILE="/tmp/full-pipeline-test-all.log"

echo "=========================================="
echo "Pipeline Test Monitor"
echo "=========================================="
echo ""

while true; do
    clear
    echo "=========================================="
    echo "Pipeline Test Monitor - $(date '+%H:%M:%S')"
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
    tail -10 "$LOG_FILE" 2>/dev/null | grep -E "(Step|completed|failed|Pipeline|PDF|✓|❌)" | tail -5
    
    echo ""
    echo "=== Module Status ==="
    for i in {1..16}; do
        if grep -q "Step $i" "$LOG_FILE" 2>/dev/null; then
            if grep -q "✓ Module.*completed" "$LOG_FILE" 2>/dev/null && grep -A 1 "Step $i" "$LOG_FILE" 2>/dev/null | grep -q "✓"; then
                echo "  [$i] ✅"
            else
                echo "  [$i] ⏳ Running..."
            fi
        else
            echo "  [$i] ⏸️  Pending"
        fi
    done
    
    echo ""
    
    # Check for completion or failure
    if grep -q "🎉\|Pipeline completed\|PDF generated" "$LOG_FILE" 2>/dev/null; then
        echo "✅ PIPELINE COMPLETED!"
        tail -15 "$LOG_FILE" 2>/dev/null
        break
    elif grep -q "Pipeline failed" "$LOG_FILE" 2>/dev/null; then
        echo "❌ PIPELINE FAILED"
        tail -10 "$LOG_FILE" 2>/dev/null
        break
    fi
    
    echo "Waiting 5 seconds..."
    sleep 5
done


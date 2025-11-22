#!/bin/bash
# Update all modules with accuracy rules

MODULES=(
  "src/modules/ingestion-appropriateness.ts"
  "src/modules/structural-scanner.ts"
  "src/modules/citation-integrity.ts"
  "src/modules/writing-issue-scanner.ts"
  "src/modules/writing-quality-summary.ts"
  "src/modules/argumentation-analyzer.ts"
  "src/modules/methodology-quality-analyzer.ts"
  "src/modules/dataset-reliability-analyzer.ts"
  "src/modules/novelty-contribution-analyzer.ts"
  "src/modules/literature-review-analyzer.ts"
  "src/modules/aibc-coherence-analyzer.ts"
  "src/modules/results-statistical-analyzer.ts"
  "src/modules/robustness-generalization-analyzer.ts"
  "src/modules/ethics-reproducibility-analyzer.ts"
  "src/modules/final-report-composer.ts"
)

for module in "${MODULES[@]}"; do
  if [ -f "$module" ]; then
    # Check if already has accuracy rules import
    if ! grep -q "accuracy-rules" "$module"; then
      # Add import after other imports
      sed -i '' '/^import.*from.*types.*index\.js/a\
import { getAccuracyRulesSystemAddition } from '\''../config/accuracy-rules.js'\'';
' "$module" 2>/dev/null || echo "Could not add import to $module"
    fi
    
    # Add accuracy rules to system prompt
    if grep -q "const systemPrompt = \`" "$module"; then
      # Add after systemPrompt definition
      sed -i '' 's/const systemPrompt = `\([^`]*\)`;/const systemPrompt = `\1${getAccuracyRulesSystemAddition()}`;/' "$module" 2>/dev/null || echo "Could not update systemPrompt in $module"
    fi
  fi
done

echo "✅ Modules updated"

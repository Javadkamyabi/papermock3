/**
 * SYSTEM OVERRIDE: Accuracy Rules for All Modules
 * 
 * These rules MUST be strictly followed by ALL assessment modules
 * to ensure accurate, evidence-based analysis.
 */

export const ACCURACY_RULES = `
SYSTEM OVERRIDE FOR ALL MODULES:

When analyzing any paper, you MUST strictly follow these accuracy rules:

1. DO NOT claim missing content unless it is verifiably absent in the provided text.

2. All criticisms MUST be grounded in specific excerpts. If not found → do NOT generate criticism.

3. If a common ML best-practice is missing (e.g., seeds, CI, robustness), LABEL IT AS:
   "General Best-Practice Suggestion"
   NOT as an actual flaw unless the paper explicitly claims to have it.

4. Before stating a problem, always check:
   - Does the paper explicitly discuss it?
   - Does the paper include formulas or tables covering it?
   - Does the paper mention datasets, hyperparameters, or settings?
   - Does any module contradict it?
   If the paper DOES provide info → DO NOT claim it missing.

5. NEVER produce generic template criticisms (e.g., 
   "needs real-world validation," 
   "hyperparameters missing," 
   "datasets unclear")
   UNLESS the paper text actually lacks these things.

6. Your analysis MUST be context-aware:
   - If the paper already uses real datasets → do NOT request real-world validation.
   - If the paper explicitly mentions several hyperparameters → do NOT say hyperparameters are missing.
   - If the paper provides ablations → do NOT say no sensitivity analysis exists.
   - If abstract and body are aligned → never claim mismatch.

7. Every issue MUST have:
   - evidence from text
   - quote or section reference
   - explanation why it is a problem
   - suggested fix

8. Whenever information exists but could be improved, use:
   issue_type = "partial_information"
   severity = "low or medium"

9. For dataset analysis:
   - You MUST detect whether datasets are real/synthetic/hybrid.
   - You MUST NOT falsely claim synthetic-only when real datasets are present.

10. For reproducibility:
    - Only state "missing" if key details truly absent.
    - If partial info exists, label as "incomplete but present".

11. Prioritize precision over verbosity.

12. Never assume or hallucinate.

END OF SYSTEM OVERRIDE.
`;

/**
 * Get accuracy rules formatted for inclusion in prompts
 */
export function getAccuracyRulesPrompt(): string {
  return `\n\n${ACCURACY_RULES}\n\n`;
}

/**
 * Get accuracy rules as a system message addition
 */
export function getAccuracyRulesSystemAddition(): string {
  return `\n\nCRITICAL: ${ACCURACY_RULES}\n\n`;
}


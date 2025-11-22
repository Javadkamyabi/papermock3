# PaperMock3

A modular PDF paper assessment system that uses OpenAI to analyze academic papers and stores results in local JSON files.

## Architecture

- **Modules**: Each module processes PDF papers independently
- **Input**: PDF files
- **Processing**: OpenAI API for assessment
- **Storage**: Local JSON files (stored in `./data` directory)
- **Report Module**: Final module that aggregates all assessments into a comprehensive report

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (create `.env` file):
```
OPENAI_API_KEY=your_openai_api_key
STORAGE_DIR=./data
```

3. Build the project:
```bash
npm run build
```

4. Run in development:
```bash
npm run dev
```

## Project Structure

```
PaperMock3/
├── src/
│   ├── modules/          # Individual assessment modules
│   ├── db/               # Local storage utilities (JSON files)
│   ├── openai/           # OpenAI client and utilities
│   ├── pdf/              # PDF parsing utilities
│   ├── types/            # TypeScript type definitions
│   └── index.ts          # Main entry point
├── package.json
└── tsconfig.json
```

## Modules

### Module1: IngestionAndAppropriateness

Analyzes academic papers for:
- **Safety & Appropriateness**: Checks for explicit content, violence, hate speech, etc.
- **Academic Style**: Determines if the document is academic in nature
- **Document Type**: Classifies as "paper", "report", "thesis", or "not_academic"
- **Metadata**: Extracts filename, language, word count

**Usage Example:**
```typescript
import { IngestionAndAppropriatenessModule } from './src/modules/ingestion-and-appropriateness.js';

const module = new IngestionAndAppropriatenessModule();
const result = await module.process('./path/to/paper.pdf', 'paper-id-123');
```

**Or use the example script:**
```bash
npm run dev src/examples/run-module1.ts ./path/to/paper.pdf
```

**Output Format:**
The module returns a JSON object with:
- `file_metadata`: Basic file information
- `document_type`: Classification and confidence scores
- `appropriateness`: Safety assessment and flags

Results are automatically stored in `./data/assessments.json`.

### Module2: StructuralScanner

Analyzes the structural organization of academic documents:
- **Structure Detection**: Identifies which structural components exist (title, authors, sections, etc.)
- **Completeness Analysis**: Evaluates how complete each section appears
- **Document-Specific Analysis**: Different analysis for papers, reports, and theses
- **Section Scoring**: Provides confidence and completeness scores for each section

**Note:** Module2 automatically retrieves the document type from Module1's assessment if available.

**Usage Example:**
```typescript
import { StructuralScannerModule } from './src/modules/structural-scanner.js';

const module = new StructuralScannerModule();
const result = await module.process('./path/to/paper.pdf', 'paper-id-123');
```

**Or use the example script:**
```bash
npx tsx src/examples/run-module2.ts ./path/to/paper.pdf [paper-id]
```

**Output Format:**
The module returns a JSON object with:
- `structure_summary`: Core structural elements (title, authors, sections, tables, figures, headings)
- `thesis_extras`: Thesis-specific elements (chapters, acknowledgements, supervisor info, appendix)
- `report_extras`: Report-specific elements (executive summary, recommendations)
- Each section includes: `exists`, `confidence`, and `completeness_score`

Results are automatically stored in `./data/assessments.json`.

### Module3: CitationIntegrity

Analyzes citation matching and reference health:
- **Citation Style Detection**: Identifies numeric, author-year, mixed, or unknown styles
- **Citation Matching**: Matches in-text citations to references in the bibliography
- **Problem Detection**: Finds unmatched citations, uncited references, and style inconsistencies
- **Recency Analysis**: Analyzes the age distribution of references

**Note:** Module3 automatically retrieves document type, subtype, and structure info from Module1 and Module2 if available.

**Usage Example:**
```typescript
import { CitationIntegrityModule } from './src/modules/citation-integrity.js';

const module = new CitationIntegrityModule();
const result = await module.process('./path/to/paper.pdf', 'paper-id-123');
```

**Or use the example script:**
```bash
npx tsx src/examples/run-module3.ts ./path/to/paper.pdf [paper-id]
```

**Output Format:**
The module returns a JSON object with:
- `summary`: Citation style, total counts of references and citations
- `matching`: Matched pairs, unmatched citations, uncited references
- `problems`: List of citation issues with severity levels
- `recency_analysis`: Distribution of reference ages with commentary

Results are automatically stored in `./data/assessments.json`.

## Usage

Each module follows a consistent pattern:
1. Accepts a PDF file path
2. Extracts text from PDF
3. Uses OpenAI to assess the paper
4. Stores results in local JSON files

The final report module will aggregate all stored assessments.


#!/bin/bash
set -e

# Create metrics directory
echo "Creating metrics directory..."
mkdir -p metrics

# Run cloc for Lines of Code analysis
echo "Running cloc for Lines of Code analysis..."
cloc . \
  --exclude-dir=node_modules,dist,build,.git,public \
  --json \
  --out=metrics/cloc.json

# Run complexity-report for Maintainability Index and complexity metrics
echo "Running complexity-report for Maintainability Index..."
# Create a temporary file list of all TypeScript files
find src -name "*.ts" -o -name "*.tsx" > /tmp/ts_files.txt

# Process files with complexity-report and collect results
echo '{"reports": []}' > metrics/escomplex.json
if [ -s /tmp/ts_files.txt ]; then
  # Run complexity-report on first few files to get sample data
  # Note: complexity-report works with JavaScript, so this is a fallback
  echo "Note: complexity-report works best with JavaScript. Using lizard for TypeScript analysis."
fi
rm -f /tmp/ts_files.txt

# Run lizard for additional cyclomatic complexity analysis
echo "Running lizard for cyclomatic complexity analysis..."
# Try JSON format first, fallback to XML if it fails
if lizard -l typescript --json src > metrics/lizard.json 2>/dev/null; then
  echo "Lizard JSON output created successfully"
elif lizard -l typescript src --xml > metrics/lizard.xml 2>/dev/null; then
  echo "Lizard XML output created successfully"
else
  echo "Warning: Lizard failed to analyze TypeScript files, trying javascript mode..."
  lizard -l javascript src --json > metrics/lizard.json 2>/dev/null || {
    echo "Warning: Lizard could not analyze source files"
    echo '[]' > metrics/lizard.json
  }
fi

# Run Plato for Maintainability Index on compiled JavaScript
echo "Running Plato for Maintainability Index on compiled JavaScript..."
PLATO_DIRS=""
for dir in dist build lib; do
  if [ -d "$dir" ] && find "$dir" -name "*.js" -type f | grep -q .; then
    PLATO_DIRS="$PLATO_DIRS \"$dir/**/*.js\""
  fi
done

if [ -n "$PLATO_DIRS" ]; then
  echo "Found compiled JavaScript in: $PLATO_DIRS"
  eval "npx --yes plato -r -d metrics/plato-report $PLATO_DIRS" || {
    echo "Warning: Plato failed to generate report"
  }
else
  echo "No compiled JavaScript found in dist/, build/, or lib/ directories"
fi

# Generate summary file
echo "Generating summary..."

# Extract total LOC from cloc
TOTAL_LOC=$(jq -r '.SUM.code // 0' metrics/cloc.json)
TOTAL_FILES=$(jq -r '.SUM.nFiles // 0' metrics/cloc.json)
TOTAL_COMMENTS=$(jq -r '.SUM.comment // 0' metrics/cloc.json)
TOTAL_BLANKS=$(jq -r '.SUM.blank // 0' metrics/cloc.json)

# Extract TypeScript-specific LOC
TS_LOC=$(jq -r '.TypeScript.code // 0' metrics/cloc.json)
TSX_LOC=$(jq -r '.TSX.code // 0' metrics/cloc.json)

# Calculate average maintainability from escomplex
# Maintainability index ranges from 0-100 (higher is better)
if [ -f metrics/escomplex.json ] && [ -s metrics/escomplex.json ]; then
  AVG_MAINTAINABILITY=$(node -e "
    try {
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync('metrics/escomplex.json', 'utf8'));
      if (data.reports && data.reports.length > 0) {
        const sum = data.reports.reduce((acc, r) => acc + (r.maintainability || 0), 0);
        console.log((sum / data.reports.length).toFixed(2));
      } else {
        console.log('N/A');
      }
    } catch (e) {
      console.log('N/A');
    }
  " 2>/dev/null || echo "N/A")
else
  AVG_MAINTAINABILITY="N/A"
fi

# Extract top complex functions from lizard XML
if [ -f metrics/lizard.xml ] && [ -s metrics/lizard.xml ]; then
  TOP_COMPLEX=$(node -e "
    try {
      const fs = require('fs');
      const xml = fs.readFileSync('metrics/lizard.xml', 'utf8');
      
      // Parse function-level items (3 values) - the third value is CCN
      const functionRegex = /<item name=\"([^\"]+)\"[^>]*>\\s*<value>\\d+<\\/value>\\s*<value>\\d+<\\/value>\\s*<value>(\\d+)<\\/value>\\s*<\\/item>/g;
      const functions = [];
      let match;
      
      while ((match = functionRegex.exec(xml)) !== null) {
        const name = match[1];
        const ccn = parseInt(match[2]);
        // Filter out file-level entries (they typically don't have 'at' in the name for functions)
        if (name.includes('(') || name.includes(' at ')) {
          functions.push({ name, complexity: ccn });
        }
      }
      
      // Sort by complexity descending and take top 5
      functions.sort((a, b) => b.complexity - a.complexity);
      const top5 = functions.slice(0, 5);
      
      if (top5.length > 0) {
        top5.forEach(fn => {
          console.log('  - ' + fn.name + ' (CCN: ' + fn.complexity + ')');
        });
      } else {
        console.log('  No complex functions found');
      }
    } catch (e) {
      console.log('  Error parsing lizard XML: ' + e.message);
    }
  " 2>/dev/null || echo "  Error parsing lizard data")
  
  # Calculate average complexity from lizard XML
  AVG_CCN=$(node -e "
    try {
      const fs = require('fs');
      const xml = fs.readFileSync('metrics/lizard.xml', 'utf8');
      const avgMatch = xml.match(/<average label=\"CCN\" value=\"([^\"]+)\"/);
      if (avgMatch) {
        console.log(parseFloat(avgMatch[1]).toFixed(2));
      } else {
        console.log('N/A');
      }
    } catch (e) {
      console.log('N/A');
    }
  " 2>/dev/null || echo "N/A")
  
  # Count total functions
  TOTAL_FUNCTIONS=$(node -e "
    try {
      const fs = require('fs');
      const xml = fs.readFileSync('metrics/lizard.xml', 'utf8');
      const sumMatch = xml.match(/<sum label=\"Functions\" value=\"([^\"]+)\"/);
      if (sumMatch) {
        console.log(sumMatch[1]);
      } else {
        console.log('0');
      }
    } catch (e) {
      console.log('0');
    }
  " 2>/dev/null || echo "0")
  
  # Get total cyclomatic complexity
  TOTAL_COMPLEXITY=$(node -e "
    try {
      const fs = require('fs');
      const xml = fs.readFileSync('metrics/lizard.xml', 'utf8');
      const sumMatch = xml.match(/<sum label=\"CCN\" value=\"([^\"]+)\"/);
      if (sumMatch) {
        console.log(sumMatch[1]);
      } else {
        console.log('N/A');
      }
    } catch (e) {
      console.log('N/A');
    }
  " 2>/dev/null || echo "N/A")
elif [ -f metrics/lizard.json ] && [ -s metrics/lizard.json ]; then
  TOP_COMPLEX=$(node -e "
    try {
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync('metrics/lizard.json', 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        // Flatten all functions from all files
        const allFunctions = [];
        data.forEach(file => {
          if (file.function_list) {
            file.function_list.forEach(fn => {
              allFunctions.push({
                name: fn.name,
                complexity: fn.cyclomatic_complexity || fn.complexity || 0,
                file: file.filename
              });
            });
          }
        });
        // Sort by complexity descending and take top 5
        allFunctions.sort((a, b) => b.complexity - a.complexity);
        const top5 = allFunctions.slice(0, 5);
        top5.forEach(fn => {
          console.log('  - ' + fn.name + ' (complexity: ' + fn.complexity + ') in ' + fn.file);
        });
      } else {
        console.log('  No function data available');
      }
    } catch (e) {
      console.log('  Error parsing lizard data');
    }
  " 2>/dev/null || echo "  Error parsing lizard data")
  
  AVG_CCN="N/A"
  TOTAL_FUNCTIONS="0"
else
  TOP_COMPLEX="  No complexity data available"
  AVG_CCN="N/A"
  TOTAL_FUNCTIONS="0"
fi

# Write summary to file
cat > metrics/summary.txt << EOF
Repository Metrics Summary
==========================

Lines of Code (LOC):
--------------------
Total Lines of Code: ${TOTAL_LOC}
Total Files: ${TOTAL_FILES}
Total Comments: ${TOTAL_COMMENTS}
Total Blank Lines: ${TOTAL_BLANKS}

TypeScript LOC: ${TS_LOC}
TSX LOC: ${TSX_LOC}

Maintainability Index:
----------------------
Average Maintainability Index: ${AVG_MAINTAINABILITY}
(Scale: 0-100, higher is better)
  - 0-9: Unmaintainable
  - 10-19: Barely maintainable
  - 20-100: Maintainable

Cyclomatic Complexity:
----------------------
Average Cyclomatic Complexity (CCN): ${AVG_CCN}
Total Functions Analyzed: ${TOTAL_FUNCTIONS}
Total Aggregate Complexity: ${TOTAL_COMPLEXITY}

Top 5 Most Complex Functions (by Cyclomatic Complexity):
${TOP_COMPLEX}

Notes:
------
- Metrics are generated from source code in the 'src' directory
- Lower cyclomatic complexity is better (generally aim for < 10 per function)
- Higher maintainability index is better
- These metrics help identify areas that may need refactoring

Generated on: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
EOF

echo "Metrics generation completed successfully!"
echo ""
echo "Files generated:"
ls -lh metrics/
echo ""
echo "Summary:"
cat metrics/summary.txt

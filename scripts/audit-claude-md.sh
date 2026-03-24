#!/bin/bash
set -e

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CLAUDE_MD="$PROJECT_ROOT/CLAUDE.md"
BACKUP_DIR="$PROJECT_ROOT/.claude-md-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔍 CLAUDE.md Audit Starting...${NC}"
echo "   Project: $PROJECT_ROOT"
echo ""

if ! command -v claude &> /dev/null; then
    echo -e "${RED}❌ Claude Code CLI not found. Install: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi

if [ -f "$CLAUDE_MD" ]; then
    mkdir -p "$BACKUP_DIR"
    cp "$CLAUDE_MD" "$BACKUP_DIR/CLAUDE.md.$TIMESTAMP.bak"
    echo -e "${YELLOW}📦 Backed up current CLAUDE.md${NC}"
fi

AUDIT_PROMPT='Read the full codebase structure first — scan all directories, key files, configs, package.json (or equivalent), and any existing documentation. Then read the CLAUDE.md file in its entirety. If no CLAUDE.md exists, say so and generate one from scratch.

Once you have read both, produce a CLAUDE.md AUDIT REPORT with these sections:

## 1. WHAT IS THERE
Summarize what the current CLAUDE.md covers. Be specific — list each section/topic it addresses.

## 2. ACCURACY CHECK
Flag anything in the CLAUDE.md that contradicts what you see in the actual codebase:
- Wrong file paths or directory structures
- Outdated dependency versions or removed packages
- Commands that would not work based on current configs
- References to files, functions, or patterns that no longer exist
- Architectural descriptions that do not match the code

## 3. WHAT IS MISSING
Based on what you found in the codebase, identify gaps. A complete CLAUDE.md should cover ALL of the following that apply to this project:

**Project Identity**
- What this project IS in one paragraph (not marketing copy — what does it actually do)
- Tech stack with specific versions
- Target platform(s)

**Architecture**
- Directory structure with purpose of each top-level folder
- Key architectural patterns used (state management, routing, data flow)
- Where the entry point is and how the app boots
- Database schema or data model overview (if applicable)
- API structure or endpoint map (if applicable)

**Development**
- How to install and run locally (exact commands, not the usual way)
- Environment variables needed (with descriptions, not just names)
- How to run tests
- Build and deploy process
- Common gotchas or things that break in non-obvious ways

**Code Conventions**
- Naming conventions actually used in the codebase (not aspirational)
- File organization patterns (where new files of type X should go)
- Import/export patterns
- Error handling approach
- How state is managed and where

**AI Collaboration Rules**
- What Claude should NEVER do in this project
- What Claude should ALWAYS do
- Known fragile areas where extra caution is needed
- Preferred libraries — what to use and what NOT to use
- Testing expectations (write tests? what kind? where?)

**Current State**
- What is working and stable
- What is in progress or broken
- Known technical debt or TODOs
- Recent major changes that affect how the code should be approached

## 4. RECOMMENDED CLAUDE.md
Now write the complete, updated CLAUDE.md file and save it to CLAUDE.md. Do not pad it. Every line should be something that would actually help an AI or a new developer work on this codebase correctly. Cut anything generic that does not apply to THIS specific project.'

echo -e "${GREEN}🤖 Running Claude Code audit...${NC}"
echo ""

cd "$PROJECT_ROOT"
claude -p "$AUDIT_PROMPT" --allowedTools "View,Read,Write,Edit"

echo ""
echo -e "${GREEN}✅ Audit complete.${NC}"

if [ -f "$BACKUP_DIR/CLAUDE.md.$TIMESTAMP.bak" ] && [ -f "$CLAUDE_MD" ]; then
    echo ""
    echo -e "${YELLOW}📊 Changes from previous version:${NC}"
    diff --color=auto "$BACKUP_DIR/CLAUDE.md.$TIMESTAMP.bak" "$CLAUDE_MD" || true
fi

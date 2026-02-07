/**
 * Claude Code Session Parser
 *
 * Reads and parses Claude Code conversation history from ~/.claude/
 */
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')

// --- Types ---

export interface ClaudeProject {
	name: string
	path: string
	dirName: string
	fullPath: string
}

export interface ClaudeSession {
	sessionId: string
	firstPrompt: string
	summary: string
	messageCount: number
	created: string
	modified: string
	gitBranch: string
	fullPath: string
}

export interface ParsedMessage {
	type: 'user' | 'assistant'
	content: string
	timestamp?: string
	sessionId: string
}

interface SessionIndexEntry {
	sessionId: string
	fullPath: string
	firstPrompt: string
	summary?: string
	messageCount: number
	created: string
	modified: string
	gitBranch?: string
}

interface SessionIndex {
	version: number
	entries: SessionIndexEntry[]
	originalPath: string
}

interface RawMessage {
	type: string
	message?: {
		content?: Array<{
			type: string
			text?: string
		}>
	}
	timestamp?: number
	sessionId?: string
}

// --- Functions ---

/**
 * Decode an encoded project directory name back to a filesystem path.
 *
 * Claude Code encodes paths by replacing `/` and `.` with `-`, making the
 * encoding ambiguous (a `-` could be a former `/`, former `.`, or literal `-`).
 * We resolve the ambiguity by walking the filesystem and greedily matching
 * the longest existing directory name at each level.
 *
 * Examples:
 *   -Users-gaborkerekes-projects-sibyl-memory-mvp
 *   → /Users/gaborkerekes/projects/sibyl-memory-mvp
 *
 *   -Users-gaborkerekes--config-nvim
 *   → /Users/gaborkerekes/.config/nvim   (`--` means `/.`)
 */
async function decodeProjectPath(encoded: string): Promise<string> {
	const raw = encoded.replace(/^-/, '')
	const rawParts = raw.split('-')

	// `--` in the encoding represents `/.` in the original path
	const segments: string[] = []
	for (let i = 0; i < rawParts.length; i++) {
		if (rawParts[i] === '' && i + 1 < rawParts.length) {
			segments.push('.' + rawParts[i + 1])
			i++
		} else if (rawParts[i] !== '') {
			segments.push(rawParts[i])
		}
	}

	// Walk the filesystem trying longest match at each level
	let currentPath = '/'
	let i = 0

	while (i < segments.length) {
		let matched = false
		for (let end = segments.length; end > i; end--) {
			const candidate = segments.slice(i, end).join('-')
			const candidatePath = join(currentPath, candidate)

			try {
				await access(candidatePath)
				currentPath = candidatePath
				i = end
				matched = true
				break
			} catch {
				continue
			}
		}

		if (!matched) {
			// Can't resolve — treat remaining segments as individual components
			for (let j = i; j < segments.length; j++) {
				currentPath = join(currentPath, segments[j])
			}
			break
		}
	}

	return currentPath
}

/**
 * List all Claude Code projects
 */
export async function listClaudeProjects(): Promise<ClaudeProject[]> {
	try {
		const entries = await readdir(PROJECTS_DIR, { withFileTypes: true })

		const projects: ClaudeProject[] = []

		for (const entry of entries) {
			if (entry.isDirectory() && entry.name.startsWith('-')) {
				const decodedPath = await decodeProjectPath(entry.name)

				projects.push({
					name: decodedPath.split('/').pop() || entry.name,
					path: decodedPath,
					dirName: entry.name,
					fullPath: join(PROJECTS_DIR, entry.name),
				})
			}
		}

		return projects.sort((a, b) => a.path.localeCompare(b.path))
	} catch (error) {
		console.error('Error listing Claude projects:', error)
		return []
	}
}

/**
 * Count user messages in a session file (fast scan without full parsing)
 */
async function countUserMessages(sessionFile: string): Promise<number> {
	try {
		const content = await readFile(sessionFile, 'utf-8')
		const lines = content.trim().split('\n')
		let count = 0

		for (const line of lines) {
			try {
				const msg = JSON.parse(line)
				if (msg.type !== 'user') continue

				// Extract text content
				const textContent = msg.message?.content?.find((c: { type: string }) => c.type === 'text')
				if (!textContent?.text) continue

				// Skip system/IDE messages
				if (textContent.text.startsWith('<ide_')) continue
				if (textContent.text.startsWith('<system-reminder>')) continue
				if (textContent.text.startsWith('<command-')) continue

				count++
			} catch {
				// Skip malformed lines
			}
		}

		return count
	} catch {
		return 0
	}
}

/**
 * List all sessions for a Claude project
 */
export async function listClaudeSessions(projectPath: string): Promise<ClaudeSession[]> {
	try {
		const projectDir = join(PROJECTS_DIR, projectPath)

		const indexPath = join(projectDir, 'sessions-index.json')
		const indexContent = await readFile(indexPath, 'utf-8')
		const index: SessionIndex = JSON.parse(indexContent)

		// Get accurate user message counts for each session
		const sessions = await Promise.all(
			index.entries.map(async (entry) => {
				const sessionFile = join(projectDir, `${entry.sessionId}.jsonl`)
				const userMessageCount = await countUserMessages(sessionFile)

				return {
					sessionId: entry.sessionId,
					firstPrompt: entry.firstPrompt || 'No prompt',
					summary: entry.summary || '',
					messageCount: userMessageCount,
					created: entry.created,
					modified: entry.modified,
					gitBranch: entry.gitBranch || '',
					fullPath: entry.fullPath,
				}
			}),
		)

		return sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
	} catch (error) {
		console.error('Error listing Claude sessions:', error)
		return []
	}
}

/**
 * Parse Claude sessions and extract messages
 */
export async function parseClaudeSessions(
	sessionIds: string[],
	options: {
		userMessagesOnly?: boolean
		projectPath?: string
	} = {},
): Promise<ParsedMessage[]> {
	const { userMessagesOnly = true, projectPath } = options

	if (!projectPath) {
		throw new Error('projectPath is required')
	}

	const projectDir = join(PROJECTS_DIR, projectPath)

	const messages: ParsedMessage[] = []

	for (const sessionId of sessionIds) {
		const sessionFile = join(projectDir, `${sessionId}.jsonl`)

		try {
			const content = await readFile(sessionFile, 'utf-8')
			const lines = content.trim().split('\n')

			for (const line of lines) {
				try {
					const msg: RawMessage = JSON.parse(line)

					// Filter by type
					if (userMessagesOnly && msg.type !== 'user') {
						continue
					}

					if (msg.type !== 'user' && msg.type !== 'assistant') {
						continue
					}

					// Extract text content
					const textContent = msg.message?.content?.find((c) => c.type === 'text')
					if (!textContent?.text) {
						continue
					}

					// Skip system/IDE messages
					if (textContent.text.startsWith('<ide_')) {
						continue
					}
					if (textContent.text.startsWith('<system-reminder>')) {
						continue
					}
					if (textContent.text.startsWith('<command-')) {
						continue
					}

					messages.push({
						type: msg.type as 'user' | 'assistant',
						content: textContent.text,
						timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : undefined,
						sessionId,
					})
				} catch {
					// Skip malformed lines
				}
			}
		} catch (error) {
			console.error(`Error parsing session ${sessionId}:`, error)
		}
	}

	return messages
}

/**
 * Get total stats for Claude sessions
 */
export async function getClaudeStats(): Promise<{
	projectCount: number
	totalSessions: number
	totalMessages: number
}> {
	const projects = await listClaudeProjects()

	let totalSessions = 0
	let totalMessages = 0

	for (const project of projects) {
		const sessions = await listClaudeSessions(project.dirName)
		totalSessions += sessions.length
		totalMessages += sessions.reduce((sum, s) => sum + s.messageCount, 0)
	}

	return {
		projectCount: projects.length,
		totalSessions,
		totalMessages,
	}
}

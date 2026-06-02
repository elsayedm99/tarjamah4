// ─────────────────────────────────────────────────────────────
// Tarjama — Project History Service
// Saves/loads project metadata to localStorage for persistence.
// Only stores text data (not the PDF binary) to keep storage small.
// ─────────────────────────────────────────────────────────────

import type { Project } from '../types';

const STORAGE_KEY = 'tarjama_project_history';
const MAX_PROJECTS = 20;

/** Lightweight project summary for the homepage list */
export interface ProjectSummary {
  id: string;
  name: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  totalPages: number;
  translatedPages: number;
  createdAt: number;
  updatedAt: number;
}

/** Get all saved project summaries */
export function getProjectHistory(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectSummary[];
  } catch {
    return [];
  }
}

/** Save or update a project in history */
export function saveProjectToHistory(project: Project): void {
  try {
    const history = getProjectHistory();

    const translatedPages = project.pages.filter(
      (p) => p.status === 'translated' || p.status === 'edited' || p.status === 'reviewed',
    ).length;

    const summary: ProjectSummary = {
      id: project.id,
      name: project.name,
      fileName: project.fileName,
      fileType: project.fileType,
      fileSize: project.fileSize,
      totalPages: project.totalPages,
      translatedPages,
      createdAt: project.createdAt,
      updatedAt: Date.now(),
    };

    // Update existing or add new
    const existingIdx = history.findIndex((p) => p.id === project.id);
    if (existingIdx >= 0) {
      history[existingIdx] = summary;
    } else {
      history.unshift(summary);
    }

    // Keep only the most recent N projects
    const trimmed = history.slice(0, MAX_PROJECTS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save project history:', err);
  }
}

/** Save full project data (for resuming later) */
export function saveFullProject(project: Project): void {
  try {
    const key = `tarjama_project_${project.id}`;
    // Strip large fields that can be regenerated
    const toSave = {
      ...project,
      // Don't save these - they're regenerated on PDF upload
    };
    localStorage.setItem(key, JSON.stringify(toSave));
    saveProjectToHistory(project);
  } catch (err) {
    console.error('Failed to save full project:', err);
  }
}

/** Load a full project by ID */
export function loadFullProject(projectId: string): Project | null {
  try {
    const key = `tarjama_project_${projectId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

/** Remove a project from history and storage */
export function deleteProject(projectId: string): void {
  try {
    // Remove from history
    const history = getProjectHistory().filter((p) => p.id !== projectId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // Remove full data
    localStorage.removeItem(`tarjama_project_${projectId}`);
  } catch (err) {
    console.error('Failed to delete project:', err);
  }
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format relative time */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

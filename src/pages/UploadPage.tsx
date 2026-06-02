import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  Settings,
  Sun,
  Moon,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { SettingsModal } from '../components/settings/SettingsModal';
import { useSettingsStore } from '../store/settingsStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { extractTextFromPdf, getPdfPageCount } from '../services/pdfService';
import { parseDocx } from '../services/docxParserService';
import { generateId } from '../utils/helpers';
import type { Project, PageData } from '../types';

import {
  getProjectHistory,
  loadFullProject,
  deleteProject,
  formatFileSize,
  formatTimeAgo,
} from '../services/projectHistoryService';
import type { ProjectSummary } from '../services/projectHistoryService';

type ProcessingStep = 'idle' | 'reading' | 'extracting' | 'ocr' | 'preparing' | 'done';

interface ProcessingState {
  step: ProcessingStep;
  progress: number;
  message: string;
  fileName?: string;
  fileSize?: number;
}

// ── Recent Projects Component ───────────────────────────────

function RecentProjects({
  navigate,
  setProject,
}: {
  navigate: (path: string) => void;
  setProject: (project: Project | null) => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    setProjects(getProjectHistory());
  }, []);

  if (projects.length === 0) return null;

  const handleResume = (projectId: string) => {
    const project = loadFullProject(projectId);
    if (project) {
      setProject(project);
      toast.success(`Resumed "${project.name}"`);
      navigate(`/project/${project.id}`);
    } else {
      toast.error('Could not load project — data may have been cleared.');
    }
  };

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    toast.info('Project removed from history');
  };

  return (
    <div style={{ maxWidth: '700px', width: '100%', marginTop: 'var(--space-6)' }}>
      <h3
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-3)',
        }}
      >
        Recent Projects
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {projects.map((project) => {
          const progress =
            project.totalPages > 0
              ? Math.round((project.translatedPages / project.totalPages) * 100)
              : 0;

          return (
            <div
              key={project.id}
              onClick={() => handleResume(project.id)}
              className="glass-card"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              {/* File icon */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FileText size={18} style={{ color: 'var(--accent)' }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {project.name}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    gap: 'var(--space-2)',
                    alignItems: 'center',
                  }}
                >
                  <span>{project.totalPages} pages</span>
                  <span>·</span>
                  <span>{formatFileSize(project.fileSize)}</span>
                  <span>·</span>
                  <span>{formatTimeAgo(project.updatedAt)}</span>
                </div>
              </div>

              {/* Progress badge */}
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-semibold)',
                  color: progress === 100 ? 'var(--success)' : 'var(--accent)',
                  background: progress === 100 ? 'rgba(34,197,94,0.1)' : 'var(--accent-muted)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  whiteSpace: 'nowrap',
                }}
              >
                {progress === 100 ? '✓ Done' : `${progress}%`}
              </div>

              {/* Delete button */}
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => handleDelete(e, project.id)}
                title="Remove from history"
                style={{ flexShrink: 0, opacity: 0.4 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Upload Page ─────────────────────────────────────────────

function UploadPage() {
  const navigate = useNavigate();
  const { theme, setTheme, llmConfig } = useSettingsStore();
  const { setProject, setPdfData } = useWorkspaceStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>({
    step: 'idle',
    progress: 0,
    message: '',
  });

  const processFile = useCallback(
    async (file: File) => {
      const fileType = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';

      setProcessing({
        step: 'reading',
        progress: 10,
        message: 'Reading file…',
        fileName: file.name,
        fileSize: file.size,
      });

      try {
        let pages: PageData[] = [];
        let totalPages = 0;

        if (fileType === 'pdf') {
          const arrayBuffer = await file.arrayBuffer();

          setProcessing((prev) => ({
            ...prev,
            step: 'extracting',
            progress: 25,
            message: 'Extracting text from PDF…',
          }));

          totalPages = await getPdfPageCount(arrayBuffer);

          const pageTexts = await extractTextFromPdf(arrayBuffer, (pageNum) => {
            const progressPct = 25 + (pageNum / totalPages) * 50;
            setProcessing((prev) => ({
              ...prev,
              progress: Math.min(progressPct, 75),
              message: `Extracting text: page ${pageNum} of ${totalPages}…`,
            }));
          });

          const emptyPages = pageTexts.filter(
            (t) => t.trim().length < 20
          ).length;
          const isLikelyScanned = emptyPages > totalPages * 0.5;

          let finalTexts = pageTexts;

          if (isLikelyScanned) {
            toast.info(
              'Scanned PDF detected — running OCR to extract text. This may take a few minutes for large documents.',
              { duration: 8000 }
            );

            setProcessing((prev) => ({
              ...prev,
              step: 'ocr',
              progress: 50,
              message: `Running OCR: 0 of ${totalPages} pages…`,
            }));

            try {
              const { ocrPdfPages } = await import('../services/ocrService');

              const ocrTexts = await ocrPdfPages(
                arrayBuffer,
                totalPages,
                (completed, total) => {
                  const progressPct = 50 + (completed / total) * 35;
                  setProcessing((prev) => ({
                    ...prev,
                    progress: Math.min(progressPct, 85),
                    message: `Running OCR: ${completed} of ${total} pages…`,
                  }));
                },
              );

              // Merge: use OCR text where pdfjs found nothing
              finalTexts = pageTexts.map((pdfText, idx) =>
                pdfText.trim().length > 20 ? pdfText : ocrTexts[idx]
              );

              toast.success('OCR complete — text extracted from all pages.');
            } catch (ocrErr) {
              console.error('OCR failed:', ocrErr);
              toast.error('OCR failed. You can still view the document and retry later.');
            }
          }

          setProcessing((prev) => ({
            ...prev,
            step: 'preparing',
            progress: 85,
            message: 'Preparing workspace…',
          }));

          // Store a COPY of the PDF data for the viewer (original may get detached by OCR/pdfjs)
          setPdfData(arrayBuffer.slice(0));

          pages = finalTexts.map((text, idx) => ({
            pageNumber: idx + 1,
            sourceText: text,
            translatedText: '',
            status: 'untranslated' as const,
            paragraphs: [],
            isManuallyEdited: false,
            isReviewed: false,
            qualityFlags: [],
          }));
        } else {
          setProcessing((prev) => ({
            ...prev,
            step: 'extracting',
            progress: 40,
            message: 'Parsing DOCX document…',
          }));

          const { text, sections } = await parseDocx(file);
          totalPages = sections.length || 1;

          pages = sections.map((section, idx) => ({
            pageNumber: idx + 1,
            sourceText: section,
            translatedText: '',
            status: 'untranslated' as const,
            paragraphs: [],
            isManuallyEdited: false,
            isReviewed: false,
            qualityFlags: [],
          }));

          if (pages.length === 0 && text.trim()) {
            pages = [
              {
                pageNumber: 1,
                sourceText: text,
                translatedText: '',
                status: 'untranslated' as const,
                paragraphs: [],
                isManuallyEdited: false,
                isReviewed: false,
                qualityFlags: [],
              },
            ];
            totalPages = 1;
          }
        }

        setProcessing({
          step: 'done',
          progress: 100,
          message: 'Document ready!',
          fileName: file.name,
          fileSize: file.size,
        });

        const project: Project = {
          id: generateId(),
          name: file.name.replace(/\.(pdf|docx?)$/i, ''),
          fileName: file.name,
          fileType,
          fileSize: file.size,
          totalPages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pages,
          glossary: [],
          documentContext: null,
          settings: {
            batchSize: 2,
            autoTranslateEnabled: false,
          },
        };

        setProject(project);

        // Persist to localStorage for homepage project list
        const { saveFullProject } = await import('../services/projectHistoryService');
        saveFullProject(project);

        toast.success(
          `Loaded "${project.name}" — ${totalPages} page${totalPages !== 1 ? 's' : ''}`
        );

        setTimeout(() => {
          navigate(`/project/${project.id}`);
        }, 400);
      } catch (err) {
        console.error('File processing error:', err);
        setProcessing({
          step: 'idle',
          progress: 0,
          message: '',
        });
        toast.error(
          `Failed to process file: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    },
    [navigate, setProject, setPdfData]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.pdf') && !ext.endsWith('.docx') && !ext.endsWith('.doc')) {
        toast.error('Please upload a PDF or DOCX file.');
        return;
      }

      processFile(file);
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    multiple: false,
    disabled: processing.step !== 'idle',
  });

  const isProcessing = processing.step !== 'idle' && processing.step !== 'done';
  const hasApiKey = !!llmConfig.apiKey;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Top Nav */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              fontFamily: 'var(--font-arabic)',
              background: 'linear-gradient(135deg, var(--color-gold-500), var(--color-gold-300))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.02em',
            }}
          >
            ترجمة
          </span>
          <span
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            Tarjama
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-8)',
          gap: 'var(--space-8)',
        }}
      >
        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>
          <h1
            style={{
              fontSize: 'var(--text-4xl)',
              fontWeight: 'var(--font-bold)',
              marginBottom: 'var(--space-4)',
              background: 'linear-gradient(135deg, var(--text-primary), var(--color-gold-500))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Court Document Translation
          </h1>
          <p
            style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--text-secondary)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            Translate Irish court documents from English to Arabic with
            phrase-by-phrase accuracy. Upload a PDF or DOCX to begin.
          </p>
        </div>

        {/* API Key Warning */}
        {!hasApiKey && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--warning-muted)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--warning)',
              fontSize: 'var(--text-sm)',
              maxWidth: '500px',
              width: '100%',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>
              No API key configured.{' '}
              <button
                onClick={() => setSettingsOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  font: 'inherit',
                }}
              >
                Open Settings
              </button>{' '}
              to add your AI provider key.
            </span>
          </div>
        )}

        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`upload-zone ${isDragActive ? 'active' : ''}`}
          style={{
            maxWidth: '500px',
            width: '100%',
            opacity: isProcessing ? 0.6 : 1,
            pointerEvents: isProcessing ? 'none' : 'auto',
          }}
        >
          <input {...getInputProps()} />

          {isProcessing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div className="spinner spinner-lg" />
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                {processing.message}
              </p>
              <div className="progress-bar" style={{ width: '300px' }}>
                <div
                  className="progress-bar-fill"
                  style={{ width: `${processing.progress}%` }}
                />
              </div>
              {processing.fileName && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  {processing.fileName}
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--accent-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isDragActive ? (
                  <FileText size={28} style={{ color: 'var(--accent)' }} />
                ) : (
                  <Upload size={28} style={{ color: 'var(--accent)' }} />
                )}
              </div>
              <div>
                <p style={{ fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-1)' }}>
                  {isDragActive
                    ? 'Drop your document here'
                    : 'Drag & drop your document here'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  or click to browse — PDF, DOCX supported
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-4)',
            maxWidth: '700px',
            width: '100%',
            marginTop: 'var(--space-4)',
          }}
        >
          {[
            {
              title: 'Batch Translation',
              desc: 'Small batches for accuracy — no hallucination',
            },
            {
              title: 'Side-by-Side Review',
              desc: 'Original & translation with scroll sync',
            },
            {
              title: 'Export to DOCX/PDF',
              desc: 'Professional RTL Arabic documents',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass-card"
              style={{
                padding: 'var(--space-4)',
                textAlign: 'center',
              }}
            >
              <h4
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-semibold)',
                  marginBottom: 'var(--space-1)',
                  color: 'var(--accent)',
                }}
              >
                {feature.title}
              </h4>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Projects */}
        <RecentProjects navigate={navigate} setProject={setProject} />
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: 'var(--space-4) var(--space-6)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs)',
          borderTop: '1px solid var(--border-primary)',
        }}
      >
        Tarjama — Professional Legal Document Translation
      </footer>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default UploadPage;

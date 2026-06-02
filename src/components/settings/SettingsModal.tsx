import { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { AVAILABLE_MODELS } from '../../utils/constants';
import type { LLMProvider } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    llmConfig,
    setProvider,
    setApiKey,
    setModel,
    theme,
    setTheme,
  } = useSettingsStore();

  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [testError, setTestError] = useState('');

  if (!isOpen) return null;

  const providerModels = AVAILABLE_MODELS.filter(
    (m) => m.provider === llmConfig.provider
  );

  const handleProviderChange = (provider: LLMProvider) => {
    setProvider(provider);
    const firstModel = AVAILABLE_MODELS.find((m) => m.provider === provider);
    if (firstModel) {
      setModel(firstModel.id);
    }
  };

  const handleTestConnection = async () => {
    if (!llmConfig.apiKey) {
      setTestStatus('error');
      setTestError('Please enter an API key first.');
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      const testPrompt = 'Translate "Hello" to Arabic. Reply with only the Arabic word.';

      if (llmConfig.provider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': llmConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: llmConfig.model,
            max_tokens: 50,
            messages: [{ role: 'user', content: testPrompt }],
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          try {
            const parsed = JSON.parse(errBody);
            throw new Error(parsed?.error?.message || `HTTP ${response.status}`);
          } catch (e) {
            if (e instanceof Error && e.message !== errBody) throw e;
            throw new Error(`HTTP ${response.status}: ${errBody}`);
          }
        }

        setTestStatus('success');
      } else if (llmConfig.provider === 'openai') {
        // Goes through Vite proxy: /api/translate → OpenAI chat completions
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: llmConfig.model,
            messages: [{ role: 'user', content: testPrompt }],
            max_tokens: 50,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          try {
            const parsed = JSON.parse(errBody);
            throw new Error(parsed?.error?.message || `HTTP ${response.status}`);
          } catch (e) {
            if (e instanceof Error && e.message !== errBody) throw e;
            throw new Error(`HTTP ${response.status}: ${errBody}`);
          }
        }

        setTestStatus('success');
      } else if (llmConfig.provider === 'gemini') {
        // Gemini: direct call with API key in URL
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.model}:generateContent?key=${llmConfig.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: testPrompt }] }],
            generationConfig: { maxOutputTokens: 50 },
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          try {
            const parsed = JSON.parse(errBody);
            throw new Error(parsed?.error?.message || `HTTP ${response.status}`);
          } catch (e) {
            if (e instanceof Error && e.message !== errBody) throw e;
            throw new Error(`HTTP ${response.status}: ${errBody}`);
          }
        }

        setTestStatus('success');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(
        err instanceof Error ? err.message : String(err)
      );
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Theme */}
          <div className="input-group">
            <label className="input-label">Theme</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
              <button
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
            </div>
          </div>

          <hr className="divider" />

          {/* LLM Provider */}
          <div className="input-group">
            <label className="input-label">AI Provider</label>
            <select
              className="select"
              value={llmConfig.provider}
              onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="gemini">Google (Gemini)</option>
            </select>
            {llmConfig.provider === 'anthropic' && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
                ✓ Direct browser connection supported
              </span>
            )}
            {(llmConfig.provider === 'openai' || llmConfig.provider === 'gemini') && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
                ⚠ Requires proxy server (Vite dev proxy or Vercel)
              </span>
            )}
          </div>

          {/* Model */}
          <div className="input-group">
            <label className="input-label">Model</label>
            <select
              className="select"
              value={llmConfig.model}
              onChange={(e) => setModel(e.target.value)}
            >
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div className="input-group">
            <label className="input-label">API Key</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="input"
                value={llmConfig.apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${llmConfig.provider === 'openai' ? 'OpenAI' : llmConfig.provider === 'anthropic' ? 'Anthropic' : 'Google'} API key`}
                style={{ paddingRight: 'var(--space-10)' }}
              />
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Stored locally in your browser. Never sent to any server except the AI provider.
            </span>
          </div>

          {/* Test Connection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !llmConfig.apiKey}
            >
              {testStatus === 'testing' ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Zap size={14} />
              )}
              Test Connection
            </button>

            {testStatus === 'success' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--success)', fontSize: 'var(--text-sm)' }}>
                <CheckCircle size={14} />
                Connected successfully
              </span>
            )}

            {testStatus === 'error' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--error)', fontSize: 'var(--text-sm)' }}>
                <AlertCircle size={14} />
                {testError}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

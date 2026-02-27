import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAutomationStore } from '../../stores/automationStore';
import CronPresetInput from './CronPresetInput';
import { AgentAvatar } from '../AgentAvatar';
import { isValidCron } from '../../services/cronUtils';
import { extractProjectId } from '../../utils/projectUtils';
import { useModelsConfig } from '../../hooks/useAppConfig';
import { getModelOptions } from '../../services/modelService';
import { fetchOllamaModels, getOllamaModelOptions } from '../../services/ollamaService';
import { useSettingsStore } from '../../stores/settingsStore';
import type { TerminalInfo, AutomationJob, LLMProviderType } from '../../types';

interface AutomationJobFormProps {
  terminals: TerminalInfo[];
  editingJob: AutomationJob | null;
  onClose: () => void;
}

export default function AutomationJobForm({
  terminals,
  editingJob,
  onClose,
}: AutomationJobFormProps) {
  const { addJob, updateJob } = useAutomationStore();
  const { models: remoteModels } = useModelsConfig();
  const anthropicOptions = getModelOptions(remoteModels);
  const { providerBaseUrl } = useSettingsStore(s => s.claude);
  const [ollamaOptions, setOllamaOptions] = useState<{ value: string; label: string }[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  // Per-job provider toggle (independent from global setting)
  const [jobProvider, setJobProvider] = useState<LLMProviderType>(
    editingJob?.provider || (
      editingJob?.model && !['sonnet', 'opus', 'haiku'].some(m => editingJob.model?.includes(m))
        ? 'ollama'
        : 'anthropic'
    )
  );

  // Fetch Ollama models when switching to ollama
  useEffect(() => {
    if (jobProvider === 'ollama' && ollamaOptions.length === 0) {
      setOllamaLoading(true);
      const url = providerBaseUrl || 'http://localhost:11434';
      fetchOllamaModels(url).then(models => {
        setOllamaOptions(getOllamaModelOptions(models));
        setOllamaLoading(false);
      });
    }
  }, [jobProvider, providerBaseUrl, ollamaOptions.length]);

  const [name, setName] = useState(editingJob?.name ?? '');
  const [cronExpression, setCronExpression] = useState(editingJob?.cronExpression ?? '0 9 * * *');
  const [timeValue, setTimeValue] = useState(() => {
    if (editingJob?.cronExpression) {
      const parts = editingJob.cronExpression.split(' ');
      return `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`;
    }
    return '09:00';
  });
  const [agentId, setAgentId] = useState(editingJob?.agentId ?? '');
  const [promptTemplate, setPromptTemplate] = useState(editingJob?.promptTemplate ?? '');
  const [model, setModel] = useState(editingJob?.model ?? '');
  const [timeoutMinutes, setTimeoutMinutes] = useState(editingJob?.timeoutMinutes ?? 10);
  const [skipIfRunning, setSkipIfRunning] = useState(editingJob?.skipIfRunning ?? true);

  // Group terminals by project path
  const projectGroups = useMemo(() => {
    const groups = new Map<string, TerminalInfo[]>();
    for (const t of terminals) {
      const key = t.cwd || 'unknown';
      const list = groups.get(key) ?? [];
      list.push(t);
      groups.set(key, list);
    }
    return groups;
  }, [terminals]);

  const selectedAgent = terminals.find(t => t.id === agentId);
  const selectedProjectName = selectedAgent
    ? extractProjectId(selectedAgent.cwd) || selectedAgent.cwd
    : '';

  const isValid = name.trim() && isValidCron(cronExpression) && agentId && promptTemplate.trim();

  const handleSave = useCallback(async () => {
    if (!isValid || !selectedAgent) return;

    const projectName = extractProjectId(selectedAgent.cwd) || selectedAgent.cwd || '';
    const jobData = {
      name: name.trim(),
      cronExpression,
      agentId,
      agentName: selectedAgent.label || 'Agent',
      projectPath: selectedAgent.cwd || '',
      projectName,
      promptTemplate: promptTemplate.trim(),
      model: model || undefined,
      provider: model ? jobProvider : undefined,
      enabled: editingJob?.enabled ?? true,
      timeoutMinutes,
      skipIfRunning,
    };

    if (editingJob) {
      await updateJob(editingJob.id, jobData);
    } else {
      await addJob(jobData);
    }
    onClose();
  }, [isValid, name, cronExpression, agentId, selectedAgent, promptTemplate, model, timeoutMinutes, skipIfRunning, editingJob, addJob, updateJob, onClose]);

  return (
    <div className="automation-form-overlay" onClick={onClose}>
      <div className="automation-form-modal" onClick={e => e.stopPropagation()}>
        <h3 className="automation-form-title">
          {editingJob ? 'Edit Job' : 'New Automation Job'}
        </h3>

        {/* Name */}
        <div className="automation-form-field">
          <label className="automation-form-label">Name</label>
          <input
            type="text"
            className="automation-form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Reddit Digest, Code Review..."
            autoFocus
          />
        </div>

        {/* Agent Selection with avatars */}
        <div className="automation-form-field">
          <label className="automation-form-label">Agent</label>
          <div className="automation-agent-list">
            {Array.from(projectGroups.entries()).map(([projectPath, agents]) => {
              const projectLabel = extractProjectId(projectPath) || projectPath;
              return (
                <div key={projectPath} className="automation-agent-group">
                  <div className="automation-agent-group-label">{projectLabel}</div>
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      type="button"
                      className={`automation-agent-option ${agentId === agent.id ? 'selected' : ''}`}
                      onClick={() => setAgentId(agent.id)}
                    >
                      <AgentAvatar
                        agentName={agent.label}
                        avatarFilename={agent.avatar}
                        style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }}
                      />
                      <div className="automation-agent-option-info">
                        <span className="automation-agent-option-name">{agent.label}</span>
                        <span className="automation-agent-option-role">
                          {agent.personality?.role || 'Developer'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          {selectedAgent && (
            <div className="automation-selected-summary">
              {selectedAgent.label} in {selectedProjectName}
            </div>
          )}
        </div>

        {/* Cron Schedule */}
        <div className="automation-form-field">
          <label className="automation-form-label">Schedule</label>
          <CronPresetInput
            value={cronExpression}
            onChange={setCronExpression}
            timeValue={timeValue}
            onTimeChange={setTimeValue}
          />
        </div>

        {/* Prompt */}
        <div className="automation-form-field">
          <label className="automation-form-label">Prompt</label>
          <textarea
            className="automation-form-textarea"
            value={promptTemplate}
            onChange={e => setPromptTemplate(e.target.value)}
            placeholder="The prompt the agent will execute automatically..."
            rows={4}
          />
        </div>

        {/* Model Selection with Provider Toggle */}
        <div className="automation-form-field">
          <label className="automation-form-label">Model (optional)</label>
          <div className="automation-provider-toggle">
            <button
              type="button"
              className={`automation-provider-btn ${jobProvider === 'anthropic' ? 'active' : ''}`}
              onClick={() => { setJobProvider('anthropic'); setModel(''); }}
            >
              Claude
            </button>
            <button
              type="button"
              className={`automation-provider-btn ${jobProvider === 'ollama' ? 'active' : ''}`}
              onClick={() => { setJobProvider('ollama'); setModel(''); }}
            >
              Ollama
            </button>
          </div>
          <select
            className="automation-form-select"
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{ marginTop: '6px' }}
          >
            <option value="">Agent default</option>
            {jobProvider === 'ollama' ? (
              ollamaLoading ? (
                <option disabled>Loading models...</option>
              ) : (
                ollamaOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))
              )
            ) : (
              anthropicOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))
            )}
          </select>
        </div>

        {/* Timeout */}
        <div className="automation-form-field" style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label className="automation-form-label">Timeout (min)</label>
            <input
              type="number"
              className="automation-form-input"
              value={timeoutMinutes}
              onChange={e => setTimeoutMinutes(parseInt(e.target.value, 10) || 10)}
              min={1}
              max={120}
            />
          </div>
        </div>

        {/* Skip if running */}
        <div className="automation-form-field">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
            <input
              type="checkbox"
              checked={skipIfRunning}
              onChange={e => setSkipIfRunning(e.target.checked)}
            />
            Skip if previous run is still in progress
          </label>
        </div>

        {/* Actions */}
        <div className="automation-form-actions">
          <button className="automation-form-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="automation-form-btn save"
            onClick={handleSave}
            disabled={!isValid}
          >
            {editingJob ? 'Save' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

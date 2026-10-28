import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { applyServerSources, isRemoteSession } from '../../../domain/store';
import type { Source } from '../../../domain/types';

export interface ProcessingJob {
  id: string;
  source_id: string | null;
  kind: 'ingest' | 'index';
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';
  stage: string;
  progress: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  events: { at: string; agent: string; message: string }[];
}

export function useProcessing(projectId: string) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [indexed, setIndexed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!isRemoteSession()) return;
    try {
      const result = await api<{ sources: Source[]; jobs: ProcessingJob[]; indexed: boolean }>(`/api/projects/${projectId}/processing`);
      applyServerSources(projectId, result.sources);
      setJobs(result.jobs);
      setIndexed(result.indexed);
      setChecked(true);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read processing status.'); }
  }, [projectId]);
  useEffect(() => {
    if (!isRemoteSession()) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!active) return;
      await refresh();
      if (active) timer = setTimeout(() => void poll(), 1500);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [refresh]);
  return { jobs, indexed, checked, error, refresh };
}

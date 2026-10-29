import { useEffect, useRef, useState } from 'react';
import { CloudDownload, Folder, ChevronRight, RefreshCw, Unplug } from 'lucide-react';
import { api } from '../../../lib/api';
import { flushRemote, isRemoteSession } from '../../../domain/store';
import { Button, Confirm, Notice, toast } from '../../components/ui';
import './google-drive.css';

interface Config { projectId: string; folderIds: string[]; destination: string; recursive: boolean; excludedIds: string[]; mediaConsent: boolean; autoSync: boolean; }
interface DriveStatus { configured: boolean; connected: boolean; email: string | null; link: { config: Config; lastSync: number; error: string | null; summary: { imported?: number; updated?: number; unchanged?: number; skipped?: number; failed?: number; failures?: { name: string; error: string }[] } } | null; }
interface DriveFolder { id: string; name: string; }
interface Preview { total: number; supported: number; folders: number; types: Record<string, number>; items: { id: string; name: string; fileType: string; folderPath: string; size?: string; skipReason: string | null }[]; }

export function GoogleDrive({ projectId, destination, onRefresh }: { projectId: string; destination: string; onRefresh: () => Promise<void> }) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [trail, setTrail] = useState<DriveFolder[]>([{ id: 'root', name: 'My Drive' }]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [recursive, setRecursive] = useState(true);
  const [autoSync, setAutoSync] = useState(false);
  const [mediaConsent, setMediaConsent] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [queued, setQueued] = useState(false);
  const parent = trail.at(-1)!.id;
  const remote = isRemoteSession();
  const config: Config = { projectId, folderIds: Object.keys(selected), destination, recursive, excludedIds: excluded, mediaConsent, autoSync };
  const selectionKey = JSON.stringify([projectId, config.folderIds, destination, recursive, mediaConsent]);
  const latestSelection = useRef(selectionKey);
  latestSelection.current = selectionKey;

  useEffect(() => {
    if (!remote) return;
    let active = true;
    const load = async () => {
      try { const next = await api<DriveStatus>(`/api/drive/status?projectId=${encodeURIComponent(projectId)}`); if (active) setStatus(next); }
      catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not load Google Drive status.'); }
    };
    void load(); const timer = setInterval(() => void load(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [projectId, remote]);
  useEffect(() => {
    if (!expanded || !status?.connected) return;
    let active = true;
    setBusy('folders'); setError(null);
    api<{ files: DriveFolder[]; nextPageToken?: string }>(`/api/drive/folders?parent=${encodeURIComponent(parent)}`)
      .then(result => { if (active) { setFolders(result.files); setNextPage(result.nextPageToken ?? null); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not list folders.'); })
      .finally(() => { if (active) setBusy(null); });
    return () => { active = false; };
  }, [parent, expanded, status?.connected]);
  // A preview belongs to a specific selection, destination and conversion policy.
  useEffect(() => { setPreview(null); setExcluded([]); }, [selected, recursive, destination, mediaConsent]);

  const action = async (name: string, work: () => Promise<void>) => {
    setBusy(name); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Google Drive action failed.'); }
    finally { setBusy(null); }
  };
  const reloadStatus = async () => { setStatus(await api<DriveStatus>(`/api/drive/status?projectId=${encodeURIComponent(projectId)}`)); };
  const toggleSelected = (folder: DriveFolder) => {
    setSelected(prev => { const next = { ...prev }; if (next[folder.id]) delete next[folder.id]; else next[folder.id] = folder.name; return next; });
  };
  const selectedItems = preview?.items.filter(item => !item.skipReason && !excluded.includes(item.id)) ?? [];

  return <section className="card card-pad drive-connection stack" aria-label="Google Drive knowledge">
    <div className="drive-heading"><span className="choice-icon"><CloudDownload size={24} /></span><div><h2>Google Drive</h2><p className="muted small">Choose your folders. Keep their documents connected to your assistant.</p></div>
      {remote && status?.connected && <span className="pill pill-ok">Connected</span>}
    </div>
    {!remote ? <p className="muted small">Sign in to connect your Google account. Demo mode keeps its files in this browser.</p> : <>
      {status && !status.configured && <Notice tone="warn">Google Drive setup is needed on this installation. Configure the server’s Google OAuth client ID, client secret and redirect URL. Your Gemini API key alone does not connect Drive.</Notice>}
      {!status?.connected ? <Button disabled={!status?.configured || !!busy} icon={<CloudDownload size={17} />} onClick={() => void action('connect', async () => {
        await flushRemote();
        const result = await api<{ url: string }>('/api/drive/connect', { method: 'POST', body: JSON.stringify({ projectId }) });
        window.location.assign(result.url);
      })}>{busy === 'connect' ? 'Opening Google…' : 'Connect Google Drive'}</Button> : <>
        <div className="drive-actions"><span className="small">{status.email}</span><Button size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close folder selection' : 'Choose folders'}</Button>
          {status.link && <Button size="sm" disabled={!!busy} icon={<RefreshCw size={15} />} onClick={() => void action('sync', async () => {
            await api(`/api/drive/sync/${projectId}`, { method: 'POST' }); setQueued(true); toast('Drive sync queued.');
          })}>Sync now</Button>}
          <Button size="sm" variant="ghost" icon={<Unplug size={15} />} onClick={() => setConfirmDisconnect(true)}>Disconnect</Button>
        </div>
        <p className="faint small">Google grants read-only access to your Drive. Anvesha imports only your chosen folders. Originals are never edited. My Drive is supported; Shared Drives and shortcuts are excluded.</p>
        {expanded && <div className="drive-picker stack">
          <nav className="drive-breadcrumbs" aria-label="Drive folder path">{trail.map((folder, i) => <button type="button" key={folder.id} onClick={() => setTrail(trail.slice(0, i + 1))}>{i > 0 && <ChevronRight size={12} />}{folder.name}</button>)}</nav>
          {busy === 'folders' ? <p role="status">Loading folders…</p> : <div className="drive-folder-list">
            {folders.length === 0 && <p className="muted small">No subfolders here. Choose a parent folder, or go back.</p>}
            {folders.map(folder => <div className="drive-folder-row" key={folder.id}><label className="check"><input type="checkbox" checked={!!selected[folder.id]} onChange={() => toggleSelected(folder)} disabled={!selected[folder.id] && Object.keys(selected).length >= 10} /><Folder size={17} /><span>{folder.name}</span></label><button type="button" className="icon-btn" aria-label={`Open Drive folder ${folder.name}`} onClick={() => setTrail([...trail, folder])}><ChevronRight size={18} /></button></div>)}
          </div>}
          {nextPage && <Button size="sm" disabled={!!busy} onClick={() => void action('more', async () => {
            const result = await api<{ files: DriveFolder[]; nextPageToken?: string }>(`/api/drive/folders?parent=${encodeURIComponent(parent)}&pageToken=${encodeURIComponent(nextPage)}`);
            setFolders([...folders, ...result.files]); setNextPage(result.nextPageToken ?? null);
          })}>Load more folders</Button>}
          {Object.keys(selected).length > 0 && <div className="drive-selected" aria-label="Selected Drive folders">{Object.entries(selected).map(([id, name]) => <button type="button" className="chip" key={id} onClick={() => toggleSelected({ id, name })}>{name} ×</button>)}</div>}
          <p className="small">Import into <strong>{destination || 'your project root'}</strong>, preserving the selected folder structure. Saving a new selection replaces this project?s previous Drive selection.</p>
          <label className="check"><input type="checkbox" checked={recursive} onChange={e => setRecursive(e.target.checked)} />Include subfolders</label>
          <label className="check"><input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)} />Check for changes every 15 minutes while the service runs</label>
          <label className="check"><input type="checkbox" checked={mediaConsent} onChange={e => setMediaConsent(e.target.checked)} />Allow audio/video to be sent to Google Gemini for speech transcription. Requires a Gemini API key; provider usage may be billed.</label>
          <Button disabled={!!busy || !Object.keys(selected).length} onClick={() => void action('preview', async () => {
            const result = await api<Preview>('/api/drive/preview', { method: 'POST', body: JSON.stringify({ ...config, excludedIds: [] }) });
            if (latestSelection.current !== selectionKey) throw new Error('The selection changed while scanning. Preview the current folders again.');
            setPreview(result);
          })}>{busy === 'preview' ? 'Scanning folders…' : 'Preview documents'}</Button>
          {preview && <div className="drive-preview stack" aria-label="Drive import preview">
            <strong>{preview.total} files across {preview.folders} folders</strong><p className="small muted">{Object.entries(preview.types).map(([type, count]) => `${count} ${type}`).join(' · ')}</p>
            <div className="drive-preview-list">{preview.items.map(item => <label className="drive-preview-item" key={item.id}><input type="checkbox" aria-label={`Import ${item.name}`} checked={!item.skipReason && !excluded.includes(item.id)} disabled={!!item.skipReason} onChange={e => setExcluded(prev => e.target.checked ? prev.filter(id => id !== item.id) : [...prev, item.id])} /><span><strong>{item.name}</strong><small>{item.folderPath} / {item.fileType}</small>{item.skipReason && <small className="field-error">{item.skipReason}</small>}</span></label>)}</div>
            <Button variant="primary" disabled={!!busy || !selectedItems.length} onClick={() => void action('import', async () => {
              await flushRemote(); await api('/api/drive/import', { method: 'POST', body: JSON.stringify(config) });
              setQueued(true); setExpanded(false); await reloadStatus(); await onRefresh(); toast('Drive import queued. Documents will appear as they are fetched.');
            })}>Import {selectedItems.length} files and prepare knowledge</Button>
          </div>}
        </div>}
        {queued && <Notice>Drive work is queued. You can leave this page; progress appears in Training. Files are fetched, processed and indexed in the background.</Notice>}
        {status.link && <div className="drive-summary small"><span>{status.link.lastSync ? `Last fetch: ${new Date(status.link.lastSync * 1000).toLocaleString()}` : 'Waiting for the first fetch'}</span><span>{status.link.config.autoSync ? 'Automatic checks enabled' : 'Manual sync'}</span>
          {status.link.lastSync > 0 && <p>{status.link.summary.imported ?? 0} imported · {status.link.summary.updated ?? 0} updated · {status.link.summary.unchanged ?? 0} unchanged · {status.link.summary.skipped ?? 0} skipped · {status.link.summary.failed ?? 0} failed</p>}
          {status.link.error && <Notice tone="danger">{status.link.error}</Notice>}
          {!!status.link.summary.failures?.length && <details><summary>Files needing attention</summary><ul>{status.link.summary.failures.map((failure, i) => <li key={i}>{failure.name}: {failure.error}</li>)}</ul></details>}
        </div>}
      </>}
    </>}
    {error && <Notice tone="danger">{error}</Notice>}
    {confirmDisconnect && <Confirm title="Disconnect Google Drive?" body="Disconnect this Google account from all your Anvesha projects and stop using its sources in new answers. Cached files remain on this installation; your originals in Drive are unchanged." confirmLabel="Disconnect" onClose={() => setConfirmDisconnect(false)} onConfirm={async () => {
      await action('disconnect', async () => { await api('/api/drive/connection', { method: 'DELETE' }); setExpanded(false); setQueued(false); await reloadStatus(); await onRefresh(); });
    }} />}
  </section>;
}

import { FlaskConical, FolderOpen, LayoutGrid, MessageSquare, PanelLeft, Send, Settings2, ShieldCheck } from 'lucide-react';
import { match, navigate } from '../router';

export function WorkspaceDock({ path, menuOpen, onMenu }: { path: string; menuOpen: boolean; onMenu: () => void }) {
  const project = match('/p/:id/:section', path) ?? match('/p/:id', path);
  const root = project ? `/p/${encodeURIComponent(project.id)}` : '';
  const items = project ? [
    { label: 'Projects', path: '/projects', Icon: LayoutGrid },
    { label: 'Documents', path: `${root}/upload`, Icon: FolderOpen },
    { label: 'Prepare', path: `${root}/training`, Icon: FlaskConical },
    { label: 'Try', path: `${root}/try`, Icon: MessageSquare },
    { label: 'Review', path: `${root}/review`, Icon: ShieldCheck },
    { label: 'Publish', path: `${root}/publish`, Icon: Send },
  ] : [
    { label: 'Projects', path: '/projects', Icon: LayoutGrid },
    { label: 'New workspace', path: '/workspace/new', Icon: FolderOpen },
  ];
  return <nav className="workspace-dock" aria-label="Workspace dock">
    {items.map(({ label, path: target, Icon }) => <a key={target} href={`#${target}`} data-mobile-hidden={['Prepare','Review'].includes(label) || undefined} aria-label={label} aria-current={path.split('?')[0] === target ? 'page' : undefined} title={label}><Icon size={19} strokeWidth={1.65} /><span>{label}</span></a>)}
    {project && <button data-mobile-hidden type="button" title="Assistant appearance" onClick={() => navigate(`${root}/make`)} aria-current={project.section === 'make' ? 'page' : undefined}><Settings2 size={19} strokeWidth={1.65} /><span>Style</span></button>}
    <span className="workspace-dock-rule" aria-hidden="true" />
    <button type="button" onClick={onMenu} aria-current={project && ['settings', 'conversations'].includes(project.section ?? '') ? 'page' : undefined} aria-expanded={menuOpen} aria-controls="workspace-navigation" title="Workspace menu"><PanelLeft size={19} strokeWidth={1.65} /><span>Menu</span></button>
  </nav>;
}

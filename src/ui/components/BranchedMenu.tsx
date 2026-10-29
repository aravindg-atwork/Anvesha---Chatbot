import { useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Folder01Icon } from '@hugeicons/core-free-icons';
import './BranchedMenu.css';

export interface BranchedMenuItem { value: string; label: string; children?: BranchedMenuItem[]; }

/** React Bits BranchedMenu, adapted for recursive folders and controlled selection. */
export default function BranchedMenu({ items, active, onSelect }: {
  items: BranchedMenuItem[]; active: string; onSelect: (value: string) => void;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const render = (nodes: BranchedMenuItem[]): ReactNode => nodes.map(item => {
    const open = !closed.has(item.value);
    return <div className="branched-menu__section" key={item.value} data-active={active === item.value ? '' : undefined}>
      <svg className="branched-menu__branch" width="24" height="36" aria-hidden="true"><path d="M 0 0 V 8 A 10 10 0 0 0 10 18 H 22" /></svg>
      <div className="branched-menu__row">
        {item.children?.length ? <button type="button" className="branched-menu__toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`} aria-expanded={open} onClick={() => setClosed(prev => {
          const next = new Set(prev); if (next.has(item.value)) next.delete(item.value); else next.add(item.value); return next;
        })}>{open ? '−' : '+'}</button> : <span className="branched-menu__toggle" />}
        <button type="button" className="branched-menu__item" aria-current={active === item.value ? 'true' : undefined} onClick={() => onSelect(item.value)}>
          <HugeiconsIcon icon={Folder01Icon} size={16} /><span>{item.label}</span>
        </button>
      </div>
      {item.children?.length && open ? <div className="branched-menu__children">{render(item.children)}</div> : null}
    </div>;
  });
  return <nav className="branched-menu" aria-label="Knowledge folders">{render(items)}</nav>;
}

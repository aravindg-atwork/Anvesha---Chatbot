import { FrostCloud } from './frost-cloud';
import { FileText, Image, MessageSquareText } from 'lucide-react';

/** Decorative, code-native knowledge map shared by the entry screens. */
export function KnowledgeAtlas({ compact = false }: { compact?: boolean }) {
  return <div className={`knowledge-atlas ${compact ? 'is-compact' : ''}`}>
    <svg viewBox="0 0 600 520" fill="none" className="atlas-lines" aria-hidden="true">
      <ellipse cx="300" cy="260" rx="216" ry="195" stroke="currentColor" strokeDasharray="2 8" />
      <ellipse cx="300" cy="260" rx="146" ry="132" stroke="currentColor" strokeDasharray="2 8" />
      <path d="M145 130C145 220 240 190 300 260M456 160C398 160 420 260 300 260M150 378C250 378 228 290 300 260M457 373C365 373 401 280 300 260" stroke="currentColor" />
      <circle cx="300" cy="260" r="205" stroke="currentColor" opacity=".2" />
      <circle cx="300" cy="65" r="4" fill="var(--brand-highlight)" stroke="none" /><circle cx="509" cy="322" r="4" fill="var(--brand-highlight)" stroke="none" />
    </svg>
    <div className="atlas-cloud-hub"><FrostCloud background={false} color="brand" /><span>anvesha</span></div>
    <span className="atlas-node atlas-node-one"><FileText size={21} /><span>Documents<small>The things you know</small></span></span>
    <span className="atlas-node atlas-node-two"><Image size={21} /><span>Images<small>Every detail matters</small></span></span>
    <span className="atlas-node atlas-node-three"><MessageSquareText size={21} /><span>Questions<small>The things people ask</small></span></span>
    <span className="atlas-answer"><span className="atlas-answer-dot" /> A clearer answer.</span>
  </div>;
}

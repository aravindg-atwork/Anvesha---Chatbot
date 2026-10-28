import { BookOpen, Building2, GraduationCap, Handshake, Leaf, MessageCircle, Sparkles, type LucideIcon } from 'lucide-react';
import type { Assistant } from '../../domain/types';

const AVATAR_ICONS: Record<string, LucideIcon> = {
  chat: MessageCircle,
  book: BookOpen,
  building: Building2,
  graduation: GraduationCap,
  leaf: Leaf,
  sparkles: Sparkles,
  handshake: Handshake,
};
export const AVATAR_KEYS = Object.keys(AVATAR_ICONS);

/** Assistant avatar: the first letter of the name, or one of a small set of drawn icons. */
export function AvatarGlyph({ value, name, size }: { value: string; name: string; size: number }) {
  const Icon = AVATAR_ICONS[value];
  if (Icon) return <Icon size={Math.round(size * 0.52)} strokeWidth={2} aria-hidden />;
  return <>{(name || '?').trim().slice(0, 1).toUpperCase()}</>;
}

export function Avatar({ a, size = 36, inverse }: { a: Assistant; size?: number; inverse?: boolean }) {
  const label = (a.draft.avatar || a.draft.name || '?').trim().slice(0, 2);
  const colours = inverse ? { background: '#fff', color: a.share.widget.color } : { background: a.share.widget.color, color: '#fff' };
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, ...colours }} aria-hidden>
      {AVATAR_ICONS[a.draft.avatar] ? <AvatarGlyph value={a.draft.avatar} name={a.draft.name} size={size} /> : label.slice(0, 1).toUpperCase()}
    </span>
  );
}

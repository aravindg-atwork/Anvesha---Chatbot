import { useAppState } from '../../domain/store';
import { BrandMark } from '../components/ui';
import { PublishedChat } from './install/PublishedChat';

/** What an end user sees: the published assistant only, with no owner controls. */
export function PublicChat({ publicId }: { publicId: string }) {
  const a = useAppState((s) => s.assistants.find((x) => x.publicId === publicId));
  const org = useAppState((s) => s.orgs.find((o) => o.id === a?.orgId));
  const live = a?.status === 'live' && a.published;

  return (
    <div className="page" style={{ background: 'var(--surface-muted)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container" style={{ maxWidth: 980, display: 'flex', alignItems: 'center', gap: 14, minHeight: 72 }}>
          <span className="brand-mark" style={{ background: a?.share.widget.color ?? 'var(--accent)', width: 38, height: 38 }} aria-hidden>
            <strong style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>{(a?.published?.name ?? '?').slice(0, 1)}</strong>
          </span>
          <div>
            <strong style={{ fontSize: '1.15rem' }}>{a?.published?.name ?? 'Assistant'}</strong>
            {org && <div className="muted small">{org.name}</div>}
          </div>
        </div>
      </header>
      <main className="container" style={{ maxWidth: 980, padding: '28px 24px 40px', flex: 1 }}>
        {!a || !a.published ? (
          <div className="card card-pad stack">
            <h1 style={{ fontSize: '1.8rem' }}>This assistant isn’t available</h1>
            <p className="muted">The link may be wrong, or the assistant has not been published.</p>
          </div>
        ) : (
          <>
            {live ? (
              <p className="muted" style={{ marginBottom: 16 }}>{a.published.purpose}</p>
            ) : (
              <div className="notice notice-warn" role="status" style={{ marginBottom: 16 }}>
                This assistant isn’t available right now. Please contact {org?.name ?? 'the organisation'} directly.
              </div>
            )}
            <PublishedChat a={a} orgName={org?.name ?? ''} surface="page" />
          </>
        )}
      </main>
      <footer className="footer" style={{ marginTop: 0 }}>
        <div className="container spread" style={{ maxWidth: 980 }}>
          <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
            <BrandMark size={20} /> Powered by Anvesha
          </span>
          {org?.isSample && <span>Sample assistant for a fictional company.</span>}
        </div>
      </footer>
    </div>
  );
}

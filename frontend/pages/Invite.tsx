import { useMemo, useState } from "react";

interface Invitee {
  id: string;
  name: string;
  invitedBy?: string;
}

const seedInvitees: Invitee[] = [
  { id: "host", name: "You" },
  { id: "p2", name: "Ava", invitedBy: "host" },
  { id: "p3", name: "Ben", invitedBy: "host" },
  { id: "p4", name: "Cam", invitedBy: "p2" },
];

interface InviteTreeProps {
  invitees: Invitee[];
}

const InviteTree = ({ invitees }: InviteTreeProps) => {
  const byParent = useMemo(() => {
    const grouped: Record<string, Invitee[]> = {};
    invitees.forEach((invitee) => {
      const key = invitee.invitedBy ?? "root";
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(invitee);
    });
    return grouped;
  }, [invitees]);

  const renderNodes = (parentId: string | null) => {
    const key = parentId ?? "root";
    const children = byParent[key] ?? [];
    if (!children.length) return null;

    return (
      <ul className="invite-tree">
        {children.map((child) => (
          <li key={child.id}>
            <div className="invite-node">
              <strong>{child.name}</strong>
              {child.invitedBy && <span className="node-meta">invited by {child.invitedBy}</span>}
            </div>
            {renderNodes(child.id)}
          </li>
        ))}
      </ul>
    );
  };

  return <div className="invite-tree-wrapper">{renderNodes(null)}</div>;
};

const InvitePage = () => {
  const [invitees, setInvitees] = useState<Invitee[]>(seedInvitees);
  const [email, setEmail] = useState("friend@example.com");
  const [deepLink] = useState("https://opinionated.people/invite/demo-token");

  const handleManualInvite = () => {
    if (!email.trim()) return;
    const id = `p${invitees.length + 1}`;
    setInvitees((current) => [...current, { id, name: email.split("@")[0], invitedBy: "host" }]);
    setEmail("");
  };

  return (
    <div className="invite-page">
      <section>
        <h2>Invite Players</h2>
        <p>Select contacts or add an email to invite more friends into your game.</p>
        <div className="contact-picker">
          <button type="button" disabled>
            Pick from contacts (coming soon)
          </button>
          <small>We are waiting on OS APIs to expose the player’s contacts.</small>
        </div>
        <div className="manual-entry">
          <input value={email} placeholder="friend@email.com" onChange={(event) => setEmail(event.target.value)} />
          <button type="button" onClick={handleManualInvite}>
            Send invite
          </button>
        </div>
      </section>

      <section>
        <h3>Shareable Deep Link</h3>
        <div className="deep-link">
          <code>{deepLink}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(deepLink)}>
            Copy link
          </button>
        </div>
      </section>

      <section>
        <h3>Invite Tree</h3>
        <p>Track who invited whom to maintain the chain of trust.</p>
        <InviteTree invitees={invitees} />
      </section>
    </div>
  );
};

export default InvitePage;

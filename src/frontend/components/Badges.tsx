import "./components.css";

export type Badge = {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
};

type BadgesProps = {
  badges: Badge[];
};

const Badges = ({ badges }: BadgesProps) => {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Recognition</p>
          <h2>Badges</h2>
        </div>
        <span className="panel__tag">{badges.length} earned</span>
      </header>
      <div className="badges">
        {badges.map((badge) => (
          <article key={badge.id} className="badge">
            <div className="badge__icon" aria-hidden>
              {badge.name
                .split(" ")
                .map((word) => word[0])
                .join("")}
            </div>
            <div>
              <p className="badge__name">{badge.name}</p>
              <p className="badge__description">{badge.description}</p>
              <p className="badge__earned">Earned {badge.earnedAt}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Badges;

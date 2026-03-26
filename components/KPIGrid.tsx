type Card = {
  title: string;
  value: string;
  subchips?: string[];
  delta?: string;
};

export default function KPIGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="kpi-grid">
      {cards.map((card, i) => (
        <div key={i} className="kpi-card">
          <div className="kpi-header">
            <div className="kpi-title">{card.title}</div>
            {card.delta ? <span className="kpi-delta neutral">{card.delta}</span> : null}
          </div>
          <div className="kpi-value">{card.value}</div>
          <div className="kpi-sub">
            {(card.subchips || []).map((chip) => (
              <span key={chip} className="kpi-chip">{chip}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
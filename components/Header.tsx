type Props = {
  reportCount: number;
};

export default function Header({ reportCount }: Props) {
  return (
    <div className="optima-headerbar">
      <div>
        <div className="optima-title">NORDSHEET</div>
        <div className="optima-subtitle">
          Financial cockpit with AI insights, variance tracking and export-ready reporting
        </div>
      </div>

      <div className="header-right">
        <div className="optima-pill">
          Tillagt i rapport: {reportCount} punkt{reportCount !== 1 ? "er" : ""}
        </div>
        <div className="optima-window">
          <span className="optima-dot" />
          <span className="optima-dot" />
        </div>
      </div>
    </div>
  );
}
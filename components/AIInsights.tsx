export default function AIInsights({ insights }: { insights: string[] }) {
  return (
    <div className="ns-ai-panel">
      <div className="ns-ai-head">
        <div>
          <div className="ns-ai-title">AI Insights</div>
          <div className="ns-ai-sub">Latest comments from AI</div>
        </div>
      </div>

      <div className="ns-ai-body">
        {insights.map((line, i) => (
          <div key={i} className="ns-ai-note">
            <div className="ns-ai-note-time">Insight {String(i + 1).padStart(2, "0")}</div>
            <div className="ns-ai-note-text">{line}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
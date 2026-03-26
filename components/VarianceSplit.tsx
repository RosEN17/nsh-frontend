export default function VarianceSplit({
  negatives,
  positives,
}: {
  negatives: any[];
  positives: any[];
}) {
  return (
    <div className="two-col">
      <div className="panel">
        <h3>Red flags</h3>
        <p>Största negativa avvikelser</p>
        <ul>
          {negatives.map((x, i) => (
            <li key={i}>{x.Label || x.KontoNamn || x.Konto}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Positive drivers</h3>
        <p>Största positiva avvikelser</p>
        <ul>
          {positives.map((x, i) => (
            <li key={i}>{x.Label || x.KontoNamn || x.Konto}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
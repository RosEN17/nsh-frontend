"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";

const FAQ = [
  { q: "Hur laddar jag upp en fil?", a: "Gå till Connect i topbaren, dra och släpp din Excel eller CSV-fil, klicka sedan 'Analysera med AI'." },
  { q: "Vad är AI Alerts?", a: "AI Alerts flaggar automatiskt avvikelser som är ovanligt stora eller som avviker från tidigare perioder. De visas i sidomenyn med antal." },
  { q: "Hur schemalägg jag en uppföljning?", a: "Gå till Variances, klicka 'Mer info' på en avvikelse, välj sedan 'Schemalägg uppföljning' och välj ett datum." },
  { q: "Hur bjuder jag in en kollega?", a: "Gå till Bolag & Team i sidomenyn, ange din kollegas e-post och klicka 'Bjud in'." },
  { q: "Hur exporterar jag en rapport?", a: "Gå till Report i topbaren, välj rapporttyp och format, anpassa via AI-chatten och klicka 'Generera & Exportera'." },
];

export default function HelpPage() {
  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page" style={{ maxWidth: 640 }}>
        <div className="ns-hero-title">Hjälp & support</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>Vanliga frågor och svar</div>

        <div className="help-faq">
          {FAQ.map((item, i) => (
            <div key={i} className="help-faq-item">
              <div className="help-faq-q">{item.q}</div>
              <div className="help-faq-a">{item.a}</div>
            </div>
          ))}
        </div>

        <div className="settings-card" style={{ marginTop: 8 }}>
          <div className="settings-card-title">Kontakta support</div>
          <div className="settings-sub" style={{ marginBottom: 12 }}>
            Hittar du inte svar på din fråga? Kontakta oss direkt.
          </div>
          <a href="mailto:support@nordsheet.com" className="settings-save-btn"
            style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}>
            support@nordsheet.com
          </a>
        </div>
      </div>
    </ProtectedLayout>
  );
}

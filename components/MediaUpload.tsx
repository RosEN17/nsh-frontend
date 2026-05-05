"use client";

/**
 * MediaUpload.tsx
 *
 * Hanterar uppladdning av projektbilder och ritningar/skisser.
 * Bilder analyseras direkt av AI när de laddas upp – AI:n läser av
 * vad den ser (mått, material, scope) och visar resultatet inline.
 *
 * Ritningar skickas med detail="high" till GPT-4o för noggrannare
 * måttavläsning. Projektbilder skickas med detail="low".
 *
 * Props:
 *  onImagesChange   – callback med alla bilder (base64) redo för /api/estimate
 *  onDrawingsChange – callback med alla ritningar (base64)
 *  jobType          – används för att ge AI rätt kontext vid analys
 *  disabled         – inaktivera under kalkylgenerering
 */

import { useState, useRef, useCallback } from "react";

export interface UploadedFile {
  name: string;
  data: string;       // base64 data-URL
  isDrawing?: boolean;
}

interface AnalysisResult {
  fileName: string;
  summary: string;
  loading: boolean;
  error?: string;
}

interface Props {
  onImagesChange: (images: UploadedFile[]) => void;
  onDrawingsChange: (drawings: UploadedFile[]) => void;
  jobType?: string;
  disabled?: boolean;
}

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPTED_DOC   = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const MAX_FILES      = 8;
const MAX_SIZE_MB    = 10;

async function analyzeFileWithAI(
  file: UploadedFile,
  jobType: string,
  isDrawing: boolean,
): Promise<string> {
  const apiKey = (window as any).__NORDSHEET_ANALYSIS_KEY__ || "";

  const prompt = isDrawing
    ? `Du är en byggkalkylator. Analysera denna ritning/skiss för ett ${jobType || "bygg"}-jobb.
Extrahera: mått (B×L i meter), höjd, eventuella anteckningar om material eller konstruktion.
Svara på svenska i 2-3 meningar max. Börja med de viktigaste måtten.`
    : `Du är en byggkalkylator. Beskriv vad du ser på detta platsfoton för ett ${jobType || "bygg"}-jobb.
Fokusera på: ytstorlek, markförhållanden, befintliga konstruktioner, material, höjd över mark.
Svara på svenska i 1-2 meningar max.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.data.split(";")[0].replace("data:", "") as any,
                data: file.data.split(",")[1],
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Analys misslyckades (${res.status})`);
  }

  const json = await res.json();
  return (json.content?.[0]?.text || "Kunde inte analysera bilden.").trim();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileRow({
  file,
  analysis,
  onRemove,
  isDrawing,
}: {
  file: UploadedFile;
  analysis?: AnalysisResult;
  onRemove: () => void;
  isDrawing: boolean;
}) {
  const isImage = file.data.startsWith("data:image");

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "0.5px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      marginBottom: 8,
    }}>
      {/* Toppraden */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        {isImage ? (
          <img
            src={file.data}
            alt={file.name}
            style={{
              width: 48,
              height: 48,
              objectFit: "cover",
              borderRadius: "var(--radius)",
              border: "0.5px solid var(--border)",
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius)",
            background: "var(--bg-elevated)",
            border: "0.5px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}>
            📄
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {file.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {isDrawing ? "Ritning/skiss" : "Projektbild"}
            {analysis?.loading && " · Analyserar…"}
          </div>
        </div>

        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: 4,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            transition: "color .15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* AI-analys */}
      {analysis && (
        <div style={{
          borderTop: "0.5px solid var(--border)",
          padding: "8px 12px",
          background: "rgba(106,129,147,0.05)",
        }}>
          {analysis.loading ? (
            <div className="ai-analysis-loading">
              <div className="ai-analysis-spinner" />
              <span>AI analyserar {isDrawing ? "ritningen" : "bilden"}…</span>
            </div>
          ) : analysis.error ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Analys ej tillgänglig
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--accent-text)" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 5v4M8 11v.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {analysis.summary}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MediaUpload({ onImagesChange, onDrawingsChange, jobType, disabled }: Props) {
  const [photos, setPhotos]       = useState<UploadedFile[]>([]);
  const [drawings, setDrawings]   = useState<UploadedFile[]>([]);
  const [analyses, setAnalyses]   = useState<Record<string, AnalysisResult>>({});
  const [dragPhoto, setDragPhoto]   = useState(false);
  const [dragDrawing, setDragDrawing] = useState(false);

  const photoInputRef   = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  const triggerAnalysis = useCallback(async (file: UploadedFile, isDrawing: boolean) => {
    const key = file.name + file.data.slice(-8);
    setAnalyses(prev => ({ ...prev, [key]: { fileName: file.name, summary: "", loading: true } }));
    try {
      const summary = await analyzeFileWithAI(file, jobType || "altan", isDrawing);
      setAnalyses(prev => ({ ...prev, [key]: { fileName: file.name, summary, loading: false } }));
    } catch {
      setAnalyses(prev => ({ ...prev, [key]: { fileName: file.name, summary: "", loading: false, error: "fel" } }));
    }
  }, [jobType]);

  const readFile = useCallback((file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        reject(new Error(`${file.name} är för stor (max ${MAX_SIZE_MB} MB)`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: reader.result as string });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const addPhotos = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const toAdd = Array.from(files).slice(0, MAX_FILES - photos.length);
    const loaded = await Promise.all(toAdd.map(readFile).map(p => p.catch(() => null)));
    const valid  = loaded.filter(Boolean) as UploadedFile[];
    const next   = [...photos, ...valid];
    setPhotos(next);
    onImagesChange(next);
    valid.forEach(f => triggerAnalysis(f, false));
  }, [photos, onImagesChange, readFile, triggerAnalysis]);

  const addDrawings = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const toAdd = Array.from(files).slice(0, MAX_FILES - drawings.length);
    const loaded = await Promise.all(toAdd.map(readFile).map(p => p.catch(() => null)));
    const valid  = loaded.filter(Boolean) as UploadedFile[];
    const tagged = valid.map(f => ({ ...f, name: `[RITNING] ${f.name}`, isDrawing: true }));
    const next   = [...drawings, ...tagged];
    setDrawings(next);
    onDrawingsChange(next);
    tagged.forEach(f => triggerAnalysis(f, true));
  }, [drawings, onDrawingsChange, readFile, triggerAnalysis]);

  const removePhoto = (i: number) => {
    const next = photos.filter((_, idx) => idx !== i);
    setPhotos(next);
    onImagesChange(next);
  };

  const removeDrawing = (i: number) => {
    const next = drawings.filter((_, idx) => idx !== i);
    setDrawings(next);
    onDrawingsChange(next);
  };

  const getKey = (f: UploadedFile) => f.name + f.data.slice(-8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── PROJEKTBILDER ── */}
      <div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}>
          <label className="label" style={{ margin: 0 }}>Projektbilder</label>
          {photos.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {photos.length}/{MAX_FILES}
            </span>
          )}
        </div>

        <div
          className={`file-drop${dragPhoto ? " drag-over" : ""}`}
          onClick={() => !disabled && photoInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragPhoto(true); }}
          onDragLeave={() => setDragPhoto(false)}
          onDrop={e => {
            e.preventDefault();
            setDragPhoto(false);
            if (!disabled) addPhotos(e.dataTransfer.files);
          }}
          style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
        >
          <div style={{ fontSize: 18, marginBottom: 6 }}>📸</div>
          <div className="file-drop-text">Dra hit eller klicka för att ladda upp</div>
          <div className="file-drop-sub">JPG, PNG, WebP · Max {MAX_SIZE_MB} MB per bild</div>
          <div className="file-drop-sub" style={{ marginTop: 4, color: "var(--accent-text)" }}>
            AI analyserar och läser av vad som syns
          </div>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept={ACCEPTED_IMAGE}
          multiple
          style={{ display: "none" }}
          onChange={e => addPhotos(e.target.files)}
          disabled={disabled}
        />

        {photos.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {photos.map((f, i) => (
              <FileRow
                key={getKey(f)}
                file={f}
                analysis={analyses[getKey(f)]}
                onRemove={() => removePhoto(i)}
                isDrawing={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── RITNINGAR / SKISSER ── */}
      <div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}>
          <label className="label" style={{ margin: 0 }}>Ritningar &amp; skisser</label>
          {drawings.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {drawings.length}/{MAX_FILES}
            </span>
          )}
        </div>

        <div
          className={`file-drop${dragDrawing ? " drag-over" : ""}`}
          onClick={() => !disabled && drawingInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragDrawing(true); }}
          onDragLeave={() => setDragDrawing(false)}
          onDrop={e => {
            e.preventDefault();
            setDragDrawing(false);
            if (!disabled) addDrawings(e.dataTransfer.files);
          }}
          style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
        >
          <div style={{ fontSize: 18, marginBottom: 6 }}>📐</div>
          <div className="file-drop-text">Ladda upp ritning eller handskiss</div>
          <div className="file-drop-sub">JPG, PNG, PDF · Handskisser fungerar utmärkt</div>
          <div className="file-drop-sub" style={{ marginTop: 4, color: "var(--accent-text)" }}>
            AI läser av mått och fyller i parametrar automatiskt
          </div>
        </div>

        <input
          ref={drawingInputRef}
          type="file"
          accept={ACCEPTED_DOC}
          multiple
          style={{ display: "none" }}
          onChange={e => addDrawings(e.target.files)}
          disabled={disabled}
        />

        {drawings.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {drawings.map((f, i) => (
              <FileRow
                key={getKey(f)}
                file={f}
                analysis={analyses[getKey(f)]}
                onRemove={() => removeDrawing(i)}
                isDrawing={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

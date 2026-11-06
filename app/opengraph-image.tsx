import { ImageResponse } from "next/og";

export const alt = "Halcyon — Calm video calls, just between you two.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#0d0f1a",
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(45,212,191,0.35), transparent 55%), radial-gradient(circle at 85% 70%, rgba(167,139,250,0.35), transparent 55%)",
          color: "#f2f4f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(135deg, #2dd4bf, #a78bfa)",
            }}
          />
          Halcyon
        </div>
        <div style={{ marginTop: 48, fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>
          Calm video calls,
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.05,
            backgroundImage: "linear-gradient(90deg, #2dd4bf, #22d3ee, #a78bfa, #fb7185)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          just between you two.
        </div>
        <div style={{ marginTop: 40, fontSize: 32, color: "#9aa3b5" }}>
          Peer-to-peer · no accounts · share a link and talk
        </div>
      </div>
    ),
    size
  );
}

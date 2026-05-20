import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ruletrade-AI";
export const size = { width: 1200, height: 630 };

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#0f172a",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: 64,
        fontWeight: 700,
      }}
    >
      Ruletrade-AI
    </div>,
    { ...size },
  );
}

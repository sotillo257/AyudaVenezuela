import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MapPicker from "./MapPicker";

vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn((opts) => opts),
  },
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="map-container" className={className}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position }: { position: [number, number] }) => <div data-testid="marker">{position.join(",")}</div>,
  useMap: () => ({ invalidateSize: vi.fn() }),
  useMapEvents: () => null,
}));

describe("MapPicker", () => {
  it("renders a clearly visible, guided map area for choosing a center location", () => {
    render(<MapPicker value={[10.5, -66.889]} onPick={vi.fn()} />);

    const region = screen.getByRole("region", { name: /seleccionar ubicación/i });
    expect(region).toHaveClass("h-72");
    expect(screen.getByTestId("map-container")).toHaveClass("h-full");
    expect(screen.getByText(/arrastra el mapa y toca el punto exacto/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seleccionar centro del mapa/i })).toBeInTheDocument();
    expect(screen.getByText(/ubicación seleccionada/i)).toBeInTheDocument();
  });
});

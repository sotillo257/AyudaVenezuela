import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MapPicker from "./MapPicker";

const setViewMock = vi.fn();
const getCurrentPositionMock = vi.fn();

vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn((opts) => opts),
  },
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, className, center }: { children: React.ReactNode; className?: string; center: [number, number] }) => (
    <div data-testid="map-container" data-center={center.join(",")} className={className}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position }: { position: [number, number] }) => <div data-testid="marker">{position.join(",")}</div>,
  useMap: () => ({ invalidateSize: vi.fn(), setView: setViewMock }),
  useMapEvents: () => null,
}));

describe("MapPicker", () => {
  beforeEach(() => {
    setViewMock.mockReset();
    getCurrentPositionMock.mockReset();
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: getCurrentPositionMock },
    });
  });

  it("renders a clearly visible, guided map area for choosing a center location", () => {
    render(<MapPicker value={[10.5, -66.889]} onPick={vi.fn()} />);

    const region = screen.getByRole("region", { name: /seleccionar ubicación/i });
    expect(region).toHaveClass("h-[26rem]");
    expect(screen.getByTestId("map-container")).toHaveClass("h-full");
    expect(screen.getByText(/arrastra el mapa y toca el punto exacto/i)).toBeInTheDocument();
    expect(screen.getByText(/intentaré centrarme en tu ubicación/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seleccionar centro del mapa/i })).toBeInTheDocument();
    expect(screen.getByText(/ubicación seleccionada/i)).toBeInTheDocument();
  });

  it("centers the map on the person's location when no point has been selected yet", async () => {
    getCurrentPositionMock.mockImplementation((success: (pos: GeolocationPosition) => void) => {
      success({
        coords: {
          latitude: 11.11,
          longitude: -66.22,
          accuracy: 15,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    });

    render(<MapPicker value={null} onPick={vi.fn()} />);

    await waitFor(() => {
      expect(getCurrentPositionMock).toHaveBeenCalledOnce();
      expect(setViewMock).toHaveBeenCalledWith([11.11, -66.22]);
    });
  });
});

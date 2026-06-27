import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
import type { Centro } from "@/lib/types";

vi.mock("next/dynamic", () => ({
  default: () => function MockMapView() {
    return <div data-testid="map-view" />;
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: [] }),
  }),
}));

const centros: Centro[] = [
  {
    id: "1",
    nombre: "Centro Agua",
    operador: "ong",
    estado: "verificado",
    lat: 40,
    lon: -3,
    direccion: null,
    area: "Madrid",
    horario: "10:00",
    contacto: null,
    acepta: ["Agua"],
    no_acepta: [],
    proxima_salida: null,
    notas: null,
    fuente_url: null,
    fuente_descripcion: null,
    ultima_verificacion: "2026-06-26T11:00:00Z",
    created_at: "2026-06-26T10:00:00Z",
    distancia_m: 2000,
  },
  {
    id: "2",
    nombre: "Centro Higiene",
    operador: "iglesia",
    estado: "verificado",
    lat: 41,
    lon: 2,
    direccion: null,
    area: "Barcelona",
    horario: null,
    contacto: null,
    acepta: ["Higiene", "Alimentos"],
    no_acepta: [],
    proxima_salida: null,
    notas: null,
    fuente_url: null,
    fuente_descripcion: null,
    ultima_verificacion: "2026-06-26T11:00:00Z",
    created_at: "2026-06-26T10:00:00Z",
    distancia_m: 1000,
  },
];

describe("AppShell", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success, error) => error({ code: 1, PERMISSION_DENIED: 1 })),
      },
    });
  });

  it("renders public centers, lists nearest first, filters by category and shows donation demand", async () => {
    const user = userEvent.setup();
    const { container } = render(<AppShell initialCentros={centros} />);

    expect(screen.getByText(/2 verificados hoy/i)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("min-h-[100dvh]");
    const bottomNav = screen.getByRole("navigation");
    expect(bottomNav).toHaveClass("sticky");
    expect(bottomNav.className).toContain("safe-area-inset-bottom");
    await user.click(screen.getByRole("button", { name: /lista/i }));

    const cards = screen.getAllByRole("button", { name: /verificado/i });
    expect(cards[0]).toHaveTextContent("Centro Higiene");
    expect(cards[0]).toHaveTextContent("1.0 km");
    expect(cards[1]).toHaveTextContent("Centro Agua");
    expect(cards[1]).toHaveTextContent("2.0 km");

    await user.click(screen.getByRole("button", { name: /^agua$/i }));
    expect(screen.getByText("Centro Agua")).toBeInTheDocument();
    expect(screen.queryByText("Centro Higiene")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /qué donar/i }));
    const donationPanel = screen.getByText("Lo más necesario ahora").closest("div")!;
    expect(donationPanel.className).toContain("safe-area-inset-bottom");
    expect(within(donationPanel).getByText("Agua")).toBeInTheDocument();
  });
});

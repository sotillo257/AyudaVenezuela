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
  {
    id: "3",
    nombre: "Centro Comunitario Nuevo",
    operador: "grupo_comunitario",
    estado: "pendiente",
    lat: 42,
    lon: -8,
    direccion: null,
    area: "Valencia",
    horario: "12:00",
    contacto: null,
    acepta: ["Ropa"],
    no_acepta: [],
    proxima_salida: null,
    notas: null,
    fuente_url: null,
    fuente_descripcion: null,
    ultima_verificacion: null,
    created_at: "2026-06-26T12:30:00Z",
    distancia_m: 500,
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

    expect(screen.getByRole("heading", { name: /centros de acopio para ayudar a venezuela/i })).toBeInTheDocument();
    expect(screen.getByText(/encuentra centros cercanos dentro y fuera de venezuela/i)).toBeInTheDocument();
    const nearText = screen.getByText(/Cerca de Plaza Venezuela, Caracas/i);
    expect(nearText).toBeInTheDocument();
    expect(nearText.parentElement).toHaveTextContent("3 centros disponibles");
    const yummyLink = screen.getAllByRole("link", { name: /dona en yummy/i })[0];
    expect(yummyLink).toHaveAttribute("href", "https://dona.yummyrides.com/");
    const locationButton = screen.getByRole("button", { name: /usar mi ubicación real/i });
    expect(locationButton).toHaveClass("px-2.5", "py-1", "text-[10.5px]");
    expect(container.firstChild).toHaveClass("min-h-[100dvh]");
    expect(screen.getByTestId("mobile-content-region")).toHaveClass("flex-1");
    expect(screen.getByTestId("mobile-shell-body")).toHaveClass("flex");
    const bottomNav = screen.getByRole("navigation");
    expect(bottomNav).toHaveClass("sticky");
    expect(bottomNav.className).toContain("safe-area-inset-bottom");
    await user.click(screen.getByRole("button", { name: /lista/i }));

    const pendingCard = screen.getByRole("button", { name: /centro comunitario nuevo/i });
    expect(pendingCard).toHaveTextContent("Centro Comunitario Nuevo");
    expect(screen.getByText(/punto sin verificar/i)).toBeInTheDocument();
    expect(pendingCard).toHaveTextContent("500 m");

    await user.click(screen.getByRole("button", { name: /^agua$/i }));
    expect(screen.getByText("Centro Agua")).toBeInTheDocument();
    expect(screen.queryByText("Centro Higiene")).not.toBeInTheDocument();
    expect(screen.queryByText("Centro Comunitario Nuevo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /qué donar/i }));
    const donationPanel = screen.getByText("Lo más necesario ahora").closest("div")!;
    expect(donationPanel.className).toContain("safe-area-inset-bottom");
    expect(within(donationPanel).getByText("Agua")).toBeInTheDocument();
  });

  it("warns clearly when a point is visible but not yet verified", async () => {
    const user = userEvent.setup();
    render(<AppShell initialCentros={centros} />);

    await user.click(screen.getByRole("button", { name: /lista/i }));
    await user.click(screen.getByRole("button", { name: /centro comunitario nuevo/i }));

    const warningBox = screen.getByText(/este punto no ha sido verificado/i).parentElement;
    expect(warningBox).toHaveTextContent("Cuidado:");
    expect(warningBox).toHaveTextContent("no sabemos si este punto es de confianza todavía");
  });
});

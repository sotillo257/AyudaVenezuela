import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import AddCenterForm from "./AddCenterForm";

const rpcMock = vi.fn();

vi.mock("next/dynamic", () => ({
  default: () => function MockMapPicker({ value, onPick }: { value: [number, number] | null; onPick: (lat: number, lon: number) => void }) {
    return (
      <div>
        <button type="button" onClick={() => onPick(10.5, -66.889)}>
          Marcar ubicación
        </button>
        <div data-testid="map-picker-value">{value ? value.join(",") : "sin-ubicacion"}</div>
      </div>
    );
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: rpcMock,
  }),
}));

describe("AddCenterForm", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pide identidad del proponente, aclara privacidad y envía esos datos para validación interna", async () => {
    const user = userEvent.setup();
    render(<AddCenterForm />);

    expect(screen.getByText(/se publica al instante como punto sin verificar/i)).toBeInTheDocument();
    expect(screen.getByText(/no se mostrarán públicamente/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/organización responsable/i), "Punto Vecinal");
    await user.type(screen.getByPlaceholderText(/persona responsable del centro/i), "María Pérez");
    await user.type(screen.getByPlaceholderText(/tu nombre/i), "Jesús");
    await user.type(screen.getByPlaceholderText(/tu apellido/i), "Sotillo");
    await user.type(screen.getByPlaceholderText(/tu teléfono/i), "+34600111222");
    await user.click(screen.getByRole("button", { name: /marcar ubicación/i }));
    await user.click(screen.getByRole("button", { name: /enviar a revisión/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("proponer_centro", expect.objectContaining({
        p_nombre: "Punto Vecinal",
        p_responsable: "María Pérez",
        p_proponente_nombre: "Jesús",
        p_proponente_apellido: "Sotillo",
        p_proponente_telefono: "+34600111222",
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(/ya aparece en el mapa como punto sin verificar/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/un moderador lo revisará/i)).toBeInTheDocument();
  });

  it("mantiene los campos del formulario alineados a ancho completo en móvil", () => {
    render(<AddCenterForm />);

    const direccion = screen.getByPlaceholderText(/dirección/i);
    const area = screen.getByPlaceholderText(/zona \/ ciudad/i);
    const responsable = screen.getByPlaceholderText(/persona responsable del centro/i);
    const nombre = screen.getByPlaceholderText(/tu nombre/i);
    const apellido = screen.getByPlaceholderText(/tu apellido/i);
    const telefono = screen.getByPlaceholderText(/tu teléfono/i);

    expect(direccion).toHaveClass("block", "w-full", "min-w-0");
    expect(area).toHaveClass("block", "w-full", "min-w-0");
    expect(nombre).toHaveClass("block", "w-full", "min-w-0");
    expect(apellido).toHaveClass("block", "w-full", "min-w-0");
    expect(responsable.parentElement).toHaveClass("grid", "w-full", "grid-cols-1");
    expect(telefono.parentElement).toHaveClass("grid", "w-full", "grid-cols-1");
    expect(direccion.parentElement).toHaveClass("grid", "w-full", "grid-cols-1");
    expect(area.parentElement).toBe(direccion.parentElement);
    expect(nombre.parentElement).toHaveClass("grid", "w-full", "grid-cols-1");
    expect(apellido.parentElement).toBe(nombre.parentElement);
  });

  it("usa sugerencias de dirección para rellenar el mapa con un punto aproximado antes del ajuste manual", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ([{
        place_id: 123,
        display_name: "Av. Libertador, Caracas, Distrito Capital, Venezuela",
        lat: "10.5006",
        lon: "-66.8890",
        address: { city: "Caracas" },
      }]),
    } as Response);

    render(<AddCenterForm />);

    await user.type(
      screen.getByPlaceholderText(/escribe una calle, zona o referencia/i),
      "Av Libertador Caracas"
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    const suggestion = await screen.findByRole("button", { name: /av\. libertador, caracas/i });
    await user.click(suggestion);

    expect(screen.getByPlaceholderText(/dirección/i)).toHaveValue("Av. Libertador, Caracas, Distrito Capital, Venezuela");
    expect(screen.getByPlaceholderText(/zona \/ ciudad/i)).toHaveValue("Caracas");
    expect(screen.getByTestId("map-picker-value")).toHaveTextContent("10.5006,-66.889");
    expect(screen.getByText(/punto aproximado colocado desde/i)).toBeInTheDocument();
  });

  it("bloquea el envío si faltan los datos de identificación del proponente", async () => {
    const user = userEvent.setup();
    render(<AddCenterForm />);

    await user.type(screen.getByPlaceholderText(/organización responsable/i), "Punto Vecinal");
    await user.click(screen.getByRole("button", { name: /marcar ubicación/i }));
    await user.click(screen.getByRole("button", { name: /enviar a revisión/i }));

    expect(screen.getByText(/necesitamos nombre, apellido y teléfono/i)).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

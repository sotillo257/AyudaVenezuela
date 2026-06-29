import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AddCenterForm from "./AddCenterForm";

const rpcMock = vi.fn();

vi.mock("next/dynamic", () => ({
  default: () => function MockMapPicker({ onPick }: { onPick: (lat: number, lon: number) => void }) {
    return (
      <button type="button" onClick={() => onPick(10.5, -66.889)}>
        Marcar ubicación
      </button>
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

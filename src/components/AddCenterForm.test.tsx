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

  it("explains that new points appear immediately as unverified and keeps that message after submit", async () => {
    const user = userEvent.setup();
    render(<AddCenterForm />);

    expect(screen.getByText(/se publica al instante como punto sin verificar/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/organización responsable/i), "Punto Vecinal");
    await user.click(screen.getByRole("button", { name: /marcar ubicación/i }));
    await user.click(screen.getByRole("button", { name: /enviar a revisión/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya aparece en el mapa como punto sin verificar/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/un moderador lo revisará/i)).toBeInTheDocument();
  });
});

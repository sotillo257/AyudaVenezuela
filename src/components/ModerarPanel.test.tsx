import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ModerarPanel from "./ModerarPanel";

const signInWithPassword = vi.fn();
const signInWithOtp = vi.fn();
const signOut = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn();
const rpc = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const inMock = vi.fn();
const orderMock = vi.fn();
const updateMock = vi.fn();
const updateEqMock = vi.fn();
const deleteMock = vi.fn();
const deleteEqMock = vi.fn();
const contactosSelectMock = vi.fn();
const contactosOrderMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession,
      onAuthStateChange,
      signInWithPassword,
      signInWithOtp,
      signOut,
    },
    rpc,
    from: fromMock,
  }),
}));

const centroPendiente = {
  id: "centro-1",
  nombre: "Centro comunitario nuevo",
  operador: "asociacion",
  estado: "pendiente",
  lat: 10.5,
  lon: -66.9,
  direccion: "Av. Libertador",
  area: "Caracas",
  horario: null,
  contacto: "0412-0000000",
  acepta: ["Agua", "Alimentos"],
  no_acepta: [],
  proxima_salida: null,
  notas: null,
  fuente_url: "https://ejemplo.com/evidencia",
  fuente_descripcion: null,
  ultima_verificacion: null,
  created_at: "2026-06-27T10:00:00.000Z",
};

function mockModeratorSession() {
  getSession.mockResolvedValue({
    data: {
      session: {
        user: {
          email: "admin@example.com",
        },
      },
    },
  });
  rpc.mockResolvedValue({ data: true, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();

  getSession.mockResolvedValue({ data: { session: null } });
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  rpc.mockResolvedValue({ data: false, error: null });

  orderMock.mockResolvedValue({ data: [centroPendiente], error: null });
  inMock.mockReturnValue({ order: orderMock });
  selectMock.mockReturnValue({ in: inMock });

  updateEqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: updateEqMock });

  deleteEqMock.mockResolvedValue({ error: null });
  deleteMock.mockReturnValue({ eq: deleteEqMock });

  contactosOrderMock.mockResolvedValue({ data: [], error: null });
  contactosSelectMock.mockReturnValue({ order: contactosOrderMock });

  fromMock.mockImplementation((table: string) => {
    if (table === "v_centros") return { select: selectMock };
    if (table === "centros") return { update: updateMock, delete: deleteMock };
    if (table === "contactos") return { select: contactosSelectMock };
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("ModerarPanel", () => {
  it("uses email and password login for moderators instead of magic-link OTP", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<ModerarPanel />);

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "secret123");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "secret123",
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("lets moderators edit a center directly from the moderation area", async () => {
    mockModeratorSession();
    const user = userEvent.setup();

    render(<ModerarPanel />);

    expect(await screen.findByText(/centro comunitario nuevo/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /editar/i }));
    const nombreInput = screen.getByLabelText(/nombre del centro/i);
    const areaInput = screen.getByLabelText(/zona o ciudad/i);
    const aceptaInput = screen.getByLabelText(/qué acepta/i);

    await user.clear(nombreInput);
    await user.type(nombreInput, "Centro actualizado");
    await user.clear(areaInput);
    await user.type(areaInput, "Valencia");
    await user.clear(aceptaInput);
    await user.type(aceptaInput, "Agua, Medicinas, Mantas");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        nombre: "Centro actualizado",
        area: "Valencia",
        direccion: "Av. Libertador",
        contacto: "0412-0000000",
        fuente_url: "https://ejemplo.com/evidencia",
        acepta: ["Agua", "Medicinas", "Mantas"],
      });
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "centro-1");
    expect(await screen.findByText(/cambios guardados/i)).toBeInTheDocument();
  });

  it("lets moderators delete a center from the moderation area", async () => {
    mockModeratorSession();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<ModerarPanel />);

    expect(await screen.findByText(/centro comunitario nuevo/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
    expect(deleteEqMock).toHaveBeenCalledWith("id", "centro-1");
    expect(await screen.findByText(/centro eliminado/i)).toBeInTheDocument();

    confirmSpy.mockRestore();
  });
});

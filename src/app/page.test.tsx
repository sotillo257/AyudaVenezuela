import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const inMock = vi.fn();
const orderMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/components/AppShell", () => ({
  default: ({ initialCentros }: { initialCentros: unknown[] }) => (
    <div>
      <span>centros: {initialCentros.length}</span>
    </div>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: fromMock,
  }),
}));

beforeEach(() => {
  inMock.mockReset();
  orderMock.mockReset();
  selectMock.mockReset();
  fromMock.mockReset();

  orderMock.mockResolvedValue({
    data: [{ id: "1", nombre: "visible", estado: "pendiente" }],
    error: null,
  });
  inMock.mockReturnValue({ order: orderMock });
  selectMock.mockReturnValue({ in: inMock });
  fromMock.mockReturnValue({ select: selectMock });
});

describe("HomePage", () => {
  it("loads verified and pending centers so new reports are visible immediately", async () => {
    const { default: HomePage } = await import("./page");
    const page = await HomePage();
    render(page);

    expect(fromMock).toHaveBeenCalledWith("v_centros");
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(inMock).toHaveBeenCalledWith("estado", ["verificado", "pendiente"]);
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(screen.getByText(/centros: 1/i)).toBeInTheDocument();
  });
});

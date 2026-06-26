import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ModerarPanel from "./ModerarPanel";

const signInWithPassword = vi.fn();
const signInWithOtp = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession,
      onAuthStateChange,
      signInWithPassword,
      signInWithOtp,
      signOut: vi.fn(),
    },
    rpc,
    from: vi.fn(),
  }),
}));

describe("ModerarPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null } });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    rpc.mockResolvedValue({ data: false });
  });

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
});

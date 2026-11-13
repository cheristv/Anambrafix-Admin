
import { supabase } from "./supabase";

export type AdminRegistrationInput = {
  fullName: string;
  email: string;
  password: string;
};

export async function registerAdmin(
  input: AdminRegistrationInput
): Promise<void> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    throw new Error("Please sign in with the owner account first.");
  }

  const { data, error } = await supabase.functions.invoke("create-admin", {
    body: {
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    },
  });

  if (error) {
    throw new Error(
      error.message || "Could not connect to the administrator service."
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.success) {
    throw new Error("The administrator account could not be confirmed.");
  }
}

import { createClient } from './client';

// Iniciar sesión con email y contraseña
export async function login(email: string, password: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

// Cerrar sesión
export async function logout() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

// Obtener sesión actual
export async function getSession() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

// Obtener usuario autenticado actual
export async function getUser() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

// Verificar si el usuario está autenticado
export async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

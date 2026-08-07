import { createClient } from './client';
import { Usuario, Rol, SesionUsuario } from '../types/models';

// Obtener usuario por email (después de autenticarse)
export async function getUsuarioByEmail(email: string): Promise<Usuario | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('activo', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

  return data || null;
}

// Obtener roles de un usuario
export async function getRolesDelUsuario(
  usuarioId: string
): Promise<Rol[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('usuarios_roles')
    .select(
      `
      rol_id,
      roles (
        id,
        nombre,
        areas_permitidas
      )
    `
    )
    .eq('usuario_id', usuarioId);

  if (error) throw error;

  return data?.map((item: any) => item.roles) || [];
}

// Obtener sesión completa del usuario (usuario + roles)
export async function getSesionUsuario(
  usuarioId: string
): Promise<SesionUsuario | null> {
  const supabase = createClient();

  const { data: usuario, error: errorUsuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', usuarioId)
    .single();

  if (errorUsuario && errorUsuario.code !== 'PGRST116') throw errorUsuario;

  if (!usuario) return null;

  const roles = await getRolesDelUsuario(usuarioId);

  return {
    ...usuario,
    roles,
  };
}

// Obtener todos los roles disponibles (para administración)
export async function getAllRoles(): Promise<Rol[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('nombre');

  if (error) throw error;

  return data || [];
}

// Crear usuario (solo administrador)
export async function crearUsuario(
  email: string,
  nombre: string,
  password: string
): Promise<Usuario> {
  const supabase = createClient();

  // Crear usuario en Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;

  // Crear usuario en tabla usuarios
  const { data, error } = await supabase
    .from('usuarios')
    .insert([
      {
        id: authData.user!.id,
        email,
        nombre,
        activo: true,
        created_by: 'system', // Será reemplazado por usuario autenticado en la lógica
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}

// Asignar rol a usuario
export async function asignarRolAlUsuario(
  usuarioId: string,
  rolId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from('usuarios_roles').insert([
    {
      usuario_id: usuarioId,
      rol_id: rolId,
    },
  ]);

  if (error && !error.message.includes('duplicate')) throw error;
}

// Desactivar usuario
export async function desactivarUsuario(usuarioId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('usuarios')
    .update({ activo: false, archived_at: new Date().toISOString() })
    .eq('id', usuarioId);

  if (error) throw error;
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CENTRO_ID = '12345678-1234-5678-1234-567812345678';
const SISTEMA_ID = '00000000-0000-0000-0000-000000000000';

const users = [
  {
    email: `admin+${Date.now()}@clinic.test`,
    password: 'AdminClinic123!',
    nombre: 'Administrador',
    rol: 'Administrador del sistema'
  },
  {
    email: `staff+${Date.now()}@clinic.test`,
    password: 'StaffClinic123!',
    nombre: 'Staff Administrativo',
    rol: 'Administración'
  },
  {
    email: `podo+${Date.now()}@clinic.test`,
    password: 'PodoClinic123!',
    nombre: 'Podólogo',
    rol: 'Podólogo'
  },
  {
    email: `ortho+${Date.now()}@clinic.test`,
    password: 'OrthoClinic123!',
    nombre: 'Ortopedia',
    rol: 'Ortopedia'
  }
];

async function setupUsers() {
  console.log('🔧 Setup de usuarios de prueba...\n');

  for (const user of users) {
    try {
      // 1. Crear en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      if (authError) throw authError;

      const userId = authData.user.id;
      console.log(`✅ Usuario Auth creado: ${user.email} (${userId})`);

      // 2. Insertar en tabla usuarios
      const { error: userError } = await supabase
        .from('usuarios')
        .insert({
          id: userId,
          email: user.email,
          nombre: user.nombre,
          activo: true,
          centro_id: CENTRO_ID,
          created_by: SISTEMA_ID,
        });

      if (userError) throw userError;
      console.log(`✅ Usuario BD insertado: ${user.nombre}`);

      // 3. Obtener rol ID y asignar
      const { data: rolData, error: rolError } = await supabase
        .from('roles')
        .select('id')
        .eq('nombre', user.rol)
        .single();

      if (rolError) throw rolError;

      const { error: assignError } = await supabase
        .from('usuarios_roles')
        .insert({
          usuario_id: userId,
          rol_id: rolData.id,
        });

      if (assignError) throw assignError;
      console.log(`✅ Rol asignado: ${user.rol}\n`);

    } catch (err) {
      console.error(`❌ Error con ${user.email}:`, err.message);
    }
  }

  console.log('🎉 Setup completado!\n');
  console.log('Credenciales de prueba:');
  users.forEach(u => {
    console.log(`  📧 ${u.email} / 🔑 ${u.password}`);
  });
}

setupUsers().catch(console.error);

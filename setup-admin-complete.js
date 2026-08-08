const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';

const CENTRO_ID = '12345678-1234-5678-1234-567812345678';
const SISTEMA_ID = '00000000-0000-0000-0000-000000000000';

const USER_ID = '8ab33311-0a88-4b23-a006-9884250c4f69';
const EMAIL = 'admin.phase1.1786221633221@clinic.local';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function setupAdmin() {
  try {
    console.log('\n🔧 Setup del admin...\n');

    // 1. Insertar en usuarios
    const { error: userError } = await supabase
      .from('usuarios')
      .insert({
        id: USER_ID,
        email: EMAIL,
        nombre: 'Administrador',
        activo: true,
        centro_id: CENTRO_ID,
        created_by: SISTEMA_ID,
      });

    if (userError) throw userError;
    console.log('✅ Usuario insertado en tabla usuarios');

    // 2. Obtener rol ID
    const { data: rolData, error: rolError } = await supabase
      .from('roles')
      .select('id')
      .eq('nombre', 'Administrador del sistema')
      .single();

    if (rolError) throw rolError;

    // 3. Asignar rol
    const { error: assignError } = await supabase
      .from('usuarios_roles')
      .insert({
        usuario_id: USER_ID,
        rol_id: rolData.id,
      });

    if (assignError && assignError.code !== '23505') throw assignError;
    console.log('✅ Rol asignado');

    console.log('\n✨ Setup completado\n');
    console.log('📧 Email: ' + EMAIL);
    console.log('🔑 Password: AdminPhase1!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

setupAdmin();

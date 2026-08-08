const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';

const CENTRO_ID = '12345678-1234-5678-1234-567812345678';
const SISTEMA_ID = '00000000-0000-0000-0000-000000000000';

const timestamp = Date.now();
const testUser = {
  email: `test${timestamp}@clinicos.local`,
  password: 'TestUser123!@#',
  nombre: 'Usuario de Prueba',
  rol: 'Administrador del sistema'
};

async function createUser() {
  try {
    // Usar ADMIN_KEY para bypass RLS
    const supabase = createClient(SUPABASE_URL, ADMIN_KEY);

    console.log('\n🔧 Creando usuario de prueba...\n');

    // 1. Crear en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
    });

    if (authError) throw authError;

    const userId = authData.user.id;
    console.log(`✅ Usuario Auth creado: ${testUser.email}`);
    console.log(`   ID: ${userId}`);

    // 2. Insertar en tabla usuarios
    const { error: userError } = await supabase
      .from('usuarios')
      .insert({
        id: userId,
        email: testUser.email,
        nombre: testUser.nombre,
        activo: true,
        centro_id: CENTRO_ID,
        created_by: SISTEMA_ID,
      });

    if (userError) throw userError;
    console.log(`✅ Usuario BD insertado`);

    // 3. Obtener rol ID y asignar
    const { data: rolData, error: rolError } = await supabase
      .from('roles')
      .select('id')
      .eq('nombre', testUser.rol)
      .single();

    if (rolError) throw rolError;

    const { error: assignError } = await supabase
      .from('usuarios_roles')
      .insert({
        usuario_id: userId,
        rol_id: rolData.id,
      });

    if (assignError) throw assignError;
    console.log(`✅ Rol asignado: ${testUser.rol}\n`);

    console.log('\n✨ Usuario creado exitosamente\n');
    console.log('📧 Email: ' + testUser.email);
    console.log('🔑 Password: ' + testUser.password + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createUser();

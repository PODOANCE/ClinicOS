const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

async function auditUsers() {
  const supabase = createClient(SUPABASE_URL, ADMIN_KEY);

  console.log('\n📋 AUDITORÍA: USUARIOS EXISTENTES EN public.usuarios\n');
  console.log('====================\n');

  // 1. Obtener todos en auth.users
  console.log('1️⃣  Consultando auth.users...\n');
  const authResult = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=100`,
    {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ADMIN_KEY}`
      }
    }
  );

  const authData = await authResult.json();
  const authUsers = authData.users || [];
  const authMap = new Map(authUsers.map(u => [u.email, u.id]));

  console.log(`Usuarios en auth.users: ${authUsers.length}\n`);

  // 2. Obtener todos los usuarios en public.usuarios
  const { data: publicUsers, error: publicError } = await supabase
    .from('usuarios')
    .select('id, email, nombre, activo, created_by, created_at')
    .order('email');

  if (publicError) {
    console.log(`❌ Error: ${publicError.message}`);
    return;
  }

  console.log(`\n2️⃣  Usuarios en public.usuarios: ${publicUsers?.length || 0}\n`);
  console.log('====================\n');

  let inAuthCount = 0;
  let notInAuthCount = 0;

  publicUsers?.forEach((user, idx) => {
    const authId = authMap.get(user.email);
    const inAuth = !!authId;
    const status = inAuth ? '✅' : '❌';

    if (inAuth) inAuthCount++;
    else notInAuthCount++;

    console.log(`${idx + 1}. ${user.email}`);
    console.log(`   ID en BD: ${user.id}`);
    if (authId) console.log(`   ID en Auth: ${authId}`);
    console.log(`   Nombre: ${user.nombre}`);
    console.log(`   Activo: ${user.activo}`);
    console.log(`   En Auth: ${status}`);
    console.log('');
  });

  // 3. Resumen
  console.log('\nRESUMEN:\n');
  console.log(`✅ Usuarios en AMBOS (Auth + BD): ${inAuthCount}`);
  console.log(`❌ Usuarios SOLO en BD (Sin Auth): ${notInAuthCount}\n`);

  console.log('RECOMENDACIONES:\n');

  if (notInAuthCount > 0) {
    const notInAuth = publicUsers?.filter(u => !authMap.has(u.email)) || [];
    console.log(`Los ${notInAuthCount} usuarios sin Auth son:\n`);
    notInAuth.forEach(u => {
      console.log(`- ${u.email}`);
    });
    console.log('\nOpciones:');
    console.log('1. Eliminar (si son datos de prueba)');
    console.log('2. Mantener (si son usuarios reales pendientes de Auth)');
    console.log('3. Crear sus credenciales en Auth');
  }

  // 4. Verificar roles de los usuarios
  console.log('\n\n3️⃣  ROLES ASIGNADOS A USUARIOS\n');
  console.log('====================\n');

  const { data: roles, error: rolesError } = await supabase
    .from('usuarios_roles')
    .select('usuario_id, rol_id, roles(nombre)')
    .order('usuario_id');

  if (rolesError) {
    console.log(`❌ Error: ${rolesError.message}`);
  } else {
    console.log(`Total de asignaciones: ${roles?.length || 0}\n`);

    if (roles && roles.length > 0) {
      roles.forEach(r => {
        const user = publicUsers?.find(u => u.id === r.usuario_id);
        console.log(`${user?.email || r.usuario_id.slice(0, 8) + '...'} → ${r.roles?.nombre}`);
      });
    } else {
      console.log('❌ NINGÚN USUARIO TIENE ROLES ASIGNADOS\n');
      console.log('Acción necesaria: Asignar roles explícitamente');
    }
  }

  console.log('\n');
}

auditUsers().catch(console.error);

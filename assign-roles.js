const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const assignments = [
  {
    email: 'admin@podologiarivas.com',
    userId: '89298c82-43bf-42b9-9757-316866b95877',
    roleName: 'Administrador del sistema'
  },
  {
    email: 'info@podologiarivas.com',
    userId: 'd78b3b25-7b7c-4d9d-8b12-f58e1d2ea1b1',
    roleName: 'Administración'
  },
  {
    email: 'ortopedia@podologiarivas.com',
    userId: '790b0886-2061-4a20-800e-8d33b504392c',
    roleName: 'Ortopedia'
  },
  {
    email: 'podologia@podologiarivas.com',
    userId: '4c79228a-7646-4b8f-b451-075201c966eb',
    roleName: 'Podólogo'
  }
];

async function assignRoles() {
  console.log('🔄 Asignando roles a usuarios...\n');

  for (const assignment of assignments) {
    try {
      // Obtener ID del rol
      const { data: rolData, error: rolError } = await supabase
        .from('roles')
        .select('id')
        .eq('nombre', assignment.roleName)
        .single();

      if (rolError) throw rolError;

      // Asignar rol
      const { error: assignError } = await supabase
        .from('usuarios_roles')
        .insert({
          usuario_id: assignment.userId,
          rol_id: rolData.id,
        });

      if (assignError && assignError.code !== '23505') throw assignError; // 23505 = unique violation (already exists)

      console.log(`✅ ${assignment.email} → ${assignment.roleName}`);
    } catch (err) {
      console.error(`❌ ${assignment.email}: ${err.message}`);
    }
  }

  console.log('\n✅ Roles asignados correctamente');
}

assignRoles();

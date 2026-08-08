const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkUserRoles() {
  try {
    const { data: usuariosRoles, error } = await supabase
      .from('usuarios_roles')
      .select(`
        usuario_id,
        rol_id,
        usuarios (email, nombre),
        roles (nombre, areas_permitidas)
      `);

    if (error) throw error;

    console.log('\n📋 ASIGNACIONES DE ROLES:\n');
    if (usuariosRoles && usuariosRoles.length > 0) {
      usuariosRoles.forEach(ur => {
        console.log(`  Usuario: ${ur.usuarios?.email}`);
        console.log(`  Rol: ${ur.roles?.nombre}`);
        console.log(`  Áreas permitidas:`, Object.keys(ur.roles?.areas_permitidas || {}));
        console.log('');
      });
    } else {
      console.log('  (Ninguna asignación)\n');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkUserRoles();

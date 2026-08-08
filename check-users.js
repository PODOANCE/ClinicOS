const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkUsers() {
  try {
    // Obtener usuarios de la tabla usuarios
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, email, nombre, activo');

    if (error) throw error;

    console.log('\n📋 USUARIOS EN TABLA usuarios:\n');
    if (usuarios && usuarios.length > 0) {
      usuarios.forEach(u => {
        console.log(`  Email: ${u.email}`);
        console.log(`  ID: ${u.id}`);
        console.log(`  Nombre: ${u.nombre}`);
        console.log(`  Activo: ${u.activo}\n`);
      });
    } else {
      console.log('  (Ninguno)\n');
    }

    // Obtener roles
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, nombre');

    if (rolesError) throw rolesError;

    console.log('📋 ROLES DISPONIBLES:\n');
    if (roles && roles.length > 0) {
      roles.forEach(r => {
        console.log(`  ${r.nombre} (${r.id})`);
      });
      console.log('');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkUsers();

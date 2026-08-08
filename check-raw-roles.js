const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function check() {
  try {
    // Query sin joins para ver datos raw
    const { data, error } = await supabase
      .from('usuarios_roles')
      .select('usuario_id, rol_id');

    if (error) {
      console.log('Error con RLS, intentando sin autenticación...');
      console.error(error.message);
      return;
    }

    console.log('\n📋 DATOS RAW DE usuarios_roles:\n');
    if (data && data.length > 0) {
      console.log(`  Total registros: ${data.length}\n`);
      data.forEach((row, i) => {
        console.log(`  ${i+1}. usuario_id: ${row.usuario_id}`);
        console.log(`     rol_id: ${row.rol_id}\n`);
      });
    } else {
      console.log('  (Vacía)\n');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

check();

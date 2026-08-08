const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';
const ADMIN_ID = 'dd87f885-8b49-4b25-9592-a5e49c08c746';
const NEW_PASSWORD = 'AdminPhase1!';

async function resetPassword() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${ADMIN_ID}`,
      {
        method: 'PUT',
        headers: {
          'apikey': ADMIN_KEY,
          'Authorization': `Bearer ${ADMIN_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: NEW_PASSWORD,
        }),
      }
    );

    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Contraseña reseteada exitosamente\n');
      console.log('📧 Email: admin@podologiarivas.com');
      console.log(`🔑 Contraseña: ${NEW_PASSWORD}\n`);
    } else {
      console.error('❌ Error:', data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

resetPassword();

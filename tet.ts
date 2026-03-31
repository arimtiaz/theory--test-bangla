/**
 * Quick subscription API check for user 351da100-023d-4fa9-9b85-8db02b4164e9
 */

const USER_ID = '351da100-023d-4fa9-9b85-8db02b4164e9';
const BASE_URL = 'https://api.theorytestbangla.co.uk/api/admin/users';
const ADMIN_TOKEN = 'theorytestbangla.admin.superaccess';

async function checkSubscription() {
  console.log(`\n=== Checking subscription for user: ${USER_ID} ===\n`);

  // 1) Try GET on the user endpoint to read current status
  console.log('--- GET /api/admin/users/{userId}/role ---');
  try {
    const getRes = await fetch(`${BASE_URL}/${USER_ID}/role`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    const getText = await getRes.text();
    console.log(`Status: ${getRes.status}`);
    try {
      console.log('Body:', JSON.stringify(JSON.parse(getText), null, 2));
    } catch {
      console.log('Body:', getText);
    }
  } catch (err) {
    console.error('GET error:', err);
  }

  // 2) Try GET on the user endpoint directly
  console.log('\n--- GET /api/admin/users/{userId} ---');
  try {
    const getRes2 = await fetch(`${BASE_URL}/${USER_ID}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    const getText2 = await getRes2.text();
    console.log(`Status: ${getRes2.status}`);
    try {
      console.log('Body:', JSON.stringify(JSON.parse(getText2), null, 2));
    } catch {
      console.log('Body:', getText2);
    }
  } catch (err) {
    console.error('GET error:', err);
  }

  // 3) PUT to update subscription to premium and see response
  console.log('\n--- PUT /api/admin/users/{userId}/role (subscription: premium) ---');
  try {
    const putRes = await fetch(`${BASE_URL}/${USER_ID}/role`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription: 'premium' }),
    });
    const putText = await putRes.text();
    console.log(`Status: ${putRes.status}`);
    try {
      console.log('Body:', JSON.stringify(JSON.parse(putText), null, 2));
    } catch {
      console.log('Body:', putText);
    }
  } catch (err) {
    console.error('PUT error:', err);
  }
}

checkSubscription();

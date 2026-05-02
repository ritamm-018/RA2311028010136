const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://20.207.122.201/evaluation-service';

/**
 * Authenticates and obtains access token
 * @returns {Promise<string>} The access token
 */
async function authenticate() {
  const payload = {
    email: process.env.EMAIL,
    name: process.env.NAME,
    rollNo: process.env.ROLL_NO,
    accessCode: process.env.ACCESS_CODE,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET
  };

  try {
    const response = await axios.post(`${BASE_URL}/auth`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.status === 200 || response.status === 201) {
      if (response.data.access_token) {
        const token = response.data.access_token;
        console.log('Authentication successful, token obtained');

        // Save to .env
        const envPath = '.env';
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf8');
        }
        const lines = envContent.split('\n').filter(line => !line.startsWith('ACCESS_TOKEN='));
        lines.push(`ACCESS_TOKEN=${token}`);
        fs.writeFileSync(envPath, lines.join('\n'));

        return token;
      } else {
        console.log('Auth response:', JSON.stringify(response.data, null, 2));
        throw new Error('Authentication failed: no token in response');
      }
    } else {
      throw new Error('Authentication failed: bad status');
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    throw error;
  }
}

if (require.main === module) {
  authenticate().catch(console.error);
}

module.exports = { authenticate };
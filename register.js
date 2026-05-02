const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://20.207.122.201/evaluation-service';

/**
 * Registers with the evaluation service
 * @returns {Promise<Object>} Registration response with clientID and clientSecret
 */
async function register() {
  const payload = {
    email: rd9169@srmist.edu.in,
    name: Ritam Dutta,
    mobileNo: 9741768650,
    githubUsername: ritamm-018,
    rollNo: RA2311028010136,
    accessCode: QkbpxH
  };

  try {
    const response = await axios.post(`${BASE_URL}/register`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.status === 200) {
      console.log('Registration successful:', response.data);
      return response.data;
    } else {
      throw new Error(`Registration failed with status ${response.status}`);
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      console.log('Already registered:', error.response.data);
      return error.response.data;
    }
    console.error('Registration error:', error.message);
    throw error;
  }
}

if (require.main === module) {
  register().catch(console.error);
}

module.exports = { register };

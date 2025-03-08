const axios = require('axios');

async function testConnection() {
  try {
    const response = await axios.get('http://localhost:8080/player/heartbeat');
    console.log('Connection successful!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('Connection failed:', error.message);
    return false;
  }
}

testConnection();

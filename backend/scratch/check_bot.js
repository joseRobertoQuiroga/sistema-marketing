const axios = require('axios');
const token = '8764826903:AAF8b81R4yIt3ibB2SBQbN9DSa8ZDlECDt8';

async function checkBot() {
    try {
        const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
        console.log('✅ Bot Info:', res.data);
    } catch (error) {
        console.error('❌ Error checking bot:', error.response ? error.response.data : error.message);
    }
}

checkBot();

const https = require('https');

const API_KEY = 'sbp_cacff619be703fc9db7bc910c8cbb077a639c700';

const data = JSON.stringify({
    password: 'VittaiaUser2026DBpwd'
});

const req = https.request('https://api.supabase.com/v1/projects/ftmtmzfhysyvkxpukcpa/database/password', {
    method: 'PATCH',
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
}, (res) => {
    let respData = '';
    res.on('data', chunk => respData += chunk);
    res.on('end', () => console.log('Reset DB Password Response:', res.statusCode, respData));
});
req.on('error', console.error);
req.write(data);
req.end();

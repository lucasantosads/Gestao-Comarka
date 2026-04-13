const https = require('https');
const fs = require('fs');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nZm5vamJidnVtdWp6Zmtsa2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMyMzMwOCwiZXhwIjoyMDg5ODk5MzA4fQ.EFCFnNP7bt1KuT2KcDp-aF0_zDOvblNkcrfw8-5zVNk';
const url = 'https://ogfnojbbvumujzfklkhh.supabase.co/rest/v1/?apikey=' + SERVICE_KEY;

https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        fs.writeFileSync('openapi.json', data);
        console.log('OpenAPI fetched successfully with Service Role key');
    });
}).on('error', e => console.error(e));

const fs = require('fs');
const path = require('path');

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content;
            
            newContent = newContent.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL!/g, '(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co")');
            newContent = newContent.replace(/process\.env\.SUPABASE_SERVICE_ROLE_KEY!/g, '(process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")');
            newContent = newContent.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!/g, '(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")');
            
            // Just in case it's process.env.NEXT_PUBLIC_SUPABASE_URL as string
            newContent = newContent.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL as string/g, '(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co")');
            newContent = newContent.replace(/process\.env\.SUPABASE_SERVICE_ROLE_KEY as string/g, '(process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")');
            
            if (newContent !== content) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log('Updated: ' + fullPath);
            }
        }
    }
}

walk('./src');

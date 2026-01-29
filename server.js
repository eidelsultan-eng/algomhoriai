const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'gomhouria_db.json');
const PORT = 8080;

if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // API Routes
    if (req.url === '/api/patients') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fs.readFileSync(DB_FILE, 'utf8'));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                const newPatient = JSON.parse(body);
                let data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                const idx = data.findIndex(p => p.id === newPatient.id);
                if (idx !== -1) data[idx] = newPatient; else data.push(newPatient);
                fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
                res.writeHead(200); res.end(JSON.stringify({ status: 'ok' }));
            });
        }
        return;
    }

    // Static Files (Serve the App)
    let url = req.url.split('?')[0];
    let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
    let ext = path.extname(filePath);
    let types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

    fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end("Not Found"); }
        else { res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' }); res.end(content); }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.clear();
    console.log("------------------------------------------");
    console.log("       AL-GOMHOURIA LAB SERVER READY");
    console.log("------------------------------------------");
    console.log("1. Keep this window OPEN.");
    console.log("2. On OTHER devices (Tablet/PC), open Chrome and type:");

    // Auto-detect IPs to show user
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`\n   --> URL: http://${net.address}:${PORT}`);
            }
        }
    }
    console.log("\n------------------------------------------");
});

// server.js
const { exec } = require('child_process');
const port = process.env.PORT || 3000;

// Este comando inicia el servidor integrado de PHP
const phpServer = exec(`php -S 0.0.0.0:${port} -t .`);

phpServer.stdout.on('data', (data) => console.log(`PHP: ${data}`));
phpServer.stderr.on('data', (data) => console.error(`PHP Error: ${data}`));

console.log(`Zenith AI escuchando en el puerto ${port}...`);
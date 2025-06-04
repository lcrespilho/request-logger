const express = require('express')
const http = require('http') // Necessário para SSE
const path = require('path')

const app = express()
const server = http.createServer(app) // Usaremos este server para SSE
const PORT = process.env.PORT || 1029 // Use a porta do ambiente ou 3000

// CORS disabled because my nginx adds cors headers
//const cors = require('cors')
// Enable CORS for all routes
//app.use(
//  cors({
//    credentials: true,
//  })
//)

// ----- Armazenamento em Memória -----
let loggedRequests = [] // Array para guardar os logs
const MAX_LOGS = 1000 // Limite de logs

// ----- Middleware -----
// Para parsear JSON no corpo das requisições POST
app.use(express.json())
// Para parsear dados de formulários urlencoded (menos comum para APIs, mas útil)
app.use(express.urlencoded({ extended: true }))
// Para servir arquivos estáticos (HTML, JS do painel)
app.use(express.static(path.join(__dirname, 'public')))

// ----- Lógica do Server-Sent Events (SSE) -----
let sseClients = [] // Lista de clientes conectados ao painel

// Função para enviar atualização para todos os clientes SSE conectados
function sendUpdateToClients(data) {
  const formattedData = `data: ${JSON.stringify(data)}\n\n` // Formato SSE: "data: {json}\n\n"
  console.log(`Sending update to ${sseClients.length} clients`)
  sseClients.forEach(client => client.res.write(formattedData))
}

// ----- Rota do Painel de logs -----
// Serve o arquivo HTML do painel
app.get('/logs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logs.html'))
})

// Endpoint SSE que os clientes do painel irão conectar
app.get('/sse', (req, res) => {
  // Headers essenciais para SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Important for nginx
  res.flushHeaders() // Envia os headers imediatamente

  const clientId = Date.now()
  const newClient = { id: clientId, res }
  sseClients.push(newClient)
  console.log(`Client ${clientId} connected via SSE`)

  // Envia os logs atuais quando um cliente conecta pela primeira vez
  // Envia como um evento especial 'initial'
  res.write(`data: ${JSON.stringify({ type: 'initial', logs: loggedRequests })}\n\n`)

  // Lida com desconexão do cliente
  req.on('close', () => {
    console.log(`Client ${clientId} disconnected`)
    sseClients = sseClients.filter(client => client.id !== clientId)
    res.end()
  })
})

// ----- Helper function for logging requests -----
function handleLogRequest(req, res) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    originalUrl: req.originalUrl,
    body: req.body, // O corpo da requisição (parseado pelo middleware)
  }

  // Adiciona o novo log no início do array
  loggedRequests.unshift(logEntry)

  // Mantém o array com no máximo MAX_LOGS entradas
  if (loggedRequests.length > MAX_LOGS) {
    loggedRequests.pop() // Remove o log mais antigo (do final do array)
  }

  console.log(`Logged ${logEntry.method} request to ${logEntry.path}`)

  // Notifica os clientes do painel sobre o novo log via SSE
  sendUpdateToClients({ type: 'new_log', log: logEntry })

  // Responde à requisição original
  res.status(200).send({ message: 'Request logged successfully' })
}

// ----- Rota de coleta -----
const collectPathRegex = /\/collect\/.+/;

// Captura apenas GET requisições para /collect/*
app.get(collectPathRegex, handleLogRequest);

// Captura apenas POST requisições para /collect/*
app.post(collectPathRegex, handleLogRequest);

// Explicitly handle OPTIONS requests for the /collect/* path
// This ensures OPTIONS requests are not logged and receive a standard response.
// Nginx might handle CORS preflight, but this is a good fallback.
app.options(collectPathRegex, (req, res) => {
  res.sendStatus(204); // No Content
});


// ----- Rota para baixar o json do array loggedRequests -----
app.get('/download', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', 'attachment; filename=logs.json')
  res.send(JSON.stringify(loggedRequests, null, 2))
})

// ----- Rota para limpar os logs -----
app.post('/clear-logs', (req, res) => {
  console.log('Clearing logs...');
  loggedRequests = []; // Clear the array

  // Notify SSE clients that logs have been cleared
  sendUpdateToClients({ type: 'clear_logs' });

  res.status(200).send({ message: 'Logs cleared successfully' });
});

// ----- Inicialização do Servidor -----
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  console.log(`Endpoint de Logging: http://localhost:${PORT}/collect/*, https://louren.co.in/request-logger/collect/*`)
  console.log(`Painel de logs: http://localhost:${PORT}/logs, https://louren.co.in/request-logger/logs`)
  console.log(`SSE Endpoint: http://localhost:${PORT}/sse, https://louren.co.in/request-logger/sse`)
  console.log(`Download Logs Endpoint: http://localhost:${PORT}/download, https://louren.co.in/request-logger/download`)
  console.log(`Clear Logs Endpoint: http://localhost:${PORT}/clear-logs, https://louren.co.in/request-logger/clear-logs`)
})

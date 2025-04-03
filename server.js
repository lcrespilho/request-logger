const express = require('express')
const http = require('http') // Necessário para SSE
const path = require('path')

const app = express()
const cors = require('cors')
const server = http.createServer(app) // Usaremos este server para SSE
const PORT = process.env.PORT || 1029 // Use a porta do ambiente ou 3000

// Enable CORS for all routes
app.use(
  cors({
    credentials: true,
  })
)

// ----- Armazenamento em Memória -----
let loggedRequests = [] // Array para guardar os logs
const MAX_LOGS = 100 // Limite de logs

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

// ----- Rota de coleta -----
// Captura TODAS as requisições (GET, POST, etc) para /collect/*
app.all(/\/collect\/.+/, (req, res) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.socket.remoteAddress, // IP do requisitante
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

  console.log(`Logged ${logEntry.method} request to ${logEntry.path} from ${logEntry.ip}`)

  // Notifica os clientes do painel sobre o novo log via SSE
  sendUpdateToClients({ type: 'new_log', log: logEntry })

  // Responde à requisição original
  res.status(200).send({ message: 'Request logged successfully' })
})

// ----- Inicialização do Servidor -----
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  console.log(`Endpoint de Logging: http://localhost:${PORT}/collect/*, https://louren.co.in/request-logger/collect/*`)
  console.log(`Painel de logs: http://localhost:${PORT}/logs, https://louren.co.in/request-logger/logs`)
  console.log(`SSE Endpoint: http://localhost:${PORT}/sse, https://louren.co.in/request-logger/sse`)
})

const logContainer = document.getElementById('logContainer')
const logStatus = document.getElementById('logStatus')
let clientLogs = [] // Armazena os logs no lado do cliente
const MAX_CLIENT_LOGS = 100 // Mantém o mesmo limite do servidor visualmente

function formatLogEntry(log) {
  // Trata o body: se for objeto, stringify; senão, mostra como está (ou vazio)
  let bodyContent = ''
  if (log.body) {
    if (typeof log.body === 'object' && Object.keys(log.body).length > 0) {
      try {
        bodyContent = `<p><strong>Body (JSON):</strong></p><pre>${JSON.stringify(log.body, null, 2)}</pre>`
      } catch (e) {
        bodyContent = `<p><strong>Body (Erro ao formatar JSON):</strong></p><pre>${log.body}</pre>`
      }
    } else if (typeof log.body === 'string' && log.body.length > 0) {
      bodyContent = `<p><strong>Body (Texto):</strong></p><pre>${log.body}</pre>`
    } else if (typeof log.body !== 'undefined') {
      bodyContent = `<p><strong>Body:</strong></p><pre>${String(log.body)}</pre>`
    }
  }

  return `
        <div class="log-entry">
            <p><strong>Timestamp:</strong> ${new Date(log.timestamp).toLocaleString('pt-BR')}</p>
            <p><strong>IP:</strong> ${log.ip}</p>
            <p><strong>Método:</strong> ${log.method}</p>
            <p><strong>Path:</strong> ${log.path}</p>
            <p><strong>originalUrl:</strong> ${log.originalUrl}</p>
            <p><strong>Headers:</strong></p>
            <pre>${JSON.stringify(log.headers, null, 2)}</pre>
            ${bodyContent}
        </div>
    `
}

function renderLogs() {
  if (clientLogs.length === 0) {
    logContainer.innerHTML = '<p style="text-align:center;">Nenhuma requisição registrada ainda.</p>'
    return
  }
  // Renderiza os logs formatados
  logContainer.innerHTML = clientLogs.map(formatLogEntry).join('')
}

function connectSSE() {
  logStatus.textContent = 'Conectando ao servidor de eventos...'
  console.log('Connecting to SSE endpoint')
  const eventSource = new EventSource('sse') // Conecta ao endpoint SSE

  eventSource.onopen = () => {
    logStatus.textContent = 'Conectado. Aguardando logs...'
    console.log('SSE Connection established.')
    renderLogs() // Renderiza logs vazios ou iniciais caso a conexão demore
  }

  eventSource.onmessage = event => {
    console.log('SSE Data Received:', event.data)
    try {
      const messageData = JSON.parse(event.data)

      if (messageData.type === 'initial' && Array.isArray(messageData.logs)) {
        // Recebeu a carga inicial de logs
        clientLogs = messageData.logs
        logStatus.textContent = `Conectado. Exibindo ${clientLogs.length} logs.`
        console.log(`Received initial ${clientLogs.length} logs.`)
      } else if (messageData.type === 'new_log' && messageData.log) {
        // Recebeu um novo log individual
        const newLog = messageData.log
        clientLogs.unshift(newLog) // Adiciona no início
        // Limita o array no cliente também
        if (clientLogs.length > MAX_CLIENT_LOGS) {
          clientLogs.pop()
        }
        logStatus.textContent = `Conectado. Última atualização: ${new Date().toLocaleTimeString('pt-BR')}`
        console.log('Received new log entry.')
      } else {
        console.warn('Received unknown SSE message format:', messageData)
      }

      renderLogs() // Re-renderiza a lista de logs com os dados atualizados
    } catch (error) {
      logStatus.textContent = 'Erro ao processar dados do servidor.'
      console.error('Error parsing SSE data:', error, 'Raw data:', event.data)
    }
  }

  eventSource.onerror = error => {
    logStatus.textContent = 'Erro na conexão SSE. Tentando reconectar...'
    console.error('SSE Error:', error)
    // O EventSource tenta reconectar automaticamente por padrão.
    // Poderia fechar aqui se não quisesse reconexão: eventSource.close();
    // Limpa os logs para indicar o problema
    clientLogs = []
    renderLogs()
    // Tenta reconectar manualmente após um tempo se necessário (opcional)
    // setTimeout(connectSSE, 5000); // Exemplo: Tenta novamente em 5 segundos
  }
}

// Inicia a conexão SSE quando a página carregar
connectSSE()

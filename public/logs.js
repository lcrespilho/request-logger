const infoButton = document.getElementById('infoButton')
const infoText = document.getElementById('infoText')
infoButton.addEventListener('click', () => {
  infoText.style.display = infoText.style.display === 'none' ? 'block' : 'none'
})

const logContainer = document.getElementById('logContainer')
const clearLogsButton = document.getElementById('clearLogsButton')
const logStatus = document.getElementById('logStatus')
let clientLogs = [] // Armazena os logs no lado do cliente
const MAX_CLIENT_LOGS = 100 // Mantém o mesmo limite do servidor visualmente
const ENABLE_CLOG = true // Enable/disable console logs in the frontend script

function formatLogEntry(log) {
  // Get method class for styling
  const methodClass = `method-${log.method}`

  // Format timestamp
  const timestamp = new Date(log.timestamp).toLocaleString('pt-BR')

  // Headers with copy button
  const headersJson = JSON.stringify(log.headers, null, 2)
  const headersId = `headers-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`

  // Body content with copy button if it exists
  let bodyContent = ''
  let bodyJson = ''

  if (log.body) {
    const bodyId = `body-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`

    if (typeof log.body === 'object' && Object.keys(log.body).length > 0) {
      try {
        bodyJson = JSON.stringify(log.body, null, 2)
        bodyContent = `
          <div class="pre-header">
            <span>Body (JSON)</span>
            <button class="copy-btn" onclick="copyToClipboard('${bodyId}')">Copiar</button>
          </div>
          <pre id="${bodyId}">${bodyJson}</pre>
        `
      } catch (e) {
        bodyContent = `
          <div class="pre-header">
            <span>Body (Erro ao formatar JSON)</span>
          </div>
          <pre>${log.body}</pre>
        `
      }
    } else if (typeof log.body === 'string' && log.body.length > 0) {
      bodyContent = `
        <div class="pre-header">
          <span>Body (Texto)</span>
          <button class="copy-btn" onclick="copyToClipboard('${bodyId}')">Copiar</button>
        </div>
        <pre id="${bodyId}">${log.body}</pre>
      `
    } else if (typeof log.body !== 'undefined') {
      bodyContent = `
        <div class="pre-header">
          <span>Body</span>
        </div>
        <pre>${String(log.body)}</pre>
      `
    }
  }

  return `
    <div class="log-entry" data-log-id="${log.id}">
      <div class="log-entry-header">
        <span class="method-badge ${methodClass}">${log.method}</span>
        <span><strong>Timestamp:</strong> ${timestamp}</span>
      </div>
      <p><strong>Url:</strong> ${log.originalUrl}</p>
      
      <div class="pre-header">
        <span>Headers</span>
        <button class="copy-btn" onclick="copyToClipboard('${headersId}')">Copiar</button>
      </div>
      <pre id="${headersId}">${headersJson}</pre>
      ${bodyContent}
      <button class="delete-log-button" title="Delete">🗑️</button>
    </div>
  `
}

// Add this function to handle copying to clipboard
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId)
  const textArea = document.createElement('textarea')
  textArea.value = element.textContent
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)

  // Show feedback
  const originalButton = event.target
  const originalText = originalButton.textContent
  originalButton.textContent = 'Copiado!'
  setTimeout(() => {
    originalButton.textContent = originalText
  }, 500)
}

// --- Clear Logs Button Functionality ---
clearLogsButton.addEventListener('click', async () => {
  try {
    const response = await fetch('clear-logs', { method: 'POST' })
    if (response.ok) {
      ENABLE_CLOG && console.log('Clear logs request successful. UI will update via SSE.')
      // The SSE event 'clear_logs' will handle clearing the UI
    } else {
      alert('Failed to clear logs. Server responded with: ' + response.status)
    }
  } catch (error) {
    console.error('Error sending clear logs request:', error)
    alert('Error sending clear logs request. Check the console for details.')
  }
})

// --- Delete Individual Log Functionality ---
logContainer.addEventListener('click', async event => {
  // Check if the clicked element or its parent is the delete button
  const deleteButton = event.target.closest('.delete-log-button')
  if (deleteButton) {
    const logEntryElement = deleteButton.closest('.log-entry')
    if (!logEntryElement) return // Should not happen if button is inside .log-entry

    const logId = logEntryElement.dataset.logId
    if (!logId) {
      ENABLE_CLOG && console.error('Log ID not found for this entry.')
      alert('Erro: Não foi possível identificar o log para excluir.')
      return
    }

    try {
      // Send DELETE request to the backend endpoint
      const response = await fetch(`${logId}`, { method: 'DELETE' })
      if (!response.ok) alert('Failed to clear logs. Server responded with: ' + response.status)
      // UI update will be handled by the SSE 'log_deleted' event
    } catch (error) {
      console.error('Error sending delete log request:', error)
      alert('Error sending clear log request. Check the console for details.')
    }
  }
})

// Add download functionality
const downloadButton = document.getElementById('downloadButton')
downloadButton.addEventListener('click', function () {
  window.location.href = 'download'
})

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
    try {
      const messageData = JSON.parse(event.data)

      if (messageData.type === 'initial' && Array.isArray(messageData.logs)) {
        // Recebeu a carga inicial de logs
        clientLogs = messageData.logs
        logStatus.textContent = `Conectado. Exibindo ${clientLogs.length} logs.`
        ENABLE_CLOG && console.log(`Received initial ${clientLogs.length} logs.`)
      } else if (messageData.type === 'new_log' && messageData.log) {
        // Recebeu um novo log individual
        const newLog = messageData.log
        clientLogs.unshift(newLog) // Adiciona no início
        // Limita o array no cliente também
        if (clientLogs.length > MAX_CLIENT_LOGS) {
          clientLogs.pop()
        }
        logStatus.textContent = `Conectado. Última atualização: ${new Date().toLocaleTimeString('pt-BR')}`
        ENABLE_CLOG && console.log('Received new log entry:', newLog)
      } else if (messageData.type === 'clear_logs') {
        // Recebeu pedido para deletar todos os logs
        ENABLE_CLOG && console.log('Received clear_logs event from server. Clearing UI.')
        clientLogs = [] // Clear the client-side array
        logStatus.textContent = 'Logs limpos pelo servidor.'
      } else if (messageData.type === 'log_deleted' && messageData.logId) {
        // Recebeu pedido para deletar um log individual
        const deletedLogId = messageData.logId
        ENABLE_CLOG && console.log(`Received log_deleted event for log ID ${deletedLogId}`)
        // Remove the log from the client-side array
        clientLogs = clientLogs.filter(log => log.id !== deletedLogId)
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
    clientLogs = [] // Clear client-side logs on error too
    renderLogs() // Render the now empty list
    // Tenta reconectar manualmente após um tempo se necessário (opcional)
    // setTimeout(connectSSE, 5000); // Exemplo: Tenta novamente em 5 segundos
  }
}

// Inicia a conexão SSE quando a página carregar
connectSSE()

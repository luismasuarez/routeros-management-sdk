class RouterOSManager {
    constructor() {
        this.connectionId = null;
        this.apiBase = 'http://localhost:3000/api';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Botón de conexión
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connect();
        });

        // Botón de envío de comandos
        document.getElementById('sendCommandBtn').addEventListener('click', () => {
            this.sendCommand();
        });

        // Comandos rápidos
        document.querySelectorAll('.quick-command').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.target.dataset.command;
                document.getElementById('commandInput').value = command;
                this.sendCommand();
            });
        });

        // Limpiar resultados
        document.getElementById('clearResultsBtn').addEventListener('click', () => {
            this.clearResults();
        });

        // Enter en el input de comandos
        document.getElementById('commandInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendCommand();
            }
        });
    }

    async connect() {
        const host = document.getElementById('host').value;
        const port = document.getElementById('port').value;
        const secure = document.getElementById('secure').checked;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!host || !username || !password) {
            this.showNotification('Por favor completa todos los campos requeridos', 'error');
            return;
        }

        this.updateConnectionStatus('Conectando...', 'connecting');

        try {
            const response = await fetch(`${this.apiBase}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    host,
                    port: port || undefined,
                    secure,
                    username,
                    password
                })
            });

            const data = await response.json();

            if (data.success) {
                this.connectionId = data.connectionId;
                this.updateConnectionStatus('Conectado', 'connected');
                this.showCommandPanel();
                this.showNotification('Conexión exitosa', 'success');
            } else {
                throw new Error(data.error || 'Error de conexión');
            }

        } catch (error) {
            this.updateConnectionStatus('Error de conexión', 'error');
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    async sendCommand() {
        if (!this.connectionId) {
            this.showNotification('No hay conexión activa', 'error');
            return;
        }

        const command = document.getElementById('commandInput').value.trim();
        if (!command) {
            this.showNotification('Por favor ingresa un comando', 'error');
            return;
        }

        // Mostrar comando en resultados
        this.addToResults(`$ ${command}`, 'command');

        try {
            const response = await fetch(`${this.apiBase}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connectionId: this.connectionId,
                    command: command.split(' ')
                })
            });

            const data = await response.json();

            if (data.success) {
                this.addToResults(JSON.stringify(data.data, null, 2), 'response');
                this.updateResultCount();
            } else {
                this.addToResults(`Error: ${data.error}`, 'error');
            }

        } catch (error) {
            this.addToResults(`Error de red: ${error.message}`, 'error');
        }

        // Limpiar input
        document.getElementById('commandInput').value = '';
    }

    updateConnectionStatus(text, status) {
        const statusElement = document.getElementById('connectionStatus');
        const indicator = document.getElementById('statusIndicator');
        const textElement = document.getElementById('statusText');

        statusElement.classList.remove('hidden');
        textElement.textContent = text;

        // Actualizar indicador visual
        indicator.className = 'w-3 h-3 rounded-full mr-2';
        switch (status) {
            case 'connecting':
                indicator.classList.add('bg-yellow-500', 'animate-pulse');
                break;
            case 'connected':
                indicator.classList.add('bg-green-500');
                break;
            case 'error':
                indicator.classList.add('bg-red-500');
                break;
        }
    }

    showCommandPanel() {
        document.getElementById('commandPanel').classList.remove('hidden');
    }

    addToResults(content, type = 'response') {
        const container = document.getElementById('resultsContainer');
        const output = document.getElementById('resultsOutput');

        // Mostrar panel de resultados si está oculto
        container.parentElement.classList.remove('hidden');

        // Agregar contenido con timestamp
        const timestamp = new Date().toLocaleTimeString();
        const className = type === 'command' ? 'text-blue-600' :
                        type === 'error' ? 'text-red-600' : 'text-gray-800';

        output.innerHTML += `<div class="${className} mb-2">
            <span class="text-gray-500 text-xs">[${timestamp}]</span> ${content}
        </div>`;

        // Scroll al final
        container.scrollTop = container.scrollHeight;
    }

    updateResultCount() {
        const output = document.getElementById('resultsOutput');
        const lines = output.children.length;
        document.getElementById('resultCount').textContent = `${lines} resultados`;
    }

    clearResults() {
        document.getElementById('resultsOutput').innerHTML = '';
        document.getElementById('resultCount').textContent = '';
        document.getElementById('resultsPanel').classList.add('hidden');
    }

    showNotification(message, type = 'info') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-md text-white font-medium z-50 transition-all duration-300 transform translate-x-full`;

        switch (type) {
            case 'success':
                notification.classList.add('bg-green-600');
                break;
            case 'error':
                notification.classList.add('bg-red-600');
                break;
            default:
                notification.classList.add('bg-blue-600');
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Animar entrada
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        // Remover después de 3 segundos
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new RouterOSManager();
});

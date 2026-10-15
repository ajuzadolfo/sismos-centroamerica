import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslationService } from '../../services/translation.service';
import { SnapshotShareService } from '../../services/snapshot-share.service';
import { environment } from '../../../environments/environment';

export interface CabrakanMapAction {
  type?: string;
  lat?: number;
  lon?: number;
  zoom?: number;
  pitch?: number;
  eventId?: string;
}

export interface CabrakanChatResponseDto {
  reply: string;
  modelUsed?: string;
  timestamp?: string;
  suggestedQuestions?: string[];
  mapAction?: CabrakanMapAction | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  mapAction?: CabrakanMapAction | null;
}

@Component({
  selector: 'app-cabrakan-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Botón Flotante para Abrir/Cerrar Cabrakán AI -->
    <button
      class="cabrakan-launcher glass-panel"
      [class.active]="isOpen()"
      (click)="toggleChat()"
      [title]="transService.currentLang() === 'en' ? 'Open Cabrakán AI Geoscientific Assistant' : 'Abrir Asistente Geocientífico Cabrakán AI'">
      <span class="launcher-icon">🌋</span>
      <span class="launcher-label">Cabrakán AI</span>
      <span class="model-badge">3.8</span>
      @if (hasUnread()) {
        <span class="unread-dot"></span>
      }
    </button>

    <!-- Ventana de Chat Flotante Glassmorphic -->
    @if (isOpen()) {
      <div class="chat-window glass-panel">
        <!-- Header del Asistente -->
        <div class="chat-header">
          <div class="header-info">
            <span class="header-avatar">🌋</span>
            <div>
              <div class="header-title-row">
                <span class="assistant-name">Cabrakán AI</span>
                @if (activeModel() !== 'offline-fallback' && !activeModel().includes('fallback')) {
                  <span class="assistant-chip live" title="Conectado en vivo con Gemini 3.8 Flash">
                    <span class="status-pulse-dot"></span>
                    Gemini 3.8 Flash (En Vivo)
                  </span>
                } @else {
                  <span class="assistant-chip fallback" title="Operando en Modo Respaldo Geocientífico Offline">
                    🛡️ Modo Respaldo (Offline)
                  </span>
                }
              </div>
              <span class="assistant-subtitle">
                {{ transService.currentLang() === 'en' ? 'Geoscientific AI · Central America' : 'Asistente Geocientífico · Centroamérica' }}
              </span>
            </div>
          </div>
          <button class="header-close-btn" (click)="isOpen.set(false)" title="Cerrar">&times;</button>
        </div>

        <!-- Área de Mensajes -->
        <div #messageContainer class="messages-container">
          @for (msg of messages(); track msg.id) {
            <div class="message-wrapper" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
              @if (msg.role === 'assistant') {
                <span class="msg-avatar">🌋</span>
              }
              <div class="msg-bubble">
                <div class="msg-text" [innerHTML]="formatMessage(msg.content)"></div>
                
                <!-- Botón de Conducción Cartográfica (Map Driver) -->
                @if (msg.mapAction; as action) {
                  <button class="map-action-btn" (click)="flyToMapAction(action)">
                    <span>🎯</span>
                    <span>{{ transService.currentLang() === 'en' ? 'Focus on 3D Map' : 'Ver Ubicación en Mapa 3D' }}</span>
                  </button>
                }

                <div class="msg-meta-row">
                  @if (msg.role === 'assistant' && msg.modelUsed) {
                    <span class="msg-model-tag" [class.live]="msg.modelUsed !== 'offline-fallback' && !msg.modelUsed.includes('fallback')" [class.fallback]="msg.modelUsed === 'offline-fallback' || msg.modelUsed.includes('fallback')">
                      {{ msg.modelUsed !== 'offline-fallback' && !msg.modelUsed.includes('fallback') ? '⚡ ' + (msg.modelUsed.includes('gemini') ? 'Gemini 3.8 Flash' : msg.modelUsed) : '🛡️ Respaldo Geocientífico' }}
                    </span>
                  }
                  <span class="msg-time">{{ msg.timestamp }}</span>
                </div>
              </div>
            </div>
          }

          <!-- Indicador de Escritura / Generación -->
          @if (isGenerating()) {
            <div class="message-wrapper assistant">
              <span class="msg-avatar">🌋</span>
              <div class="msg-bubble generating-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="generating-text">{{ transService.currentLang() === 'en' ? 'Cabrakán is analyzing seismic data...' : 'Cabrakán está consultando la sismicidad...' }}</span>
              </div>
            </div>
          }
        </div>

        <!-- Preguntas Rápidas Sugeridas -->
        @if (suggestions().length > 0 && !isGenerating()) {
          <div class="suggestions-bar">
            @for (sug of suggestions(); track sug) {
              <button class="sug-pill" (click)="sendPresetMessage(sug)">
                {{ sug }}
              </button>
            }
          </div>
        }

        <!-- Caja de Entrada de Texto -->
        <div class="chat-input-bar">
          <input
            #chatInput
            type="text"
            [(ngModel)]="userInput"
            (keydown.enter)="sendMessage()"
            [placeholder]="transService.currentLang() === 'en' ? 'Ask Cabrakán about earthquakes, fault zones...' : 'Pregunta a Cabrakán sobre sismos, fallas, prevención...'"
            [disabled]="isGenerating()"
            class="chat-input"
          />
          <button class="send-btn" (click)="sendMessage()" [disabled]="!userInput.trim() || isGenerating()">
            <span>➤</span>
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .cabrakan-launcher {
      position: absolute;
      bottom: 40px;
      right: 18px;
      z-index: 55;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      background: rgba(8, 14, 26, 0.9);
      border: 1px solid rgba(0, 240, 255, 0.45);
      border-radius: 30px;
      color: #00f0ff;
      font-family: var(--font-sans);
      font-weight: 700;
      font-size: 0.8rem;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 240, 255, 0.25), 0 0 10px rgba(0, 0, 0, 0.6);
      transition: all 0.25s ease;
    }

    .cabrakan-launcher:hover {
      background: rgba(0, 240, 255, 0.18);
      color: #ffffff;
      transform: translateY(-2px);
      box-shadow: 0 6px 26px rgba(0, 240, 255, 0.4);
    }

    .cabrakan-launcher.active {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.25) 0%, rgba(139, 92, 246, 0.35) 100%);
      border-color: #00f0ff;
    }

    .launcher-icon {
      font-size: 1rem;
      animation: pulse-glow 2s infinite ease-in-out;
    }

    @keyframes pulse-glow {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px #00f0ff); }
      50% { transform: scale(1.15); filter: drop-shadow(0 0 8px #00f0ff); }
    }

    .model-badge {
      padding: 1px 6px;
      background: rgba(139, 92, 246, 0.3);
      border: 1px solid rgba(139, 92, 246, 0.6);
      border-radius: 10px;
      color: #c4b5fd;
      font-size: 0.62rem;
      font-weight: 800;
    }

    .unread-dot {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 10px;
      height: 10px;
      background: #ff1744;
      border-radius: 50%;
      box-shadow: 0 0 8px #ff1744;
    }

    /* Ventana Flotante del Chat */
    .chat-window {
      position: absolute;
      bottom: 92px;
      right: 18px;
      width: 380px;
      max-width: calc(100vw - 36px);
      height: 520px;
      max-height: calc(100vh - 140px);
      z-index: 60;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      background: rgba(8, 14, 26, 0.94);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 240, 255, 0.32);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 240, 255, 0.15);
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .chat-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-avatar {
      font-size: 1.3rem;
    }

    .header-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .assistant-name {
      font-weight: 800;
      font-size: 0.88rem;
      color: #ffffff;
      letter-spacing: 0.02em;
    }

    .assistant-chip {
      font-size: 0.62rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.3s ease;
    }

    .assistant-chip.live {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.14);
      border: 1px solid rgba(56, 189, 248, 0.3);
    }

    .assistant-chip.fallback {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid rgba(251, 191, 36, 0.35);
    }

    .status-pulse-dot {
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 6px #10b981;
      animation: status-blink 1.8s infinite ease-in-out;
    }

    @keyframes status-blink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .msg-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 6px;
      font-size: 0.65rem;
    }

    .msg-model-tag {
      font-size: 0.6rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 6px;
    }

    .msg-model-tag.live {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
    }

    .msg-model-tag.fallback {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.12);
    }

    .assistant-subtitle {
      font-size: 0.65rem;
      color: #94a3b8;
    }

    .header-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
    }
    .header-close-btn:hover { color: #ffffff; }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message-wrapper {
      display: flex;
      gap: 8px;
      max-width: 90%;
    }

    .message-wrapper.assistant {
      align-self: flex-start;
    }

    .message-wrapper.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .msg-avatar {
      font-size: 1rem;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .msg-bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .message-wrapper.assistant .msg-bubble {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      border-top-left-radius: 2px;
    }

    .message-wrapper.user .msg-bubble {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.22) 0%, rgba(14, 165, 233, 0.28) 100%);
      border: 1px solid rgba(0, 240, 255, 0.4);
      color: #ffffff;
      border-top-right-radius: 2px;
    }

    .msg-text :first-child { margin-top: 0; }
    .msg-text :last-child { margin-bottom: 0; }

    .msg-time {
      display: block;
      margin-top: 4px;
      font-size: 0.6rem;
      color: #64748b;
      text-align: right;
      font-family: var(--font-mono);
    }

    .map-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 8px;
      padding: 5px 10px;
      background: rgba(0, 240, 255, 0.15);
      border: 1px solid rgba(0, 240, 255, 0.4);
      border-radius: 6px;
      color: #00f0ff;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .map-action-btn:hover {
      background: rgba(0, 240, 255, 0.28);
      color: #ffffff;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
    }

    /* Indicador animado de generación */
    .generating-bubble {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .typing-dot {
      width: 5px;
      height: 5px;
      background: #00f0ff;
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1.1); opacity: 1; }
    }

    .generating-text {
      font-size: 0.7rem;
      color: #94a3b8;
      font-style: italic;
      margin-left: 4px;
    }

    /* Sugerencias de Preguntas */
    .suggestions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 14px 10px 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .sug-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 4px 10px;
      font-size: 0.68rem;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      text-overflow: ellipsis;
      max-width: 100%;
      overflow: hidden;
    }

    .sug-pill:hover {
      background: rgba(0, 240, 255, 0.12);
      border-color: rgba(0, 240, 255, 0.35);
      color: #00f0ff;
    }

    /* Barra de Entrada */
    .chat-input-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(4, 9, 20, 0.95);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .chat-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 8px 12px;
      color: #ffffff;
      font-size: 0.78rem;
      font-family: var(--font-sans);
      outline: none;
      transition: border-color 0.2s ease;
    }

    .chat-input:focus {
      border-color: #00f0ff;
      background: rgba(0, 240, 255, 0.03);
    }

    .send-btn {
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 240, 255, 0.18);
      border: 1px solid rgba(0, 240, 255, 0.45);
      border-radius: 8px;
      color: #00f0ff;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .send-btn:hover:not(:disabled) {
      background: #00f0ff;
      color: #040914;
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.5);
    }

    .send-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    @media (max-width: 480px) {
      .chat-window {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100%;
        height: 80vh;
        height: 80dvh;
        border-radius: 18px 18px 0 0;
      }
      .cabrakan-launcher {
        bottom: 50px;
        right: 12px;
        padding: 6px 12px;
        font-size: 0.74rem;
      }
    }
  `]
})
export class CabrakanChatComponent {
  private http = inject(HttpClient);
  transService = inject(TranslationService);
  private snapshotService = inject(SnapshotShareService);

  @ViewChild('messageContainer') messageContainer?: ElementRef<HTMLDivElement>;

  activeModel = signal<string>('gemini-3.8-flash');
  isOpen = signal<boolean>(false);
  hasUnread = signal<boolean>(false);
  isGenerating = signal<boolean>(false);
  userInput = '';

  suggestions = signal<string[]>([
    '¿Cuáles son los sismos más fuertes de la historia?',
    '¿Cómo funciona la subducción de Cocos bajo el Caribe?',
    '¿Qué precauciones tomar ante una secuencia de réplicas?'
  ]);

  messages = signal<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: '¡Saludos! Soy **Cabrakán AI**, tu asistente geocientífico especializado en la dinámica tectónica y sismológica de Centroamérica. Pregúntame sobre cualquier sismo reciente, catálogos históricos, fallas o protocolos de emergencia.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  toggleChat() {
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      this.hasUnread.set(false);
      this.scrollToBottom();
    }
  }

  sendPresetMessage(text: string) {
    this.userInput = text;
    this.sendMessage();
  }

  async sendMessage() {
    const text = this.userInput.trim();
    if (!text || this.isGenerating()) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.messages.update(list => [...list, userMsg]);
    this.userInput = '';
    this.isGenerating.set(true);
    this.scrollToBottom();

    const history = this.messages().slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));

    const payload = {
      message: text,
      history
    };

    const asstId = 'asst-' + Date.now();
    const asstMsg: ChatMessage = {
      id: asstId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: this.activeModel(),
      mapAction: null
    };

    let hasStarted = false;

    try {
      const response = await fetch(`${environment.apiUrl}/chat/cabrakan/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming failed: ' + response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);
            if (data.type === 'chunk') {
              if (!hasStarted) {
                hasStarted = true;
                this.isGenerating.set(false);
                this.messages.update(list => [...list, asstMsg]);
              }
              if (data.modelUsed) {
                this.activeModel.set(data.modelUsed);
                asstMsg.modelUsed = data.modelUsed;
              }
              asstMsg.content += data.text || '';
              this.messages.update(list =>
                list.map(m => m.id === asstId ? { ...m, content: asstMsg.content, modelUsed: asstMsg.modelUsed } : m)
              );
              this.scrollToBottom();
            } else if (data.type === 'complete') {
              if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
                this.suggestions.set(data.suggestedQuestions);
              }
              if (data.mapAction) {
                asstMsg.mapAction = data.mapAction;
                this.messages.update(list =>
                  list.map(m => m.id === asstId ? { ...m, mapAction: data.mapAction } : m)
                );
                this.flyToMapAction(data.mapAction);
              }
            }
          } catch {
            // Chunk intermedio no JSON ignorado
          }
        }
      }

      if (!hasStarted && asstMsg.content) {
        this.messages.update(list => [...list, asstMsg]);
      }
    } catch {
      if (!hasStarted) {
        const fallbackMsg: ChatMessage = {
          id: 'asst-err-' + Date.now(),
          role: 'assistant',
          content: 'No pude conectar con el servicio de inferencia en este momento. Por favor reintenta en breve.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'offline-fallback'
        };
        this.messages.update(list => [...list, fallbackMsg]);
      }
    } finally {
      this.isGenerating.set(false);
      this.scrollToBottom();
      if (!this.isOpen()) {
        this.hasUnread.set(true);
      }
    }
  }

  flyToMapAction(action: CabrakanMapAction) {
    const map = this.snapshotService.getActiveMap();
    if (!map || action.lat === undefined || action.lon === undefined) return;

    map.flyTo({
      center: [action.lon, action.lat],
      zoom: action.zoom || 7.0,
      pitch: action.pitch !== undefined ? action.pitch : 40,
      essential: true
    });
  }

  formatMessage(text: string): string {
    if (!text) return '';
    // Sanitizar caracteres HTML para prevenir inyecciones XSS
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Formato básico de markdown
    formatted = formatted
      .replace(/### (.*?)(?:\n|$)/g, '<h4 style="color:#00f0ff;margin:6px 0 3px 0;font-size:0.82rem;">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ffffff;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/(?:\n|^)\* (.*?)/g, '<li style="margin-left:14px;margin-bottom:3px;">$1</li>')
      .replace(/\n/g, '<br/>');
    return formatted;
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messageContainer?.nativeElement) {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }
    }, 80);
  }
}

/**
 * EventBus - Sistema de mensajería Pub/Sub desacoplado
 * Permite la comunicación reactiva entre componentes y servicios sin acoplamiento directo.
 */
export class EventBus {
  constructor() {
    this.events = new Map();
  }

  /**
   * Suscribe un callback a un evento
   * @param {string} event - Nombre del evento
   * @param {Function} handler - Función a ejecutar
   * @returns {Function} Función para cancelar la suscripción
   */
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`EventBus.on: El handler para '${event}' debe ser una función.`);
    }
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(handler);

    return () => this.off(event, handler);
  }

  /**
   * Suscribe un callback que solo se ejecutará una vez
   * @param {string} event - Nombre del evento
   * @param {Function} handler - Función a ejecutar
   */
  once(event, handler) {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      handler(data);
    });
    return unsubscribe;
  }

  /**
   * Desuscribe un callback de un evento
   * @param {string} event - Nombre del evento
   * @param {Function} handler - Función registrada
   */
  off(event, handler) {
    if (this.events.has(event)) {
      this.events.get(event).delete(handler);
      if (this.events.get(event).size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Emite un evento con datos asociados
   * @param {string} event - Nombre del evento
   * @param {*} data - Payload enviado a los suscriptores
   */
  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Error al procesar evento '${event}':`, err);
        }
      });
    }
  }

  /**
   * Limpia todas las suscripciones registradas
   */
  clear() {
    this.events.clear();
  }
}

// Instancia singleton global para la aplicación
export const eventBus = new EventBus();

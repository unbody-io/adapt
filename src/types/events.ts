import { nanoid } from 'nanoid'

/**
 * Base event structure all events follow
 */
export interface BaseEvent<T extends string, P> {
	id: string
	type: T
	timestamp: number
	payload: P
}

/**
 * Helper type to build event union from an event map
 */
export type EventsFromMap<M> = {
	[K in keyof M]: BaseEvent<K & string, M[K]>
}[keyof M]

/**
 * Handler for a specific event type
 */
export type TypedHandler<P> = (payload: P) => void

/**
 * Handler for unified event stream
 */
export type UnifiedHandler<E> = (event: E) => void

/**
 * Type-safe event emitter
 *
 * Supports both typed subscriptions for specific events and unified
 * subscriptions for all events. Emits generic 'error' event for any
 * failed events (type ending in ':failed').
 */
export class TypedEmitter<M extends object> {
	private listeners: Map<string, Function[]> = new Map()
	private wildcardListeners: UnifiedHandler<EventsFromMap<M>>[] = []

	/**
	 * Subscribe to a specific event type
	 */
	on<K extends keyof M>(type: K, handler: TypedHandler<M[K]>): this

	/**
	 * Subscribe to all events (unified stream)
	 */
	on(handler: UnifiedHandler<EventsFromMap<M>>): this

	on<K extends keyof M>(
		typeOrHandler: K | UnifiedHandler<EventsFromMap<M>>,
		handler?: TypedHandler<M[K]>
	): this {
		if (typeof typeOrHandler === 'function') {
			this.wildcardListeners.push(typeOrHandler)
		} else {
			const type = typeOrHandler as string
			const listeners = this.listeners.get(type) || []
			listeners.push(handler!)
			this.listeners.set(type, listeners)
		}
		return this
	}

	/**
	 * Emit an event
	 *
	 * Notifies typed listeners for the specific event type,
	 * all wildcard listeners, and 'error' listeners for failed events.
	 */
	protected emit<K extends keyof M>(type: K, payload: M[K]): void {
		const event = {
			id: `event_${nanoid()}`,
			type: type as string,
			timestamp: Date.now(),
			payload,
		} as BaseEvent<K & string, M[K]>

		// Typed listeners
		const listeners = this.listeners.get(type as string) || []
		for (const listener of listeners) {
			listener(payload)
		}

		// Wildcard listeners
		for (const listener of this.wildcardListeners) {
			listener(event as EventsFromMap<M>)
		}

		// Generic error event for failed events
		if ((type as string).endsWith(':failed')) {
			const errorListeners = this.listeners.get('error') || []
			for (const listener of errorListeners) {
				listener(event)
			}
		}
	}
}

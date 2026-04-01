import { describe, it, expect, vi } from 'vitest'
import { TypedEmitter } from '../src/types/events'

// Define a test event map
interface TestEventMap {
	'item:created': { id: string; name: string }
	'item:deleted': { id: string }
	'item:updated:failed': { id: string; error: string }
	error: unknown
}

// Concrete emitter that exposes emit for testing
class TestEmitter extends TypedEmitter<TestEventMap> {
	public fire<K extends keyof TestEventMap>(type: K, payload: TestEventMap[K]) {
		this.emit(type, payload)
	}
}

describe('TypedEmitter', () => {
	it('typed handler receives correct payload', () => {
		const emitter = new TestEmitter()
		const handler = vi.fn()
		emitter.on('item:created', handler)
		emitter.fire('item:created', { id: '1', name: 'test' })
		expect(handler).toHaveBeenCalledWith({ id: '1', name: 'test' })
	})

	it('wildcard handler receives all events', () => {
		const emitter = new TestEmitter()
		const handler = vi.fn()
		emitter.on(handler)
		emitter.fire('item:created', { id: '1', name: 'test' })
		emitter.fire('item:deleted', { id: '1' })
		expect(handler).toHaveBeenCalledTimes(2)
	})

	it('wildcard handler receives full event shape', () => {
		const emitter = new TestEmitter()
		const handler = vi.fn()
		emitter.on(handler)
		emitter.fire('item:created', { id: '1', name: 'test' })
		const event = handler.mock.calls[0][0]
		expect(event.id).toMatch(/^event_/)
		expect(event.type).toBe('item:created')
		expect(event.timestamp).toBeTypeOf('number')
		expect(event.payload).toEqual({ id: '1', name: 'test' })
	})

	it('multiple handlers for same type all fire', () => {
		const emitter = new TestEmitter()
		const h1 = vi.fn()
		const h2 = vi.fn()
		emitter.on('item:created', h1)
		emitter.on('item:created', h2)
		emitter.fire('item:created', { id: '1', name: 'test' })
		expect(h1).toHaveBeenCalledOnce()
		expect(h2).toHaveBeenCalledOnce()
	})

	it('handler for type A does not fire on type B', () => {
		const emitter = new TestEmitter()
		const handler = vi.fn()
		emitter.on('item:created', handler)
		emitter.fire('item:deleted', { id: '1' })
		expect(handler).not.toHaveBeenCalled()
	})

	it('on() returns this for chaining', () => {
		const emitter = new TestEmitter()
		const result = emitter.on('item:created', vi.fn())
		expect(result).toBe(emitter)
	})

	it(':failed events also trigger error listeners', () => {
		const emitter = new TestEmitter()
		const errorHandler = vi.fn()
		emitter.on('error', errorHandler)
		emitter.fire('item:updated:failed', { id: '1', error: 'not found' })
		expect(errorHandler).toHaveBeenCalledOnce()
		// Error handler gets the full event, not just payload
		const event = errorHandler.mock.calls[0][0]
		expect(event.type).toBe('item:updated:failed')
		expect(event.payload).toEqual({ id: '1', error: 'not found' })
	})

	it('non-failed events do not trigger error listeners', () => {
		const emitter = new TestEmitter()
		const errorHandler = vi.fn()
		emitter.on('error', errorHandler)
		emitter.fire('item:created', { id: '1', name: 'test' })
		expect(errorHandler).not.toHaveBeenCalled()
	})
})

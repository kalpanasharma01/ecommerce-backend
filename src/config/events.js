const EventEmitter = require('events');
/**
 * Application event bus.
 * Purpose: decouple "something happened" (order placed, stock low, status changed)
 * from "what we do about it" (push real-time notifications, log). Controllers only
 * emit events; listeners in listeners.js react. New reactions (email, audit log)
 * can be added without touching controller code.
 */
module.exports = new EventEmitter();

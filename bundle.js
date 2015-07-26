require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var m = require('mumath');
var margins = require('mucss/margin');
var paddings = require('mucss/padding');
var offsets = require('mucss/offset');
var borders = require('mucss/border');
var css = require('mucss/css');

/**
 * @module
 */
module.exports = align;
module.exports.numerify = numerify;


var doc = document, win = window, root = doc.documentElement;



/**
 * Align set of elements by the side
 *
 * @param {NodeList|Array} els A list of elements
 * @param {string|number|Array} alignment Alignment param
 * @param {Element|Rectangle} relativeTo An area or element to calc off
 */
function align(els, alignment, relativeTo){
	if (!els || els.length < 2) throw Error('At least one element should be passed');

	//default alignment is left
	if (!alignment) alignment = 0;

	//default key element is the first one
	if (!relativeTo) relativeTo = els[0];


	//figure out x/y
	var xAlign, yAlign;
	if (alignment instanceof Array) {
		xAlign = numerify(alignment[0]);
		yAlign = numerify(alignment[1]);
	}
	//catch y values
	else if (/top|middle|bottom/.test(alignment)) {
		yAlign = numerify(alignment);
	}
	else {
		xAlign = numerify(alignment);
	}


	//apply alignment
	var toRect = offsets(relativeTo);
	for (var i = els.length, el, s; i--;){
		el = els[i];

		//ignore self
		if (el === relativeTo) continue;

		s = getComputedStyle(el);

		//ensure element is at least relative, if it is static
		if (s.position === 'static') css(el, 'position', 'relative');


		//include margins
		var placeeMargins = margins(el);

		//get relativeTo & parent rectangles
		var parent = el.offsetParent || win;
		var parentRect = offsets(parent);
		var parentPaddings = paddings(parent);
		var parentBorders = borders(parent);

		//correct parentRect
		if (parent === doc.body || parent === root && getComputedStyle(parent).position === 'static') {
			parentRect.left = 0;
			parentRect.top = 0;
		}
		parentRect = m.sub(parentRect, parentBorders);
		parentRect = m.add(parentRect, placeeMargins);
		parentRect = m.add(parentRect, parentPaddings);


		alignX(els[i], toRect, parentRect, xAlign);
		alignY(els[i], toRect, parentRect, yAlign);
	}
}




/**
 * Place horizontally
 */
function alignX ( placee, placerRect, parentRect, align ){
	if (typeof align !== 'number') return;

	//desirable absolute left
	var desirableLeft = placerRect.left + placerRect.width*align - placee.offsetWidth*align - parentRect.left;

	css(placee, {
		left: desirableLeft,
		right: 'auto'
	});
}


/**
 * Place vertically
 */
function alignY ( placee, placerRect, parentRect, align ){
	if (typeof align !== 'number') return;

	//desirable absolute top
	var desirableTop = placerRect.top + placerRect.height*align - placee.offsetHeight*align - parentRect.top;

	css(placee, {
		top: desirableTop,
		bottom: 'auto'
	});
}



/**
 * @param {string|number} value Convert any value passed to float 0..1
 */
function numerify(value){
	if (typeof value === 'string') {
		//else parse single-value
		switch (value) {
			case 'left':
			case 'top':
				return 0;
			case 'right':
			case 'bottom':
				return 1;
			case 'center':
			case 'middle':
				return 0.5;
		}
		return parseFloat(value);
	}

	return value;
}
},{"mucss/border":41,"mucss/css":42,"mucss/margin":46,"mucss/offset":47,"mucss/padding":48,"mumath":61}],2:[function(require,module,exports){
/**
 * Define stateful property on an object
 */
module.exports = defineState;

var State = require('st8');


/**
 * Define stateful property on a target
 *
 * @param {object} target Any object
 * @param {string} property Property name
 * @param {object} descriptor State descriptor
 *
 * @return {object} target
 */
function defineState (target, property, descriptor, isFn) {
	//define accessor on a target
	if (isFn) {
		target[property] = function () {
			if (arguments.length) {
				return state.set(arguments[0]);
			}
			else {
				return state.get();
			}
		};
	}

	//define setter/getter on a target
	else {
		Object.defineProperty(target, property, {
			set: function (value) {
				return state.set(value);
			},
			get: function () {
				return state.get();
			}
		});
	}

	//define state controller
	var state = new State(descriptor, target);

	return target;
}
},{"st8":3}],3:[function(require,module,exports){
/**
 * @module  st8
 *
 * Micro state machine.
 */


var Emitter = require('events');
var isFn = require('is-function');
var isObject = require('is-plain-object');


/** Defaults */

State.options = {
	leaveCallback: 'after',
	enterCallback: 'before',
	changeCallback: 'change',
	remainderState: '_'
};


/**
 * Create a new state controller based on states passed
 *
 * @constructor
 *
 * @param {object} settings Initial states
 */

function State(states, context){
	//ignore existing state
	if (states instanceof State) return states;

	//ensure new state instance is created
	if (!(this instanceof State)) return new State(states);

	//save states object
	this.states = states || {};

	//save context
	this.context = context || this;

	//initedFlag
	this.isInit = false;
}


/** Inherit State from Emitter */

var proto = State.prototype = Object.create(Emitter.prototype);


/**
 * Go to a state
 *
 * @param {*} value Any new state to enter
 */

proto.set = function (value) {
	var oldValue = this.state, states = this.states;
	// console.group('set', value, oldValue);

	//leave old state
	var oldStateName = states[oldValue] !== undefined ? oldValue : State.options.remainderState;
	var oldState = states[oldStateName];

	var leaveResult, leaveFlag = State.options.leaveCallback + oldStateName;

	if (this.isInit) {
		if (isObject(oldState)) {
			if (!this[leaveFlag]) {
				this[leaveFlag] = true;

				//if oldstate has after method - call it
				leaveResult = getValue(oldState, State.options.leaveCallback, this.context);

				//ignore changing if leave result is falsy
				if (leaveResult === false) {
					this[leaveFlag] = false;
					// console.groupEnd();
					return false;
				}

				//redirect, if returned anything
				else if (leaveResult !== undefined && leaveResult !== value) {
					this.set(leaveResult);
					this[leaveFlag] = false;
					// console.groupEnd();
					return false;
				}

				this[leaveFlag] = false;

				//ignore redirect
				if (this.state !== oldValue) {
					return;
				}
			}

		}

		//ignore not changed value
		if (value === oldValue) return false;
	}
	else {
		this.isInit = true;
	}


	//set current value
	this.state = value;


	//try to enter new state
	var newStateName = states[value] !== undefined ? value : State.options.remainderState;
	var newState = states[newStateName];
	var enterFlag = State.options.enterCallback + newStateName;
	var enterResult;

	if (!this[enterFlag]) {
		this[enterFlag] = true;

		if (isObject(newState)) {
			enterResult = getValue(newState, State.options.enterCallback, this.context);
		} else {
			enterResult = getValue(states, newStateName, this.context);
		}

		//ignore entering falsy state
		if (enterResult === false) {
			this.set(oldValue);
			this[enterFlag] = false;
			// console.groupEnd();
			return false;
		}

		//redirect if returned anything but current state
		else if (enterResult !== undefined && enterResult !== value) {
			this.set(enterResult);
			this[enterFlag] = false;
			// console.groupEnd();
			return false;
		}

		this[enterFlag] = false;
	}



	//notify change
	if (value !== oldValue)	{
		this.emit(State.options.changeCallback, value, oldValue);
	}


	// console.groupEnd();

	//return context to chain calls
	return this.context;
};


/** Get current state */

proto.get = function(){
	return this.state;
};


/** Return value or fn result */
function getValue(holder, meth, ctx){
	if (isFn(holder[meth])) {
		return holder[meth].call(ctx);
	}

	return holder[meth];
}


module.exports = State;
},{"events":119,"is-function":16,"is-plain-object":4}],4:[function(require,module,exports){
/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

var isObject = require('isobject');

function isObjectObject(o) {
  return isObject(o) === true
    && Object.prototype.toString.call(o) === '[object Object]';
}

module.exports = function isPlainObject(o) {
  var ctor,prot;
  
  if (isObjectObject(o) === false) return false;
  
  // If has modified constructor
  ctor = o.constructor;
  if (typeof ctor !== 'function') return false;
  
  // If has modified prototype
  prot = ctor.prototype;
  if (isObjectObject(prot) === false) return false;
  
  // If constructor does not have an Object-specific method
  if (prot.hasOwnProperty('isPrototypeOf') === false) {
    return false;
  }
  
  // Most likely a plain Object
  return true;
};

},{"isobject":5}],5:[function(require,module,exports){
/*!
 * isobject <https://github.com/jonschlinkert/isobject>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

module.exports = function isObject(val) {
  return val != null && typeof val === 'object'
    && !Array.isArray(val);
};

},{}],6:[function(require,module,exports){
/**
 * @module emmy/emit
 */
var icicle = require('icicle');
var slice = require('sliced');
var isString = require('mutype/is-string');
var isNode = require('mutype/is-node');
var isEvent = require('mutype/is-event');
var listeners = require('./listeners');


/**
 * A simple wrapper to handle stringy/plain events
 */
module.exports = function(target, evt){
	if (!target) return;

	var args = arguments;
	if (isString(evt)) {
		args = slice(arguments, 2);
		evt.split(/\s+/).forEach(function(evt){
			evt = evt.split('.')[0];

			emit.apply(this, [target, evt].concat(args));
		});
	} else {
		return emit.apply(this, args);
	}
};


/** detect env */
var $ = typeof jQuery === 'undefined' ? undefined : jQuery;
var doc = typeof document === 'undefined' ? undefined : document;
var win = typeof window === 'undefined' ? undefined : window;


/**
 * Emit an event, optionally with data or bubbling
 * Accept only single elements/events
 *
 * @param {string} eventName An event name, e. g. 'click'
 * @param {*} data Any data to pass to event.details (DOM) or event.data (elsewhere)
 * @param {bool} bubbles Whether to trigger bubbling event (DOM)
 *
 *
 * @return {target} a target
 */
function emit(target, eventName, data, bubbles){
	var emitMethod, evt = eventName;

	//Create proper event for DOM objects
	if (isNode(target) || target === win) {
		//NOTE: this doesnot bubble on off-DOM elements

		if (isEvent(eventName)) {
			evt = eventName;
		} else {
			//IE9-compliant constructor
			evt = doc.createEvent('CustomEvent');
			evt.initCustomEvent(eventName, bubbles, true, data);

			//a modern constructor would be:
			// var evt = new CustomEvent(eventName, { detail: data, bubbles: bubbles })
		}

		emitMethod = target.dispatchEvent;
	}

	//create event for jQuery object
	else if ($ && target instanceof $) {
		//TODO: decide how to pass data
		evt = $.Event( eventName, data );
		evt.detail = data;

		//FIXME: reference case where triggerHandler needed (something with multiple calls)
		emitMethod = bubbles ? targte.trigger : target.triggerHandler;
	}

	//detect target events
	else {
		//emit - default
		//trigger - jquery
		//dispatchEvent - DOM
		//raise - node-state
		//fire - ???
		emitMethod = target['dispatchEvent'] || target['emit'] || target['trigger'] || target['fire'] || target['raise'];
	}


	var args = slice(arguments, 2);


	//use locks to avoid self-recursion on objects wrapping this method
	if (emitMethod) {
		if (icicle.freeze(target, 'emit' + eventName)) {
			//use target event system, if possible
			emitMethod.apply(target, [evt].concat(args));
			icicle.unfreeze(target, 'emit' + eventName);

			return target;
		}

		//if event was frozen - probably it is emitter instance
		//so perform normal callback
	}


	//fall back to default event system
	var evtCallbacks = listeners(target, evt);

	//copy callbacks to fire because list can be changed by some callback (like `off`)
	var fireList = slice(evtCallbacks);
	for (var i = 0; i < fireList.length; i++ ) {
		fireList[i] && fireList[i].apply(target, args);
	}

	return target;
}
},{"./listeners":7,"icicle":8,"mutype/is-event":34,"mutype/is-node":35,"mutype/is-string":38,"sliced":9}],7:[function(require,module,exports){
/**
 * A storage of per-target callbacks.
 * WeakMap is the most safe solution.
 *
 * @module emmy/listeners
 */


/**
 * Property name to provide on targets.
 *
 * Can’t use global WeakMap -
 * it is impossible to provide singleton global cache of callbacks for targets
 * not polluting global scope. So it is better to pollute target scope than the global.
 *
 * Otherwise, each emmy instance will create it’s own cache, which leads to mess.
 *
 * Also can’t use `._events` property on targets, as it is done in `events` module,
 * because it is incompatible. Emmy targets universal events wrapper, not the native implementation.
 */
var cbPropName = '_callbacks';


/**
 * Get listeners for the target/evt (optionally).
 *
 * @param {object} target a target object
 * @param {string}? evt an evt name, if undefined - return object with events
 *
 * @return {(object|array)} List/set of listeners
 */
function listeners(target, evt, tags){
	var cbs = target[cbPropName];
	var result;

	if (!evt) {
		result = cbs || {};

		//filter cbs by tags
		if (tags) {
			var filteredResult = {};
			for (var evt in result) {
				filteredResult[evt] = result[evt].filter(function (cb) {
					return hasTags(cb, tags);
				});
			}
			result = filteredResult;
		}

		return result;
	}

	if (!cbs || !cbs[evt]) {
		return [];
	}

	result = cbs[evt];

	//if there are evt namespaces specified - filter callbacks
	if (tags && tags.length) {
		result = result.filter(function (cb) {
			return hasTags(cb, tags);
		});
	}

	return result;
}


/**
 * Remove listener, if any
 */
listeners.remove = function(target, evt, cb, tags){
	//get callbacks for the evt
	var evtCallbacks = target[cbPropName];
	if (!evtCallbacks || !evtCallbacks[evt]) return false;

	var callbacks = evtCallbacks[evt];

	//if tags are passed - make sure callback has some tags before removing
	if (tags && tags.length && !hasTags(cb, tags)) return false;

	//remove specific handler
	for (var i = 0; i < callbacks.length; i++) {
		//once method has original callback in .cb
		if (callbacks[i] === cb || callbacks[i].fn === cb) {
			callbacks.splice(i, 1);
			break;
		}
	}
};


/**
 * Add a new listener
 */
listeners.add = function(target, evt, cb, tags){
	if (!cb) return;

	var targetCallbacks = target[cbPropName];

	//ensure set of callbacks for the target exists
	if (!targetCallbacks) {
		targetCallbacks = {};
		Object.defineProperty(target, cbPropName, {
			value: targetCallbacks
		});
	}

	//save a new callback
	(targetCallbacks[evt] = targetCallbacks[evt] || []).push(cb);

	//save ns for a callback, if any
	if (tags && tags.length) {
		cb._ns = tags;
	}
};


/** Detect whether an cb has at least one tag from the list */
function hasTags(cb, tags){
	if (cb._ns) {
		//if cb is tagged with a ns and includes one of the ns passed - keep it
		for (var i = tags.length; i--;){
			if (cb._ns.indexOf(tags[i]) >= 0) return true;
		}
	}
}


module.exports = listeners;
},{}],8:[function(require,module,exports){
/**
 * @module Icicle
 */
module.exports = {
	freeze: lock,
	unfreeze: unlock,
	isFrozen: isLocked
};


/** Set of targets  */
var lockCache = new WeakMap;


/**
 * Set flag on target with the name passed
 *
 * @return {bool} Whether lock succeeded
 */
function lock(target, name){
	var locks = lockCache.get(target);
	if (locks && locks[name]) return false;

	//create lock set for a target, if none
	if (!locks) {
		locks = {};
		lockCache.set(target, locks);
	}

	//set a new lock
	locks[name] = true;

	//return success
	return true;
}


/**
 * Unset flag on the target with the name passed.
 *
 * Note that if to return new value from the lock/unlock,
 * then unlock will always return false and lock will always return true,
 * which is useless for the user, though maybe intuitive.
 *
 * @param {*} target Any object
 * @param {string} name A flag name
 *
 * @return {bool} Whether unlock failed.
 */
function unlock(target, name){
	var locks = lockCache.get(target);
	if (!locks || !locks[name]) return false;

	locks[name] = null;

	return true;
}


/**
 * Return whether flag is set
 *
 * @param {*} target Any object to associate lock with
 * @param {string} name A flag name
 *
 * @return {Boolean} Whether locked or not
 */
function isLocked(target, name){
	var locks = lockCache.get(target);
	return (locks && locks[name]);
}
},{}],9:[function(require,module,exports){

/**
 * An Array.prototype.slice.call(arguments) alternative
 *
 * @param {Object} args something with a length
 * @param {Number} slice
 * @param {Number} sliceEnd
 * @api public
 */

module.exports = function (args, slice, sliceEnd) {
  var ret = [];
  var len = args.length;

  if (0 === len) return ret;

  var start = slice < 0
    ? Math.max(0, slice + len)
    : slice || 0;

  if (sliceEnd !== undefined) {
    len = sliceEnd < 0
      ? sliceEnd + len
      : sliceEnd
  }

  while (len-- > start) {
    ret[len - start] = args[len];
  }

  return ret;
}


},{}],10:[function(require,module,exports){
/**
 * @module emmy/off
 */
module.exports = off;

var icicle = require('icicle');
var slice = require('sliced');
var listeners = require('./listeners');
var isArray = require('mutype/is-array');


/**
 * Remove listener[s] from the target
 *
 * @param {[type]} evt [description]
 * @param {Function} fn [description]
 *
 * @return {[type]} [description]
 */
function off(target, evt, fn) {
	if (!target) return target;

	var callbacks, i;

	//unbind all listeners if no fn specified
	if (fn === undefined) {
		var args = slice(arguments, 1);

		//try to use target removeAll method, if any
		var allOff = target['removeAll'] || target['removeAllListeners'];

		//call target removeAll
		if (allOff) {
			allOff.apply(target, args);
		}


		//then forget own callbacks, if any

		//unbind all evts
		if (!evt) {
			callbacks = listeners(target);
			for (evt in callbacks) {
				off(target, evt);
			}
		}
		//unbind all callbacks for an evt
		else {
			evt = '' + evt;

			//invoke method for each space-separated event from a list
			evt.split(/\s+/).forEach(function (evt) {
				var evtParts = evt.split('.');
				evt = evtParts.shift();
				callbacks = listeners(target, evt, evtParts);

				//returned array of callbacks (as event is defined)
				if (evt) {
					var obj = {};
					obj[evt] = callbacks;
					callbacks = obj;
				}

				//for each group of callbacks - unbind all
				for (var evtName in callbacks) {
					slice(callbacks[evtName]).forEach(function (cb) {
						off(target, evtName, cb);
					});
				}
			});
		}

		return target;
	}


	//target events (string notation to advanced_optimizations)
	var offMethod = target['removeEventListener'] || target['removeListener'] || target['detachEvent'] || target['off'];

	//invoke method for each space-separated event from a list
	evt.split(/\s+/).forEach(function (evt) {
		var evtParts = evt.split('.');
		evt = evtParts.shift();

		//use target `off`, if possible
		if (offMethod) {
			//avoid self-recursion from the outside
			if (icicle.freeze(target, 'off' + evt)) {
				offMethod.call(target, evt, fn);
				icicle.unfreeze(target, 'off' + evt);
			}

			//if it’s frozen - ignore call
			else {
				return target;
			}
		}

		if (fn.closedCall) fn.closedCall = false;

		//forget callback
		listeners.remove(target, evt, fn, evtParts);
	});


	return target;
}
},{"./listeners":7,"icicle":8,"mutype/is-array":33,"sliced":9}],11:[function(require,module,exports){
/**
 * @module emmy/on
 */


var icicle = require('icicle');
var listeners = require('./listeners');
var isObject = require('mutype/is-object');

module.exports = on;


/**
 * Bind fn to a target.
 *
 * @param {*} targte A single target to bind evt
 * @param {string} evt An event name
 * @param {Function} fn A callback
 * @param {Function}? condition An optional filtering fn for a callback
 *                              which accepts an event and returns callback
 *
 * @return {object} A target
 */
function on(target, evt, fn){
	if (!target) return target;

	//consider object of events
	if (isObject(evt)) {
		for(var evtName in evt) {
			on(target, evtName, evt[evtName]);
		}
		return target;
	}

	//get target `on` method, if any
	//prefer native-like method name
	//user may occasionally expose `on` to the global, in case of browserify
	//but it is unlikely one would replace native `addEventListener`
	var onMethod =  target['addEventListener'] || target['addListener'] || target['attachEvent'] || target['on'];

	var cb = fn;

	evt = '' + evt;

	//invoke method for each space-separated event from a list
	evt.split(/\s+/).forEach(function(evt){
		var evtParts = evt.split('.');
		evt = evtParts.shift();

		//use target event system, if possible
		if (onMethod) {
			//avoid self-recursions
			//if it’s frozen - ignore call
			if (icicle.freeze(target, 'on' + evt)){
				onMethod.call(target, evt, cb);
				icicle.unfreeze(target, 'on' + evt);
			}
			else {
				return target;
			}
		}

		//save the callback anyway
		listeners.add(target, evt, cb, evtParts);
	});

	return target;
}


/**
 * Wrap an fn with condition passing
 */
on.wrap = function(target, evt, fn, condition){
	var cb = function() {
		if (condition.apply(target, arguments)) {
			return fn.apply(target, arguments);
		}
	};

	cb.fn = fn;

	return cb;
};
},{"./listeners":7,"icicle":8,"mutype/is-object":37}],12:[function(require,module,exports){
/**
 * Get clientY/clientY from an event.
 * If index is passed, treat it as index of global touches, not the targetTouches.
 * Global touches include target touches.
 *
 * @module get-client-xy
 *
 * @param {Event} e Event raised, like mousemove
 *
 * @return {number} Coordinate relative to the screen
 */
function getClientY (e, idx) {
	// touch event
	if (e.touches) {
		if (arguments.length > 1) {
			return findTouch(e.touches, idx).clientY
		}
		else {
			return e.targetTouches[0].clientY;
		}
	}

	// mouse event
	return e.clientY;
}
function getClientX (e, idx) {
	// touch event
	if (e.touches) {
		if (arguments.length > idx) {
			return findTouch(e.touches, idx).clientX;
		}
		else {
			return e.targetTouches[0].clientX;
		}
	}

	// mouse event
	return e.clientX;
}

function getClientXY (e, idx) {
	return [getClientX.apply(this, arguments), getClientY.apply(this, arguments)];
}

function findTouch (touchList, idx) {
	for (var i = 0; i < touchList.length; i++) {
		if (touchList[i].identifier === idx) {
			return touchList[i];
		}
	}
}


getClientXY.x = getClientX;
getClientXY.y = getClientY;
getClientXY.findTouch = findTouch;

module.exports = getClientXY;
},{}],13:[function(require,module,exports){
/** generate unique id for selector */
var counter = Date.now() % 1e9;

module.exports = function getUid(){
	return (Math.random() * 1e9 >>> 0) + (counter++);
};
},{}],14:[function(require,module,exports){
/** @module  intersects */
module.exports = intersects;


var min = Math.min, max = Math.max;


/**
 * Main intersection detector.
 *
 * @param {Rectangle} a Target
 * @param {Rectangle} b Container
 *
 * @return {bool} Whether target is within the container
 */
function intersects (a, b, tolerance){
	//ignore definite disintersection
	if (a.right < b.left || a.left > b.right) return false;
	if (a.bottom < b.top || a.top > b.bottom) return false;

	//intersection values
	var iX = min(a.right - max(b.left, a.left), b.right - max(a.left, b.left));
	var iY = min(a.bottom - max(b.top, a.top), b.bottom - max(a.top, b.top));
	var iSquare = iX * iY;

	var bSquare = (b.bottom - b.top) * (b.right - b.left);
	var aSquare = (a.bottom - a.top) * (a.right - a.left);

	//measure square overlap relative to the min square
	var targetSquare = min(aSquare, bSquare);


	//minimal overlap ratio
	tolerance = tolerance !== undefined ? tolerance : 0.5;

	if (iSquare / targetSquare > tolerance) {
		return true;
	}

	return false;
}
},{}],15:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],16:[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],17:[function(require,module,exports){
/**
 * Simple rect constructor.
 * It is just faster and smaller than constructing an object.
 *
 * @module mucss/Rect
 *
 * @param {number} l left
 * @param {number} t top
 * @param {number} r right
 * @param {number} b bottom
 * @param {number}? w width
 * @param {number}? h height
 *
 * @return {Rect} A rectangle object
 */
module.exports = function Rect (l,t,r,b,w,h) {
	this.top=t||0;
	this.bottom=b||0;
	this.left=l||0;
	this.right=r||0;
	if (w!==undefined) this.width=w||this.right-this.left;
	if (h!==undefined) this.height=h||this.bottom-this.top;
};
},{}],18:[function(require,module,exports){
/**
 * Get or set element’s style, prefix-agnostic.
 *
 * @module  mucss/css
 */
var fakeStyle = require('./fake-element').style;
var prefix = require('./prefix').lowercase;


/**
 * Apply styles to an element.
 *
 * @param    {Element}   el   An element to apply styles.
 * @param    {Object|string}   obj   Set of style rules or string to get style rule.
 */
module.exports = function(el, obj){
	if (!el || !obj) return;

	var name, value;

	//return value, if string passed
	if (typeof obj === 'string') {
		name = obj;

		//return value, if no value passed
		if (arguments.length < 3) {
			return el.style[prefixize(name)];
		}

		//set style, if value passed
		value = arguments[2] || '';
		obj = {};
		obj[name] = value;
	}

	for (name in obj){
		//convert numbers to px
		if (typeof obj[name] === 'number' && /left|right|bottom|top|width|height/i.test(name)) obj[name] += 'px';

		value = obj[name] || '';

		el.style[prefixize(name)] = value;
	}
};


/**
 * Return prefixized prop name, if needed.
 *
 * @param    {string}   name   A property name.
 * @return   {string}   Prefixed property name.
 */
function prefixize(name){
	var uName = name[0].toUpperCase() + name.slice(1);
	if (fakeStyle[name] !== undefined) return name;
	if (fakeStyle[prefix + uName] !== undefined) return prefix + uName;
	return '';
}

},{"./fake-element":19,"./prefix":24}],19:[function(require,module,exports){
/** Just a fake element to test styles
 * @module mucss/fake-element
 */

module.exports = document.createElement('div');
},{}],20:[function(require,module,exports){
/**
 * Window scrollbar detector.
 *
 * @module mucss/has-scroll
 */
exports.x = function () {
	return window.innerHeight > document.documentElement.clientHeight;
};
exports.y = function () {
	return window.innerWidth > document.documentElement.clientWidth;
};
},{}],21:[function(require,module,exports){
/**
 * Detect whether element is placed to fixed container or is fixed itself.
 *
 * @module mucss/is-fixed
 *
 * @param {(Element|Object)} el Element to detect fixedness.
 *
 * @return {boolean} Whether element is nested.
 */
module.exports = function (el) {
	var parentEl = el;

	//window is fixed, btw
	if (el === window) return true;

	//unlike the doc
	if (el === document) return false;

	while (parentEl) {
		if (getComputedStyle(parentEl).position === 'fixed') return true;
		parentEl = parentEl.offsetParent;
	}
	return false;
};
},{}],22:[function(require,module,exports){
/**
 * Calculate absolute offsets of an element, relative to the document.
 *
 * @module mucss/offsets
 *
 */
var win = window;
var doc = document;
var Rect = require('./Rect');
var hasScroll = require('./has-scroll');
var scrollbar = require('./scrollbar');
var isFixedEl = require('./is-fixed');
var getTranslate = require('./translate');


/**
 * Return absolute offsets of any target passed
 *
 * @param    {Element|window}   el   A target. Pass window to calculate viewport offsets
 * @return   {Object}   Offsets object with trbl.
 */
module.exports = offsets;

function offsets (el) {
	if (!el) throw Error('Bad argument');

	//calc client rect
	var cRect, result;

	//return vp offsets
	if (el === win) {
		result = new Rect(
			win.pageXOffset,
			win.pageYOffset
		);

		result.width = win.innerWidth - (hasScroll.y() ? scrollbar : 0),
		result.height = win.innerHeight - (hasScroll.x() ? scrollbar : 0)
		result.right = result.left + result.width;
		result.bottom = result.top + result.height;

		return result;
	}

	//return absolute offsets if document requested
	else if (el === doc) {
		var res = offsets(doc.documentElement);
		res.bottom = Math.max(window.innerHeight, res.bottom);
		res.right = Math.max(window.innerWidth, res.right);
		if (hasScroll.y(doc.documentElement)) res.right -= scrollbar;
		if (hasScroll.x(doc.documentElement)) res.bottom -= scrollbar;
		return res;
	}

	//FIXME: why not every element has getBoundingClientRect method?
	try {
		cRect = el.getBoundingClientRect();
	} catch (e) {
		cRect = new Rect(
			el.clientLeft,
			el.clientTop
		);
	}

	//whether element is or is in fixed
	var isFixed = isFixedEl(el);
	var xOffset = isFixed ? 0 : win.pageXOffset;
	var yOffset = isFixed ? 0 : win.pageYOffset;

	result = new Rect(
		cRect.left + xOffset,
		cRect.top + yOffset,
		cRect.left + xOffset + el.offsetWidth,
		cRect.top + yOffset + el.offsetHeight,
		el.offsetWidth,
		el.offsetHeight
	);

	return result;
};
},{"./Rect":17,"./has-scroll":20,"./is-fixed":21,"./scrollbar":25,"./translate":27}],23:[function(require,module,exports){
/**
 * Returns parsed css value.
 *
 * @module mucss/parse-value
 *
 * @param {string} str A string containing css units value
 *
 * @return {number} Parsed number value
 */
module.exports = function (str){
	str += '';
	return parseFloat(str.slice(0,-2)) || 0;
};

//FIXME: add parsing units
},{}],24:[function(require,module,exports){
/**
 * Vendor prefixes
 * Method of http://davidwalsh.name/vendor-prefix
 * @module mucss/prefix
 */

var styles = getComputedStyle(document.documentElement, '');

var pre = (Array.prototype.slice.call(styles)
	.join('')
	.match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
)[1];

dom = ('WebKit|Moz|MS|O').match(new RegExp('(' + pre + ')', 'i'))[1];

module.exports = {
	dom: dom,
	lowercase: pre,
	css: '-' + pre + '-',
	js: pre[0].toUpperCase() + pre.substr(1)
};
},{}],25:[function(require,module,exports){
/**
 * Calculate scrollbar width.
 *
 * @module mucss/scrollbar
 */

// Create the measurement node
var scrollDiv = document.createElement("div");

var style = scrollDiv.style;

style.width = '100px';
style.height = '100px';
style.overflow = 'scroll';
style.position = 'absolute';
style.top = '-9999px';

document.documentElement.appendChild(scrollDiv);

// the scrollbar width
module.exports = scrollDiv.offsetWidth - scrollDiv.clientWidth;

// Delete fake DIV
document.documentElement.removeChild(scrollDiv);
},{}],26:[function(require,module,exports){
/**
 * Enable/disable selectability of an element
 * @module mucss/selection
 */
var css = require('./css');


/**
 * Disable or Enable any selection possibilities for an element.
 *
 * @param    {Element}   el   Target to make unselectable.
 */
exports.disable = function(el){
	css(el, {
		'user-select': 'none',
		'user-drag': 'none',
		'touch-callout': 'none'
	});
	el.setAttribute('unselectable', 'on');
	el.addEventListener('selectstart', pd);
};
exports.enable = function(el){
	css(el, {
		'user-select': null,
		'user-drag': null,
		'touch-callout': null
	});
	el.removeAttribute('unselectable');
	el.removeEventListener('selectstart', pd);
};


/** Prevent you know what. */
function pd(e){
	e.preventDefault();
}
},{"./css":18}],27:[function(require,module,exports){
/**
 * Parse translate3d
 *
 * @module mucss/translate
 */

var css = require('./css');
var parseValue = require('./parse-value');

module.exports = function (el) {
	var translateStr = css(el, 'transform');

	//find translate token, retrieve comma-enclosed values
	//translate3d(1px, 2px, 2) → 1px, 2px, 2
	//FIXME: handle nested calcs
	var match = /translate(?:3d)?\s*\(([^\)]*)\)/.exec(translateStr);

	if (!match) return [0, 0];
	var values = match[1].split(/\s*,\s*/);

	//parse values
	//FIXME: nested values are not necessarily pixels
	return values.map(function (value) {
		return parseValue(value);
	});
};
},{"./css":18,"./parse-value":23}],28:[function(require,module,exports){
/**
 * Clamper.
 * Detects proper clamp min/max.
 *
 * @param {number} a Current value to cut off
 * @param {number} min One side limit
 * @param {number} max Other side limit
 *
 * @return {number} Clamped value
 */

module.exports = require('./wrap')(function(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max);
});
},{"./wrap":32}],29:[function(require,module,exports){
/**
 * @module  mumath/loop
 *
 * Looping function for any framesize
 */

module.exports = require('./wrap')(function (value, left, right) {
	//detect single-arg case, like mod-loop
	if (right === undefined) {
		right = left;
		left = 0;
	}

	//swap frame order
	if (left > right) {
		var tmp = right;
		right = left;
		left = tmp;
	}

	var frame = right - left;

	value = ((value + left) % frame) - left;
	if (value < left) value += frame;
	if (value > right) value -= frame;

	return value;
});
},{"./wrap":32}],30:[function(require,module,exports){
/**
 * @module  mumath/precision
 *
 * Get precision from float:
 *
 * @example
 * 1.1 → 1, 1234 → 0, .1234 → 4
 *
 * @param {number} n
 *
 * @return {number} decimap places
 */

module.exports = require('./wrap')(function(n){
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
});
},{"./wrap":32}],31:[function(require,module,exports){
/**
 * Precision round
 *
 * @param {number} value
 * @param {number} step Minimal discrete to round
 *
 * @return {number}
 *
 * @example
 * toPrecision(213.34, 1) == 213
 * toPrecision(213.34, .1) == 213.3
 * toPrecision(213.34, 10) == 210
 */
var precision = require('./precision');

module.exports = require('./wrap')(function(value, step) {
	if (step === 0) return value;
	if (!step) return Math.round(value);
	step = parseFloat(step);
	value = Math.round(value / step) * step;
	return parseFloat(value.toFixed(precision(step)));
});
},{"./precision":30,"./wrap":32}],32:[function(require,module,exports){
/**
 * Get fn wrapped with array/object attrs recognition
 *
 * @return {Function} Target function
 */
module.exports = function(fn){
	return function(a){
		var args = arguments;
		if (a instanceof Array) {
			var result = new Array(a.length), slice;
			for (var i = 0; i < a.length; i++){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = args[j] instanceof Array ? args[j][i] : args[j];
					val = val;
					slice.push(val);
				}
				result[i] = fn.apply(this, slice);
			}
			return result;
		}
		else if (typeof a === 'object') {
			var result = {}, slice;
			for (var i in a){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = typeof args[j] === 'object' ? args[j][i] : args[j];
					val = val;
					slice.push(val);
				}
				result[i] = fn.apply(this, slice);
			}
			return result;
		}
		else {
			return fn.apply(this, args);
		}
	};
};
},{}],33:[function(require,module,exports){
module.exports = function(a){
	return a instanceof Array;
}
},{}],34:[function(require,module,exports){
module.exports = function(target){
	return typeof Event !== 'undefined' && target instanceof Event;
};
},{}],35:[function(require,module,exports){
module.exports = function(target){
	return typeof document !== 'undefined' && target instanceof Node;
};
},{}],36:[function(require,module,exports){
module.exports = function(a){
	return typeof a === 'number' || a instanceof Number;
}
},{}],37:[function(require,module,exports){
/**
 * @module mutype/is-object
 */

//TODO: add st8 tests

//isPlainObject indeed
module.exports = function(o){
	// return obj === Object(obj);
	return !!o && typeof o === 'object' && o.constructor === Object;
};

},{}],38:[function(require,module,exports){
module.exports = function(a){
	return typeof a === 'string' || a instanceof String;
}
},{}],39:[function(require,module,exports){
module.exports = extend

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],40:[function(require,module,exports){
arguments[4][17][0].apply(exports,arguments)
},{"dup":17}],41:[function(require,module,exports){
/**
 * Parse element’s borders
 *
 * @module mucss/borders
 */

var Rect = require('./Rect');
var parse = require('./parse-value');

/**
 * Return border widths of an element
 */
module.exports = function(el){
	if (el === window) return new Rect;

	if (!(el instanceof Element)) throw Error('Argument is not an element');

	var style = window.getComputedStyle(el);

	return new Rect(
		parse(style.borderLeftWidth),
		parse(style.borderTopWidth),
		parse(style.borderRightWidth),
		parse(style.borderBottomWidth)
	);
};
},{"./Rect":40,"./parse-value":49}],42:[function(require,module,exports){
arguments[4][18][0].apply(exports,arguments)
},{"./fake-element":43,"./prefix":50,"dup":18}],43:[function(require,module,exports){
arguments[4][19][0].apply(exports,arguments)
},{"dup":19}],44:[function(require,module,exports){
arguments[4][20][0].apply(exports,arguments)
},{"dup":20}],45:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"dup":21}],46:[function(require,module,exports){
/**
 * Get margins of an element.
 * @module mucss/margins
 */

var parse = require('./parse-value');
var Rect = require('./Rect');

/**
 * Return margins of an element.
 *
 * @param    {Element}   el   An element which to calc margins.
 * @return   {Object}   Paddings object `{top:n, bottom:n, left:n, right:n}`.
 */
module.exports = function(el){
	if (el === window) return new Rect();

	if (!(el instanceof Element)) throw Error('Argument is not an element');

	var style = window.getComputedStyle(el);

	return new Rect(
		parse(style.marginLeft),
		parse(style.marginTop),
		parse(style.marginRight),
		parse(style.marginBottom)
	);
};

},{"./Rect":40,"./parse-value":49}],47:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./Rect":40,"./has-scroll":44,"./is-fixed":45,"./scrollbar":51,"./translate":52,"dup":22}],48:[function(require,module,exports){
/**
 * Caclulate paddings of an element.
 * @module  mucss/paddings
 */


var Rect = require('./Rect');
var parse = require('./parse-value');


/**
 * Return paddings of an element.
 *
 * @param    {Element}   $el   An element to calc paddings.
 * @return   {Object}   Paddings object `{top:n, bottom:n, left:n, right:n}`.
 */
module.exports = function($el){
	if ($el === window) return new Rect();

	if (!($el instanceof Element)) throw Error('Argument is not an element');

	var style = window.getComputedStyle($el);

	return new Rect(
		parse(style.paddingLeft),
		parse(style.paddingTop),
		parse(style.paddingRight),
		parse(style.paddingBottom)
	);
};
},{"./Rect":40,"./parse-value":49}],49:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"dup":23}],50:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"dup":24}],51:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"dup":25}],52:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"./css":42,"./parse-value":49,"dup":27}],53:[function(require,module,exports){
/**
 * @module  mumath/add
 */
module.exports = require('./wrap')(function () {
	var result = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		result += arguments[i];
	}
	return result;
});
},{"./wrap":76}],54:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"./wrap":76,"dup":28}],55:[function(require,module,exports){

},{}],56:[function(require,module,exports){
/**
 * @module mumath/div
 */
module.exports = require('./wrap')(function () {
	var result = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		result /= arguments[i];
	}
	return result;
});
},{"./wrap":76}],57:[function(require,module,exports){
/**
 * @module mumath/eq
 */
module.exports = require('./wrap')(function (a, b) {
	return a === b;
});
},{"./wrap":76}],58:[function(require,module,exports){
arguments[4][55][0].apply(exports,arguments)
},{"dup":55}],59:[function(require,module,exports){
/**
 * @module mumath/gt
 */
module.exports = require('./wrap')(function (a, b) {
	return a > b;
});
},{"./wrap":76}],60:[function(require,module,exports){
/**
 * @module mumath/gte
 */
module.exports = require('./wrap')(function (a, b) {
	return a >= b;
});
},{"./wrap":76}],61:[function(require,module,exports){
/**
 * Composed set of all math utils
 *
 * @module  mumath
 */
module.exports = {
	between: require('./between'),
	isBetween: require('./is-between'),
	round: require('./round'),
	precision: require('./precision'),
	loop: require('./loop'),
	add: require('./add'),
	sub: require('./sub'),
	min: require('./min'),
	max: require('./max'),
	div: require('./div'),
	lg: require('./lg'),
	log: require('./log'),
	mult: require('./mult'),
	mod: require('./mod'),
	floor: require('./floor'),
	ceil: require('./ceil'),

	gt: require('./gt'),
	gte: require('./gte'),
	lt: require('./lt'),
	lte: require('./lte'),
	eq: require('./eq'),
	ne: require('./ne'),
};
},{"./add":53,"./between":54,"./ceil":55,"./div":56,"./eq":57,"./floor":58,"./gt":59,"./gte":60,"./is-between":62,"./lg":63,"./log":64,"./loop":65,"./lt":66,"./lte":67,"./max":68,"./min":69,"./mod":70,"./mult":71,"./ne":72,"./precision":73,"./round":74,"./sub":75}],62:[function(require,module,exports){
/**
 * Whether element is between left & right including
 *
 * @param {number} a
 * @param {number} left
 * @param {number} right
 *
 * @return {Boolean}
 */
module.exports = require('./wrap')(function(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
});
},{"./wrap":76}],63:[function(require,module,exports){
/**
 * Base 10 logarithm
 *
 * @module mumath/lg
 */
module.exports = require('./wrap')(function (a) {
	return Math.log(a) / Math.log(10);
});
},{"./wrap":76}],64:[function(require,module,exports){
/**
 * Natural logarithm
 *
 * @module mumath/log
 */
module.exports = require('./wrap')(function (a) {
	return Math.log(a);
});
},{"./wrap":76}],65:[function(require,module,exports){
arguments[4][29][0].apply(exports,arguments)
},{"./wrap":76,"dup":29}],66:[function(require,module,exports){
/**
 * @module mumath/lt
 */
module.exports = require('./wrap')(function (a, b) {
	return a < b;
});
},{"./wrap":76}],67:[function(require,module,exports){
/**
 * @module mumath/lte
 */
module.exports = require('./wrap')(function (a, b) {
	return a <= b;
});
},{"./wrap":76}],68:[function(require,module,exports){
/** @module mumath/max */
module.exports = require('./wrap')(Math.max);
},{"./wrap":76}],69:[function(require,module,exports){
/**
 * @module mumath/min
 */
module.exports = require('./wrap')(Math.min);
},{"./wrap":76}],70:[function(require,module,exports){
/**
 * @module mumath/mod
 */
module.exports = require('./wrap')(function () {
	var result = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		result %= arguments[i];
	}
	return result;
});
},{"./wrap":76}],71:[function(require,module,exports){
/**
 * @module mumath/mult
 */
module.exports = require('./wrap')(function () {
	var result = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		result *= arguments[i];
	}
	return result;
});
},{"./wrap":76}],72:[function(require,module,exports){
/**
 * @module mumath/ne
 */
module.exports = require('./wrap')(function (a, b) {
	return a !== b;
});
},{"./wrap":76}],73:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"./wrap":76,"dup":30}],74:[function(require,module,exports){
arguments[4][31][0].apply(exports,arguments)
},{"./precision":73,"./wrap":76,"dup":31}],75:[function(require,module,exports){
/**
 * @module mumath/sub
 */
module.exports = require('./wrap')(function () {
	var result = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		result -= arguments[i];
	}
	return result;
});
},{"./wrap":76}],76:[function(require,module,exports){
arguments[4][32][0].apply(exports,arguments)
},{"dup":32}],77:[function(require,module,exports){
//speedy implementation of `in`
//NOTE: `!target[propName]` 2-3 orders faster than `!(propName in target)`
module.exports = function(a, b){
	if (!a) return false;

	//NOTE: this causes getter fire
	if (a[b]) return true;

	//FIXME: why in is better than hasOwnProperty? Something with prototypes. Show a case.
	return b in a;
	// return a.hasOwnProperty(b);
}

},{}],78:[function(require,module,exports){
/**
* Trivial types checkers.
* Because there’re no common lib for that ( lodash_ is a fatguy)
*/
//TODO: make main use as `is.array(target)`
//TODO: separate by libs, included per-file

module.exports = {
	has: require('./has'),
	isObject: require('./is-object'),
	isFn: require('./is-fn'),
	isString: require('./is-string'),
	isNumber: require('./is-number'),
	isBoolean: require('./is-bool'),
	isPlain: require('./is-plain'),
	isArray: require('./is-array'),
	isArrayLike: require('./is-array-like'),
	isElement: require('./is-element'),
	isPrivateName: require('./is-private-name'),
	isRegExp: require('./is-regex'),
	isEmpty: require('./is-empty')
};

},{"./has":77,"./is-array":80,"./is-array-like":79,"./is-bool":81,"./is-element":82,"./is-empty":83,"./is-fn":85,"./is-number":87,"./is-object":88,"./is-plain":89,"./is-private-name":90,"./is-regex":91,"./is-string":92}],79:[function(require,module,exports){
var isString = require('./is-string');
var isArray = require('./is-array');
var isFn = require('./is-fn');

//FIXME: add tests from http://jsfiddle.net/ku9LS/1/
module.exports = function (a){
	return isArray(a) || (a && !isString(a) && !a.nodeType && (typeof window != 'undefined' ? a != window : true) && !isFn(a) && typeof a.length === 'number');
}
},{"./is-array":80,"./is-fn":85,"./is-string":92}],80:[function(require,module,exports){
arguments[4][33][0].apply(exports,arguments)
},{"dup":33}],81:[function(require,module,exports){
module.exports = function(a){
	return typeof a === 'boolean' || a instanceof Boolean;
}
},{}],82:[function(require,module,exports){
module.exports = function(target){
	return typeof document !== 'undefined' && target instanceof HTMLElement;
};
},{}],83:[function(require,module,exports){
module.exports = function(a){
	if (!a) return true;
	for (var k in a) {
		return false;
	}
	return true;
}
},{}],84:[function(require,module,exports){
arguments[4][34][0].apply(exports,arguments)
},{"dup":34}],85:[function(require,module,exports){
module.exports = function(a){
	return !!(a && a.apply);
}
},{}],86:[function(require,module,exports){
arguments[4][35][0].apply(exports,arguments)
},{"dup":35}],87:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"dup":36}],88:[function(require,module,exports){
arguments[4][37][0].apply(exports,arguments)
},{"dup":37}],89:[function(require,module,exports){
var isString = require('./is-string'),
	isNumber = require('./is-number'),
	isBool = require('./is-bool');

module.exports = function isPlain(a){
	return !a || isString(a) || isNumber(a) || isBool(a);
};
},{"./is-bool":81,"./is-number":87,"./is-string":92}],90:[function(require,module,exports){
module.exports = function(n){
	return n[0] === '_' && n.length > 1;
}

},{}],91:[function(require,module,exports){
module.exports = function(target){
	return target instanceof RegExp;
}
},{}],92:[function(require,module,exports){
arguments[4][38][0].apply(exports,arguments)
},{"dup":38}],93:[function(require,module,exports){
/**
 * @module queried/lib/index
 */


var slice = require('sliced');
var unique = require('array-unique');
var getUid = require('get-uid');
var paren = require('parenthesis');
var isString = require('mutype/is-string');
var isArray = require('mutype/is-array');
var isArrayLike = require('mutype/is-array-like');
var arrayify = require('arrayify-compact');
var doc = require('get-doc');


/**
 * Query wrapper - main method to query elements.
 */
function queryMultiple(selector, el) {
	//ignore bad selector
	if (!selector) return [];

	//return elements passed as a selector unchanged (cover params case)
	if (!isString(selector)) {
		if (isArray(selector)) {
			return unique(arrayify(selector.map(function (sel) {
				return queryMultiple(sel, el);
			})));
		} else {
			return [selector];
		}
	}

	//catch polyfillable first `:scope` selector - just erase it, works just fine
	if (pseudos.scope) {
		selector = selector.replace(/^\s*:scope/, '');
	}

	//ignore non-queryable containers
	if (!el) {
		el = [querySingle.document];
	}

	//treat passed list
	else if (isArrayLike(el)) {
		el = arrayify(el);
	}

	//if element isn’t a node - make it q.document
	else if (!el.querySelector) {
		el = [querySingle.document];
	}

	//make any ok element a list
	else {
		el = [el];
	}

	return qPseudos(el, selector);
}


/** Query single element - no way better than return first of multiple selector */
function querySingle(selector, el){
	return queryMultiple(selector, el)[0];
}


/**
 * Return query result based off target list.
 * Parse and apply polyfilled pseudos
 */
function qPseudos(list, selector) {
	//ignore empty selector
	selector = selector.trim();
	if (!selector) return list;

	// console.group(selector);

	//scopify immediate children selector
	if (selector[0] === '>') {
		if (!pseudos.scope) {
			//scope as the first element in selector scopifies current element just ok
			selector = ':scope' + selector;
		}
		else {
			var id = getUid();
			list.forEach(function(el){el.setAttribute('__scoped', id);});
			selector = '[__scoped="' + id + '"]' + selector;
		}
	}

	var pseudo, pseudoFn, pseudoParam, pseudoParamId;

	//catch pseudo
	var parts = paren.parse(selector);
	var match = parts[0].match(pseudoRE);

	//if pseudo found
	if (match) {
		//grab pseudo details
		pseudo = match[1];
		pseudoParamId = match[2];

		if (pseudoParamId) {
			pseudoParam = paren.stringify(parts[pseudoParamId.slice(1)], parts);
		}

		//pre-select elements before pseudo
		var preSelector = paren.stringify(parts[0].slice(0, match.index), parts);

		//fix for query-relative
		if (!preSelector && !mappers[pseudo]) preSelector = '*';
		if (preSelector) list = qList(list, preSelector);


		//apply pseudo filter/mapper on the list
		pseudoFn = function(el) {return pseudos[pseudo](el, pseudoParam); };
		if (filters[pseudo]) {
			list = list.filter(pseudoFn);
		}
		else if (mappers[pseudo]) {
			list = unique(arrayify(list.map(pseudoFn)));
		}

		//shorten selector
		selector = parts[0].slice(match.index + match[0].length);

		// console.groupEnd();

		//query once again
		return qPseudos(list, paren.stringify(selector, parts));
	}

	//just query list
	else {
		// console.groupEnd();
		return qList(list, selector);
	}
}


/** Apply selector on a list of elements, no polyfilled pseudos */
function qList(list, selector){
	return unique(arrayify(list.map(function(el){
		return slice(el.querySelectorAll(selector));
	})));
}


/** Registered pseudos */
var pseudos = {};
var filters = {};
var mappers = {};


/** Regexp to grab pseudos with params */
var pseudoRE;


/**
 * Append a new filtering (classic) pseudo
 *
 * @param {string} name Pseudo name
 * @param {Function} filter A filtering function
 */
function registerFilter(name, filter, incSelf){
	if (pseudos[name]) return;

	//save pseudo filter
	pseudos[name] = filter;
	pseudos[name].includeSelf = incSelf;
	filters[name] = true;

	regenerateRegExp();
}


/**
 * Append a new mapping (relative-like) pseudo
 *
 * @param {string} name pseudo name
 * @param {Function} mapper map function
 */
function registerMapper(name, mapper, incSelf){
	if (pseudos[name]) return;

	pseudos[name] = mapper;
	pseudos[name].includeSelf = incSelf;
	mappers[name] = true;

	regenerateRegExp();
}


/** Update regexp catching pseudos */
function regenerateRegExp(){
	pseudoRE = new RegExp('::?(' + Object.keys(pseudos).join('|') + ')(\\\\[0-9]+)?');
}



/** Exports */
querySingle.all = queryMultiple;
querySingle.registerFilter = registerFilter;
querySingle.registerMapper = registerMapper;

/** Default document representative to use for DOM */
querySingle.document = doc;


module.exports = querySingle;
},{"array-unique":99,"arrayify-compact":100,"get-doc":102,"get-uid":104,"mutype/is-array":80,"mutype/is-array-like":79,"mutype/is-string":92,"parenthesis":105,"sliced":108}],94:[function(require,module,exports){
var q = require('..');

function has(el, subSelector){
	return !!q(subSelector, el);
}

module.exports = has;
},{"..":93}],95:[function(require,module,exports){
var q = require('..');
/** CSS4 matches */
function matches(el, selector){
	if (!el.parentNode) {
		var fragment = q.document.createDocumentFragment();
		fragment.appendChild(el);
	}

	return q.all(selector, el.parentNode).indexOf(el) > -1;
}

module.exports = matches;
},{"..":93}],96:[function(require,module,exports){
var matches = require('./matches');

function not(el, selector){
	return !matches(el, selector);
}

module.exports = not;
},{"./matches":95}],97:[function(require,module,exports){
var q = require('..');

module.exports = function root(el){
	return el === q.document.documentElement;
};
},{"..":93}],98:[function(require,module,exports){
/**
 * :scope pseudo
 * Return element if it has `scoped` attribute.
 *
 * @link http://dev.w3.org/csswg/selectors-4/#the-scope-pseudo
 */

module.exports = function scope(el){
	return el.hasAttribute('scoped');
};
},{}],99:[function(require,module,exports){
/*!
 * array-unique <https://github.com/jonschlinkert/array-unique>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function unique(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('array-unique expects an array.');
  }

  var len = arr.length;
  var i = -1;

  while (i++ < len) {
    var j = i + 1;

    for (; j < arr.length; ++j) {
      if (arr[i] === arr[j]) {
        arr.splice(j--, 1);
      }
    }
  }
  return arr;
};

},{}],100:[function(require,module,exports){
/*!
 * arrayify-compact <https://github.com/jonschlinkert/arrayify-compact>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT License
 */

'use strict';

var flatten = require('array-flatten');

module.exports = function(arr) {
  return flatten(!Array.isArray(arr) ? [arr] : arr)
    .filter(Boolean);
};

},{"array-flatten":101}],101:[function(require,module,exports){
'use strict'

/**
 * Expose `arrayFlatten`.
 */
module.exports = arrayFlatten

/**
 * Recursive flatten function with depth.
 *
 * @param  {Array}  array
 * @param  {Array}  result
 * @param  {Number} depth
 * @return {Array}
 */
function flattenWithDepth (array, result, depth) {
  for (var i = 0; i < array.length; i++) {
    var value = array[i]

    if (depth > 0 && Array.isArray(value)) {
      flattenWithDepth(value, result, depth - 1)
    } else {
      result.push(value)
    }
  }

  return result
}

/**
 * Recursive flatten function. Omitting depth is slightly faster.
 *
 * @param  {Array} array
 * @param  {Array} result
 * @return {Array}
 */
function flattenForever (array, result) {
  for (var i = 0; i < array.length; i++) {
    var value = array[i]

    if (Array.isArray(value)) {
      flattenForever(value, result)
    } else {
      result.push(value)
    }
  }

  return result
}

/**
 * Flatten an array, with the ability to define a depth.
 *
 * @param  {Array}  array
 * @param  {Number} depth
 * @return {Array}
 */
function arrayFlatten (array, depth) {
  if (depth == null) {
    return flattenForever(array, [])
  }

  return flattenWithDepth(array, [], depth)
}

},{}],102:[function(require,module,exports){
/**
 * @module  get-doc
 */

var hasDom = require('has-dom');

module.exports = hasDom() ? document : null;
},{"has-dom":103}],103:[function(require,module,exports){
'use strict';
module.exports = function () {
	return typeof window !== 'undefined'
		&& typeof document !== 'undefined'
		&& typeof document.createElement === 'function';
};

},{}],104:[function(require,module,exports){
arguments[4][13][0].apply(exports,arguments)
},{"dup":13}],105:[function(require,module,exports){
/**
 * @module parenthesis
 */
module.exports = {
	parse: require('./parse'),
	stringify: require('./stringify')
};
},{"./parse":106,"./stringify":107}],106:[function(require,module,exports){
/**
 * @module  parenthesis/parse
 *
 * Parse a string with parenthesis.
 *
 * @param {string} str A string with parenthesis
 *
 * @return {Array} A list with parsed parens, where 0 is initial string.
 */

//TODO: implement sequential parser of this algorithm, compare performance.
module.exports = function(str, bracket){
	//pretend non-string parsed per-se
	if (typeof str !== 'string') return [str];

	var res = [], prevStr;

	bracket = bracket || '()';

	//create parenthesis regex
	var pRE = new RegExp(['\\', bracket[0], '[^\\', bracket[0], '\\', bracket[1], ']*\\', bracket[1]].join(''));

	function replaceToken(token, idx, str){
		//save token to res
		var refId = res.push(token.slice(1,-1));

		return '\\' + refId;
	}

	//replace paren tokens till there’s none
	while (str != prevStr) {
		prevStr = str;
		str = str.replace(pRE, replaceToken);
	}

	//save resulting str
	res.unshift(str);

	return res;
};
},{}],107:[function(require,module,exports){
/**
 * @module parenthesis/stringify
 *
 * Stringify an array/object with parenthesis references
 *
 * @param {Array|Object} arr An array or object where 0 is initial string
 *                           and every other key/value is reference id/value to replace
 *
 * @return {string} A string with inserted regex references
 */

//FIXME: circular references causes recursions here
//TODO: there’s possible a recursive version of this algorithm, so test it & compare
module.exports = function (str, refs, bracket){
	var prevStr;

	//pretend bad string stringified with no parentheses
	if (!str) return '';

	if (typeof str !== 'string') {
		bracket = refs;
		refs = str;
		str = refs[0];
	}

	bracket = bracket || '()';

	function replaceRef(token, idx, str){
		return bracket[0] + refs[token.slice(1)] + bracket[1];
	}

	while (str != prevStr) {
		prevStr = str;
		str = str.replace(/\\[0-9]+/, replaceRef);
	}

	return str;
};
},{}],108:[function(require,module,exports){
module.exports = exports = require('./lib/sliced');

},{"./lib/sliced":109}],109:[function(require,module,exports){
arguments[4][9][0].apply(exports,arguments)
},{"dup":9}],110:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"./listeners":111,"dup":6,"icicle":112,"mutype/is-event":84,"mutype/is-node":86,"mutype/is-string":92,"sliced":113}],111:[function(require,module,exports){
arguments[4][7][0].apply(exports,arguments)
},{"dup":7}],112:[function(require,module,exports){
arguments[4][8][0].apply(exports,arguments)
},{"dup":8}],113:[function(require,module,exports){
arguments[4][9][0].apply(exports,arguments)
},{"dup":9}],114:[function(require,module,exports){
arguments[4][11][0].apply(exports,arguments)
},{"./listeners":111,"dup":11,"icicle":112,"mutype/is-object":88}],115:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],116:[function(require,module,exports){
var type = require('mutype');
var extend = require('xtend/mutable');

module.exports = splitKeys;


/**
 * Disentangle listed keys
 *
 * @param {Object} obj An object with key including listed declarations
 * @example {'a,b,c': 1}
 *
 * @param {boolean} deep Whether to flatten nested objects
 *
 * @todo Think to provide such method on object prototype
 *
 * @return {oblect} Source set passed {@link set}
 */
function splitKeys(obj, deep, separator){
	//swap args, if needed
	if ((deep || separator) && (type.isBoolean(separator) || type.isString(deep) || type.isRegExp(deep))) {
		var tmp = deep;
		deep = separator;
		separator = tmp;
	}

	//ensure separator
	separator = separator === undefined ? splitKeys.separator : separator;

	var list, value;

	for(var keys in obj){
		value = obj[keys];

		if (deep && type.isObject(value)) splitKeys(value, deep, separator);

		list = keys.split(separator);

		if (list.length > 1){
			delete obj[keys];
			list.forEach(setKey);
		}
	}

	function setKey(key){
		//if existing key - extend, if possible
		//FIXME: obj[key] might be not an object, but function, for example
		if (value !== obj[key] && type.isObject(value) && type.isObject(obj[key])) {
			obj[key] = extend({}, obj[key], value);
		}
		//or replace
		else {
			obj[key] = value;
		}
	}

	return obj;
}


/** default separator */
splitKeys.separator = /\s?,\s?/;
},{"mutype":78,"xtend/mutable":117}],117:[function(require,module,exports){
arguments[4][39][0].apply(exports,arguments)
},{"dup":39}],118:[function(require,module,exports){
/**
 * Append all not-existing props to the initial object
 *
 * @return {[type]} [description]
 */
module.exports = function(){
	var args = [].slice.call(arguments);
	var res = args[0];
	var l = args.length;

	if (typeof res !== 'object') throw  Error('Bad argument');

	for (var i = 1, l = args.length, obj; i < l; i++) {
		obj = args[i];
		if (typeof obj === 'object') {
			for (var prop in obj) {
				if (res[prop] === undefined) res[prop] = obj[prop];
			}
		}
	}

	return res;
};
},{}],119:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],"draggy":[function(require,module,exports){
/**
 * Simple draggable component
 *
 * @module draggy
 */


//work with css
var css = require('mucss/css');
var parseCSSValue = require('mucss/parse-value');
var selection = require('mucss/selection');
var offsets = require('mucss/offset');
var getTranslate = require('mucss/translate');
var intersect = require('intersects');

//events
var on = require('emmy/on');
var off = require('emmy/off');
var emit = require('emmy/emit');
var Emitter = require('events');
var getClientX = require('get-client-xy').x;
var getClientY = require('get-client-xy').y;

//utils
var isArray = require('is-array');
var isNumber = require('mutype/is-number');
var isString = require('mutype/is-string');
var isFn = require('is-function');
var defineState = require('define-state');
var extend = require('xtend/mutable');
var round = require('mumath/round');
var between = require('mumath/between');
var loop = require('mumath/loop');
var getUid = require('get-uid');
var q = require('queried');


var win = window, doc = document, root = doc.documentElement;


/**
 * Draggable controllers associated with elements.
 *
 * Storing them on elements is
 * - leak-prone,
 * - pollutes element’s namespace,
 * - requires some artificial key to store,
 * - unable to retrieve controller easily.
 *
 * That is why weakmap.
 */
var draggableCache = Draggable.cache = new WeakMap;



/**
 * Make an element draggable.
 *
 * @constructor
 *
 * @param {HTMLElement} target An element whether in/out of DOM
 * @param {Object} options An draggable options
 *
 * @return {HTMLElement} Target element
 */
function Draggable(target, options) {
	if (!(this instanceof Draggable)) {
		return new Draggable(target, options);
	}

	var self = this;

	//get unique id for instance
	//needed to track event binders
	self.id = getUid();
	self._ns = '.draggy_' + self.id;

	//save element passed
	self.element = target;

	draggableCache.set(target, self);

	//define mode of drag
	defineState(self, 'css3', self.css3);
	self.css3 = true;

	//define state behaviour
	defineState(self, 'state', self.state);

	//define axis behaviour
	defineState(self, 'axis', self.axis);
	self.axis = null;

	//take over options
	extend(self, options);

	//define handle
	if (!self.handle) {
		self.handle = self.element;
	}

	//setup droppable
	if (self.droppable) {
		self.initDroppable();
	}

	//go to initial state
	self.state = 'idle';

	//try to calc out basic limits
	self.update();
}


/** Inherit draggable from Emitter */
var proto = Draggable.prototype = Object.create(Emitter.prototype);


/** Init droppable "plugin" */
proto.initDroppable = function () {
	var self = this;

	on(self, 'dragstart', function () {
		var self = this;
		self.dropTargets = q.all(self.droppable);
	});

	on(self, 'drag', function () {
		var self = this;

		if (!self.dropTargets) {
			return;
		}

		var selfRect = offsets(self.element);

		self.dropTargets.forEach(function (dropTarget) {
			var targetRect = offsets(dropTarget);

			if (intersect(selfRect, targetRect, self.droppableTolerance)) {
				if (self.droppableClass) {
					dropTarget.classList.add(self.droppableClass);
				}
				if (!self.dropTarget) {
					self.dropTarget = dropTarget;

					emit(self, 'dragover', dropTarget);
					emit(dropTarget, 'dragover', self);
				}
			}
			else {
				if (self.dropTarget) {
					emit(self, 'dragout', dropTarget);
					emit(dropTarget, 'dragout', self);

					self.dropTarget = null;
				}
				if (self.droppableClass) {
					dropTarget.classList.remove(self.droppableClass);
				}
			}
		});
	});

	on(self, 'dragend', function () {
		var self = this;

		//emit drop, if any
		if (self.dropTarget) {
			emit(self.dropTarget, 'drop', self);
			emit(self, 'drop', self.dropTarget);
			self.dropTarget.classList.remove(self.droppableClass);
			self.dropTarget = null;
		}
	});
};


/**
 * Draggable behaviour
 * @enum {string}
 * @default is 'idle'
 */
proto.state = {
	//idle
	_: {
		before: function () {
			var self = this;

			self.element.classList.add('draggy-idle');

			//emit drag evts on element
			emit(self.element, 'idle', null, true);
			self.emit('idle');

			self.currentHandles = q.all(self.handle);
			self.currentHandles.forEach(function (handle) {
				on(handle, 'mousedown' + self._ns + ' touchstart' + self._ns, function (e) {
					//mark event as belonging to the draggy
					if (!e.draggy) {
						e.draggy = self;
					}
				});
			});
			//bind start drag to each handle
			on(doc, 'mousedown' + self._ns + ' touchstart' + self._ns, function (e) {
				//ignore not the self draggies
				if (e.draggy !== self) return;

				//if target is focused - ignore drag
				if (doc.activeElement === e.target) return;

				e.preventDefault();

				//multitouch has multiple starts
				self.setTouch(e);

				//update movement params
				self.update(e);

				//go to threshold state
				self.state = 'threshold';
			});
		},
		after: function () {
			var self = this;

			self.element.classList.remove('draggy-idle');

			off(doc, self._ns);
			self.currentHandles.forEach(function (handle) {
				off(handle, self._ns);
			});
			self.currentHandles = null;

			//set up tracking
			if (self.release) {
				self._trackingInterval = setInterval(function (e) {
					var now = Date.now();
					var elapsed = now - self.timestamp;

					//get delta movement since the last track
					var dX = self.prevX - self.frame[0];
					var dY = self.prevY - self.frame[1];
					self.frame[0] = self.prevX;
					self.frame[1] = self.prevY;

					var delta = Math.sqrt(dX * dX + dY * dY);

					//get speed as average of prev and current (prevent div by zero)
					var v = Math.min(self.velocity * delta / (1 + elapsed), self.maxSpeed);
					self.speed = 0.8 * v + 0.2 * self.speed;

					//get new angle as a last diff
					//NOTE: vector average isn’t the same as speed scalar average
					self.angle = Math.atan2(dY, dX);

					self.emit('track');

					return self;
				}, self.framerate);
			}
		}
	},

	threshold: {
		before: function () {
			var self = this;

			//ignore threshold state, if threshold is none
			if (isZeroArray(self.threshold)) {
				self.state = 'drag';
				return;
			}

			self.element.classList.add('draggy-threshold');

			//emit drag evts on element
			self.emit('threshold');
			emit(self.element, 'threshold');

			//listen to doc movement
			on(doc, 'touchmove' + self._ns + ' mousemove' + self._ns, function (e) {
				e.preventDefault();

				//compare movement to the threshold
				var clientX = getClientX(e, self.touchIdx);
				var clientY = getClientY(e, self.touchIdx);
				var difX = self.prevMouseX - clientX;
				var difY = self.prevMouseY - clientY;

				if (difX < self.threshold[0] || difX > self.threshold[2] || difY < self.threshold[1] || difY > self.threshold[3]) {
					self.update(e);
					self.state = 'drag';
				}
			});
			on(doc, 'mouseup' + self._ns + ' touchend' + self._ns + '', function (e) {
				e.preventDefault();

				//forget touches
				self.resetTouch();

				self.state = 'idle';
			});
		},

		after: function () {
			var self = this;

			self.element.classList.remove('draggy-threshold');

			off(doc, self._ns);
		}
	},

	drag: {
		before: function () {
			var self = this;

			//reduce dragging clutter
			selection.disable(root);

			self.element.classList.add('draggy-drag');

			//emit drag evts on element
			self.emit('dragstart');
			emit(self.element, 'dragstart', null, true);

			//emit drag events on self
			self.emit('drag');
			emit(self.element, 'drag', null, true);

			//stop drag on leave
			on(doc, 'touchend' + self._ns + ' mouseup' + self._ns + ' mouseleave' + self._ns, function (e) {
				e.preventDefault();

				//forget touches - dragend is called once
				self.resetTouch();

				//manage release movement
				if (self.speed > 1) {
					self.state = 'release';
				}

				else {
					self.state = 'idle';
				}
			});

			//move via transform
			on(doc, 'touchmove' + self._ns + ' mousemove' + self._ns, function (e) {
				self.drag(e);
			});
		},

		after: function () {
			var self = this;

			//enable document interactivity
			selection.enable(root);

			self.element.classList.remove('draggy-drag');

			//emit dragend on element, this
			self.emit('dragend');
			emit(self.element, 'dragend', null, true);

			//unbind drag events
			off(doc, self._ns);

			clearInterval(self._trackingInterval);
		}
	},

	release: {
		before: function () {
			var self = this;

			self.element.classList.add('draggy-release');

			//enter animation mode
			clearTimeout(self._animateTimeout);

			//set proper transition
			css(self.element, {
				'transition': (self.releaseDuration) + 'ms ease-out ' + (self.css3 ? 'transform' : 'position')
			});

			//plan leaving anim mode
			self._animateTimeout = setTimeout(function () {
				self.state = 'idle';
			}, self.releaseDuration);


			//calc target point & animate to it
			self.move(
				self.prevX + self.speed * Math.cos(self.angle),
				self.prevY + self.speed * Math.sin(self.angle)
			);

			self.speed = 0;
			self.emit('track');
		},

		after: function () {
			var self = this;

			self.element.classList.remove('draggy-release');

			css(this.element, {
				'transition': null
			});
		}
	},

	destroy: function () {
		var self = this;
		clearTimeout(self._animateTimeout);
		off(doc, self._ns);
	}
};


/** Drag handler. Needed to provide drag movement emulation via API */
proto.drag = function (e) {
	var self = this;

	e.preventDefault();

	var mouseX = getClientX(e, self.touchIdx),
		mouseY = getClientY(e, self.touchIdx);

	//calc mouse movement diff
	var diffMouseX = mouseX - self.prevMouseX,
		diffMouseY = mouseY - self.prevMouseY;

	//absolute mouse coordinate
	var mouseAbsX = mouseX + win.pageXOffset,
		mouseAbsY = mouseY + win.pageYOffset;

	//calc sniper offset, if any
	if (e.ctrlKey || e.metaKey) {
		self.sniperOffsetX += diffMouseX * self.sniperSlowdown;
		self.sniperOffsetY += diffMouseY * self.sniperSlowdown;
	}

	//calc movement x and y
	//take absolute placing as it is the only reliable way (2x proved)
	var x = (mouseAbsX - self.initOffsetX) - self.innerOffsetX - self.sniperOffsetX,
		y = (mouseAbsY - self.initOffsetY) - self.innerOffsetY - self.sniperOffsetY;

	//move element
	self.move(x, y);

	//save prevClientXY for calculating diff
	self.prevMouseX = mouseX;
	self.prevMouseY = mouseY;

	//emit drag
	self.emit('drag');
	emit(self.element, 'drag', null, true);
};


/** Current number of draggable touches */
var touches = 0;


/** Manage touches */
proto.setTouch = function (e) {
	if (!e.touches || this.isTouched()) return this;

	//current touch index
	this.touchIdx = touches;
	touches++;

	return this;
};
proto.resetTouch = function () {
	touches = 0;
	this.touchIdx = null;

	return this;
};
proto.isTouched = function () {
	return this.touchIdx !== null;
};


/** Index to fetch touch number from event */
proto.touchIdx = null;


/**
 * Update movement limits.
 * Refresh self.withinOffsets and self.limits.
 */
proto.update = function (e) {
	var self = this;

	//initial translation offsets
	var initXY = self.getCoords();

	//calc initial coords
	self.prevX = initXY[0];
	self.prevY = initXY[1];

	//container rect might be outside the vp, so calc absolute offsets
	//zero-position offsets, with translation(0,0)
	var selfOffsets = offsets(self.element);
	self.initOffsetX = selfOffsets.left - self.prevX;
	self.initOffsetY = selfOffsets.top - self.prevY;
	self.offsets = selfOffsets;

	//handle parent case
	var within = self.within;
	if (self.within === 'parent') {
		within = self.element.parentNode;
	}
	within = within || doc;

	//absolute offsets of a container
	var withinOffsets = offsets(within);
	self.withinOffsets = withinOffsets;


	//calculate movement limits - pin width might be wider than constraints
	self.overflowX = self.pin.width - withinOffsets.width;
	self.overflowY = self.pin.height - withinOffsets.height;
	self.limits = {
		left: withinOffsets.left - self.initOffsetX - self.pin[0] - (self.overflowX < 0 ? 0 : self.overflowX),
		top: withinOffsets.top - self.initOffsetY - self.pin[1] - (self.overflowY < 0 ? 0 : self.overflowY),
		right: self.overflowX > 0 ? 0 : withinOffsets.right - self.initOffsetX - self.pin[2],
		bottom: self.overflowY > 0 ? 0 : withinOffsets.bottom - self.initOffsetY - self.pin[3]
	};

	//preset inner offsets
	self.innerOffsetX = self.pin[0];
	self.innerOffsetY = self.pin[1];

	var selfClientRect = self.element.getBoundingClientRect();

	//if event passed - update acc to event
	if (e) {
		//take last mouse position from the event
		self.prevMouseX = getClientX(e, self.touchIdx);
		self.prevMouseY = getClientY(e, self.touchIdx);

		//if mouse is within the element - take offset normally as rel displacement
		self.innerOffsetX = -selfClientRect.left + getClientX(e, self.touchIdx);
		self.innerOffsetY = -selfClientRect.top + getClientY(e, self.touchIdx);
	}
	//if no event - suppose pin-centered event
	else {
		//take mouse position & inner offset as center of pin
		var pinX = (self.pin[0] + self.pin[2] ) * 0.5;
		var pinY = (self.pin[1] + self.pin[3] ) * 0.5;
		self.prevMouseX = selfClientRect.left + pinX;
		self.prevMouseY = selfClientRect.top + pinY;
		self.innerOffsetX = pinX;
		self.innerOffsetY = pinY;
	}

	//set initial kinetic props
	self.speed = 0;
	self.amplitude = 0;
	self.angle = 0;
	self.timestamp = +new Date();
	self.frame = [self.prevX, self.prevY];

	//set sniper offset
	self.sniperOffsetX = 0;
	self.sniperOffsetY = 0;
};


/**
 * Way of placement:
 * - position === false (slower but more precise and cross-browser)
 * - translate3d === true (faster but may cause blurs on linux systems)
 */
proto.css3 = {
	_: function () {
		css(this.element, 'position', 'absolute');
		this.getCoords = function () {
			// return [this.element.offsetLeft, this.element.offsetTop];
			return [parseCSSValue(css(this.element,'left')), parseCSSValue(css(this.element, 'top'))];
		};

		this.setCoords = function (x, y) {
			css(this.element, {
				left: x,
				top: y
			});

			//save prev coords to use as a start point next time
			this.prevX = x;
			this.prevY = y;
		};
	},

	//undefined placing is treated as translate3d
	true: function () {
		this.getCoords  = function () {
			return getTranslate(this.element) || [0,0];
		};

		this.setCoords = function (x, y) {
			x = round(x, this.precision);
			y = round(y, this.precision);

			css(this.element, 'transform', ['translate3d(', x, 'px,', y, 'px, 0)'].join(''));

			//save prev coords to use as a start point next time
			this.prevX = x;
			this.prevY = y;
		};
	}
};


/**
 * Restricting container
 * @type {Element|object}
 * @default doc.documentElement
 */
proto.within = doc;


/** Handle to drag */
proto.handle;


Object.defineProperties(proto, {
	/**
	 * Which area of draggable should not be outside the restriction area.
	 * @type {(Array|number)}
	 * @default [0,0,this.element.offsetWidth, this.element.offsetHeight]
	 */
	pin: {
		set: function (value) {
			if (isArray(value)) {
				if (value.length === 2) {
					this._pin = [value[0], value[1], value[0], value[1]];
				} else if (value.length === 4) {
					this._pin = value;
				}
			}

			else if (isNumber(value)) {
				this._pin = [value, value, value, value];
			}

			else {
				this._pin = value;
			}

			//calc pin params
			this._pin.width = this._pin[2] - this._pin[0];
			this._pin.height = this._pin[3] - this._pin[1];
		},

		get: function () {
			if (this._pin) return this._pin;

			//returning autocalculated pin, if private pin is none
			var pin = [0,0, this.offsets.width, this.offsets.height];
			pin.width = this.offsets.width;
			pin.height = this.offsets.height;
			return pin;
		}
	},

	/** Avoid initial mousemove */
	threshold: {
		set: function (val) {
			if (isNumber(val)) {
				this._threshold = [-val*0.5, -val*0.5, val*0.5, val*0.5];
			} else if (val.length === 2) {
				//Array(w,h)
				this._threshold = [-val[0]*0.5, -val[1]*0.5, val[0]*0.5, val[1]*0.5];
			} else if (val.length === 4) {
				//Array(x1,y1,x2,y2)
				this._threshold = val;
			} else if (isFn(val)) {
				//custom val funciton
				this._threshold = val();
			} else {
				this._threshold = [0,0,0,0];
			}
		},

		get: function () {
			return this._threshold || [0,0,0,0];
		}
	}
});



/**
 * For how long to release movement
 *
 * @type {(number|false)}
 * @default false
 * @todo
 */
proto.release = false;
proto.releaseDuration = 500;
proto.velocity = 1000;
proto.maxSpeed = 250;
proto.framerate = 50;


/** To what extent round position */
proto.precision = 1;


/** Droppable params */
proto.droppable = null;
proto.droppableTolerance = 0.5;
proto.droppableClass = null;


/** Slow down movement by pressing ctrl/cmd */
proto.sniper = true;


/** How much to slow sniper drag */
proto.sniperSlowdown = .85;


/**
 * Restrict movement by axis
 *
 * @default undefined
 * @enum {string}
 */
proto.axis = {
	_: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var h = (limits.bottom - limits.top);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0] - Math.max(0, this.overflowX);
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1] - Math.max(0, this.overflowY);
				if (this.repeat === 'x') {
					x = loop(x - oX, w) + oX;
				}
				else if (this.repeat === 'y') {
					y = loop(y - oY, h) + oY;
				}
				else {
					x = loop(x - oX, w) + oX;
					y = loop(y - oY, h) + oY;
				}
			}

			x = between(x, limits.left, limits.right);
			y = between(y, limits.top, limits.bottom);

			this.setCoords(x, y);
		};
	},
	x: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0] - Math.max(0, this.overflowX);
				x = loop(x - oX, w) + oX;
			} else {
				x = between(x, limits.left, limits.right);
			}

			this.setCoords(x, this.prevY);
		};
	},
	y: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var h = (limits.bottom - limits.top);
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1] - Math.max(0, this.overflowY);
				y = loop(y - oY, h) + oY;
			} else {
				y = between(y, limits.top, limits.bottom);
			}

			this.setCoords(this.prevX, y);
		};
	}
};


/** Repeat movement by one of axises */
proto.repeat = false;


/** Check whether arr is filled with zeros */
function isZeroArray(arr) {
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}



/** Clean all memory-related things */
proto.destroy = function () {
	var self = this;

	self.state = 'destroy';

	self.element = null;
	self.within = null;
};



module.exports = Draggable;
},{"define-state":2,"emmy/emit":6,"emmy/off":10,"emmy/on":11,"events":119,"get-client-xy":12,"get-uid":13,"intersects":14,"is-array":15,"is-function":16,"mucss/css":18,"mucss/offset":22,"mucss/parse-value":23,"mucss/selection":26,"mucss/translate":27,"mumath/between":28,"mumath/loop":29,"mumath/round":31,"mutype/is-number":36,"mutype/is-string":38,"queried":"queried","xtend/mutable":39}],"placer":[function(require,module,exports){
/**
* @module  placer
*
* Places any element relative to any other element the way you define
*/
module.exports = place;

//TODO: use translate3d instead of absolute repositioning (option?)
//TODO: implement avoiding strategy (graphic editors use-case when you need to avoid placing over selected elements)
//TODO: enhance best-side strategy: choose the most closest side

var css = require('mucss/css');
var scrollbarWidth = require('mucss/scrollbar');
var isFixed = require('mucss/is-fixed');
var offsets = require('mucss/offset');
var hasScroll = require('mucss/has-scroll');
var borders = require('mucss/border');
var margins = require('mucss/margin');
var q = require('queried');
var softExtend = require('soft-extend');
var align = require('aligner');


//shortcuts
var win = window, doc = document, root = doc.documentElement;


/**
 * Default options
 */
var defaults = {
	//an element to align relatively to
	//element
	relativeTo: win,

	//which side to place element
	//t/r/b/l, 'center', 'middle'
	side: 'center',

	/**
	 * An alignment trbl/0..1/center
	 *
	 * @default  0
	 * @type {(number|string|array)}
	 */
	align: 0,

	//selector/nodelist/node/[x,y]/window/function(el)
	avoid: undefined,

	//selector/nodelist/node/[x,y]/window/function(el)
	within: undefined,

	//look for better blacement, if doesn’t fit
	findBestSide: true
};


/**
 * Place element relative to the target by the side & params passed.
 *
 * @main
 *
 * @param {Element} element An element to place
 * @param {object} options Options object
 *
 * @return {boolean} The result of placement - whether placing succeeded
 */
function place(element, options){
	//ensure element
	element = q(element);

	//inherit defaults
	options = softExtend(options, defaults);

	//ensure elements
	if (!options.relativeTo) {
		options.relativeTo = q(options.relativeTo, element) || win;
	}
	if (!options.within) {
		options.within = q(options.within, element);
	}

	//TODO: query avoidables
	// options.avoid = q(element, options.avoid, true);


	//set the same position as the target or absolute
	if (options.relativeTo instanceof Element && isFixed(options.relativeTo)) {
		element.style.position = 'fixed';
	}
	else {
		element.style.position = 'absolute';
	}


	//else place according to the position
	var side = options.findBestSide && options.within ? getBestSide(element, options) : options.side;

	placeBySide[side](element, options);


	return element;
}


/**
 * Set of positioning functions
 * @enum {Function}
 * @param {Element} placee Element to place
 * @param {object} target Offsets rectangle (absolute position)
 * @param {object} ignore Sides to avoid entering (usually, already tried)
 */
var placeBySide = {
	center: function(placee, opts){
		// console.log('place center');

		//get relativeTo & within rectangles
		var placerRect = offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//align centered
		var al = opts.align;
		if (!(al instanceof Array)) {
			if (/,/.test(al)) {
				al = al.split(/\s*,\s*/);
				al = [parseFloat(al[0]), parseFloat(al[1])];
			}
			else if (/top|bottom|middle/.test(al)) al = [.5, al];
			else al = [al, .5];
		}

		align([opts.relativeTo, placee], al);


		//apply limits
		if (opts.within) {
			trimPositionY(placee, opts.within, parentRect);
			trimPositionX(placee, opts.within, parentRect);
		}


		//upd options
		opts.side = 'center';
	},

	left: function(placee, opts){
		// console.log('place left')

		var parent = placee.offsetParent;

		var placerRect = offsets(opts.relativeTo);
		var parentRect = getParentRect(parent);

		//correct borders
		contractRect(parentRect, borders(parent));


		//place left (set css right because placee width may change)
		css(placee, {
			right: parentRect.right - placerRect.left,
			left: 'auto'
		});

		//place vertically properly
		align([opts.relativeTo, placee], [null, opts.align]);


		//apply limits
		if (opts.within) trimPositionY(placee, opts.within, parentRect);


		//upd options
		opts.side = 'left';
	},

	right: function (placee, opts) {
		// console.log('place right')


		//get relativeTo & within rectangles
		var placerRect = offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);

		//correct borders
		contractRect(parentRect, borders(placee.offsetParent));


		//place right
		css(placee, {
			left: placerRect.right - parentRect.left,
			right: 'auto',
		});


		//place vertically properly
		align([opts.relativeTo, placee], [null, opts.align]);


		//apply limits
		if (opts.within) trimPositionY(placee, opts.within, parentRect);


		//upd options
		opts.side = 'right';
	},

	top: function(placee, opts){
		// console.log('place top');

		var parent = placee.offsetParent;
		var placerRect = offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//correct borders
		contractRect(parentRect, borders(parent));


		//place vertically top-side
		css(placee, {
			bottom: parentRect.bottom - placerRect.top,
			top: 'auto'
		});


		//place horizontally properly
		align([opts.relativeTo, placee], [opts.align]);


		//apply limits
		if (opts.within) trimPositionX(placee, opts.within, parentRect);


		//upd options
		opts.side = 'top';
	},

	bottom: function(placee, opts){
		// console.log('place bottom');

		//get relativeTo & within rectangles
		var placerRect = offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//correct borders
		contractRect(parentRect, borders(placee.offsetParent));


		//place bottom
		css(placee, {
			top: placerRect.bottom - parentRect.top,
			bottom: 'auto',
		});


		//place horizontally properly
		align([opts.relativeTo, placee], [opts.align]);


		//apply limits
		if (opts.within) trimPositionX(placee, opts.within, parentRect);


		//upd options
		opts.side = 'bottom';
	}
};


/**
 * Find the most appropriate side to place element
 */
function getBestSide (placee, opts) {
	var initSide = opts.side;

	var withinRect = offsets(opts.within),
		placeeRect = offsets(placee),
		placerRect = offsets(opts.relativeTo);

	contractRect(withinRect, borders(opts.within));

	var placeeMargins = margins(placee);

	//rect of "hot" area (available spaces from placer to container)
	var hotRect = {
		top: placerRect.top - withinRect.top,
		bottom: withinRect.bottom - placerRect.bottom,
		left: placerRect.left - withinRect.left,
		right: withinRect.right - placerRect.right
	};

	//rect of available spaces
	var availSpace = {
		top: hotRect.top - placeeRect.height - placeeMargins.top - placeeMargins.bottom,
		bottom: hotRect.bottom - placeeRect.height - placeeMargins.top - placeeMargins.bottom,
		left: hotRect.left - placeeRect.width - placeeMargins.left - placeeMargins.right,
		right: hotRect.right - placeeRect.width - placeeMargins.left - placeeMargins.right
	};

	//TODO:
	//if at least one avoidable el within the hot area
	//get specific limits for the side (besides the `within` restrictor)
	//and if limits are too tight, ignore the side


	//if fits initial side, return it
	if (availSpace[initSide] >= 0) return initSide;

	//if none of sides fit, return center
	if (availSpace.top < 0 && availSpace.bottom < 0 && availSpace.left < 0 && availSpace.right < 0) return 'center';

	//else find the most free side within others
	var maxSide = initSide, maxSpace = availSpace[maxSide];
	for (var side in availSpace) {
		if (availSpace[side] > maxSpace) {
			maxSide = side; maxSpace = availSpace[maxSide];
		}
	}

	return maxSide;
}



/** contract rect 1 with rect 2 */
function contractRect(rect, rect2){
	//correct rect2
	rect.left += rect2.left;
	rect.right -= rect2.right;
	rect.bottom -= rect2.bottom;
	rect.top += rect2.top;
	return rect;
}


/** apply limits rectangle to the position of an element */
function trimPositionY(placee, within, parentRect){
	var placeeRect = offsets(placee);
	var withinRect = offsets(within);
	var placeeMargins = margins(placee);

	contractRect(withinRect, borders(within));

	if (withinRect.top > placeeRect.top - placeeMargins.top) {
		css(placee, {
			top: withinRect.top - parentRect.top,
			bottom: 'auto'
		});
	}

	else if (withinRect.bottom < placeeRect.bottom + placeeMargins.bottom) {
		css(placee, {
			top: 'auto',
			bottom: parentRect.bottom - withinRect.bottom
		});
	}
}
function trimPositionX(placee, within, parentRect){
	var placeeRect = offsets(placee);
	var withinRect = offsets(within);
	var placeeMargins = margins(placee);

	contractRect(withinRect, borders(within));

	if (withinRect.left > placeeRect.left - placeeMargins.left) {
		css(placee, {
			left: withinRect.left - parentRect.left,
			right: 'auto'
		});
	}

	else if (withinRect.right < placeeRect.right + placeeMargins.right) {
		css(placee, {
			left: 'auto',
			right: parentRect.right - withinRect.right
		});
	}
}


/**
 * Return offsets rectangle for an element/array/any target passed.
 * I. e. normalize offsets rect
 *
 * @param {*} el Element, selector, window, document, rect, array
 *
 * @return {object} Offsets rectangle
 */
function getParentRect(target){
	var rect;

	//handle special static body case
	if (target === doc.body || target === root && getComputedStyle(target).position === 'static'){
		rect = {
			left: 0,
			right: win.innerWidth - (hasScroll.y() ? scrollbarWidth : 0),
			width: win.innerWidth,
			top: 0,
			bottom: win.innerHeight - (hasScroll.x() ? scrollbarWidth : 0),
			height: win.innerHeight
		};
	}
	else {
		rect = offsets(target);
	}

	return rect;
}
},{"aligner":1,"mucss/border":41,"mucss/css":42,"mucss/has-scroll":44,"mucss/is-fixed":45,"mucss/margin":46,"mucss/offset":47,"mucss/scrollbar":51,"queried":"queried","soft-extend":118}],"queried":[function(require,module,exports){
/**
 * @module  queried
 */


var doc = require('get-doc');
var q = require('./lib/');


/**
 * Detect unsupported css4 features, polyfill them
 */

//detect `:scope`
try {
	doc.querySelector(':scope');
}
catch (e) {
	q.registerFilter('scope', require('./lib/pseudos/scope'));
}


//detect `:has`
try {
	doc.querySelector(':has');
}
catch (e) {
	q.registerFilter('has', require('./lib/pseudos/has'));

	//polyfilled :has requires artificial :not to make `:not(:has(...))`.
	q.registerFilter('not', require('./lib/pseudos/not'));
}


//detect `:root`
try {
	doc.querySelector(':root');
}
catch (e) {
	q.registerFilter('root', require('./lib/pseudos/root'));
}


//detect `:matches`
try {
	doc.querySelector(':matches');
}
catch (e) {
	q.registerFilter('matches', require('./lib/pseudos/matches'));
}


/** Helper methods */
q.matches = require('./lib/pseudos/matches');


module.exports = q;
},{"./lib/":93,"./lib/pseudos/has":94,"./lib/pseudos/matches":95,"./lib/pseudos/not":96,"./lib/pseudos/root":97,"./lib/pseudos/scope":98,"get-doc":102}],"resizable":[function(require,module,exports){
var Draggable = require('draggy');
var emit = require('emmy/emit');
var on = require('emmy/on');
var isArray = require('mutype/is-array');
var isString = require('mutype/is-string');
var isObject = require('mutype/is-object');
var q = require('queried');
var extend = require('xtend/mutable');
var inherit = require('inherits');
var Emitter = require('events');
var between = require('mumath/between');
var splitKeys = require('split-keys');
var css = require('mucss/css');
var paddings = require('mucss/padding');
var borders = require('mucss/border');
var margins = require('mucss/margin');
var offsets = require('mucss/offset');
var parseCSSValue = require('mucss/parse-value');


var doc = document, win = window, root = doc.documentElement;


/**
 * Make an element resizable.
 *
 * Note that we don’t need a container option
 * as arbitrary container is emulatable via fake resizable.
 *
 * @constructor
 */
function Resizable (el, options) {
	var self = this;

	if (!(self instanceof Resizable)) {
		return new Resizable(el, options);
	}

	self.element = el;

	extend(self, options);

	self.createHandles();

	//bind event, if any
	if (self.resize) {
		self.on('resize', self.resize);
	}
}

inherit(Resizable, Emitter);


var proto = Resizable.prototype;


/** Create handles according to options */
proto.createHandles = function () {
	var self = this;

	//init handles
	var handles;

	//parse value
	if (isArray(self.handles)) {
		handles = {};
		for (var i = self.handles.length; i--;){
			handles[self.handles[i]] = null;
		}
	}
	else if (isString(self.handles)) {
		handles = {};
		var arr = self.handles.match(/([swne]+)/g);
		for (var i = arr.length; i--;){
			handles[arr[i]] = null;
		}
	}
	else if (isObject(self.handles)) {
		handles = self.handles;
	}
	//default set of handles depends on position.
	else {
		var position = getComputedStyle(self.element).position;
		var display = getComputedStyle(self.element).display;
		//if display is inline-like - provide only three handles
		//it is position: static or display: inline
		if (/inline/.test(display) || /static/.test(position)){
			handles = {
				s: null,
				se: null,
				e: null
			};

			//ensure position is not static
			css(self.element, 'position', 'relative');
		}
		//else - all handles
		else {
			handles = {
				s: null,
				se: null,
				e: null,
				ne: null,
				n: null,
				nw: null,
				w: null,
				sw: null
			};
		}
	}

	//create proper number of handles
	var handle;
	for (var direction in handles) {
		handles[direction] = self.createHandle(handles[direction], direction);
	}

	//save handles elements
	self.handles = handles;
}


/** Create handle for the direction */
proto.createHandle = function(handle, direction){
	var self = this;

	var el = self.element;

	//make handle element
	if (!handle) {
		handle = document.createElement('div');
		handle.classList.add('resizable-handle');
	}

	//insert handle to the element
	self.element.appendChild(handle);

	//save direction
	handle.direction = direction;

	//make handle draggable
	var draggy = new Draggable(handle, {
		within: self.within,
		// css3: false,
		threshold: self.threshold,
		axis: /^[ns]$/.test(direction) ? 'y' : /^[we]$/.test(direction) ? 'x' : 'both'
	});

	draggy.on('dragstart', function (e) {
		self.m = margins(el);
		self.b = borders(el);
		self.p = paddings(el);

		//parse initial offsets
		var s = getComputedStyle(el);
		self.offsets = [parseCSSValue(s.left), parseCSSValue(s.top)];

		//fix top-left position
		css(el, {
			left: self.offsets[0],
			top: self.offsets[1]
		});

		//recalc border-box
		if (getComputedStyle(el).boxSizing === 'border-box') {
			self.p.top = 0;
			self.p.bottom = 0;
			self.p.left = 0;
			self.p.right = 0;
			self.b.top = 0;
			self.b.bottom = 0;
			self.b.left = 0;
			self.b.right = 0;
		}

		//save initial size
		self.size = [el.offsetWidth - self.b.left - self.b.right - self.p.left - self.p.right, el.offsetHeight - self.b.top - self.b.bottom - self.p.top - self.p.bottom];

		//calc limits (max height/width)
		if (self.within) {
			var po = offsets(self.within);
			var o = offsets(el);
			self.limits = [
				o.left - po.left + self.size[0],
				o.top - po.top + self.size[1],
				po.right - o.right + self.size[0],
				po.bottom - o.bottom + self.size[1]];
		} else {
			self.limits = [9999, 9999, 9999, 9999];
		}


		//preset mouse cursor
		css(root, {
			'cursor': direction + '-resize'
		});

		//clear cursors
		for (var h in self.handles){
			css(self.handles[h], 'cursor', null);
		}
	});

	draggy.on('drag', function(e){
		var coords = draggy.getCoords();

		//change width/height properly
		switch (direction) {
			case 'se':
			case 's':
			case 'e':
				css(el, {
					width: between(self.size[0] + coords[0], 0, self.limits[2]),
					height: between(self.size[1] + coords[1], 0, self.limits[3])
				});
				break;
			case 'nw':
			case 'n':
			case 'w':
				css(el, {
					width: between(self.size[0] - coords[0], 0, self.limits[0]),
					height: between(self.size[1] - coords[1], 0, self.limits[1])
				});

				// //subtract t/l on changed size
				var difX = self.size[0] + self.b.left + self.b.right + self.p.left + self.p.right - el.offsetWidth;
				var difY = self.size[1] + self.b.top + self.b.bottom + self.p.top + self.p.bottom - el.offsetHeight;

				css(el, {
					left: self.offsets[0] + difX,
					top: self.offsets[1] + difY
				});
				break;
			case 'ne':
				css(el, {
					width: between(self.size[0] + coords[0], 0, self.limits[2]),
					height: between(self.size[1] - coords[1], 0, self.limits[1])
				});

				//subtract t/l on changed size
				var difY = self.size[1] + self.b.top + self.b.bottom + self.p.top + self.p.bottom - el.offsetHeight;

				css(el, {
					top: self.offsets[1] + difY
				});
				break;
			case 'sw':
				css(el, {
					width: between(self.size[0] - coords[0], 0, self.limits[0]),
					height: between(self.size[1] + coords[1], 0, self.limits[3])
				});

				//subtract t/l on changed size
				var difX = self.size[0] + self.b.left + self.b.right + self.p.left + self.p.right - el.offsetWidth;

				css(el, {
					left: self.offsets[0] + difX
				});
				break;
		};

		//trigger callbacks
		emit(self, 'resize');
		emit(el, 'resize');

		draggy.setCoords(0,0);
	});

	draggy.on('dragend', function(){
		//clear cursor & pointer-events
		css(root, {
			'cursor': null
		});

		//get back cursors
		for (var h in self.handles){
			css(self.handles[h], 'cursor', self.handles[h].direction + '-resize');
		}
	});

	//append styles
	css(handle, handleStyles[direction]);
	css(handle, 'cursor', direction + '-resize');

	//append proper class
	handle.classList.add('resizable-handle-' + direction);

	return handle;
};


/** deconstructor - removes any memory bindings */
proto.destroy = function () {
	//remove all handles
	for (var hName in this.handles){
		this.element.removeChild(this.handles[hName]);
		this.handles[hName].draggable.destroy();
	}


	//remove references
	this.element = null;
};


var w = 10;


/** Threshold size */
proto.threshold = w;


/** Styles for handles */
var handleStyles = splitKeys({
	'e,w,n,s,nw,ne,sw,se': {
		'position': 'absolute'
	},
	'e,w': {
		'top, bottom':0,
		'width': w
	},
	'e': {
		'left': 'auto',
		'right': -w/2
	},
	'w': {
		'right': 'auto',
		'left': -w/2
	},
	's': {
		'top': 'auto',
		'bottom': -w/2
	},
	'n': {
		'bottom': 'auto',
		'top': -w/2
	},
	'n,s': {
		'left, right': 0,
		'height': w
	},
	'nw,ne,sw,se': {
		'width': w,
		'height': w,
		'z-index': 1
	},
	'nw': {
		'top, left': -w/2,
		'bottom, right': 'auto'
	},
	'ne': {
		'top, right': -w/2,
		'bottom, left': 'auto'
	},
	'sw': {
		'bottom, left': -w/2,
		'top, right': 'auto'
	},
	'se': {
		'bottom, right': -w/2,
		'top, left': 'auto'
	}
}, true);



/**
 * @module resizable
 */
module.exports = Resizable;
},{"draggy":"draggy","emmy/emit":110,"emmy/on":114,"events":119,"inherits":115,"mucss/border":41,"mucss/css":42,"mucss/margin":46,"mucss/offset":47,"mucss/padding":48,"mucss/parse-value":49,"mumath/between":54,"mutype/is-array":80,"mutype/is-object":88,"mutype/is-string":92,"queried":"queried","split-keys":116,"xtend/mutable":117}]},{},[])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL2FsaWduZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9kZWZpbmUtc3RhdGUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9kZWZpbmUtc3RhdGUvbm9kZV9tb2R1bGVzL3N0OC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL2RlZmluZS1zdGF0ZS9ub2RlX21vZHVsZXMvc3Q4L25vZGVfbW9kdWxlcy9pcy1wbGFpbi1vYmplY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9kZWZpbmUtc3RhdGUvbm9kZV9tb2R1bGVzL3N0OC9ub2RlX21vZHVsZXMvaXMtcGxhaW4tb2JqZWN0L25vZGVfbW9kdWxlcy9pc29iamVjdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL2VtbXkvZW1pdC5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL2VtbXkvbGlzdGVuZXJzLmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvZW1teS9ub2RlX21vZHVsZXMvaWNpY2xlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvZW1teS9ub2RlX21vZHVsZXMvc2xpY2VkL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvZW1teS9vZmYuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9lbW15L29uLmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvZ2V0LWNsaWVudC14eS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL2dldC11aWQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9pbnRlcnNlY3RzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvaXMtYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9pcy1mdW5jdGlvbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL211Y3NzL1JlY3QuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdWNzcy9jc3MuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdWNzcy9mYWtlLWVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdWNzcy9oYXMtc2Nyb2xsLmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvbXVjc3MvaXMtZml4ZWQuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdWNzcy9vZmZzZXQuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdWNzcy9wYXJzZS12YWx1ZS5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL211Y3NzL3ByZWZpeC5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL211Y3NzL3Njcm9sbGJhci5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL211Y3NzL3NlbGVjdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL211Y3NzL3RyYW5zbGF0ZS5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL211bWF0aC9iZXR3ZWVuLmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvbXVtYXRoL2xvb3AuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdW1hdGgvcHJlY2lzaW9uLmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvbXVtYXRoL3JvdW5kLmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvbXVtYXRoL3dyYXAuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdXR5cGUvaXMtYXJyYXkuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdXR5cGUvaXMtZXZlbnQuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdXR5cGUvaXMtbm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL211dHlwZS9pcy1udW1iZXIuanMiLCJub2RlX21vZHVsZXMvZHJhZ2d5L25vZGVfbW9kdWxlcy9tdXR5cGUvaXMtb2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL2RyYWdneS9ub2RlX21vZHVsZXMvbXV0eXBlL2lzLXN0cmluZy5qcyIsIm5vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL3h0ZW5kL211dGFibGUuanMiLCJub2RlX21vZHVsZXMvbXVjc3MvYm9yZGVyLmpzIiwibm9kZV9tb2R1bGVzL211Y3NzL21hcmdpbi5qcyIsIm5vZGVfbW9kdWxlcy9tdWNzcy9wYWRkaW5nLmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9hZGQuanMiLCJub2RlX21vZHVsZXMvbXVtYXRoL2NlaWwuanMiLCJub2RlX21vZHVsZXMvbXVtYXRoL2Rpdi5qcyIsIm5vZGVfbW9kdWxlcy9tdW1hdGgvZXEuanMiLCJub2RlX21vZHVsZXMvbXVtYXRoL2d0LmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9ndGUuanMiLCJub2RlX21vZHVsZXMvbXVtYXRoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9pcy1iZXR3ZWVuLmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9sZy5qcyIsIm5vZGVfbW9kdWxlcy9tdW1hdGgvbG9nLmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9sdC5qcyIsIm5vZGVfbW9kdWxlcy9tdW1hdGgvbHRlLmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9tYXguanMiLCJub2RlX21vZHVsZXMvbXVtYXRoL21pbi5qcyIsIm5vZGVfbW9kdWxlcy9tdW1hdGgvbW9kLmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9tdWx0LmpzIiwibm9kZV9tb2R1bGVzL211bWF0aC9uZS5qcyIsIm5vZGVfbW9kdWxlcy9tdW1hdGgvc3ViLmpzIiwibm9kZV9tb2R1bGVzL211dHlwZS9oYXMuanMiLCJub2RlX21vZHVsZXMvbXV0eXBlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL211dHlwZS9pcy1hcnJheS1saWtlLmpzIiwibm9kZV9tb2R1bGVzL211dHlwZS9pcy1ib29sLmpzIiwibm9kZV9tb2R1bGVzL211dHlwZS9pcy1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL211dHlwZS9pcy1lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9tdXR5cGUvaXMtZm4uanMiLCJub2RlX21vZHVsZXMvbXV0eXBlL2lzLXBsYWluLmpzIiwibm9kZV9tb2R1bGVzL211dHlwZS9pcy1wcml2YXRlLW5hbWUuanMiLCJub2RlX21vZHVsZXMvbXV0eXBlL2lzLXJlZ2V4LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbGliL3BzZXVkb3MvaGFzLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbGliL3BzZXVkb3MvbWF0Y2hlcy5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL2xpYi9wc2V1ZG9zL25vdC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL2xpYi9wc2V1ZG9zL3Jvb3QuanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9saWIvcHNldWRvcy9zY29wZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9hcnJheS11bmlxdWUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9ub2RlX21vZHVsZXMvYXJyYXlpZnktY29tcGFjdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9hcnJheWlmeS1jb21wYWN0L25vZGVfbW9kdWxlcy9hcnJheS1mbGF0dGVuL2FycmF5LWZsYXR0ZW4uanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9ub2RlX21vZHVsZXMvZ2V0LWRvYy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9nZXQtZG9jL25vZGVfbW9kdWxlcy9oYXMtZG9tL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL3BhcmVudGhlc2lzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL3BhcmVudGhlc2lzL3BhcnNlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL3BhcmVudGhlc2lzL3N0cmluZ2lmeS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9zbGljZWQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcmVzaXphYmxlL25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Jlc2l6YWJsZS9ub2RlX21vZHVsZXMvc3BsaXQta2V5cy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zb2Z0LWV4dGVuZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsImRyYWdneSIsImluZGV4LmpzIiwicXVlcmllZCIsInJlc2l6YWJsZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDVEE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7OztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ1BBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNOQTtBQUNBO0FBQ0E7Ozs7Ozs7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBOzs7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBOzs7Ozs7Ozs7Ozs7OztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0ekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgbSA9IHJlcXVpcmUoJ211bWF0aCcpO1xyXG52YXIgbWFyZ2lucyA9IHJlcXVpcmUoJ211Y3NzL21hcmdpbicpO1xyXG52YXIgcGFkZGluZ3MgPSByZXF1aXJlKCdtdWNzcy9wYWRkaW5nJyk7XHJcbnZhciBvZmZzZXRzID0gcmVxdWlyZSgnbXVjc3Mvb2Zmc2V0Jyk7XHJcbnZhciBib3JkZXJzID0gcmVxdWlyZSgnbXVjc3MvYm9yZGVyJyk7XHJcbnZhciBjc3MgPSByZXF1aXJlKCdtdWNzcy9jc3MnKTtcclxuXHJcbi8qKlxyXG4gKiBAbW9kdWxlXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGFsaWduO1xyXG5tb2R1bGUuZXhwb3J0cy5udW1lcmlmeSA9IG51bWVyaWZ5O1xyXG5cclxuXHJcbnZhciBkb2MgPSBkb2N1bWVudCwgd2luID0gd2luZG93LCByb290ID0gZG9jLmRvY3VtZW50RWxlbWVudDtcclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIEFsaWduIHNldCBvZiBlbGVtZW50cyBieSB0aGUgc2lkZVxyXG4gKlxyXG4gKiBAcGFyYW0ge05vZGVMaXN0fEFycmF5fSBlbHMgQSBsaXN0IG9mIGVsZW1lbnRzXHJcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcnxBcnJheX0gYWxpZ25tZW50IEFsaWdubWVudCBwYXJhbVxyXG4gKiBAcGFyYW0ge0VsZW1lbnR8UmVjdGFuZ2xlfSByZWxhdGl2ZVRvIEFuIGFyZWEgb3IgZWxlbWVudCB0byBjYWxjIG9mZlxyXG4gKi9cclxuZnVuY3Rpb24gYWxpZ24oZWxzLCBhbGlnbm1lbnQsIHJlbGF0aXZlVG8pe1xyXG5cdGlmICghZWxzIHx8IGVscy5sZW5ndGggPCAyKSB0aHJvdyBFcnJvcignQXQgbGVhc3Qgb25lIGVsZW1lbnQgc2hvdWxkIGJlIHBhc3NlZCcpO1xyXG5cclxuXHQvL2RlZmF1bHQgYWxpZ25tZW50IGlzIGxlZnRcclxuXHRpZiAoIWFsaWdubWVudCkgYWxpZ25tZW50ID0gMDtcclxuXHJcblx0Ly9kZWZhdWx0IGtleSBlbGVtZW50IGlzIHRoZSBmaXJzdCBvbmVcclxuXHRpZiAoIXJlbGF0aXZlVG8pIHJlbGF0aXZlVG8gPSBlbHNbMF07XHJcblxyXG5cclxuXHQvL2ZpZ3VyZSBvdXQgeC95XHJcblx0dmFyIHhBbGlnbiwgeUFsaWduO1xyXG5cdGlmIChhbGlnbm1lbnQgaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0eEFsaWduID0gbnVtZXJpZnkoYWxpZ25tZW50WzBdKTtcclxuXHRcdHlBbGlnbiA9IG51bWVyaWZ5KGFsaWdubWVudFsxXSk7XHJcblx0fVxyXG5cdC8vY2F0Y2ggeSB2YWx1ZXNcclxuXHRlbHNlIGlmICgvdG9wfG1pZGRsZXxib3R0b20vLnRlc3QoYWxpZ25tZW50KSkge1xyXG5cdFx0eUFsaWduID0gbnVtZXJpZnkoYWxpZ25tZW50KTtcclxuXHR9XHJcblx0ZWxzZSB7XHJcblx0XHR4QWxpZ24gPSBudW1lcmlmeShhbGlnbm1lbnQpO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vYXBwbHkgYWxpZ25tZW50XHJcblx0dmFyIHRvUmVjdCA9IG9mZnNldHMocmVsYXRpdmVUbyk7XHJcblx0Zm9yICh2YXIgaSA9IGVscy5sZW5ndGgsIGVsLCBzOyBpLS07KXtcclxuXHRcdGVsID0gZWxzW2ldO1xyXG5cclxuXHRcdC8vaWdub3JlIHNlbGZcclxuXHRcdGlmIChlbCA9PT0gcmVsYXRpdmVUbykgY29udGludWU7XHJcblxyXG5cdFx0cyA9IGdldENvbXB1dGVkU3R5bGUoZWwpO1xyXG5cclxuXHRcdC8vZW5zdXJlIGVsZW1lbnQgaXMgYXQgbGVhc3QgcmVsYXRpdmUsIGlmIGl0IGlzIHN0YXRpY1xyXG5cdFx0aWYgKHMucG9zaXRpb24gPT09ICdzdGF0aWMnKSBjc3MoZWwsICdwb3NpdGlvbicsICdyZWxhdGl2ZScpO1xyXG5cclxuXHJcblx0XHQvL2luY2x1ZGUgbWFyZ2luc1xyXG5cdFx0dmFyIHBsYWNlZU1hcmdpbnMgPSBtYXJnaW5zKGVsKTtcclxuXHJcblx0XHQvL2dldCByZWxhdGl2ZVRvICYgcGFyZW50IHJlY3RhbmdsZXNcclxuXHRcdHZhciBwYXJlbnQgPSBlbC5vZmZzZXRQYXJlbnQgfHwgd2luO1xyXG5cdFx0dmFyIHBhcmVudFJlY3QgPSBvZmZzZXRzKHBhcmVudCk7XHJcblx0XHR2YXIgcGFyZW50UGFkZGluZ3MgPSBwYWRkaW5ncyhwYXJlbnQpO1xyXG5cdFx0dmFyIHBhcmVudEJvcmRlcnMgPSBib3JkZXJzKHBhcmVudCk7XHJcblxyXG5cdFx0Ly9jb3JyZWN0IHBhcmVudFJlY3RcclxuXHRcdGlmIChwYXJlbnQgPT09IGRvYy5ib2R5IHx8IHBhcmVudCA9PT0gcm9vdCAmJiBnZXRDb21wdXRlZFN0eWxlKHBhcmVudCkucG9zaXRpb24gPT09ICdzdGF0aWMnKSB7XHJcblx0XHRcdHBhcmVudFJlY3QubGVmdCA9IDA7XHJcblx0XHRcdHBhcmVudFJlY3QudG9wID0gMDtcclxuXHRcdH1cclxuXHRcdHBhcmVudFJlY3QgPSBtLnN1YihwYXJlbnRSZWN0LCBwYXJlbnRCb3JkZXJzKTtcclxuXHRcdHBhcmVudFJlY3QgPSBtLmFkZChwYXJlbnRSZWN0LCBwbGFjZWVNYXJnaW5zKTtcclxuXHRcdHBhcmVudFJlY3QgPSBtLmFkZChwYXJlbnRSZWN0LCBwYXJlbnRQYWRkaW5ncyk7XHJcblxyXG5cclxuXHRcdGFsaWduWChlbHNbaV0sIHRvUmVjdCwgcGFyZW50UmVjdCwgeEFsaWduKTtcclxuXHRcdGFsaWduWShlbHNbaV0sIHRvUmVjdCwgcGFyZW50UmVjdCwgeUFsaWduKTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiBQbGFjZSBob3Jpem9udGFsbHlcclxuICovXHJcbmZ1bmN0aW9uIGFsaWduWCAoIHBsYWNlZSwgcGxhY2VyUmVjdCwgcGFyZW50UmVjdCwgYWxpZ24gKXtcclxuXHRpZiAodHlwZW9mIGFsaWduICE9PSAnbnVtYmVyJykgcmV0dXJuO1xyXG5cclxuXHQvL2Rlc2lyYWJsZSBhYnNvbHV0ZSBsZWZ0XHJcblx0dmFyIGRlc2lyYWJsZUxlZnQgPSBwbGFjZXJSZWN0LmxlZnQgKyBwbGFjZXJSZWN0LndpZHRoKmFsaWduIC0gcGxhY2VlLm9mZnNldFdpZHRoKmFsaWduIC0gcGFyZW50UmVjdC5sZWZ0O1xyXG5cclxuXHRjc3MocGxhY2VlLCB7XHJcblx0XHRsZWZ0OiBkZXNpcmFibGVMZWZ0LFxyXG5cdFx0cmlnaHQ6ICdhdXRvJ1xyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFBsYWNlIHZlcnRpY2FsbHlcclxuICovXHJcbmZ1bmN0aW9uIGFsaWduWSAoIHBsYWNlZSwgcGxhY2VyUmVjdCwgcGFyZW50UmVjdCwgYWxpZ24gKXtcclxuXHRpZiAodHlwZW9mIGFsaWduICE9PSAnbnVtYmVyJykgcmV0dXJuO1xyXG5cclxuXHQvL2Rlc2lyYWJsZSBhYnNvbHV0ZSB0b3BcclxuXHR2YXIgZGVzaXJhYmxlVG9wID0gcGxhY2VyUmVjdC50b3AgKyBwbGFjZXJSZWN0LmhlaWdodCphbGlnbiAtIHBsYWNlZS5vZmZzZXRIZWlnaHQqYWxpZ24gLSBwYXJlbnRSZWN0LnRvcDtcclxuXHJcblx0Y3NzKHBsYWNlZSwge1xyXG5cdFx0dG9wOiBkZXNpcmFibGVUb3AsXHJcblx0XHRib3R0b206ICdhdXRvJ1xyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IHZhbHVlIENvbnZlcnQgYW55IHZhbHVlIHBhc3NlZCB0byBmbG9hdCAwLi4xXHJcbiAqL1xyXG5mdW5jdGlvbiBudW1lcmlmeSh2YWx1ZSl7XHJcblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuXHRcdC8vZWxzZSBwYXJzZSBzaW5nbGUtdmFsdWVcclxuXHRcdHN3aXRjaCAodmFsdWUpIHtcclxuXHRcdFx0Y2FzZSAnbGVmdCc6XHJcblx0XHRcdGNhc2UgJ3RvcCc6XHJcblx0XHRcdFx0cmV0dXJuIDA7XHJcblx0XHRcdGNhc2UgJ3JpZ2h0JzpcclxuXHRcdFx0Y2FzZSAnYm90dG9tJzpcclxuXHRcdFx0XHRyZXR1cm4gMTtcclxuXHRcdFx0Y2FzZSAnY2VudGVyJzpcclxuXHRcdFx0Y2FzZSAnbWlkZGxlJzpcclxuXHRcdFx0XHRyZXR1cm4gMC41O1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHBhcnNlRmxvYXQodmFsdWUpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHZhbHVlO1xyXG59IiwiLyoqXHJcbiAqIERlZmluZSBzdGF0ZWZ1bCBwcm9wZXJ0eSBvbiBhbiBvYmplY3RcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZGVmaW5lU3RhdGU7XHJcblxyXG52YXIgU3RhdGUgPSByZXF1aXJlKCdzdDgnKTtcclxuXHJcblxyXG4vKipcclxuICogRGVmaW5lIHN0YXRlZnVsIHByb3BlcnR5IG9uIGEgdGFyZ2V0XHJcbiAqXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSB0YXJnZXQgQW55IG9iamVjdFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHkgUHJvcGVydHkgbmFtZVxyXG4gKiBAcGFyYW0ge29iamVjdH0gZGVzY3JpcHRvciBTdGF0ZSBkZXNjcmlwdG9yXHJcbiAqXHJcbiAqIEByZXR1cm4ge29iamVjdH0gdGFyZ2V0XHJcbiAqL1xyXG5mdW5jdGlvbiBkZWZpbmVTdGF0ZSAodGFyZ2V0LCBwcm9wZXJ0eSwgZGVzY3JpcHRvciwgaXNGbikge1xyXG5cdC8vZGVmaW5lIGFjY2Vzc29yIG9uIGEgdGFyZ2V0XHJcblx0aWYgKGlzRm4pIHtcclxuXHRcdHRhcmdldFtwcm9wZXJ0eV0gPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XHJcblx0XHRcdFx0cmV0dXJuIHN0YXRlLnNldChhcmd1bWVudHNbMF0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdHJldHVybiBzdGF0ZS5nZXQoKTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdC8vZGVmaW5lIHNldHRlci9nZXR0ZXIgb24gYSB0YXJnZXRcclxuXHRlbHNlIHtcclxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIHByb3BlcnR5LCB7XHJcblx0XHRcdHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XHJcblx0XHRcdFx0cmV0dXJuIHN0YXRlLnNldCh2YWx1ZSk7XHJcblx0XHRcdH0sXHJcblx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHJldHVybiBzdGF0ZS5nZXQoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvL2RlZmluZSBzdGF0ZSBjb250cm9sbGVyXHJcblx0dmFyIHN0YXRlID0gbmV3IFN0YXRlKGRlc2NyaXB0b3IsIHRhcmdldCk7XHJcblxyXG5cdHJldHVybiB0YXJnZXQ7XHJcbn0iLCIvKipcclxuICogQG1vZHVsZSAgc3Q4XHJcbiAqXHJcbiAqIE1pY3JvIHN0YXRlIG1hY2hpbmUuXHJcbiAqL1xyXG5cclxuXHJcbnZhciBFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyk7XHJcbnZhciBpc0ZuID0gcmVxdWlyZSgnaXMtZnVuY3Rpb24nKTtcclxudmFyIGlzT2JqZWN0ID0gcmVxdWlyZSgnaXMtcGxhaW4tb2JqZWN0Jyk7XHJcblxyXG5cclxuLyoqIERlZmF1bHRzICovXHJcblxyXG5TdGF0ZS5vcHRpb25zID0ge1xyXG5cdGxlYXZlQ2FsbGJhY2s6ICdhZnRlcicsXHJcblx0ZW50ZXJDYWxsYmFjazogJ2JlZm9yZScsXHJcblx0Y2hhbmdlQ2FsbGJhY2s6ICdjaGFuZ2UnLFxyXG5cdHJlbWFpbmRlclN0YXRlOiAnXydcclxufTtcclxuXHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgbmV3IHN0YXRlIGNvbnRyb2xsZXIgYmFzZWQgb24gc3RhdGVzIHBhc3NlZFxyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICpcclxuICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzIEluaXRpYWwgc3RhdGVzXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gU3RhdGUoc3RhdGVzLCBjb250ZXh0KXtcclxuXHQvL2lnbm9yZSBleGlzdGluZyBzdGF0ZVxyXG5cdGlmIChzdGF0ZXMgaW5zdGFuY2VvZiBTdGF0ZSkgcmV0dXJuIHN0YXRlcztcclxuXHJcblx0Ly9lbnN1cmUgbmV3IHN0YXRlIGluc3RhbmNlIGlzIGNyZWF0ZWRcclxuXHRpZiAoISh0aGlzIGluc3RhbmNlb2YgU3RhdGUpKSByZXR1cm4gbmV3IFN0YXRlKHN0YXRlcyk7XHJcblxyXG5cdC8vc2F2ZSBzdGF0ZXMgb2JqZWN0XHJcblx0dGhpcy5zdGF0ZXMgPSBzdGF0ZXMgfHwge307XHJcblxyXG5cdC8vc2F2ZSBjb250ZXh0XHJcblx0dGhpcy5jb250ZXh0ID0gY29udGV4dCB8fCB0aGlzO1xyXG5cclxuXHQvL2luaXRlZEZsYWdcclxuXHR0aGlzLmlzSW5pdCA9IGZhbHNlO1xyXG59XHJcblxyXG5cclxuLyoqIEluaGVyaXQgU3RhdGUgZnJvbSBFbWl0dGVyICovXHJcblxyXG52YXIgcHJvdG8gPSBTdGF0ZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVtaXR0ZXIucHJvdG90eXBlKTtcclxuXHJcblxyXG4vKipcclxuICogR28gdG8gYSBzdGF0ZVxyXG4gKlxyXG4gKiBAcGFyYW0geyp9IHZhbHVlIEFueSBuZXcgc3RhdGUgdG8gZW50ZXJcclxuICovXHJcblxyXG5wcm90by5zZXQgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuXHR2YXIgb2xkVmFsdWUgPSB0aGlzLnN0YXRlLCBzdGF0ZXMgPSB0aGlzLnN0YXRlcztcclxuXHQvLyBjb25zb2xlLmdyb3VwKCdzZXQnLCB2YWx1ZSwgb2xkVmFsdWUpO1xyXG5cclxuXHQvL2xlYXZlIG9sZCBzdGF0ZVxyXG5cdHZhciBvbGRTdGF0ZU5hbWUgPSBzdGF0ZXNbb2xkVmFsdWVdICE9PSB1bmRlZmluZWQgPyBvbGRWYWx1ZSA6IFN0YXRlLm9wdGlvbnMucmVtYWluZGVyU3RhdGU7XHJcblx0dmFyIG9sZFN0YXRlID0gc3RhdGVzW29sZFN0YXRlTmFtZV07XHJcblxyXG5cdHZhciBsZWF2ZVJlc3VsdCwgbGVhdmVGbGFnID0gU3RhdGUub3B0aW9ucy5sZWF2ZUNhbGxiYWNrICsgb2xkU3RhdGVOYW1lO1xyXG5cclxuXHRpZiAodGhpcy5pc0luaXQpIHtcclxuXHRcdGlmIChpc09iamVjdChvbGRTdGF0ZSkpIHtcclxuXHRcdFx0aWYgKCF0aGlzW2xlYXZlRmxhZ10pIHtcclxuXHRcdFx0XHR0aGlzW2xlYXZlRmxhZ10gPSB0cnVlO1xyXG5cclxuXHRcdFx0XHQvL2lmIG9sZHN0YXRlIGhhcyBhZnRlciBtZXRob2QgLSBjYWxsIGl0XHJcblx0XHRcdFx0bGVhdmVSZXN1bHQgPSBnZXRWYWx1ZShvbGRTdGF0ZSwgU3RhdGUub3B0aW9ucy5sZWF2ZUNhbGxiYWNrLCB0aGlzLmNvbnRleHQpO1xyXG5cclxuXHRcdFx0XHQvL2lnbm9yZSBjaGFuZ2luZyBpZiBsZWF2ZSByZXN1bHQgaXMgZmFsc3lcclxuXHRcdFx0XHRpZiAobGVhdmVSZXN1bHQgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHR0aGlzW2xlYXZlRmxhZ10gPSBmYWxzZTtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vcmVkaXJlY3QsIGlmIHJldHVybmVkIGFueXRoaW5nXHJcblx0XHRcdFx0ZWxzZSBpZiAobGVhdmVSZXN1bHQgIT09IHVuZGVmaW5lZCAmJiBsZWF2ZVJlc3VsdCAhPT0gdmFsdWUpIHtcclxuXHRcdFx0XHRcdHRoaXMuc2V0KGxlYXZlUmVzdWx0KTtcclxuXHRcdFx0XHRcdHRoaXNbbGVhdmVGbGFnXSA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0Ly8gY29uc29sZS5ncm91cEVuZCgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dGhpc1tsZWF2ZUZsYWddID0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdC8vaWdub3JlIHJlZGlyZWN0XHJcblx0XHRcdFx0aWYgKHRoaXMuc3RhdGUgIT09IG9sZFZhbHVlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8vaWdub3JlIG5vdCBjaGFuZ2VkIHZhbHVlXHJcblx0XHRpZiAodmFsdWUgPT09IG9sZFZhbHVlKSByZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cdGVsc2Uge1xyXG5cdFx0dGhpcy5pc0luaXQgPSB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vc2V0IGN1cnJlbnQgdmFsdWVcclxuXHR0aGlzLnN0YXRlID0gdmFsdWU7XHJcblxyXG5cclxuXHQvL3RyeSB0byBlbnRlciBuZXcgc3RhdGVcclxuXHR2YXIgbmV3U3RhdGVOYW1lID0gc3RhdGVzW3ZhbHVlXSAhPT0gdW5kZWZpbmVkID8gdmFsdWUgOiBTdGF0ZS5vcHRpb25zLnJlbWFpbmRlclN0YXRlO1xyXG5cdHZhciBuZXdTdGF0ZSA9IHN0YXRlc1tuZXdTdGF0ZU5hbWVdO1xyXG5cdHZhciBlbnRlckZsYWcgPSBTdGF0ZS5vcHRpb25zLmVudGVyQ2FsbGJhY2sgKyBuZXdTdGF0ZU5hbWU7XHJcblx0dmFyIGVudGVyUmVzdWx0O1xyXG5cclxuXHRpZiAoIXRoaXNbZW50ZXJGbGFnXSkge1xyXG5cdFx0dGhpc1tlbnRlckZsYWddID0gdHJ1ZTtcclxuXHJcblx0XHRpZiAoaXNPYmplY3QobmV3U3RhdGUpKSB7XHJcblx0XHRcdGVudGVyUmVzdWx0ID0gZ2V0VmFsdWUobmV3U3RhdGUsIFN0YXRlLm9wdGlvbnMuZW50ZXJDYWxsYmFjaywgdGhpcy5jb250ZXh0KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGVudGVyUmVzdWx0ID0gZ2V0VmFsdWUoc3RhdGVzLCBuZXdTdGF0ZU5hbWUsIHRoaXMuY29udGV4dCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly9pZ25vcmUgZW50ZXJpbmcgZmFsc3kgc3RhdGVcclxuXHRcdGlmIChlbnRlclJlc3VsdCA9PT0gZmFsc2UpIHtcclxuXHRcdFx0dGhpcy5zZXQob2xkVmFsdWUpO1xyXG5cdFx0XHR0aGlzW2VudGVyRmxhZ10gPSBmYWxzZTtcclxuXHRcdFx0Ly8gY29uc29sZS5ncm91cEVuZCgpO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly9yZWRpcmVjdCBpZiByZXR1cm5lZCBhbnl0aGluZyBidXQgY3VycmVudCBzdGF0ZVxyXG5cdFx0ZWxzZSBpZiAoZW50ZXJSZXN1bHQgIT09IHVuZGVmaW5lZCAmJiBlbnRlclJlc3VsdCAhPT0gdmFsdWUpIHtcclxuXHRcdFx0dGhpcy5zZXQoZW50ZXJSZXN1bHQpO1xyXG5cdFx0XHR0aGlzW2VudGVyRmxhZ10gPSBmYWxzZTtcclxuXHRcdFx0Ly8gY29uc29sZS5ncm91cEVuZCgpO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpc1tlbnRlckZsYWddID0gZmFsc2U7XHJcblx0fVxyXG5cclxuXHJcblxyXG5cdC8vbm90aWZ5IGNoYW5nZVxyXG5cdGlmICh2YWx1ZSAhPT0gb2xkVmFsdWUpXHR7XHJcblx0XHR0aGlzLmVtaXQoU3RhdGUub3B0aW9ucy5jaGFuZ2VDYWxsYmFjaywgdmFsdWUsIG9sZFZhbHVlKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdC8vcmV0dXJuIGNvbnRleHQgdG8gY2hhaW4gY2FsbHNcclxuXHRyZXR1cm4gdGhpcy5jb250ZXh0O1xyXG59O1xyXG5cclxuXHJcbi8qKiBHZXQgY3VycmVudCBzdGF0ZSAqL1xyXG5cclxucHJvdG8uZ2V0ID0gZnVuY3Rpb24oKXtcclxuXHRyZXR1cm4gdGhpcy5zdGF0ZTtcclxufTtcclxuXHJcblxyXG4vKiogUmV0dXJuIHZhbHVlIG9yIGZuIHJlc3VsdCAqL1xyXG5mdW5jdGlvbiBnZXRWYWx1ZShob2xkZXIsIG1ldGgsIGN0eCl7XHJcblx0aWYgKGlzRm4oaG9sZGVyW21ldGhdKSkge1xyXG5cdFx0cmV0dXJuIGhvbGRlclttZXRoXS5jYWxsKGN0eCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gaG9sZGVyW21ldGhdO1xyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZTsiLCIvKiFcbiAqIGlzLXBsYWluLW9iamVjdCA8aHR0cHM6Ly9naXRodWIuY29tL2pvbnNjaGxpbmtlcnQvaXMtcGxhaW4tb2JqZWN0PlxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxNC0yMDE1LCBKb24gU2NobGlua2VydC5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBpc09iamVjdCA9IHJlcXVpcmUoJ2lzb2JqZWN0Jyk7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0T2JqZWN0KG8pIHtcbiAgcmV0dXJuIGlzT2JqZWN0KG8pID09PSB0cnVlXG4gICAgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pID09PSAnW29iamVjdCBPYmplY3RdJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG8pIHtcbiAgdmFyIGN0b3IscHJvdDtcbiAgXG4gIGlmIChpc09iamVjdE9iamVjdChvKSA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgXG4gIC8vIElmIGhhcyBtb2RpZmllZCBjb25zdHJ1Y3RvclxuICBjdG9yID0gby5jb25zdHJ1Y3RvcjtcbiAgaWYgKHR5cGVvZiBjdG9yICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gIFxuICAvLyBJZiBoYXMgbW9kaWZpZWQgcHJvdG90eXBlXG4gIHByb3QgPSBjdG9yLnByb3RvdHlwZTtcbiAgaWYgKGlzT2JqZWN0T2JqZWN0KHByb3QpID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICBcbiAgLy8gSWYgY29uc3RydWN0b3IgZG9lcyBub3QgaGF2ZSBhbiBPYmplY3Qtc3BlY2lmaWMgbWV0aG9kXG4gIGlmIChwcm90Lmhhc093blByb3BlcnR5KCdpc1Byb3RvdHlwZU9mJykgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICAvLyBNb3N0IGxpa2VseSBhIHBsYWluIE9iamVjdFxuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvKiFcbiAqIGlzb2JqZWN0IDxodHRwczovL2dpdGh1Yi5jb20vam9uc2NobGlua2VydC9pc29iamVjdD5cbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtMjAxNSwgSm9uIFNjaGxpbmtlcnQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzT2JqZWN0KHZhbCkge1xuICByZXR1cm4gdmFsICE9IG51bGwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCdcbiAgICAmJiAhQXJyYXkuaXNBcnJheSh2YWwpO1xufTtcbiIsIi8qKlxyXG4gKiBAbW9kdWxlIGVtbXkvZW1pdFxyXG4gKi9cclxudmFyIGljaWNsZSA9IHJlcXVpcmUoJ2ljaWNsZScpO1xyXG52YXIgc2xpY2UgPSByZXF1aXJlKCdzbGljZWQnKTtcclxudmFyIGlzU3RyaW5nID0gcmVxdWlyZSgnbXV0eXBlL2lzLXN0cmluZycpO1xyXG52YXIgaXNOb2RlID0gcmVxdWlyZSgnbXV0eXBlL2lzLW5vZGUnKTtcclxudmFyIGlzRXZlbnQgPSByZXF1aXJlKCdtdXR5cGUvaXMtZXZlbnQnKTtcclxudmFyIGxpc3RlbmVycyA9IHJlcXVpcmUoJy4vbGlzdGVuZXJzJyk7XHJcblxyXG5cclxuLyoqXHJcbiAqIEEgc2ltcGxlIHdyYXBwZXIgdG8gaGFuZGxlIHN0cmluZ3kvcGxhaW4gZXZlbnRzXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCwgZXZ0KXtcclxuXHRpZiAoIXRhcmdldCkgcmV0dXJuO1xyXG5cclxuXHR2YXIgYXJncyA9IGFyZ3VtZW50cztcclxuXHRpZiAoaXNTdHJpbmcoZXZ0KSkge1xyXG5cdFx0YXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMik7XHJcblx0XHRldnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uKGV2dCl7XHJcblx0XHRcdGV2dCA9IGV2dC5zcGxpdCgnLicpWzBdO1xyXG5cclxuXHRcdFx0ZW1pdC5hcHBseSh0aGlzLCBbdGFyZ2V0LCBldnRdLmNvbmNhdChhcmdzKSk7XHJcblx0XHR9KTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGVtaXQuYXBwbHkodGhpcywgYXJncyk7XHJcblx0fVxyXG59O1xyXG5cclxuXHJcbi8qKiBkZXRlY3QgZW52ICovXHJcbnZhciAkID0gdHlwZW9mIGpRdWVyeSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBqUXVlcnk7XHJcbnZhciBkb2MgPSB0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogZG9jdW1lbnQ7XHJcbnZhciB3aW4gPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IHdpbmRvdztcclxuXHJcblxyXG4vKipcclxuICogRW1pdCBhbiBldmVudCwgb3B0aW9uYWxseSB3aXRoIGRhdGEgb3IgYnViYmxpbmdcclxuICogQWNjZXB0IG9ubHkgc2luZ2xlIGVsZW1lbnRzL2V2ZW50c1xyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIEFuIGV2ZW50IG5hbWUsIGUuIGcuICdjbGljaydcclxuICogQHBhcmFtIHsqfSBkYXRhIEFueSBkYXRhIHRvIHBhc3MgdG8gZXZlbnQuZGV0YWlscyAoRE9NKSBvciBldmVudC5kYXRhIChlbHNld2hlcmUpXHJcbiAqIEBwYXJhbSB7Ym9vbH0gYnViYmxlcyBXaGV0aGVyIHRvIHRyaWdnZXIgYnViYmxpbmcgZXZlbnQgKERPTSlcclxuICpcclxuICpcclxuICogQHJldHVybiB7dGFyZ2V0fSBhIHRhcmdldFxyXG4gKi9cclxuZnVuY3Rpb24gZW1pdCh0YXJnZXQsIGV2ZW50TmFtZSwgZGF0YSwgYnViYmxlcyl7XHJcblx0dmFyIGVtaXRNZXRob2QsIGV2dCA9IGV2ZW50TmFtZTtcclxuXHJcblx0Ly9DcmVhdGUgcHJvcGVyIGV2ZW50IGZvciBET00gb2JqZWN0c1xyXG5cdGlmIChpc05vZGUodGFyZ2V0KSB8fCB0YXJnZXQgPT09IHdpbikge1xyXG5cdFx0Ly9OT1RFOiB0aGlzIGRvZXNub3QgYnViYmxlIG9uIG9mZi1ET00gZWxlbWVudHNcclxuXHJcblx0XHRpZiAoaXNFdmVudChldmVudE5hbWUpKSB7XHJcblx0XHRcdGV2dCA9IGV2ZW50TmFtZTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vSUU5LWNvbXBsaWFudCBjb25zdHJ1Y3RvclxyXG5cdFx0XHRldnQgPSBkb2MuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XHJcblx0XHRcdGV2dC5pbml0Q3VzdG9tRXZlbnQoZXZlbnROYW1lLCBidWJibGVzLCB0cnVlLCBkYXRhKTtcclxuXHJcblx0XHRcdC8vYSBtb2Rlcm4gY29uc3RydWN0b3Igd291bGQgYmU6XHJcblx0XHRcdC8vIHZhciBldnQgPSBuZXcgQ3VzdG9tRXZlbnQoZXZlbnROYW1lLCB7IGRldGFpbDogZGF0YSwgYnViYmxlczogYnViYmxlcyB9KVxyXG5cdFx0fVxyXG5cclxuXHRcdGVtaXRNZXRob2QgPSB0YXJnZXQuZGlzcGF0Y2hFdmVudDtcclxuXHR9XHJcblxyXG5cdC8vY3JlYXRlIGV2ZW50IGZvciBqUXVlcnkgb2JqZWN0XHJcblx0ZWxzZSBpZiAoJCAmJiB0YXJnZXQgaW5zdGFuY2VvZiAkKSB7XHJcblx0XHQvL1RPRE86IGRlY2lkZSBob3cgdG8gcGFzcyBkYXRhXHJcblx0XHRldnQgPSAkLkV2ZW50KCBldmVudE5hbWUsIGRhdGEgKTtcclxuXHRcdGV2dC5kZXRhaWwgPSBkYXRhO1xyXG5cclxuXHRcdC8vRklYTUU6IHJlZmVyZW5jZSBjYXNlIHdoZXJlIHRyaWdnZXJIYW5kbGVyIG5lZWRlZCAoc29tZXRoaW5nIHdpdGggbXVsdGlwbGUgY2FsbHMpXHJcblx0XHRlbWl0TWV0aG9kID0gYnViYmxlcyA/IHRhcmd0ZS50cmlnZ2VyIDogdGFyZ2V0LnRyaWdnZXJIYW5kbGVyO1xyXG5cdH1cclxuXHJcblx0Ly9kZXRlY3QgdGFyZ2V0IGV2ZW50c1xyXG5cdGVsc2Uge1xyXG5cdFx0Ly9lbWl0IC0gZGVmYXVsdFxyXG5cdFx0Ly90cmlnZ2VyIC0ganF1ZXJ5XHJcblx0XHQvL2Rpc3BhdGNoRXZlbnQgLSBET01cclxuXHRcdC8vcmFpc2UgLSBub2RlLXN0YXRlXHJcblx0XHQvL2ZpcmUgLSA/Pz9cclxuXHRcdGVtaXRNZXRob2QgPSB0YXJnZXRbJ2Rpc3BhdGNoRXZlbnQnXSB8fCB0YXJnZXRbJ2VtaXQnXSB8fCB0YXJnZXRbJ3RyaWdnZXInXSB8fCB0YXJnZXRbJ2ZpcmUnXSB8fCB0YXJnZXRbJ3JhaXNlJ107XHJcblx0fVxyXG5cclxuXHJcblx0dmFyIGFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDIpO1xyXG5cclxuXHJcblx0Ly91c2UgbG9ja3MgdG8gYXZvaWQgc2VsZi1yZWN1cnNpb24gb24gb2JqZWN0cyB3cmFwcGluZyB0aGlzIG1ldGhvZFxyXG5cdGlmIChlbWl0TWV0aG9kKSB7XHJcblx0XHRpZiAoaWNpY2xlLmZyZWV6ZSh0YXJnZXQsICdlbWl0JyArIGV2ZW50TmFtZSkpIHtcclxuXHRcdFx0Ly91c2UgdGFyZ2V0IGV2ZW50IHN5c3RlbSwgaWYgcG9zc2libGVcclxuXHRcdFx0ZW1pdE1ldGhvZC5hcHBseSh0YXJnZXQsIFtldnRdLmNvbmNhdChhcmdzKSk7XHJcblx0XHRcdGljaWNsZS51bmZyZWV6ZSh0YXJnZXQsICdlbWl0JyArIGV2ZW50TmFtZSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdGFyZ2V0O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vaWYgZXZlbnQgd2FzIGZyb3plbiAtIHByb2JhYmx5IGl0IGlzIGVtaXR0ZXIgaW5zdGFuY2VcclxuXHRcdC8vc28gcGVyZm9ybSBub3JtYWwgY2FsbGJhY2tcclxuXHR9XHJcblxyXG5cclxuXHQvL2ZhbGwgYmFjayB0byBkZWZhdWx0IGV2ZW50IHN5c3RlbVxyXG5cdHZhciBldnRDYWxsYmFja3MgPSBsaXN0ZW5lcnModGFyZ2V0LCBldnQpO1xyXG5cclxuXHQvL2NvcHkgY2FsbGJhY2tzIHRvIGZpcmUgYmVjYXVzZSBsaXN0IGNhbiBiZSBjaGFuZ2VkIGJ5IHNvbWUgY2FsbGJhY2sgKGxpa2UgYG9mZmApXHJcblx0dmFyIGZpcmVMaXN0ID0gc2xpY2UoZXZ0Q2FsbGJhY2tzKTtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGZpcmVMaXN0Lmxlbmd0aDsgaSsrICkge1xyXG5cdFx0ZmlyZUxpc3RbaV0gJiYgZmlyZUxpc3RbaV0uYXBwbHkodGFyZ2V0LCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB0YXJnZXQ7XHJcbn0iLCIvKipcclxuICogQSBzdG9yYWdlIG9mIHBlci10YXJnZXQgY2FsbGJhY2tzLlxyXG4gKiBXZWFrTWFwIGlzIHRoZSBtb3N0IHNhZmUgc29sdXRpb24uXHJcbiAqXHJcbiAqIEBtb2R1bGUgZW1teS9saXN0ZW5lcnNcclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqIFByb3BlcnR5IG5hbWUgdG8gcHJvdmlkZSBvbiB0YXJnZXRzLlxyXG4gKlxyXG4gKiBDYW7igJl0IHVzZSBnbG9iYWwgV2Vha01hcCAtXHJcbiAqIGl0IGlzIGltcG9zc2libGUgdG8gcHJvdmlkZSBzaW5nbGV0b24gZ2xvYmFsIGNhY2hlIG9mIGNhbGxiYWNrcyBmb3IgdGFyZ2V0c1xyXG4gKiBub3QgcG9sbHV0aW5nIGdsb2JhbCBzY29wZS4gU28gaXQgaXMgYmV0dGVyIHRvIHBvbGx1dGUgdGFyZ2V0IHNjb3BlIHRoYW4gdGhlIGdsb2JhbC5cclxuICpcclxuICogT3RoZXJ3aXNlLCBlYWNoIGVtbXkgaW5zdGFuY2Ugd2lsbCBjcmVhdGUgaXTigJlzIG93biBjYWNoZSwgd2hpY2ggbGVhZHMgdG8gbWVzcy5cclxuICpcclxuICogQWxzbyBjYW7igJl0IHVzZSBgLl9ldmVudHNgIHByb3BlcnR5IG9uIHRhcmdldHMsIGFzIGl0IGlzIGRvbmUgaW4gYGV2ZW50c2AgbW9kdWxlLFxyXG4gKiBiZWNhdXNlIGl0IGlzIGluY29tcGF0aWJsZS4gRW1teSB0YXJnZXRzIHVuaXZlcnNhbCBldmVudHMgd3JhcHBlciwgbm90IHRoZSBuYXRpdmUgaW1wbGVtZW50YXRpb24uXHJcbiAqL1xyXG52YXIgY2JQcm9wTmFtZSA9ICdfY2FsbGJhY2tzJztcclxuXHJcblxyXG4vKipcclxuICogR2V0IGxpc3RlbmVycyBmb3IgdGhlIHRhcmdldC9ldnQgKG9wdGlvbmFsbHkpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge29iamVjdH0gdGFyZ2V0IGEgdGFyZ2V0IG9iamVjdFxyXG4gKiBAcGFyYW0ge3N0cmluZ30/IGV2dCBhbiBldnQgbmFtZSwgaWYgdW5kZWZpbmVkIC0gcmV0dXJuIG9iamVjdCB3aXRoIGV2ZW50c1xyXG4gKlxyXG4gKiBAcmV0dXJuIHsob2JqZWN0fGFycmF5KX0gTGlzdC9zZXQgb2YgbGlzdGVuZXJzXHJcbiAqL1xyXG5mdW5jdGlvbiBsaXN0ZW5lcnModGFyZ2V0LCBldnQsIHRhZ3Mpe1xyXG5cdHZhciBjYnMgPSB0YXJnZXRbY2JQcm9wTmFtZV07XHJcblx0dmFyIHJlc3VsdDtcclxuXHJcblx0aWYgKCFldnQpIHtcclxuXHRcdHJlc3VsdCA9IGNicyB8fCB7fTtcclxuXHJcblx0XHQvL2ZpbHRlciBjYnMgYnkgdGFnc1xyXG5cdFx0aWYgKHRhZ3MpIHtcclxuXHRcdFx0dmFyIGZpbHRlcmVkUmVzdWx0ID0ge307XHJcblx0XHRcdGZvciAodmFyIGV2dCBpbiByZXN1bHQpIHtcclxuXHRcdFx0XHRmaWx0ZXJlZFJlc3VsdFtldnRdID0gcmVzdWx0W2V2dF0uZmlsdGVyKGZ1bmN0aW9uIChjYikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIGhhc1RhZ3MoY2IsIHRhZ3MpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJlc3VsdCA9IGZpbHRlcmVkUmVzdWx0O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXN1bHQ7XHJcblx0fVxyXG5cclxuXHRpZiAoIWNicyB8fCAhY2JzW2V2dF0pIHtcclxuXHRcdHJldHVybiBbXTtcclxuXHR9XHJcblxyXG5cdHJlc3VsdCA9IGNic1tldnRdO1xyXG5cclxuXHQvL2lmIHRoZXJlIGFyZSBldnQgbmFtZXNwYWNlcyBzcGVjaWZpZWQgLSBmaWx0ZXIgY2FsbGJhY2tzXHJcblx0aWYgKHRhZ3MgJiYgdGFncy5sZW5ndGgpIHtcclxuXHRcdHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24gKGNiKSB7XHJcblx0XHRcdHJldHVybiBoYXNUYWdzKGNiLCB0YWdzKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgbGlzdGVuZXIsIGlmIGFueVxyXG4gKi9cclxubGlzdGVuZXJzLnJlbW92ZSA9IGZ1bmN0aW9uKHRhcmdldCwgZXZ0LCBjYiwgdGFncyl7XHJcblx0Ly9nZXQgY2FsbGJhY2tzIGZvciB0aGUgZXZ0XHJcblx0dmFyIGV2dENhbGxiYWNrcyA9IHRhcmdldFtjYlByb3BOYW1lXTtcclxuXHRpZiAoIWV2dENhbGxiYWNrcyB8fCAhZXZ0Q2FsbGJhY2tzW2V2dF0pIHJldHVybiBmYWxzZTtcclxuXHJcblx0dmFyIGNhbGxiYWNrcyA9IGV2dENhbGxiYWNrc1tldnRdO1xyXG5cclxuXHQvL2lmIHRhZ3MgYXJlIHBhc3NlZCAtIG1ha2Ugc3VyZSBjYWxsYmFjayBoYXMgc29tZSB0YWdzIGJlZm9yZSByZW1vdmluZ1xyXG5cdGlmICh0YWdzICYmIHRhZ3MubGVuZ3RoICYmICFoYXNUYWdzKGNiLCB0YWdzKSkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHQvL3JlbW92ZSBzcGVjaWZpYyBoYW5kbGVyXHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcclxuXHRcdC8vb25jZSBtZXRob2QgaGFzIG9yaWdpbmFsIGNhbGxiYWNrIGluIC5jYlxyXG5cdFx0aWYgKGNhbGxiYWNrc1tpXSA9PT0gY2IgfHwgY2FsbGJhY2tzW2ldLmZuID09PSBjYikge1xyXG5cdFx0XHRjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEFkZCBhIG5ldyBsaXN0ZW5lclxyXG4gKi9cclxubGlzdGVuZXJzLmFkZCA9IGZ1bmN0aW9uKHRhcmdldCwgZXZ0LCBjYiwgdGFncyl7XHJcblx0aWYgKCFjYikgcmV0dXJuO1xyXG5cclxuXHR2YXIgdGFyZ2V0Q2FsbGJhY2tzID0gdGFyZ2V0W2NiUHJvcE5hbWVdO1xyXG5cclxuXHQvL2Vuc3VyZSBzZXQgb2YgY2FsbGJhY2tzIGZvciB0aGUgdGFyZ2V0IGV4aXN0c1xyXG5cdGlmICghdGFyZ2V0Q2FsbGJhY2tzKSB7XHJcblx0XHR0YXJnZXRDYWxsYmFja3MgPSB7fTtcclxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGNiUHJvcE5hbWUsIHtcclxuXHRcdFx0dmFsdWU6IHRhcmdldENhbGxiYWNrc1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvL3NhdmUgYSBuZXcgY2FsbGJhY2tcclxuXHQodGFyZ2V0Q2FsbGJhY2tzW2V2dF0gPSB0YXJnZXRDYWxsYmFja3NbZXZ0XSB8fCBbXSkucHVzaChjYik7XHJcblxyXG5cdC8vc2F2ZSBucyBmb3IgYSBjYWxsYmFjaywgaWYgYW55XHJcblx0aWYgKHRhZ3MgJiYgdGFncy5sZW5ndGgpIHtcclxuXHRcdGNiLl9ucyA9IHRhZ3M7XHJcblx0fVxyXG59O1xyXG5cclxuXHJcbi8qKiBEZXRlY3Qgd2hldGhlciBhbiBjYiBoYXMgYXQgbGVhc3Qgb25lIHRhZyBmcm9tIHRoZSBsaXN0ICovXHJcbmZ1bmN0aW9uIGhhc1RhZ3MoY2IsIHRhZ3Mpe1xyXG5cdGlmIChjYi5fbnMpIHtcclxuXHRcdC8vaWYgY2IgaXMgdGFnZ2VkIHdpdGggYSBucyBhbmQgaW5jbHVkZXMgb25lIG9mIHRoZSBucyBwYXNzZWQgLSBrZWVwIGl0XHJcblx0XHRmb3IgKHZhciBpID0gdGFncy5sZW5ndGg7IGktLTspe1xyXG5cdFx0XHRpZiAoY2IuX25zLmluZGV4T2YodGFnc1tpXSkgPj0gMCkgcmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBsaXN0ZW5lcnM7IiwiLyoqXHJcbiAqIEBtb2R1bGUgSWNpY2xlXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRmcmVlemU6IGxvY2ssXHJcblx0dW5mcmVlemU6IHVubG9jayxcclxuXHRpc0Zyb3plbjogaXNMb2NrZWRcclxufTtcclxuXHJcblxyXG4vKiogU2V0IG9mIHRhcmdldHMgICovXHJcbnZhciBsb2NrQ2FjaGUgPSBuZXcgV2Vha01hcDtcclxuXHJcblxyXG4vKipcclxuICogU2V0IGZsYWcgb24gdGFyZ2V0IHdpdGggdGhlIG5hbWUgcGFzc2VkXHJcbiAqXHJcbiAqIEByZXR1cm4ge2Jvb2x9IFdoZXRoZXIgbG9jayBzdWNjZWVkZWRcclxuICovXHJcbmZ1bmN0aW9uIGxvY2sodGFyZ2V0LCBuYW1lKXtcclxuXHR2YXIgbG9ja3MgPSBsb2NrQ2FjaGUuZ2V0KHRhcmdldCk7XHJcblx0aWYgKGxvY2tzICYmIGxvY2tzW25hbWVdKSByZXR1cm4gZmFsc2U7XHJcblxyXG5cdC8vY3JlYXRlIGxvY2sgc2V0IGZvciBhIHRhcmdldCwgaWYgbm9uZVxyXG5cdGlmICghbG9ja3MpIHtcclxuXHRcdGxvY2tzID0ge307XHJcblx0XHRsb2NrQ2FjaGUuc2V0KHRhcmdldCwgbG9ja3MpO1xyXG5cdH1cclxuXHJcblx0Ly9zZXQgYSBuZXcgbG9ja1xyXG5cdGxvY2tzW25hbWVdID0gdHJ1ZTtcclxuXHJcblx0Ly9yZXR1cm4gc3VjY2Vzc1xyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFVuc2V0IGZsYWcgb24gdGhlIHRhcmdldCB3aXRoIHRoZSBuYW1lIHBhc3NlZC5cclxuICpcclxuICogTm90ZSB0aGF0IGlmIHRvIHJldHVybiBuZXcgdmFsdWUgZnJvbSB0aGUgbG9jay91bmxvY2ssXHJcbiAqIHRoZW4gdW5sb2NrIHdpbGwgYWx3YXlzIHJldHVybiBmYWxzZSBhbmQgbG9jayB3aWxsIGFsd2F5cyByZXR1cm4gdHJ1ZSxcclxuICogd2hpY2ggaXMgdXNlbGVzcyBmb3IgdGhlIHVzZXIsIHRob3VnaCBtYXliZSBpbnR1aXRpdmUuXHJcbiAqXHJcbiAqIEBwYXJhbSB7Kn0gdGFyZ2V0IEFueSBvYmplY3RcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgQSBmbGFnIG5hbWVcclxuICpcclxuICogQHJldHVybiB7Ym9vbH0gV2hldGhlciB1bmxvY2sgZmFpbGVkLlxyXG4gKi9cclxuZnVuY3Rpb24gdW5sb2NrKHRhcmdldCwgbmFtZSl7XHJcblx0dmFyIGxvY2tzID0gbG9ja0NhY2hlLmdldCh0YXJnZXQpO1xyXG5cdGlmICghbG9ja3MgfHwgIWxvY2tzW25hbWVdKSByZXR1cm4gZmFsc2U7XHJcblxyXG5cdGxvY2tzW25hbWVdID0gbnVsbDtcclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogUmV0dXJuIHdoZXRoZXIgZmxhZyBpcyBzZXRcclxuICpcclxuICogQHBhcmFtIHsqfSB0YXJnZXQgQW55IG9iamVjdCB0byBhc3NvY2lhdGUgbG9jayB3aXRoXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIEEgZmxhZyBuYW1lXHJcbiAqXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IFdoZXRoZXIgbG9ja2VkIG9yIG5vdFxyXG4gKi9cclxuZnVuY3Rpb24gaXNMb2NrZWQodGFyZ2V0LCBuYW1lKXtcclxuXHR2YXIgbG9ja3MgPSBsb2NrQ2FjaGUuZ2V0KHRhcmdldCk7XHJcblx0cmV0dXJuIChsb2NrcyAmJiBsb2Nrc1tuYW1lXSk7XHJcbn0iLCJcbi8qKlxuICogQW4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSBhbHRlcm5hdGl2ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBhcmdzIHNvbWV0aGluZyB3aXRoIGEgbGVuZ3RoXG4gKiBAcGFyYW0ge051bWJlcn0gc2xpY2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBzbGljZUVuZFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhcmdzLCBzbGljZSwgc2xpY2VFbmQpIHtcbiAgdmFyIHJldCA9IFtdO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG5cbiAgaWYgKDAgPT09IGxlbikgcmV0dXJuIHJldDtcblxuICB2YXIgc3RhcnQgPSBzbGljZSA8IDBcbiAgICA/IE1hdGgubWF4KDAsIHNsaWNlICsgbGVuKVxuICAgIDogc2xpY2UgfHwgMDtcblxuICBpZiAoc2xpY2VFbmQgIT09IHVuZGVmaW5lZCkge1xuICAgIGxlbiA9IHNsaWNlRW5kIDwgMFxuICAgICAgPyBzbGljZUVuZCArIGxlblxuICAgICAgOiBzbGljZUVuZFxuICB9XG5cbiAgd2hpbGUgKGxlbi0tID4gc3RhcnQpIHtcbiAgICByZXRbbGVuIC0gc3RhcnRdID0gYXJnc1tsZW5dO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuIiwiLyoqXHJcbiAqIEBtb2R1bGUgZW1teS9vZmZcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gb2ZmO1xyXG5cclxudmFyIGljaWNsZSA9IHJlcXVpcmUoJ2ljaWNsZScpO1xyXG52YXIgc2xpY2UgPSByZXF1aXJlKCdzbGljZWQnKTtcclxudmFyIGxpc3RlbmVycyA9IHJlcXVpcmUoJy4vbGlzdGVuZXJzJyk7XHJcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnbXV0eXBlL2lzLWFycmF5Jyk7XHJcblxyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBsaXN0ZW5lcltzXSBmcm9tIHRoZSB0YXJnZXRcclxuICpcclxuICogQHBhcmFtIHtbdHlwZV19IGV2dCBbZGVzY3JpcHRpb25dXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFtkZXNjcmlwdGlvbl1cclxuICpcclxuICogQHJldHVybiB7W3R5cGVdfSBbZGVzY3JpcHRpb25dXHJcbiAqL1xyXG5mdW5jdGlvbiBvZmYodGFyZ2V0LCBldnQsIGZuKSB7XHJcblx0aWYgKCF0YXJnZXQpIHJldHVybiB0YXJnZXQ7XHJcblxyXG5cdHZhciBjYWxsYmFja3MsIGk7XHJcblxyXG5cdC8vdW5iaW5kIGFsbCBsaXN0ZW5lcnMgaWYgbm8gZm4gc3BlY2lmaWVkXHJcblx0aWYgKGZuID09PSB1bmRlZmluZWQpIHtcclxuXHRcdHZhciBhcmdzID0gc2xpY2UoYXJndW1lbnRzLCAxKTtcclxuXHJcblx0XHQvL3RyeSB0byB1c2UgdGFyZ2V0IHJlbW92ZUFsbCBtZXRob2QsIGlmIGFueVxyXG5cdFx0dmFyIGFsbE9mZiA9IHRhcmdldFsncmVtb3ZlQWxsJ10gfHwgdGFyZ2V0WydyZW1vdmVBbGxMaXN0ZW5lcnMnXTtcclxuXHJcblx0XHQvL2NhbGwgdGFyZ2V0IHJlbW92ZUFsbFxyXG5cdFx0aWYgKGFsbE9mZikge1xyXG5cdFx0XHRhbGxPZmYuYXBwbHkodGFyZ2V0LCBhcmdzKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly90aGVuIGZvcmdldCBvd24gY2FsbGJhY2tzLCBpZiBhbnlcclxuXHJcblx0XHQvL3VuYmluZCBhbGwgZXZ0c1xyXG5cdFx0aWYgKCFldnQpIHtcclxuXHRcdFx0Y2FsbGJhY2tzID0gbGlzdGVuZXJzKHRhcmdldCk7XHJcblx0XHRcdGZvciAoZXZ0IGluIGNhbGxiYWNrcykge1xyXG5cdFx0XHRcdG9mZih0YXJnZXQsIGV2dCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdC8vdW5iaW5kIGFsbCBjYWxsYmFja3MgZm9yIGFuIGV2dFxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGV2dCA9ICcnICsgZXZ0O1xyXG5cclxuXHRcdFx0Ly9pbnZva2UgbWV0aG9kIGZvciBlYWNoIHNwYWNlLXNlcGFyYXRlZCBldmVudCBmcm9tIGEgbGlzdFxyXG5cdFx0XHRldnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uIChldnQpIHtcclxuXHRcdFx0XHR2YXIgZXZ0UGFydHMgPSBldnQuc3BsaXQoJy4nKTtcclxuXHRcdFx0XHRldnQgPSBldnRQYXJ0cy5zaGlmdCgpO1xyXG5cdFx0XHRcdGNhbGxiYWNrcyA9IGxpc3RlbmVycyh0YXJnZXQsIGV2dCwgZXZ0UGFydHMpO1xyXG5cclxuXHRcdFx0XHQvL3JldHVybmVkIGFycmF5IG9mIGNhbGxiYWNrcyAoYXMgZXZlbnQgaXMgZGVmaW5lZClcclxuXHRcdFx0XHRpZiAoZXZ0KSB7XHJcblx0XHRcdFx0XHR2YXIgb2JqID0ge307XHJcblx0XHRcdFx0XHRvYmpbZXZ0XSA9IGNhbGxiYWNrcztcclxuXHRcdFx0XHRcdGNhbGxiYWNrcyA9IG9iajtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vZm9yIGVhY2ggZ3JvdXAgb2YgY2FsbGJhY2tzIC0gdW5iaW5kIGFsbFxyXG5cdFx0XHRcdGZvciAodmFyIGV2dE5hbWUgaW4gY2FsbGJhY2tzKSB7XHJcblx0XHRcdFx0XHRzbGljZShjYWxsYmFja3NbZXZ0TmFtZV0pLmZvckVhY2goZnVuY3Rpb24gKGNiKSB7XHJcblx0XHRcdFx0XHRcdG9mZih0YXJnZXQsIGV2dE5hbWUsIGNiKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRhcmdldDtcclxuXHR9XHJcblxyXG5cclxuXHQvL3RhcmdldCBldmVudHMgKHN0cmluZyBub3RhdGlvbiB0byBhZHZhbmNlZF9vcHRpbWl6YXRpb25zKVxyXG5cdHZhciBvZmZNZXRob2QgPSB0YXJnZXRbJ3JlbW92ZUV2ZW50TGlzdGVuZXInXSB8fCB0YXJnZXRbJ3JlbW92ZUxpc3RlbmVyJ10gfHwgdGFyZ2V0WydkZXRhY2hFdmVudCddIHx8IHRhcmdldFsnb2ZmJ107XHJcblxyXG5cdC8vaW52b2tlIG1ldGhvZCBmb3IgZWFjaCBzcGFjZS1zZXBhcmF0ZWQgZXZlbnQgZnJvbSBhIGxpc3RcclxuXHRldnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uIChldnQpIHtcclxuXHRcdHZhciBldnRQYXJ0cyA9IGV2dC5zcGxpdCgnLicpO1xyXG5cdFx0ZXZ0ID0gZXZ0UGFydHMuc2hpZnQoKTtcclxuXHJcblx0XHQvL3VzZSB0YXJnZXQgYG9mZmAsIGlmIHBvc3NpYmxlXHJcblx0XHRpZiAob2ZmTWV0aG9kKSB7XHJcblx0XHRcdC8vYXZvaWQgc2VsZi1yZWN1cnNpb24gZnJvbSB0aGUgb3V0c2lkZVxyXG5cdFx0XHRpZiAoaWNpY2xlLmZyZWV6ZSh0YXJnZXQsICdvZmYnICsgZXZ0KSkge1xyXG5cdFx0XHRcdG9mZk1ldGhvZC5jYWxsKHRhcmdldCwgZXZ0LCBmbik7XHJcblx0XHRcdFx0aWNpY2xlLnVuZnJlZXplKHRhcmdldCwgJ29mZicgKyBldnQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvL2lmIGl04oCZcyBmcm96ZW4gLSBpZ25vcmUgY2FsbFxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRyZXR1cm4gdGFyZ2V0O1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGZuLmNsb3NlZENhbGwpIGZuLmNsb3NlZENhbGwgPSBmYWxzZTtcclxuXHJcblx0XHQvL2ZvcmdldCBjYWxsYmFja1xyXG5cdFx0bGlzdGVuZXJzLnJlbW92ZSh0YXJnZXQsIGV2dCwgZm4sIGV2dFBhcnRzKTtcclxuXHR9KTtcclxuXHJcblxyXG5cdHJldHVybiB0YXJnZXQ7XHJcbn0iLCIvKipcbiAqIEBtb2R1bGUgZW1teS9vblxuICovXG5cblxudmFyIGljaWNsZSA9IHJlcXVpcmUoJ2ljaWNsZScpO1xudmFyIGxpc3RlbmVycyA9IHJlcXVpcmUoJy4vbGlzdGVuZXJzJyk7XG52YXIgaXNPYmplY3QgPSByZXF1aXJlKCdtdXR5cGUvaXMtb2JqZWN0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gb247XG5cblxuLyoqXG4gKiBCaW5kIGZuIHRvIGEgdGFyZ2V0LlxuICpcbiAqIEBwYXJhbSB7Kn0gdGFyZ3RlIEEgc2luZ2xlIHRhcmdldCB0byBiaW5kIGV2dFxuICogQHBhcmFtIHtzdHJpbmd9IGV2dCBBbiBldmVudCBuYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBBIGNhbGxiYWNrXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufT8gY29uZGl0aW9uIEFuIG9wdGlvbmFsIGZpbHRlcmluZyBmbiBmb3IgYSBjYWxsYmFja1xuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGljaCBhY2NlcHRzIGFuIGV2ZW50IGFuZCByZXR1cm5zIGNhbGxiYWNrXG4gKlxuICogQHJldHVybiB7b2JqZWN0fSBBIHRhcmdldFxuICovXG5mdW5jdGlvbiBvbih0YXJnZXQsIGV2dCwgZm4pe1xuXHRpZiAoIXRhcmdldCkgcmV0dXJuIHRhcmdldDtcblxuXHQvL2NvbnNpZGVyIG9iamVjdCBvZiBldmVudHNcblx0aWYgKGlzT2JqZWN0KGV2dCkpIHtcblx0XHRmb3IodmFyIGV2dE5hbWUgaW4gZXZ0KSB7XG5cdFx0XHRvbih0YXJnZXQsIGV2dE5hbWUsIGV2dFtldnROYW1lXSk7XG5cdFx0fVxuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH1cblxuXHQvL2dldCB0YXJnZXQgYG9uYCBtZXRob2QsIGlmIGFueVxuXHQvL3ByZWZlciBuYXRpdmUtbGlrZSBtZXRob2QgbmFtZVxuXHQvL3VzZXIgbWF5IG9jY2FzaW9uYWxseSBleHBvc2UgYG9uYCB0byB0aGUgZ2xvYmFsLCBpbiBjYXNlIG9mIGJyb3dzZXJpZnlcblx0Ly9idXQgaXQgaXMgdW5saWtlbHkgb25lIHdvdWxkIHJlcGxhY2UgbmF0aXZlIGBhZGRFdmVudExpc3RlbmVyYFxuXHR2YXIgb25NZXRob2QgPSAgdGFyZ2V0WydhZGRFdmVudExpc3RlbmVyJ10gfHwgdGFyZ2V0WydhZGRMaXN0ZW5lciddIHx8IHRhcmdldFsnYXR0YWNoRXZlbnQnXSB8fCB0YXJnZXRbJ29uJ107XG5cblx0dmFyIGNiID0gZm47XG5cblx0ZXZ0ID0gJycgKyBldnQ7XG5cblx0Ly9pbnZva2UgbWV0aG9kIGZvciBlYWNoIHNwYWNlLXNlcGFyYXRlZCBldmVudCBmcm9tIGEgbGlzdFxuXHRldnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uKGV2dCl7XG5cdFx0dmFyIGV2dFBhcnRzID0gZXZ0LnNwbGl0KCcuJyk7XG5cdFx0ZXZ0ID0gZXZ0UGFydHMuc2hpZnQoKTtcblxuXHRcdC8vdXNlIHRhcmdldCBldmVudCBzeXN0ZW0sIGlmIHBvc3NpYmxlXG5cdFx0aWYgKG9uTWV0aG9kKSB7XG5cdFx0XHQvL2F2b2lkIHNlbGYtcmVjdXJzaW9uc1xuXHRcdFx0Ly9pZiBpdOKAmXMgZnJvemVuIC0gaWdub3JlIGNhbGxcblx0XHRcdGlmIChpY2ljbGUuZnJlZXplKHRhcmdldCwgJ29uJyArIGV2dCkpe1xuXHRcdFx0XHRvbk1ldGhvZC5jYWxsKHRhcmdldCwgZXZ0LCBjYik7XG5cdFx0XHRcdGljaWNsZS51bmZyZWV6ZSh0YXJnZXQsICdvbicgKyBldnQpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0YXJnZXQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly9zYXZlIHRoZSBjYWxsYmFjayBhbnl3YXlcblx0XHRsaXN0ZW5lcnMuYWRkKHRhcmdldCwgZXZ0LCBjYiwgZXZ0UGFydHMpO1xuXHR9KTtcblxuXHRyZXR1cm4gdGFyZ2V0O1xufVxuXG5cbi8qKlxuICogV3JhcCBhbiBmbiB3aXRoIGNvbmRpdGlvbiBwYXNzaW5nXG4gKi9cbm9uLndyYXAgPSBmdW5jdGlvbih0YXJnZXQsIGV2dCwgZm4sIGNvbmRpdGlvbil7XG5cdHZhciBjYiA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChjb25kaXRpb24uYXBwbHkodGFyZ2V0LCBhcmd1bWVudHMpKSB7XG5cdFx0XHRyZXR1cm4gZm4uYXBwbHkodGFyZ2V0LCBhcmd1bWVudHMpO1xuXHRcdH1cblx0fTtcblxuXHRjYi5mbiA9IGZuO1xuXG5cdHJldHVybiBjYjtcbn07IiwiLyoqXHJcbiAqIEdldCBjbGllbnRZL2NsaWVudFkgZnJvbSBhbiBldmVudC5cclxuICogSWYgaW5kZXggaXMgcGFzc2VkLCB0cmVhdCBpdCBhcyBpbmRleCBvZiBnbG9iYWwgdG91Y2hlcywgbm90IHRoZSB0YXJnZXRUb3VjaGVzLlxyXG4gKiBHbG9iYWwgdG91Y2hlcyBpbmNsdWRlIHRhcmdldCB0b3VjaGVzLlxyXG4gKlxyXG4gKiBAbW9kdWxlIGdldC1jbGllbnQteHlcclxuICpcclxuICogQHBhcmFtIHtFdmVudH0gZSBFdmVudCByYWlzZWQsIGxpa2UgbW91c2Vtb3ZlXHJcbiAqXHJcbiAqIEByZXR1cm4ge251bWJlcn0gQ29vcmRpbmF0ZSByZWxhdGl2ZSB0byB0aGUgc2NyZWVuXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRDbGllbnRZIChlLCBpZHgpIHtcclxuXHQvLyB0b3VjaCBldmVudFxyXG5cdGlmIChlLnRvdWNoZXMpIHtcclxuXHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xyXG5cdFx0XHRyZXR1cm4gZmluZFRvdWNoKGUudG91Y2hlcywgaWR4KS5jbGllbnRZXHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGUudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRZO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gbW91c2UgZXZlbnRcclxuXHRyZXR1cm4gZS5jbGllbnRZO1xyXG59XHJcbmZ1bmN0aW9uIGdldENsaWVudFggKGUsIGlkeCkge1xyXG5cdC8vIHRvdWNoIGV2ZW50XHJcblx0aWYgKGUudG91Y2hlcykge1xyXG5cdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPiBpZHgpIHtcclxuXHRcdFx0cmV0dXJuIGZpbmRUb3VjaChlLnRvdWNoZXMsIGlkeCkuY2xpZW50WDtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFg7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBtb3VzZSBldmVudFxyXG5cdHJldHVybiBlLmNsaWVudFg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENsaWVudFhZIChlLCBpZHgpIHtcclxuXHRyZXR1cm4gW2dldENsaWVudFguYXBwbHkodGhpcywgYXJndW1lbnRzKSwgZ2V0Q2xpZW50WS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZFRvdWNoICh0b3VjaExpc3QsIGlkeCkge1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgdG91Y2hMaXN0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRpZiAodG91Y2hMaXN0W2ldLmlkZW50aWZpZXIgPT09IGlkeCkge1xyXG5cdFx0XHRyZXR1cm4gdG91Y2hMaXN0W2ldO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuXHJcbmdldENsaWVudFhZLnggPSBnZXRDbGllbnRYO1xyXG5nZXRDbGllbnRYWS55ID0gZ2V0Q2xpZW50WTtcclxuZ2V0Q2xpZW50WFkuZmluZFRvdWNoID0gZmluZFRvdWNoO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBnZXRDbGllbnRYWTsiLCIvKiogZ2VuZXJhdGUgdW5pcXVlIGlkIGZvciBzZWxlY3RvciAqL1xyXG52YXIgY291bnRlciA9IERhdGUubm93KCkgJSAxZTk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGdldFVpZCgpe1xyXG5cdHJldHVybiAoTWF0aC5yYW5kb20oKSAqIDFlOSA+Pj4gMCkgKyAoY291bnRlcisrKTtcclxufTsiLCIvKiogQG1vZHVsZSAgaW50ZXJzZWN0cyAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGludGVyc2VjdHM7XHJcblxyXG5cclxudmFyIG1pbiA9IE1hdGgubWluLCBtYXggPSBNYXRoLm1heDtcclxuXHJcblxyXG4vKipcclxuICogTWFpbiBpbnRlcnNlY3Rpb24gZGV0ZWN0b3IuXHJcbiAqXHJcbiAqIEBwYXJhbSB7UmVjdGFuZ2xlfSBhIFRhcmdldFxyXG4gKiBAcGFyYW0ge1JlY3RhbmdsZX0gYiBDb250YWluZXJcclxuICpcclxuICogQHJldHVybiB7Ym9vbH0gV2hldGhlciB0YXJnZXQgaXMgd2l0aGluIHRoZSBjb250YWluZXJcclxuICovXHJcbmZ1bmN0aW9uIGludGVyc2VjdHMgKGEsIGIsIHRvbGVyYW5jZSl7XHJcblx0Ly9pZ25vcmUgZGVmaW5pdGUgZGlzaW50ZXJzZWN0aW9uXHJcblx0aWYgKGEucmlnaHQgPCBiLmxlZnQgfHwgYS5sZWZ0ID4gYi5yaWdodCkgcmV0dXJuIGZhbHNlO1xyXG5cdGlmIChhLmJvdHRvbSA8IGIudG9wIHx8IGEudG9wID4gYi5ib3R0b20pIHJldHVybiBmYWxzZTtcclxuXHJcblx0Ly9pbnRlcnNlY3Rpb24gdmFsdWVzXHJcblx0dmFyIGlYID0gbWluKGEucmlnaHQgLSBtYXgoYi5sZWZ0LCBhLmxlZnQpLCBiLnJpZ2h0IC0gbWF4KGEubGVmdCwgYi5sZWZ0KSk7XHJcblx0dmFyIGlZID0gbWluKGEuYm90dG9tIC0gbWF4KGIudG9wLCBhLnRvcCksIGIuYm90dG9tIC0gbWF4KGEudG9wLCBiLnRvcCkpO1xyXG5cdHZhciBpU3F1YXJlID0gaVggKiBpWTtcclxuXHJcblx0dmFyIGJTcXVhcmUgPSAoYi5ib3R0b20gLSBiLnRvcCkgKiAoYi5yaWdodCAtIGIubGVmdCk7XHJcblx0dmFyIGFTcXVhcmUgPSAoYS5ib3R0b20gLSBhLnRvcCkgKiAoYS5yaWdodCAtIGEubGVmdCk7XHJcblxyXG5cdC8vbWVhc3VyZSBzcXVhcmUgb3ZlcmxhcCByZWxhdGl2ZSB0byB0aGUgbWluIHNxdWFyZVxyXG5cdHZhciB0YXJnZXRTcXVhcmUgPSBtaW4oYVNxdWFyZSwgYlNxdWFyZSk7XHJcblxyXG5cclxuXHQvL21pbmltYWwgb3ZlcmxhcCByYXRpb1xyXG5cdHRvbGVyYW5jZSA9IHRvbGVyYW5jZSAhPT0gdW5kZWZpbmVkID8gdG9sZXJhbmNlIDogMC41O1xyXG5cclxuXHRpZiAoaVNxdWFyZSAvIHRhcmdldFNxdWFyZSA+IHRvbGVyYW5jZSkge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZmFsc2U7XHJcbn0iLCJcbi8qKlxuICogaXNBcnJheVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiB0b1N0cmluZ1xuICovXG5cbnZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBgdmFsYFxuICogaXMgYW4gYXJyYXkuXG4gKlxuICogZXhhbXBsZTpcbiAqXG4gKiAgICAgICAgaXNBcnJheShbXSk7XG4gKiAgICAgICAgLy8gPiB0cnVlXG4gKiAgICAgICAgaXNBcnJheShhcmd1bWVudHMpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqICAgICAgICBpc0FycmF5KCcnKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKlxuICogQHBhcmFtIHttaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtib29sfVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheSB8fCBmdW5jdGlvbiAodmFsKSB7XG4gIHJldHVybiAhISB2YWwgJiYgJ1tvYmplY3QgQXJyYXldJyA9PSBzdHIuY2FsbCh2YWwpO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvblxuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24gKGZuKSB7XG4gIHZhciBzdHJpbmcgPSB0b1N0cmluZy5jYWxsKGZuKVxuICByZXR1cm4gc3RyaW5nID09PSAnW29iamVjdCBGdW5jdGlvbl0nIHx8XG4gICAgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyAmJiBzdHJpbmcgIT09ICdbb2JqZWN0IFJlZ0V4cF0nKSB8fFxuICAgICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAvLyBJRTggYW5kIGJlbG93XG4gICAgIChmbiA9PT0gd2luZG93LnNldFRpbWVvdXQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuYWxlcnQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuY29uZmlybSB8fFxuICAgICAgZm4gPT09IHdpbmRvdy5wcm9tcHQpKVxufTtcbiIsIi8qKlxyXG4gKiBTaW1wbGUgcmVjdCBjb25zdHJ1Y3Rvci5cclxuICogSXQgaXMganVzdCBmYXN0ZXIgYW5kIHNtYWxsZXIgdGhhbiBjb25zdHJ1Y3RpbmcgYW4gb2JqZWN0LlxyXG4gKlxyXG4gKiBAbW9kdWxlIG11Y3NzL1JlY3RcclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IGwgbGVmdFxyXG4gKiBAcGFyYW0ge251bWJlcn0gdCB0b3BcclxuICogQHBhcmFtIHtudW1iZXJ9IHIgcmlnaHRcclxuICogQHBhcmFtIHtudW1iZXJ9IGIgYm90dG9tXHJcbiAqIEBwYXJhbSB7bnVtYmVyfT8gdyB3aWR0aFxyXG4gKiBAcGFyYW0ge251bWJlcn0/IGggaGVpZ2h0XHJcbiAqXHJcbiAqIEByZXR1cm4ge1JlY3R9IEEgcmVjdGFuZ2xlIG9iamVjdFxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBSZWN0IChsLHQscixiLHcsaCkge1xyXG5cdHRoaXMudG9wPXR8fDA7XHJcblx0dGhpcy5ib3R0b209Ynx8MDtcclxuXHR0aGlzLmxlZnQ9bHx8MDtcclxuXHR0aGlzLnJpZ2h0PXJ8fDA7XHJcblx0aWYgKHchPT11bmRlZmluZWQpIHRoaXMud2lkdGg9d3x8dGhpcy5yaWdodC10aGlzLmxlZnQ7XHJcblx0aWYgKGghPT11bmRlZmluZWQpIHRoaXMuaGVpZ2h0PWh8fHRoaXMuYm90dG9tLXRoaXMudG9wO1xyXG59OyIsIi8qKlxyXG4gKiBHZXQgb3Igc2V0IGVsZW1lbnTigJlzIHN0eWxlLCBwcmVmaXgtYWdub3N0aWMuXHJcbiAqXHJcbiAqIEBtb2R1bGUgIG11Y3NzL2Nzc1xyXG4gKi9cclxudmFyIGZha2VTdHlsZSA9IHJlcXVpcmUoJy4vZmFrZS1lbGVtZW50Jykuc3R5bGU7XHJcbnZhciBwcmVmaXggPSByZXF1aXJlKCcuL3ByZWZpeCcpLmxvd2VyY2FzZTtcclxuXHJcblxyXG4vKipcclxuICogQXBwbHkgc3R5bGVzIHRvIGFuIGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSAgICB7RWxlbWVudH0gICBlbCAgIEFuIGVsZW1lbnQgdG8gYXBwbHkgc3R5bGVzLlxyXG4gKiBAcGFyYW0gICAge09iamVjdHxzdHJpbmd9ICAgb2JqICAgU2V0IG9mIHN0eWxlIHJ1bGVzIG9yIHN0cmluZyB0byBnZXQgc3R5bGUgcnVsZS5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWwsIG9iail7XHJcblx0aWYgKCFlbCB8fCAhb2JqKSByZXR1cm47XHJcblxyXG5cdHZhciBuYW1lLCB2YWx1ZTtcclxuXHJcblx0Ly9yZXR1cm4gdmFsdWUsIGlmIHN0cmluZyBwYXNzZWRcclxuXHRpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycpIHtcclxuXHRcdG5hbWUgPSBvYmo7XHJcblxyXG5cdFx0Ly9yZXR1cm4gdmFsdWUsIGlmIG5vIHZhbHVlIHBhc3NlZFxyXG5cdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XHJcblx0XHRcdHJldHVybiBlbC5zdHlsZVtwcmVmaXhpemUobmFtZSldO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vc2V0IHN0eWxlLCBpZiB2YWx1ZSBwYXNzZWRcclxuXHRcdHZhbHVlID0gYXJndW1lbnRzWzJdIHx8ICcnO1xyXG5cdFx0b2JqID0ge307XHJcblx0XHRvYmpbbmFtZV0gPSB2YWx1ZTtcclxuXHR9XHJcblxyXG5cdGZvciAobmFtZSBpbiBvYmope1xyXG5cdFx0Ly9jb252ZXJ0IG51bWJlcnMgdG8gcHhcclxuXHRcdGlmICh0eXBlb2Ygb2JqW25hbWVdID09PSAnbnVtYmVyJyAmJiAvbGVmdHxyaWdodHxib3R0b218dG9wfHdpZHRofGhlaWdodC9pLnRlc3QobmFtZSkpIG9ialtuYW1lXSArPSAncHgnO1xyXG5cclxuXHRcdHZhbHVlID0gb2JqW25hbWVdIHx8ICcnO1xyXG5cclxuXHRcdGVsLnN0eWxlW3ByZWZpeGl6ZShuYW1lKV0gPSB2YWx1ZTtcclxuXHR9XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFJldHVybiBwcmVmaXhpemVkIHByb3AgbmFtZSwgaWYgbmVlZGVkLlxyXG4gKlxyXG4gKiBAcGFyYW0gICAge3N0cmluZ30gICBuYW1lICAgQSBwcm9wZXJ0eSBuYW1lLlxyXG4gKiBAcmV0dXJuICAge3N0cmluZ30gICBQcmVmaXhlZCBwcm9wZXJ0eSBuYW1lLlxyXG4gKi9cclxuZnVuY3Rpb24gcHJlZml4aXplKG5hbWUpe1xyXG5cdHZhciB1TmFtZSA9IG5hbWVbMF0udG9VcHBlckNhc2UoKSArIG5hbWUuc2xpY2UoMSk7XHJcblx0aWYgKGZha2VTdHlsZVtuYW1lXSAhPT0gdW5kZWZpbmVkKSByZXR1cm4gbmFtZTtcclxuXHRpZiAoZmFrZVN0eWxlW3ByZWZpeCArIHVOYW1lXSAhPT0gdW5kZWZpbmVkKSByZXR1cm4gcHJlZml4ICsgdU5hbWU7XHJcblx0cmV0dXJuICcnO1xyXG59XHJcbiIsIi8qKiBKdXN0IGEgZmFrZSBlbGVtZW50IHRvIHRlc3Qgc3R5bGVzXHJcbiAqIEBtb2R1bGUgbXVjc3MvZmFrZS1lbGVtZW50XHJcbiAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTsiLCIvKipcclxuICogV2luZG93IHNjcm9sbGJhciBkZXRlY3Rvci5cclxuICpcclxuICogQG1vZHVsZSBtdWNzcy9oYXMtc2Nyb2xsXHJcbiAqL1xyXG5leHBvcnRzLnggPSBmdW5jdGlvbiAoKSB7XHJcblx0cmV0dXJuIHdpbmRvdy5pbm5lckhlaWdodCA+IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQ7XHJcbn07XHJcbmV4cG9ydHMueSA9IGZ1bmN0aW9uICgpIHtcclxuXHRyZXR1cm4gd2luZG93LmlubmVyV2lkdGggPiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGg7XHJcbn07IiwiLyoqXHJcbiAqIERldGVjdCB3aGV0aGVyIGVsZW1lbnQgaXMgcGxhY2VkIHRvIGZpeGVkIGNvbnRhaW5lciBvciBpcyBmaXhlZCBpdHNlbGYuXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3MvaXMtZml4ZWRcclxuICpcclxuICogQHBhcmFtIHsoRWxlbWVudHxPYmplY3QpfSBlbCBFbGVtZW50IHRvIGRldGVjdCBmaXhlZG5lc3MuXHJcbiAqXHJcbiAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgZWxlbWVudCBpcyBuZXN0ZWQuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChlbCkge1xyXG5cdHZhciBwYXJlbnRFbCA9IGVsO1xyXG5cclxuXHQvL3dpbmRvdyBpcyBmaXhlZCwgYnR3XHJcblx0aWYgKGVsID09PSB3aW5kb3cpIHJldHVybiB0cnVlO1xyXG5cclxuXHQvL3VubGlrZSB0aGUgZG9jXHJcblx0aWYgKGVsID09PSBkb2N1bWVudCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHR3aGlsZSAocGFyZW50RWwpIHtcclxuXHRcdGlmIChnZXRDb21wdXRlZFN0eWxlKHBhcmVudEVsKS5wb3NpdGlvbiA9PT0gJ2ZpeGVkJykgcmV0dXJuIHRydWU7XHJcblx0XHRwYXJlbnRFbCA9IHBhcmVudEVsLm9mZnNldFBhcmVudDtcclxuXHR9XHJcblx0cmV0dXJuIGZhbHNlO1xyXG59OyIsIi8qKlxyXG4gKiBDYWxjdWxhdGUgYWJzb2x1dGUgb2Zmc2V0cyBvZiBhbiBlbGVtZW50LCByZWxhdGl2ZSB0byB0aGUgZG9jdW1lbnQuXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3Mvb2Zmc2V0c1xyXG4gKlxyXG4gKi9cclxudmFyIHdpbiA9IHdpbmRvdztcclxudmFyIGRvYyA9IGRvY3VtZW50O1xyXG52YXIgUmVjdCA9IHJlcXVpcmUoJy4vUmVjdCcpO1xyXG52YXIgaGFzU2Nyb2xsID0gcmVxdWlyZSgnLi9oYXMtc2Nyb2xsJyk7XHJcbnZhciBzY3JvbGxiYXIgPSByZXF1aXJlKCcuL3Njcm9sbGJhcicpO1xyXG52YXIgaXNGaXhlZEVsID0gcmVxdWlyZSgnLi9pcy1maXhlZCcpO1xyXG52YXIgZ2V0VHJhbnNsYXRlID0gcmVxdWlyZSgnLi90cmFuc2xhdGUnKTtcclxuXHJcblxyXG4vKipcclxuICogUmV0dXJuIGFic29sdXRlIG9mZnNldHMgb2YgYW55IHRhcmdldCBwYXNzZWRcclxuICpcclxuICogQHBhcmFtICAgIHtFbGVtZW50fHdpbmRvd30gICBlbCAgIEEgdGFyZ2V0LiBQYXNzIHdpbmRvdyB0byBjYWxjdWxhdGUgdmlld3BvcnQgb2Zmc2V0c1xyXG4gKiBAcmV0dXJuICAge09iamVjdH0gICBPZmZzZXRzIG9iamVjdCB3aXRoIHRyYmwuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IG9mZnNldHM7XHJcblxyXG5mdW5jdGlvbiBvZmZzZXRzIChlbCkge1xyXG5cdGlmICghZWwpIHRocm93IEVycm9yKCdCYWQgYXJndW1lbnQnKTtcclxuXHJcblx0Ly9jYWxjIGNsaWVudCByZWN0XHJcblx0dmFyIGNSZWN0LCByZXN1bHQ7XHJcblxyXG5cdC8vcmV0dXJuIHZwIG9mZnNldHNcclxuXHRpZiAoZWwgPT09IHdpbikge1xyXG5cdFx0cmVzdWx0ID0gbmV3IFJlY3QoXHJcblx0XHRcdHdpbi5wYWdlWE9mZnNldCxcclxuXHRcdFx0d2luLnBhZ2VZT2Zmc2V0XHJcblx0XHQpO1xyXG5cclxuXHRcdHJlc3VsdC53aWR0aCA9IHdpbi5pbm5lcldpZHRoIC0gKGhhc1Njcm9sbC55KCkgPyBzY3JvbGxiYXIgOiAwKSxcclxuXHRcdHJlc3VsdC5oZWlnaHQgPSB3aW4uaW5uZXJIZWlnaHQgLSAoaGFzU2Nyb2xsLngoKSA/IHNjcm9sbGJhciA6IDApXHJcblx0XHRyZXN1bHQucmlnaHQgPSByZXN1bHQubGVmdCArIHJlc3VsdC53aWR0aDtcclxuXHRcdHJlc3VsdC5ib3R0b20gPSByZXN1bHQudG9wICsgcmVzdWx0LmhlaWdodDtcclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdH1cclxuXHJcblx0Ly9yZXR1cm4gYWJzb2x1dGUgb2Zmc2V0cyBpZiBkb2N1bWVudCByZXF1ZXN0ZWRcclxuXHRlbHNlIGlmIChlbCA9PT0gZG9jKSB7XHJcblx0XHR2YXIgcmVzID0gb2Zmc2V0cyhkb2MuZG9jdW1lbnRFbGVtZW50KTtcclxuXHRcdHJlcy5ib3R0b20gPSBNYXRoLm1heCh3aW5kb3cuaW5uZXJIZWlnaHQsIHJlcy5ib3R0b20pO1xyXG5cdFx0cmVzLnJpZ2h0ID0gTWF0aC5tYXgod2luZG93LmlubmVyV2lkdGgsIHJlcy5yaWdodCk7XHJcblx0XHRpZiAoaGFzU2Nyb2xsLnkoZG9jLmRvY3VtZW50RWxlbWVudCkpIHJlcy5yaWdodCAtPSBzY3JvbGxiYXI7XHJcblx0XHRpZiAoaGFzU2Nyb2xsLngoZG9jLmRvY3VtZW50RWxlbWVudCkpIHJlcy5ib3R0b20gLT0gc2Nyb2xsYmFyO1xyXG5cdFx0cmV0dXJuIHJlcztcclxuXHR9XHJcblxyXG5cdC8vRklYTUU6IHdoeSBub3QgZXZlcnkgZWxlbWVudCBoYXMgZ2V0Qm91bmRpbmdDbGllbnRSZWN0IG1ldGhvZD9cclxuXHR0cnkge1xyXG5cdFx0Y1JlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHRjUmVjdCA9IG5ldyBSZWN0KFxyXG5cdFx0XHRlbC5jbGllbnRMZWZ0LFxyXG5cdFx0XHRlbC5jbGllbnRUb3BcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHQvL3doZXRoZXIgZWxlbWVudCBpcyBvciBpcyBpbiBmaXhlZFxyXG5cdHZhciBpc0ZpeGVkID0gaXNGaXhlZEVsKGVsKTtcclxuXHR2YXIgeE9mZnNldCA9IGlzRml4ZWQgPyAwIDogd2luLnBhZ2VYT2Zmc2V0O1xyXG5cdHZhciB5T2Zmc2V0ID0gaXNGaXhlZCA/IDAgOiB3aW4ucGFnZVlPZmZzZXQ7XHJcblxyXG5cdHJlc3VsdCA9IG5ldyBSZWN0KFxyXG5cdFx0Y1JlY3QubGVmdCArIHhPZmZzZXQsXHJcblx0XHRjUmVjdC50b3AgKyB5T2Zmc2V0LFxyXG5cdFx0Y1JlY3QubGVmdCArIHhPZmZzZXQgKyBlbC5vZmZzZXRXaWR0aCxcclxuXHRcdGNSZWN0LnRvcCArIHlPZmZzZXQgKyBlbC5vZmZzZXRIZWlnaHQsXHJcblx0XHRlbC5vZmZzZXRXaWR0aCxcclxuXHRcdGVsLm9mZnNldEhlaWdodFxyXG5cdCk7XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn07IiwiLyoqXHJcbiAqIFJldHVybnMgcGFyc2VkIGNzcyB2YWx1ZS5cclxuICpcclxuICogQG1vZHVsZSBtdWNzcy9wYXJzZS12YWx1ZVxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIEEgc3RyaW5nIGNvbnRhaW5pbmcgY3NzIHVuaXRzIHZhbHVlXHJcbiAqXHJcbiAqIEByZXR1cm4ge251bWJlcn0gUGFyc2VkIG51bWJlciB2YWx1ZVxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyKXtcclxuXHRzdHIgKz0gJyc7XHJcblx0cmV0dXJuIHBhcnNlRmxvYXQoc3RyLnNsaWNlKDAsLTIpKSB8fCAwO1xyXG59O1xyXG5cclxuLy9GSVhNRTogYWRkIHBhcnNpbmcgdW5pdHMiLCIvKipcclxuICogVmVuZG9yIHByZWZpeGVzXHJcbiAqIE1ldGhvZCBvZiBodHRwOi8vZGF2aWR3YWxzaC5uYW1lL3ZlbmRvci1wcmVmaXhcclxuICogQG1vZHVsZSBtdWNzcy9wcmVmaXhcclxuICovXHJcblxyXG52YXIgc3R5bGVzID0gZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsICcnKTtcclxuXHJcbnZhciBwcmUgPSAoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoc3R5bGVzKVxyXG5cdC5qb2luKCcnKVxyXG5cdC5tYXRjaCgvLShtb3p8d2Via2l0fG1zKS0vKSB8fCAoc3R5bGVzLk9MaW5rID09PSAnJyAmJiBbJycsICdvJ10pXHJcbilbMV07XHJcblxyXG5kb20gPSAoJ1dlYktpdHxNb3p8TVN8TycpLm1hdGNoKG5ldyBSZWdFeHAoJygnICsgcHJlICsgJyknLCAnaScpKVsxXTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdGRvbTogZG9tLFxyXG5cdGxvd2VyY2FzZTogcHJlLFxyXG5cdGNzczogJy0nICsgcHJlICsgJy0nLFxyXG5cdGpzOiBwcmVbMF0udG9VcHBlckNhc2UoKSArIHByZS5zdWJzdHIoMSlcclxufTsiLCIvKipcclxuICogQ2FsY3VsYXRlIHNjcm9sbGJhciB3aWR0aC5cclxuICpcclxuICogQG1vZHVsZSBtdWNzcy9zY3JvbGxiYXJcclxuICovXHJcblxyXG4vLyBDcmVhdGUgdGhlIG1lYXN1cmVtZW50IG5vZGVcclxudmFyIHNjcm9sbERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblxyXG52YXIgc3R5bGUgPSBzY3JvbGxEaXYuc3R5bGU7XHJcblxyXG5zdHlsZS53aWR0aCA9ICcxMDBweCc7XHJcbnN0eWxlLmhlaWdodCA9ICcxMDBweCc7XHJcbnN0eWxlLm92ZXJmbG93ID0gJ3Njcm9sbCc7XHJcbnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcclxuc3R5bGUudG9wID0gJy05OTk5cHgnO1xyXG5cclxuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFwcGVuZENoaWxkKHNjcm9sbERpdik7XHJcblxyXG4vLyB0aGUgc2Nyb2xsYmFyIHdpZHRoXHJcbm1vZHVsZS5leHBvcnRzID0gc2Nyb2xsRGl2Lm9mZnNldFdpZHRoIC0gc2Nyb2xsRGl2LmNsaWVudFdpZHRoO1xyXG5cclxuLy8gRGVsZXRlIGZha2UgRElWXHJcbmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5yZW1vdmVDaGlsZChzY3JvbGxEaXYpOyIsIi8qKlxyXG4gKiBFbmFibGUvZGlzYWJsZSBzZWxlY3RhYmlsaXR5IG9mIGFuIGVsZW1lbnRcclxuICogQG1vZHVsZSBtdWNzcy9zZWxlY3Rpb25cclxuICovXHJcbnZhciBjc3MgPSByZXF1aXJlKCcuL2NzcycpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBEaXNhYmxlIG9yIEVuYWJsZSBhbnkgc2VsZWN0aW9uIHBvc3NpYmlsaXRpZXMgZm9yIGFuIGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSAgICB7RWxlbWVudH0gICBlbCAgIFRhcmdldCB0byBtYWtlIHVuc2VsZWN0YWJsZS5cclxuICovXHJcbmV4cG9ydHMuZGlzYWJsZSA9IGZ1bmN0aW9uKGVsKXtcclxuXHRjc3MoZWwsIHtcclxuXHRcdCd1c2VyLXNlbGVjdCc6ICdub25lJyxcclxuXHRcdCd1c2VyLWRyYWcnOiAnbm9uZScsXHJcblx0XHQndG91Y2gtY2FsbG91dCc6ICdub25lJ1xyXG5cdH0pO1xyXG5cdGVsLnNldEF0dHJpYnV0ZSgndW5zZWxlY3RhYmxlJywgJ29uJyk7XHJcblx0ZWwuYWRkRXZlbnRMaXN0ZW5lcignc2VsZWN0c3RhcnQnLCBwZCk7XHJcbn07XHJcbmV4cG9ydHMuZW5hYmxlID0gZnVuY3Rpb24oZWwpe1xyXG5cdGNzcyhlbCwge1xyXG5cdFx0J3VzZXItc2VsZWN0JzogbnVsbCxcclxuXHRcdCd1c2VyLWRyYWcnOiBudWxsLFxyXG5cdFx0J3RvdWNoLWNhbGxvdXQnOiBudWxsXHJcblx0fSk7XHJcblx0ZWwucmVtb3ZlQXR0cmlidXRlKCd1bnNlbGVjdGFibGUnKTtcclxuXHRlbC5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWxlY3RzdGFydCcsIHBkKTtcclxufTtcclxuXHJcblxyXG4vKiogUHJldmVudCB5b3Uga25vdyB3aGF0LiAqL1xyXG5mdW5jdGlvbiBwZChlKXtcclxuXHRlLnByZXZlbnREZWZhdWx0KCk7XHJcbn0iLCIvKipcclxuICogUGFyc2UgdHJhbnNsYXRlM2RcclxuICpcclxuICogQG1vZHVsZSBtdWNzcy90cmFuc2xhdGVcclxuICovXHJcblxyXG52YXIgY3NzID0gcmVxdWlyZSgnLi9jc3MnKTtcclxudmFyIHBhcnNlVmFsdWUgPSByZXF1aXJlKCcuL3BhcnNlLXZhbHVlJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChlbCkge1xyXG5cdHZhciB0cmFuc2xhdGVTdHIgPSBjc3MoZWwsICd0cmFuc2Zvcm0nKTtcclxuXHJcblx0Ly9maW5kIHRyYW5zbGF0ZSB0b2tlbiwgcmV0cmlldmUgY29tbWEtZW5jbG9zZWQgdmFsdWVzXHJcblx0Ly90cmFuc2xhdGUzZCgxcHgsIDJweCwgMikg4oaSIDFweCwgMnB4LCAyXHJcblx0Ly9GSVhNRTogaGFuZGxlIG5lc3RlZCBjYWxjc1xyXG5cdHZhciBtYXRjaCA9IC90cmFuc2xhdGUoPzozZCk/XFxzKlxcKChbXlxcKV0qKVxcKS8uZXhlYyh0cmFuc2xhdGVTdHIpO1xyXG5cclxuXHRpZiAoIW1hdGNoKSByZXR1cm4gWzAsIDBdO1xyXG5cdHZhciB2YWx1ZXMgPSBtYXRjaFsxXS5zcGxpdCgvXFxzKixcXHMqLyk7XHJcblxyXG5cdC8vcGFyc2UgdmFsdWVzXHJcblx0Ly9GSVhNRTogbmVzdGVkIHZhbHVlcyBhcmUgbm90IG5lY2Vzc2FyaWx5IHBpeGVsc1xyXG5cdHJldHVybiB2YWx1ZXMubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xyXG5cdFx0cmV0dXJuIHBhcnNlVmFsdWUodmFsdWUpO1xyXG5cdH0pO1xyXG59OyIsIi8qKlxyXG4gKiBDbGFtcGVyLlxyXG4gKiBEZXRlY3RzIHByb3BlciBjbGFtcCBtaW4vbWF4LlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gYSBDdXJyZW50IHZhbHVlIHRvIGN1dCBvZmZcclxuICogQHBhcmFtIHtudW1iZXJ9IG1pbiBPbmUgc2lkZSBsaW1pdFxyXG4gKiBAcGFyYW0ge251bWJlcn0gbWF4IE90aGVyIHNpZGUgbGltaXRcclxuICpcclxuICogQHJldHVybiB7bnVtYmVyfSBDbGFtcGVkIHZhbHVlXHJcbiAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3dyYXAnKShmdW5jdGlvbihhLCBtaW4sIG1heCl7XHJcblx0cmV0dXJuIG1heCA+IG1pbiA/IE1hdGgubWF4KE1hdGgubWluKGEsbWF4KSxtaW4pIDogTWF0aC5tYXgoTWF0aC5taW4oYSxtaW4pLG1heCk7XHJcbn0pOyIsIi8qKlxyXG4gKiBAbW9kdWxlICBtdW1hdGgvbG9vcFxyXG4gKlxyXG4gKiBMb29waW5nIGZ1bmN0aW9uIGZvciBhbnkgZnJhbWVzaXplXHJcbiAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3dyYXAnKShmdW5jdGlvbiAodmFsdWUsIGxlZnQsIHJpZ2h0KSB7XHJcblx0Ly9kZXRlY3Qgc2luZ2xlLWFyZyBjYXNlLCBsaWtlIG1vZC1sb29wXHJcblx0aWYgKHJpZ2h0ID09PSB1bmRlZmluZWQpIHtcclxuXHRcdHJpZ2h0ID0gbGVmdDtcclxuXHRcdGxlZnQgPSAwO1xyXG5cdH1cclxuXHJcblx0Ly9zd2FwIGZyYW1lIG9yZGVyXHJcblx0aWYgKGxlZnQgPiByaWdodCkge1xyXG5cdFx0dmFyIHRtcCA9IHJpZ2h0O1xyXG5cdFx0cmlnaHQgPSBsZWZ0O1xyXG5cdFx0bGVmdCA9IHRtcDtcclxuXHR9XHJcblxyXG5cdHZhciBmcmFtZSA9IHJpZ2h0IC0gbGVmdDtcclxuXHJcblx0dmFsdWUgPSAoKHZhbHVlICsgbGVmdCkgJSBmcmFtZSkgLSBsZWZ0O1xyXG5cdGlmICh2YWx1ZSA8IGxlZnQpIHZhbHVlICs9IGZyYW1lO1xyXG5cdGlmICh2YWx1ZSA+IHJpZ2h0KSB2YWx1ZSAtPSBmcmFtZTtcclxuXHJcblx0cmV0dXJuIHZhbHVlO1xyXG59KTsiLCIvKipcclxuICogQG1vZHVsZSAgbXVtYXRoL3ByZWNpc2lvblxyXG4gKlxyXG4gKiBHZXQgcHJlY2lzaW9uIGZyb20gZmxvYXQ6XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIDEuMSDihpIgMSwgMTIzNCDihpIgMCwgLjEyMzQg4oaSIDRcclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IG5cclxuICpcclxuICogQHJldHVybiB7bnVtYmVyfSBkZWNpbWFwIHBsYWNlc1xyXG4gKi9cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24obil7XHJcblx0dmFyIHMgPSBuICsgJycsXHJcblx0XHRkID0gcy5pbmRleE9mKCcuJykgKyAxO1xyXG5cclxuXHRyZXR1cm4gIWQgPyAwIDogcy5sZW5ndGggLSBkO1xyXG59KTsiLCIvKipcclxuICogUHJlY2lzaW9uIHJvdW5kXHJcbiAqXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZVxyXG4gKiBAcGFyYW0ge251bWJlcn0gc3RlcCBNaW5pbWFsIGRpc2NyZXRlIHRvIHJvdW5kXHJcbiAqXHJcbiAqIEByZXR1cm4ge251bWJlcn1cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdG9QcmVjaXNpb24oMjEzLjM0LCAxKSA9PSAyMTNcclxuICogdG9QcmVjaXNpb24oMjEzLjM0LCAuMSkgPT0gMjEzLjNcclxuICogdG9QcmVjaXNpb24oMjEzLjM0LCAxMCkgPT0gMjEwXHJcbiAqL1xyXG52YXIgcHJlY2lzaW9uID0gcmVxdWlyZSgnLi9wcmVjaXNpb24nKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24odmFsdWUsIHN0ZXApIHtcclxuXHRpZiAoc3RlcCA9PT0gMCkgcmV0dXJuIHZhbHVlO1xyXG5cdGlmICghc3RlcCkgcmV0dXJuIE1hdGgucm91bmQodmFsdWUpO1xyXG5cdHN0ZXAgPSBwYXJzZUZsb2F0KHN0ZXApO1xyXG5cdHZhbHVlID0gTWF0aC5yb3VuZCh2YWx1ZSAvIHN0ZXApICogc3RlcDtcclxuXHRyZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZS50b0ZpeGVkKHByZWNpc2lvbihzdGVwKSkpO1xyXG59KTsiLCIvKipcclxuICogR2V0IGZuIHdyYXBwZWQgd2l0aCBhcnJheS9vYmplY3QgYXR0cnMgcmVjb2duaXRpb25cclxuICpcclxuICogQHJldHVybiB7RnVuY3Rpb259IFRhcmdldCBmdW5jdGlvblxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihmbil7XHJcblx0cmV0dXJuIGZ1bmN0aW9uKGEpe1xyXG5cdFx0dmFyIGFyZ3MgPSBhcmd1bWVudHM7XHJcblx0XHRpZiAoYSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdHZhciByZXN1bHQgPSBuZXcgQXJyYXkoYS5sZW5ndGgpLCBzbGljZTtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKXtcclxuXHRcdFx0XHRzbGljZSA9IFtdO1xyXG5cdFx0XHRcdGZvciAodmFyIGogPSAwLCBsID0gYXJncy5sZW5ndGgsIHZhbDsgaiA8IGw7IGorKyl7XHJcblx0XHRcdFx0XHR2YWwgPSBhcmdzW2pdIGluc3RhbmNlb2YgQXJyYXkgPyBhcmdzW2pdW2ldIDogYXJnc1tqXTtcclxuXHRcdFx0XHRcdHZhbCA9IHZhbDtcclxuXHRcdFx0XHRcdHNsaWNlLnB1c2godmFsKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmVzdWx0W2ldID0gZm4uYXBwbHkodGhpcywgc2xpY2UpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiByZXN1bHQ7XHJcblx0XHR9XHJcblx0XHRlbHNlIGlmICh0eXBlb2YgYSA9PT0gJ29iamVjdCcpIHtcclxuXHRcdFx0dmFyIHJlc3VsdCA9IHt9LCBzbGljZTtcclxuXHRcdFx0Zm9yICh2YXIgaSBpbiBhKXtcclxuXHRcdFx0XHRzbGljZSA9IFtdO1xyXG5cdFx0XHRcdGZvciAodmFyIGogPSAwLCBsID0gYXJncy5sZW5ndGgsIHZhbDsgaiA8IGw7IGorKyl7XHJcblx0XHRcdFx0XHR2YWwgPSB0eXBlb2YgYXJnc1tqXSA9PT0gJ29iamVjdCcgPyBhcmdzW2pdW2ldIDogYXJnc1tqXTtcclxuXHRcdFx0XHRcdHZhbCA9IHZhbDtcclxuXHRcdFx0XHRcdHNsaWNlLnB1c2godmFsKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmVzdWx0W2ldID0gZm4uYXBwbHkodGhpcywgc2xpY2UpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiByZXN1bHQ7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG5cdFx0fVxyXG5cdH07XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhKXtcclxuXHRyZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQpe1xyXG5cdHJldHVybiB0eXBlb2YgRXZlbnQgIT09ICd1bmRlZmluZWQnICYmIHRhcmdldCBpbnN0YW5jZW9mIEV2ZW50O1xyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0KXtcclxuXHRyZXR1cm4gdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB0YXJnZXQgaW5zdGFuY2VvZiBOb2RlO1xyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oYSl7XHJcblx0cmV0dXJuIHR5cGVvZiBhID09PSAnbnVtYmVyJyB8fCBhIGluc3RhbmNlb2YgTnVtYmVyO1xyXG59IiwiLyoqXHJcbiAqIEBtb2R1bGUgbXV0eXBlL2lzLW9iamVjdFxyXG4gKi9cclxuXHJcbi8vVE9ETzogYWRkIHN0OCB0ZXN0c1xyXG5cclxuLy9pc1BsYWluT2JqZWN0IGluZGVlZFxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG8pe1xyXG5cdC8vIHJldHVybiBvYmogPT09IE9iamVjdChvYmopO1xyXG5cdHJldHVybiAhIW8gJiYgdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIG8uY29uc3RydWN0b3IgPT09IE9iamVjdDtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhKXtcclxuXHRyZXR1cm4gdHlwZW9mIGEgPT09ICdzdHJpbmcnIHx8IGEgaW5zdGFuY2VvZiBTdHJpbmc7XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0KSB7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXVxuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXRcbn1cbiIsIi8qKlxyXG4gKiBQYXJzZSBlbGVtZW504oCZcyBib3JkZXJzXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3MvYm9yZGVyc1xyXG4gKi9cclxuXHJcbnZhciBSZWN0ID0gcmVxdWlyZSgnLi9SZWN0Jyk7XHJcbnZhciBwYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UtdmFsdWUnKTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYm9yZGVyIHdpZHRocyBvZiBhbiBlbGVtZW50XHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKXtcclxuXHRpZiAoZWwgPT09IHdpbmRvdykgcmV0dXJuIG5ldyBSZWN0O1xyXG5cclxuXHRpZiAoIShlbCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB0aHJvdyBFcnJvcignQXJndW1lbnQgaXMgbm90IGFuIGVsZW1lbnQnKTtcclxuXHJcblx0dmFyIHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xyXG5cclxuXHRyZXR1cm4gbmV3IFJlY3QoXHJcblx0XHRwYXJzZShzdHlsZS5ib3JkZXJMZWZ0V2lkdGgpLFxyXG5cdFx0cGFyc2Uoc3R5bGUuYm9yZGVyVG9wV2lkdGgpLFxyXG5cdFx0cGFyc2Uoc3R5bGUuYm9yZGVyUmlnaHRXaWR0aCksXHJcblx0XHRwYXJzZShzdHlsZS5ib3JkZXJCb3R0b21XaWR0aClcclxuXHQpO1xyXG59OyIsIi8qKlxyXG4gKiBHZXQgbWFyZ2lucyBvZiBhbiBlbGVtZW50LlxyXG4gKiBAbW9kdWxlIG11Y3NzL21hcmdpbnNcclxuICovXHJcblxyXG52YXIgcGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlLXZhbHVlJyk7XHJcbnZhciBSZWN0ID0gcmVxdWlyZSgnLi9SZWN0Jyk7XHJcblxyXG4vKipcclxuICogUmV0dXJuIG1hcmdpbnMgb2YgYW4gZWxlbWVudC5cclxuICpcclxuICogQHBhcmFtICAgIHtFbGVtZW50fSAgIGVsICAgQW4gZWxlbWVudCB3aGljaCB0byBjYWxjIG1hcmdpbnMuXHJcbiAqIEByZXR1cm4gICB7T2JqZWN0fSAgIFBhZGRpbmdzIG9iamVjdCBge3RvcDpuLCBib3R0b206biwgbGVmdDpuLCByaWdodDpufWAuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKXtcclxuXHRpZiAoZWwgPT09IHdpbmRvdykgcmV0dXJuIG5ldyBSZWN0KCk7XHJcblxyXG5cdGlmICghKGVsIGluc3RhbmNlb2YgRWxlbWVudCkpIHRocm93IEVycm9yKCdBcmd1bWVudCBpcyBub3QgYW4gZWxlbWVudCcpO1xyXG5cclxuXHR2YXIgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XHJcblxyXG5cdHJldHVybiBuZXcgUmVjdChcclxuXHRcdHBhcnNlKHN0eWxlLm1hcmdpbkxlZnQpLFxyXG5cdFx0cGFyc2Uoc3R5bGUubWFyZ2luVG9wKSxcclxuXHRcdHBhcnNlKHN0eWxlLm1hcmdpblJpZ2h0KSxcclxuXHRcdHBhcnNlKHN0eWxlLm1hcmdpbkJvdHRvbSlcclxuXHQpO1xyXG59O1xyXG4iLCIvKipcclxuICogQ2FjbHVsYXRlIHBhZGRpbmdzIG9mIGFuIGVsZW1lbnQuXHJcbiAqIEBtb2R1bGUgIG11Y3NzL3BhZGRpbmdzXHJcbiAqL1xyXG5cclxuXHJcbnZhciBSZWN0ID0gcmVxdWlyZSgnLi9SZWN0Jyk7XHJcbnZhciBwYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UtdmFsdWUnKTtcclxuXHJcblxyXG4vKipcclxuICogUmV0dXJuIHBhZGRpbmdzIG9mIGFuIGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSAgICB7RWxlbWVudH0gICAkZWwgICBBbiBlbGVtZW50IHRvIGNhbGMgcGFkZGluZ3MuXHJcbiAqIEByZXR1cm4gICB7T2JqZWN0fSAgIFBhZGRpbmdzIG9iamVjdCBge3RvcDpuLCBib3R0b206biwgbGVmdDpuLCByaWdodDpufWAuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRlbCl7XHJcblx0aWYgKCRlbCA9PT0gd2luZG93KSByZXR1cm4gbmV3IFJlY3QoKTtcclxuXHJcblx0aWYgKCEoJGVsIGluc3RhbmNlb2YgRWxlbWVudCkpIHRocm93IEVycm9yKCdBcmd1bWVudCBpcyBub3QgYW4gZWxlbWVudCcpO1xyXG5cclxuXHR2YXIgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSgkZWwpO1xyXG5cclxuXHRyZXR1cm4gbmV3IFJlY3QoXHJcblx0XHRwYXJzZShzdHlsZS5wYWRkaW5nTGVmdCksXHJcblx0XHRwYXJzZShzdHlsZS5wYWRkaW5nVG9wKSxcclxuXHRcdHBhcnNlKHN0eWxlLnBhZGRpbmdSaWdodCksXHJcblx0XHRwYXJzZShzdHlsZS5wYWRkaW5nQm90dG9tKVxyXG5cdCk7XHJcbn07IiwiLyoqXHJcbiAqIEBtb2R1bGUgIG11bWF0aC9hZGRcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24gKCkge1xyXG5cdHZhciByZXN1bHQgPSBhcmd1bWVudHNbMF07XHJcblx0Zm9yICh2YXIgaSA9IDEsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRyZXN1bHQgKz0gYXJndW1lbnRzW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59KTsiLG51bGwsIi8qKlxyXG4gKiBAbW9kdWxlIG11bWF0aC9kaXZcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24gKCkge1xyXG5cdHZhciByZXN1bHQgPSBhcmd1bWVudHNbMF07XHJcblx0Zm9yICh2YXIgaSA9IDEsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRyZXN1bHQgLz0gYXJndW1lbnRzW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59KTsiLCIvKipcclxuICogQG1vZHVsZSBtdW1hdGgvZXFcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24gKGEsIGIpIHtcclxuXHRyZXR1cm4gYSA9PT0gYjtcclxufSk7IiwiLyoqXHJcbiAqIEBtb2R1bGUgbXVtYXRoL2d0XHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uIChhLCBiKSB7XHJcblx0cmV0dXJuIGEgPiBiO1xyXG59KTsiLCIvKipcclxuICogQG1vZHVsZSBtdW1hdGgvZ3RlXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uIChhLCBiKSB7XHJcblx0cmV0dXJuIGEgPj0gYjtcclxufSk7IiwiLyoqXG4gKiBDb21wb3NlZCBzZXQgb2YgYWxsIG1hdGggdXRpbHNcbiAqXG4gKiBAbW9kdWxlICBtdW1hdGhcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSB7XG5cdGJldHdlZW46IHJlcXVpcmUoJy4vYmV0d2VlbicpLFxuXHRpc0JldHdlZW46IHJlcXVpcmUoJy4vaXMtYmV0d2VlbicpLFxuXHRyb3VuZDogcmVxdWlyZSgnLi9yb3VuZCcpLFxuXHRwcmVjaXNpb246IHJlcXVpcmUoJy4vcHJlY2lzaW9uJyksXG5cdGxvb3A6IHJlcXVpcmUoJy4vbG9vcCcpLFxuXHRhZGQ6IHJlcXVpcmUoJy4vYWRkJyksXG5cdHN1YjogcmVxdWlyZSgnLi9zdWInKSxcblx0bWluOiByZXF1aXJlKCcuL21pbicpLFxuXHRtYXg6IHJlcXVpcmUoJy4vbWF4JyksXG5cdGRpdjogcmVxdWlyZSgnLi9kaXYnKSxcblx0bGc6IHJlcXVpcmUoJy4vbGcnKSxcblx0bG9nOiByZXF1aXJlKCcuL2xvZycpLFxuXHRtdWx0OiByZXF1aXJlKCcuL211bHQnKSxcblx0bW9kOiByZXF1aXJlKCcuL21vZCcpLFxuXHRmbG9vcjogcmVxdWlyZSgnLi9mbG9vcicpLFxuXHRjZWlsOiByZXF1aXJlKCcuL2NlaWwnKSxcblxuXHRndDogcmVxdWlyZSgnLi9ndCcpLFxuXHRndGU6IHJlcXVpcmUoJy4vZ3RlJyksXG5cdGx0OiByZXF1aXJlKCcuL2x0JyksXG5cdGx0ZTogcmVxdWlyZSgnLi9sdGUnKSxcblx0ZXE6IHJlcXVpcmUoJy4vZXEnKSxcblx0bmU6IHJlcXVpcmUoJy4vbmUnKSxcbn07IiwiLyoqXHJcbiAqIFdoZXRoZXIgZWxlbWVudCBpcyBiZXR3ZWVuIGxlZnQgJiByaWdodCBpbmNsdWRpbmdcclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IGFcclxuICogQHBhcmFtIHtudW1iZXJ9IGxlZnRcclxuICogQHBhcmFtIHtudW1iZXJ9IHJpZ2h0XHJcbiAqXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uKGEsIGxlZnQsIHJpZ2h0KXtcclxuXHRpZiAoYSA8PSByaWdodCAmJiBhID49IGxlZnQpIHJldHVybiB0cnVlO1xyXG5cdHJldHVybiBmYWxzZTtcclxufSk7IiwiLyoqXHJcbiAqIEJhc2UgMTAgbG9nYXJpdGhtXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVtYXRoL2xnXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uIChhKSB7XHJcblx0cmV0dXJuIE1hdGgubG9nKGEpIC8gTWF0aC5sb2coMTApO1xyXG59KTsiLCIvKipcclxuICogTmF0dXJhbCBsb2dhcml0aG1cclxuICpcclxuICogQG1vZHVsZSBtdW1hdGgvbG9nXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uIChhKSB7XHJcblx0cmV0dXJuIE1hdGgubG9nKGEpO1xyXG59KTsiLCIvKipcclxuICogQG1vZHVsZSBtdW1hdGgvbHRcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24gKGEsIGIpIHtcclxuXHRyZXR1cm4gYSA8IGI7XHJcbn0pOyIsIi8qKlxyXG4gKiBAbW9kdWxlIG11bWF0aC9sdGVcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24gKGEsIGIpIHtcclxuXHRyZXR1cm4gYSA8PSBiO1xyXG59KTsiLCIvKiogQG1vZHVsZSBtdW1hdGgvbWF4ICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoTWF0aC5tYXgpOyIsIi8qKlxyXG4gKiBAbW9kdWxlIG11bWF0aC9taW5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoTWF0aC5taW4pOyIsIi8qKlxyXG4gKiBAbW9kdWxlIG11bWF0aC9tb2RcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi93cmFwJykoZnVuY3Rpb24gKCkge1xyXG5cdHZhciByZXN1bHQgPSBhcmd1bWVudHNbMF07XHJcblx0Zm9yICh2YXIgaSA9IDEsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRyZXN1bHQgJT0gYXJndW1lbnRzW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59KTsiLCIvKipcclxuICogQG1vZHVsZSBtdW1hdGgvbXVsdFxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3dyYXAnKShmdW5jdGlvbiAoKSB7XHJcblx0dmFyIHJlc3VsdCA9IGFyZ3VtZW50c1swXTtcclxuXHRmb3IgKHZhciBpID0gMSwgbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdHJlc3VsdCAqPSBhcmd1bWVudHNbaV07XHJcblx0fVxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn0pOyIsIi8qKlxyXG4gKiBAbW9kdWxlIG11bWF0aC9uZVxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3dyYXAnKShmdW5jdGlvbiAoYSwgYikge1xyXG5cdHJldHVybiBhICE9PSBiO1xyXG59KTsiLCIvKipcclxuICogQG1vZHVsZSBtdW1hdGgvc3ViXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uICgpIHtcclxuXHR2YXIgcmVzdWx0ID0gYXJndW1lbnRzWzBdO1xyXG5cdGZvciAodmFyIGkgPSAxLCBsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0cmVzdWx0IC09IGFyZ3VtZW50c1tpXTtcclxuXHR9XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufSk7IiwiLy9zcGVlZHkgaW1wbGVtZW50YXRpb24gb2YgYGluYFxyXG4vL05PVEU6IGAhdGFyZ2V0W3Byb3BOYW1lXWAgMi0zIG9yZGVycyBmYXN0ZXIgdGhhbiBgIShwcm9wTmFtZSBpbiB0YXJnZXQpYFxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGEsIGIpe1xyXG5cdGlmICghYSkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHQvL05PVEU6IHRoaXMgY2F1c2VzIGdldHRlciBmaXJlXHJcblx0aWYgKGFbYl0pIHJldHVybiB0cnVlO1xyXG5cclxuXHQvL0ZJWE1FOiB3aHkgaW4gaXMgYmV0dGVyIHRoYW4gaGFzT3duUHJvcGVydHk/IFNvbWV0aGluZyB3aXRoIHByb3RvdHlwZXMuIFNob3cgYSBjYXNlLlxyXG5cdHJldHVybiBiIGluIGE7XHJcblx0Ly8gcmV0dXJuIGEuaGFzT3duUHJvcGVydHkoYik7XHJcbn1cclxuIiwiLyoqXHJcbiogVHJpdmlhbCB0eXBlcyBjaGVja2Vycy5cclxuKiBCZWNhdXNlIHRoZXJl4oCZcmUgbm8gY29tbW9uIGxpYiBmb3IgdGhhdCAoIGxvZGFzaF8gaXMgYSBmYXRndXkpXHJcbiovXHJcbi8vVE9ETzogbWFrZSBtYWluIHVzZSBhcyBgaXMuYXJyYXkodGFyZ2V0KWBcclxuLy9UT0RPOiBzZXBhcmF0ZSBieSBsaWJzLCBpbmNsdWRlZCBwZXItZmlsZVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0aGFzOiByZXF1aXJlKCcuL2hhcycpLFxyXG5cdGlzT2JqZWN0OiByZXF1aXJlKCcuL2lzLW9iamVjdCcpLFxyXG5cdGlzRm46IHJlcXVpcmUoJy4vaXMtZm4nKSxcclxuXHRpc1N0cmluZzogcmVxdWlyZSgnLi9pcy1zdHJpbmcnKSxcclxuXHRpc051bWJlcjogcmVxdWlyZSgnLi9pcy1udW1iZXInKSxcclxuXHRpc0Jvb2xlYW46IHJlcXVpcmUoJy4vaXMtYm9vbCcpLFxyXG5cdGlzUGxhaW46IHJlcXVpcmUoJy4vaXMtcGxhaW4nKSxcclxuXHRpc0FycmF5OiByZXF1aXJlKCcuL2lzLWFycmF5JyksXHJcblx0aXNBcnJheUxpa2U6IHJlcXVpcmUoJy4vaXMtYXJyYXktbGlrZScpLFxyXG5cdGlzRWxlbWVudDogcmVxdWlyZSgnLi9pcy1lbGVtZW50JyksXHJcblx0aXNQcml2YXRlTmFtZTogcmVxdWlyZSgnLi9pcy1wcml2YXRlLW5hbWUnKSxcclxuXHRpc1JlZ0V4cDogcmVxdWlyZSgnLi9pcy1yZWdleCcpLFxyXG5cdGlzRW1wdHk6IHJlcXVpcmUoJy4vaXMtZW1wdHknKVxyXG59O1xyXG4iLCJ2YXIgaXNTdHJpbmcgPSByZXF1aXJlKCcuL2lzLXN0cmluZycpO1xyXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJy4vaXMtYXJyYXknKTtcclxudmFyIGlzRm4gPSByZXF1aXJlKCcuL2lzLWZuJyk7XHJcblxyXG4vL0ZJWE1FOiBhZGQgdGVzdHMgZnJvbSBodHRwOi8vanNmaWRkbGUubmV0L2t1OUxTLzEvXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGEpe1xyXG5cdHJldHVybiBpc0FycmF5KGEpIHx8IChhICYmICFpc1N0cmluZyhhKSAmJiAhYS5ub2RlVHlwZSAmJiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJyA/IGEgIT0gd2luZG93IDogdHJ1ZSkgJiYgIWlzRm4oYSkgJiYgdHlwZW9mIGEubGVuZ3RoID09PSAnbnVtYmVyJyk7XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGEpe1xyXG5cdHJldHVybiB0eXBlb2YgYSA9PT0gJ2Jvb2xlYW4nIHx8IGEgaW5zdGFuY2VvZiBCb29sZWFuO1xyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQpe1xyXG5cdHJldHVybiB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRhcmdldCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50O1xyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oYSl7XHJcblx0aWYgKCFhKSByZXR1cm4gdHJ1ZTtcclxuXHRmb3IgKHZhciBrIGluIGEpIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblx0cmV0dXJuIHRydWU7XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGEpe1xyXG5cdHJldHVybiAhIShhICYmIGEuYXBwbHkpO1xyXG59IiwidmFyIGlzU3RyaW5nID0gcmVxdWlyZSgnLi9pcy1zdHJpbmcnKSxcclxuXHRpc051bWJlciA9IHJlcXVpcmUoJy4vaXMtbnVtYmVyJyksXHJcblx0aXNCb29sID0gcmVxdWlyZSgnLi9pcy1ib29sJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzUGxhaW4oYSl7XHJcblx0cmV0dXJuICFhIHx8IGlzU3RyaW5nKGEpIHx8IGlzTnVtYmVyKGEpIHx8IGlzQm9vbChhKTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG4pe1xyXG5cdHJldHVybiBuWzBdID09PSAnXycgJiYgbi5sZW5ndGggPiAxO1xyXG59XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0KXtcclxuXHRyZXR1cm4gdGFyZ2V0IGluc3RhbmNlb2YgUmVnRXhwO1xyXG59IiwiLyoqXHJcbiAqIEBtb2R1bGUgcXVlcmllZC9saWIvaW5kZXhcclxuICovXHJcblxyXG5cclxudmFyIHNsaWNlID0gcmVxdWlyZSgnc2xpY2VkJyk7XHJcbnZhciB1bmlxdWUgPSByZXF1aXJlKCdhcnJheS11bmlxdWUnKTtcclxudmFyIGdldFVpZCA9IHJlcXVpcmUoJ2dldC11aWQnKTtcclxudmFyIHBhcmVuID0gcmVxdWlyZSgncGFyZW50aGVzaXMnKTtcclxudmFyIGlzU3RyaW5nID0gcmVxdWlyZSgnbXV0eXBlL2lzLXN0cmluZycpO1xyXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ211dHlwZS9pcy1hcnJheScpO1xyXG52YXIgaXNBcnJheUxpa2UgPSByZXF1aXJlKCdtdXR5cGUvaXMtYXJyYXktbGlrZScpO1xyXG52YXIgYXJyYXlpZnkgPSByZXF1aXJlKCdhcnJheWlmeS1jb21wYWN0Jyk7XHJcbnZhciBkb2MgPSByZXF1aXJlKCdnZXQtZG9jJyk7XHJcblxyXG5cclxuLyoqXHJcbiAqIFF1ZXJ5IHdyYXBwZXIgLSBtYWluIG1ldGhvZCB0byBxdWVyeSBlbGVtZW50cy5cclxuICovXHJcbmZ1bmN0aW9uIHF1ZXJ5TXVsdGlwbGUoc2VsZWN0b3IsIGVsKSB7XHJcblx0Ly9pZ25vcmUgYmFkIHNlbGVjdG9yXHJcblx0aWYgKCFzZWxlY3RvcikgcmV0dXJuIFtdO1xyXG5cclxuXHQvL3JldHVybiBlbGVtZW50cyBwYXNzZWQgYXMgYSBzZWxlY3RvciB1bmNoYW5nZWQgKGNvdmVyIHBhcmFtcyBjYXNlKVxyXG5cdGlmICghaXNTdHJpbmcoc2VsZWN0b3IpKSB7XHJcblx0XHRpZiAoaXNBcnJheShzZWxlY3RvcikpIHtcclxuXHRcdFx0cmV0dXJuIHVuaXF1ZShhcnJheWlmeShzZWxlY3Rvci5tYXAoZnVuY3Rpb24gKHNlbCkge1xyXG5cdFx0XHRcdHJldHVybiBxdWVyeU11bHRpcGxlKHNlbCwgZWwpO1xyXG5cdFx0XHR9KSkpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIFtzZWxlY3Rvcl07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvL2NhdGNoIHBvbHlmaWxsYWJsZSBmaXJzdCBgOnNjb3BlYCBzZWxlY3RvciAtIGp1c3QgZXJhc2UgaXQsIHdvcmtzIGp1c3QgZmluZVxyXG5cdGlmIChwc2V1ZG9zLnNjb3BlKSB7XHJcblx0XHRzZWxlY3RvciA9IHNlbGVjdG9yLnJlcGxhY2UoL15cXHMqOnNjb3BlLywgJycpO1xyXG5cdH1cclxuXHJcblx0Ly9pZ25vcmUgbm9uLXF1ZXJ5YWJsZSBjb250YWluZXJzXHJcblx0aWYgKCFlbCkge1xyXG5cdFx0ZWwgPSBbcXVlcnlTaW5nbGUuZG9jdW1lbnRdO1xyXG5cdH1cclxuXHJcblx0Ly90cmVhdCBwYXNzZWQgbGlzdFxyXG5cdGVsc2UgaWYgKGlzQXJyYXlMaWtlKGVsKSkge1xyXG5cdFx0ZWwgPSBhcnJheWlmeShlbCk7XHJcblx0fVxyXG5cclxuXHQvL2lmIGVsZW1lbnQgaXNu4oCZdCBhIG5vZGUgLSBtYWtlIGl0IHEuZG9jdW1lbnRcclxuXHRlbHNlIGlmICghZWwucXVlcnlTZWxlY3Rvcikge1xyXG5cdFx0ZWwgPSBbcXVlcnlTaW5nbGUuZG9jdW1lbnRdO1xyXG5cdH1cclxuXHJcblx0Ly9tYWtlIGFueSBvayBlbGVtZW50IGEgbGlzdFxyXG5cdGVsc2Uge1xyXG5cdFx0ZWwgPSBbZWxdO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHFQc2V1ZG9zKGVsLCBzZWxlY3Rvcik7XHJcbn1cclxuXHJcblxyXG4vKiogUXVlcnkgc2luZ2xlIGVsZW1lbnQgLSBubyB3YXkgYmV0dGVyIHRoYW4gcmV0dXJuIGZpcnN0IG9mIG11bHRpcGxlIHNlbGVjdG9yICovXHJcbmZ1bmN0aW9uIHF1ZXJ5U2luZ2xlKHNlbGVjdG9yLCBlbCl7XHJcblx0cmV0dXJuIHF1ZXJ5TXVsdGlwbGUoc2VsZWN0b3IsIGVsKVswXTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gcXVlcnkgcmVzdWx0IGJhc2VkIG9mZiB0YXJnZXQgbGlzdC5cclxuICogUGFyc2UgYW5kIGFwcGx5IHBvbHlmaWxsZWQgcHNldWRvc1xyXG4gKi9cclxuZnVuY3Rpb24gcVBzZXVkb3MobGlzdCwgc2VsZWN0b3IpIHtcclxuXHQvL2lnbm9yZSBlbXB0eSBzZWxlY3RvclxyXG5cdHNlbGVjdG9yID0gc2VsZWN0b3IudHJpbSgpO1xyXG5cdGlmICghc2VsZWN0b3IpIHJldHVybiBsaXN0O1xyXG5cclxuXHQvLyBjb25zb2xlLmdyb3VwKHNlbGVjdG9yKTtcclxuXHJcblx0Ly9zY29waWZ5IGltbWVkaWF0ZSBjaGlsZHJlbiBzZWxlY3RvclxyXG5cdGlmIChzZWxlY3RvclswXSA9PT0gJz4nKSB7XHJcblx0XHRpZiAoIXBzZXVkb3Muc2NvcGUpIHtcclxuXHRcdFx0Ly9zY29wZSBhcyB0aGUgZmlyc3QgZWxlbWVudCBpbiBzZWxlY3RvciBzY29waWZpZXMgY3VycmVudCBlbGVtZW50IGp1c3Qgb2tcclxuXHRcdFx0c2VsZWN0b3IgPSAnOnNjb3BlJyArIHNlbGVjdG9yO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdHZhciBpZCA9IGdldFVpZCgpO1xyXG5cdFx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24oZWwpe2VsLnNldEF0dHJpYnV0ZSgnX19zY29wZWQnLCBpZCk7fSk7XHJcblx0XHRcdHNlbGVjdG9yID0gJ1tfX3Njb3BlZD1cIicgKyBpZCArICdcIl0nICsgc2VsZWN0b3I7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgcHNldWRvLCBwc2V1ZG9GbiwgcHNldWRvUGFyYW0sIHBzZXVkb1BhcmFtSWQ7XHJcblxyXG5cdC8vY2F0Y2ggcHNldWRvXHJcblx0dmFyIHBhcnRzID0gcGFyZW4ucGFyc2Uoc2VsZWN0b3IpO1xyXG5cdHZhciBtYXRjaCA9IHBhcnRzWzBdLm1hdGNoKHBzZXVkb1JFKTtcclxuXHJcblx0Ly9pZiBwc2V1ZG8gZm91bmRcclxuXHRpZiAobWF0Y2gpIHtcclxuXHRcdC8vZ3JhYiBwc2V1ZG8gZGV0YWlsc1xyXG5cdFx0cHNldWRvID0gbWF0Y2hbMV07XHJcblx0XHRwc2V1ZG9QYXJhbUlkID0gbWF0Y2hbMl07XHJcblxyXG5cdFx0aWYgKHBzZXVkb1BhcmFtSWQpIHtcclxuXHRcdFx0cHNldWRvUGFyYW0gPSBwYXJlbi5zdHJpbmdpZnkocGFydHNbcHNldWRvUGFyYW1JZC5zbGljZSgxKV0sIHBhcnRzKTtcclxuXHRcdH1cclxuXHJcblx0XHQvL3ByZS1zZWxlY3QgZWxlbWVudHMgYmVmb3JlIHBzZXVkb1xyXG5cdFx0dmFyIHByZVNlbGVjdG9yID0gcGFyZW4uc3RyaW5naWZ5KHBhcnRzWzBdLnNsaWNlKDAsIG1hdGNoLmluZGV4KSwgcGFydHMpO1xyXG5cclxuXHRcdC8vZml4IGZvciBxdWVyeS1yZWxhdGl2ZVxyXG5cdFx0aWYgKCFwcmVTZWxlY3RvciAmJiAhbWFwcGVyc1twc2V1ZG9dKSBwcmVTZWxlY3RvciA9ICcqJztcclxuXHRcdGlmIChwcmVTZWxlY3RvcikgbGlzdCA9IHFMaXN0KGxpc3QsIHByZVNlbGVjdG9yKTtcclxuXHJcblxyXG5cdFx0Ly9hcHBseSBwc2V1ZG8gZmlsdGVyL21hcHBlciBvbiB0aGUgbGlzdFxyXG5cdFx0cHNldWRvRm4gPSBmdW5jdGlvbihlbCkge3JldHVybiBwc2V1ZG9zW3BzZXVkb10oZWwsIHBzZXVkb1BhcmFtKTsgfTtcclxuXHRcdGlmIChmaWx0ZXJzW3BzZXVkb10pIHtcclxuXHRcdFx0bGlzdCA9IGxpc3QuZmlsdGVyKHBzZXVkb0ZuKTtcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYgKG1hcHBlcnNbcHNldWRvXSkge1xyXG5cdFx0XHRsaXN0ID0gdW5pcXVlKGFycmF5aWZ5KGxpc3QubWFwKHBzZXVkb0ZuKSkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vc2hvcnRlbiBzZWxlY3RvclxyXG5cdFx0c2VsZWN0b3IgPSBwYXJ0c1swXS5zbGljZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XHJcblxyXG5cdFx0Ly8gY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHRcdC8vcXVlcnkgb25jZSBhZ2FpblxyXG5cdFx0cmV0dXJuIHFQc2V1ZG9zKGxpc3QsIHBhcmVuLnN0cmluZ2lmeShzZWxlY3RvciwgcGFydHMpKTtcclxuXHR9XHJcblxyXG5cdC8vanVzdCBxdWVyeSBsaXN0XHJcblx0ZWxzZSB7XHJcblx0XHQvLyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblx0XHRyZXR1cm4gcUxpc3QobGlzdCwgc2VsZWN0b3IpO1xyXG5cdH1cclxufVxyXG5cclxuXHJcbi8qKiBBcHBseSBzZWxlY3RvciBvbiBhIGxpc3Qgb2YgZWxlbWVudHMsIG5vIHBvbHlmaWxsZWQgcHNldWRvcyAqL1xyXG5mdW5jdGlvbiBxTGlzdChsaXN0LCBzZWxlY3Rvcil7XHJcblx0cmV0dXJuIHVuaXF1ZShhcnJheWlmeShsaXN0Lm1hcChmdW5jdGlvbihlbCl7XHJcblx0XHRyZXR1cm4gc2xpY2UoZWwucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpO1xyXG5cdH0pKSk7XHJcbn1cclxuXHJcblxyXG4vKiogUmVnaXN0ZXJlZCBwc2V1ZG9zICovXHJcbnZhciBwc2V1ZG9zID0ge307XHJcbnZhciBmaWx0ZXJzID0ge307XHJcbnZhciBtYXBwZXJzID0ge307XHJcblxyXG5cclxuLyoqIFJlZ2V4cCB0byBncmFiIHBzZXVkb3Mgd2l0aCBwYXJhbXMgKi9cclxudmFyIHBzZXVkb1JFO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBBcHBlbmQgYSBuZXcgZmlsdGVyaW5nIChjbGFzc2ljKSBwc2V1ZG9cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgUHNldWRvIG5hbWVcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZmlsdGVyIEEgZmlsdGVyaW5nIGZ1bmN0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiByZWdpc3RlckZpbHRlcihuYW1lLCBmaWx0ZXIsIGluY1NlbGYpe1xyXG5cdGlmIChwc2V1ZG9zW25hbWVdKSByZXR1cm47XHJcblxyXG5cdC8vc2F2ZSBwc2V1ZG8gZmlsdGVyXHJcblx0cHNldWRvc1tuYW1lXSA9IGZpbHRlcjtcclxuXHRwc2V1ZG9zW25hbWVdLmluY2x1ZGVTZWxmID0gaW5jU2VsZjtcclxuXHRmaWx0ZXJzW25hbWVdID0gdHJ1ZTtcclxuXHJcblx0cmVnZW5lcmF0ZVJlZ0V4cCgpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEFwcGVuZCBhIG5ldyBtYXBwaW5nIChyZWxhdGl2ZS1saWtlKSBwc2V1ZG9cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgcHNldWRvIG5hbWVcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gbWFwcGVyIG1hcCBmdW5jdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gcmVnaXN0ZXJNYXBwZXIobmFtZSwgbWFwcGVyLCBpbmNTZWxmKXtcclxuXHRpZiAocHNldWRvc1tuYW1lXSkgcmV0dXJuO1xyXG5cclxuXHRwc2V1ZG9zW25hbWVdID0gbWFwcGVyO1xyXG5cdHBzZXVkb3NbbmFtZV0uaW5jbHVkZVNlbGYgPSBpbmNTZWxmO1xyXG5cdG1hcHBlcnNbbmFtZV0gPSB0cnVlO1xyXG5cclxuXHRyZWdlbmVyYXRlUmVnRXhwKCk7XHJcbn1cclxuXHJcblxyXG4vKiogVXBkYXRlIHJlZ2V4cCBjYXRjaGluZyBwc2V1ZG9zICovXHJcbmZ1bmN0aW9uIHJlZ2VuZXJhdGVSZWdFeHAoKXtcclxuXHRwc2V1ZG9SRSA9IG5ldyBSZWdFeHAoJzo6PygnICsgT2JqZWN0LmtleXMocHNldWRvcykuam9pbignfCcpICsgJykoXFxcXFxcXFxbMC05XSspPycpO1xyXG59XHJcblxyXG5cclxuXHJcbi8qKiBFeHBvcnRzICovXHJcbnF1ZXJ5U2luZ2xlLmFsbCA9IHF1ZXJ5TXVsdGlwbGU7XHJcbnF1ZXJ5U2luZ2xlLnJlZ2lzdGVyRmlsdGVyID0gcmVnaXN0ZXJGaWx0ZXI7XHJcbnF1ZXJ5U2luZ2xlLnJlZ2lzdGVyTWFwcGVyID0gcmVnaXN0ZXJNYXBwZXI7XHJcblxyXG4vKiogRGVmYXVsdCBkb2N1bWVudCByZXByZXNlbnRhdGl2ZSB0byB1c2UgZm9yIERPTSAqL1xyXG5xdWVyeVNpbmdsZS5kb2N1bWVudCA9IGRvYztcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHF1ZXJ5U2luZ2xlOyIsInZhciBxID0gcmVxdWlyZSgnLi4nKTtcclxuXHJcbmZ1bmN0aW9uIGhhcyhlbCwgc3ViU2VsZWN0b3Ipe1xyXG5cdHJldHVybiAhIXEoc3ViU2VsZWN0b3IsIGVsKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBoYXM7IiwidmFyIHEgPSByZXF1aXJlKCcuLicpO1xyXG4vKiogQ1NTNCBtYXRjaGVzICovXHJcbmZ1bmN0aW9uIG1hdGNoZXMoZWwsIHNlbGVjdG9yKXtcclxuXHRpZiAoIWVsLnBhcmVudE5vZGUpIHtcclxuXHRcdHZhciBmcmFnbWVudCA9IHEuZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xyXG5cdFx0ZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZWwpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHEuYWxsKHNlbGVjdG9yLCBlbC5wYXJlbnROb2RlKS5pbmRleE9mKGVsKSA+IC0xO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG1hdGNoZXM7IiwidmFyIG1hdGNoZXMgPSByZXF1aXJlKCcuL21hdGNoZXMnKTtcclxuXHJcbmZ1bmN0aW9uIG5vdChlbCwgc2VsZWN0b3Ipe1xyXG5cdHJldHVybiAhbWF0Y2hlcyhlbCwgc2VsZWN0b3IpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5vdDsiLCJ2YXIgcSA9IHJlcXVpcmUoJy4uJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHJvb3QoZWwpe1xyXG5cdHJldHVybiBlbCA9PT0gcS5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XHJcbn07IiwiLyoqXHJcbiAqIDpzY29wZSBwc2V1ZG9cclxuICogUmV0dXJuIGVsZW1lbnQgaWYgaXQgaGFzIGBzY29wZWRgIGF0dHJpYnV0ZS5cclxuICpcclxuICogQGxpbmsgaHR0cDovL2Rldi53My5vcmcvY3Nzd2cvc2VsZWN0b3JzLTQvI3RoZS1zY29wZS1wc2V1ZG9cclxuICovXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNjb3BlKGVsKXtcclxuXHRyZXR1cm4gZWwuaGFzQXR0cmlidXRlKCdzY29wZWQnKTtcclxufTsiLCIvKiFcbiAqIGFycmF5LXVuaXF1ZSA8aHR0cHM6Ly9naXRodWIuY29tL2pvbnNjaGxpbmtlcnQvYXJyYXktdW5pcXVlPlxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxNCBKb24gU2NobGlua2VydCwgY29udHJpYnV0b3JzLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB1bmlxdWUoYXJyKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShhcnIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYXJyYXktdW5pcXVlIGV4cGVjdHMgYW4gYXJyYXkuJyk7XG4gIH1cblxuICB2YXIgbGVuID0gYXJyLmxlbmd0aDtcbiAgdmFyIGkgPSAtMTtcblxuICB3aGlsZSAoaSsrIDwgbGVuKSB7XG4gICAgdmFyIGogPSBpICsgMTtcblxuICAgIGZvciAoOyBqIDwgYXJyLmxlbmd0aDsgKytqKSB7XG4gICAgICBpZiAoYXJyW2ldID09PSBhcnJbal0pIHtcbiAgICAgICAgYXJyLnNwbGljZShqLS0sIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gYXJyO1xufTtcbiIsIi8qIVxuICogYXJyYXlpZnktY29tcGFjdCA8aHR0cHM6Ly9naXRodWIuY29tL2pvbnNjaGxpbmtlcnQvYXJyYXlpZnktY29tcGFjdD5cbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgSm9uIFNjaGxpbmtlcnQsIGNvbnRyaWJ1dG9ycy5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZVxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGZsYXR0ZW4gPSByZXF1aXJlKCdhcnJheS1mbGF0dGVuJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oYXJyKSB7XG4gIHJldHVybiBmbGF0dGVuKCFBcnJheS5pc0FycmF5KGFycikgPyBbYXJyXSA6IGFycilcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xufTtcbiIsIid1c2Ugc3RyaWN0J1xuXG4vKipcbiAqIEV4cG9zZSBgYXJyYXlGbGF0dGVuYC5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBhcnJheUZsYXR0ZW5cblxuLyoqXG4gKiBSZWN1cnNpdmUgZmxhdHRlbiBmdW5jdGlvbiB3aXRoIGRlcHRoLlxuICpcbiAqIEBwYXJhbSAge0FycmF5fSAgYXJyYXlcbiAqIEBwYXJhbSAge0FycmF5fSAgcmVzdWx0XG4gKiBAcGFyYW0gIHtOdW1iZXJ9IGRlcHRoXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZmxhdHRlbldpdGhEZXB0aCAoYXJyYXksIHJlc3VsdCwgZGVwdGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgIHZhciB2YWx1ZSA9IGFycmF5W2ldXG5cbiAgICBpZiAoZGVwdGggPiAwICYmIEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBmbGF0dGVuV2l0aERlcHRoKHZhbHVlLCByZXN1bHQsIGRlcHRoIC0gMSlcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LnB1c2godmFsdWUpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZSBmbGF0dGVuIGZ1bmN0aW9uLiBPbWl0dGluZyBkZXB0aCBpcyBzbGlnaHRseSBmYXN0ZXIuXG4gKlxuICogQHBhcmFtICB7QXJyYXl9IGFycmF5XG4gKiBAcGFyYW0gIHtBcnJheX0gcmVzdWx0XG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZmxhdHRlbkZvcmV2ZXIgKGFycmF5LCByZXN1bHQpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgIHZhciB2YWx1ZSA9IGFycmF5W2ldXG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIGZsYXR0ZW5Gb3JldmVyKHZhbHVlLCByZXN1bHQpXG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuLyoqXG4gKiBGbGF0dGVuIGFuIGFycmF5LCB3aXRoIHRoZSBhYmlsaXR5IHRvIGRlZmluZSBhIGRlcHRoLlxuICpcbiAqIEBwYXJhbSAge0FycmF5fSAgYXJyYXlcbiAqIEBwYXJhbSAge051bWJlcn0gZGVwdGhcbiAqIEByZXR1cm4ge0FycmF5fVxuICovXG5mdW5jdGlvbiBhcnJheUZsYXR0ZW4gKGFycmF5LCBkZXB0aCkge1xuICBpZiAoZGVwdGggPT0gbnVsbCkge1xuICAgIHJldHVybiBmbGF0dGVuRm9yZXZlcihhcnJheSwgW10pXG4gIH1cblxuICByZXR1cm4gZmxhdHRlbldpdGhEZXB0aChhcnJheSwgW10sIGRlcHRoKVxufVxuIiwiLyoqXHJcbiAqIEBtb2R1bGUgIGdldC1kb2NcclxuICovXHJcblxyXG52YXIgaGFzRG9tID0gcmVxdWlyZSgnaGFzLWRvbScpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBoYXNEb20oKSA/IGRvY3VtZW50IDogbnVsbDsiLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG5cdFx0JiYgdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJ1xuXHRcdCYmIHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFbGVtZW50ID09PSAnZnVuY3Rpb24nO1xufTtcbiIsIi8qKlxyXG4gKiBAbW9kdWxlIHBhcmVudGhlc2lzXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRwYXJzZTogcmVxdWlyZSgnLi9wYXJzZScpLFxyXG5cdHN0cmluZ2lmeTogcmVxdWlyZSgnLi9zdHJpbmdpZnknKVxyXG59OyIsIi8qKlxyXG4gKiBAbW9kdWxlICBwYXJlbnRoZXNpcy9wYXJzZVxyXG4gKlxyXG4gKiBQYXJzZSBhIHN0cmluZyB3aXRoIHBhcmVudGhlc2lzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIEEgc3RyaW5nIHdpdGggcGFyZW50aGVzaXNcclxuICpcclxuICogQHJldHVybiB7QXJyYXl9IEEgbGlzdCB3aXRoIHBhcnNlZCBwYXJlbnMsIHdoZXJlIDAgaXMgaW5pdGlhbCBzdHJpbmcuXHJcbiAqL1xyXG5cclxuLy9UT0RPOiBpbXBsZW1lbnQgc2VxdWVudGlhbCBwYXJzZXIgb2YgdGhpcyBhbGdvcml0aG0sIGNvbXBhcmUgcGVyZm9ybWFuY2UuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc3RyLCBicmFja2V0KXtcclxuXHQvL3ByZXRlbmQgbm9uLXN0cmluZyBwYXJzZWQgcGVyLXNlXHJcblx0aWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSByZXR1cm4gW3N0cl07XHJcblxyXG5cdHZhciByZXMgPSBbXSwgcHJldlN0cjtcclxuXHJcblx0YnJhY2tldCA9IGJyYWNrZXQgfHwgJygpJztcclxuXHJcblx0Ly9jcmVhdGUgcGFyZW50aGVzaXMgcmVnZXhcclxuXHR2YXIgcFJFID0gbmV3IFJlZ0V4cChbJ1xcXFwnLCBicmFja2V0WzBdLCAnW15cXFxcJywgYnJhY2tldFswXSwgJ1xcXFwnLCBicmFja2V0WzFdLCAnXSpcXFxcJywgYnJhY2tldFsxXV0uam9pbignJykpO1xyXG5cclxuXHRmdW5jdGlvbiByZXBsYWNlVG9rZW4odG9rZW4sIGlkeCwgc3RyKXtcclxuXHRcdC8vc2F2ZSB0b2tlbiB0byByZXNcclxuXHRcdHZhciByZWZJZCA9IHJlcy5wdXNoKHRva2VuLnNsaWNlKDEsLTEpKTtcclxuXHJcblx0XHRyZXR1cm4gJ1xcXFwnICsgcmVmSWQ7XHJcblx0fVxyXG5cclxuXHQvL3JlcGxhY2UgcGFyZW4gdG9rZW5zIHRpbGwgdGhlcmXigJlzIG5vbmVcclxuXHR3aGlsZSAoc3RyICE9IHByZXZTdHIpIHtcclxuXHRcdHByZXZTdHIgPSBzdHI7XHJcblx0XHRzdHIgPSBzdHIucmVwbGFjZShwUkUsIHJlcGxhY2VUb2tlbik7XHJcblx0fVxyXG5cclxuXHQvL3NhdmUgcmVzdWx0aW5nIHN0clxyXG5cdHJlcy51bnNoaWZ0KHN0cik7XHJcblxyXG5cdHJldHVybiByZXM7XHJcbn07IiwiLyoqXHJcbiAqIEBtb2R1bGUgcGFyZW50aGVzaXMvc3RyaW5naWZ5XHJcbiAqXHJcbiAqIFN0cmluZ2lmeSBhbiBhcnJheS9vYmplY3Qgd2l0aCBwYXJlbnRoZXNpcyByZWZlcmVuY2VzXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBhcnIgQW4gYXJyYXkgb3Igb2JqZWN0IHdoZXJlIDAgaXMgaW5pdGlhbCBzdHJpbmdcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICBhbmQgZXZlcnkgb3RoZXIga2V5L3ZhbHVlIGlzIHJlZmVyZW5jZSBpZC92YWx1ZSB0byByZXBsYWNlXHJcbiAqXHJcbiAqIEByZXR1cm4ge3N0cmluZ30gQSBzdHJpbmcgd2l0aCBpbnNlcnRlZCByZWdleCByZWZlcmVuY2VzXHJcbiAqL1xyXG5cclxuLy9GSVhNRTogY2lyY3VsYXIgcmVmZXJlbmNlcyBjYXVzZXMgcmVjdXJzaW9ucyBoZXJlXHJcbi8vVE9ETzogdGhlcmXigJlzIHBvc3NpYmxlIGEgcmVjdXJzaXZlIHZlcnNpb24gb2YgdGhpcyBhbGdvcml0aG0sIHNvIHRlc3QgaXQgJiBjb21wYXJlXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHN0ciwgcmVmcywgYnJhY2tldCl7XHJcblx0dmFyIHByZXZTdHI7XHJcblxyXG5cdC8vcHJldGVuZCBiYWQgc3RyaW5nIHN0cmluZ2lmaWVkIHdpdGggbm8gcGFyZW50aGVzZXNcclxuXHRpZiAoIXN0cikgcmV0dXJuICcnO1xyXG5cclxuXHRpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcclxuXHRcdGJyYWNrZXQgPSByZWZzO1xyXG5cdFx0cmVmcyA9IHN0cjtcclxuXHRcdHN0ciA9IHJlZnNbMF07XHJcblx0fVxyXG5cclxuXHRicmFja2V0ID0gYnJhY2tldCB8fCAnKCknO1xyXG5cclxuXHRmdW5jdGlvbiByZXBsYWNlUmVmKHRva2VuLCBpZHgsIHN0cil7XHJcblx0XHRyZXR1cm4gYnJhY2tldFswXSArIHJlZnNbdG9rZW4uc2xpY2UoMSldICsgYnJhY2tldFsxXTtcclxuXHR9XHJcblxyXG5cdHdoaWxlIChzdHIgIT0gcHJldlN0cikge1xyXG5cdFx0cHJldlN0ciA9IHN0cjtcclxuXHRcdHN0ciA9IHN0ci5yZXBsYWNlKC9cXFxcWzAtOV0rLywgcmVwbGFjZVJlZik7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gc3RyO1xyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL3NsaWNlZCcpO1xuIiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCJ2YXIgdHlwZSA9IHJlcXVpcmUoJ211dHlwZScpO1xyXG52YXIgZXh0ZW5kID0gcmVxdWlyZSgneHRlbmQvbXV0YWJsZScpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBzcGxpdEtleXM7XHJcblxyXG5cclxuLyoqXHJcbiAqIERpc2VudGFuZ2xlIGxpc3RlZCBrZXlzXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogQW4gb2JqZWN0IHdpdGgga2V5IGluY2x1ZGluZyBsaXN0ZWQgZGVjbGFyYXRpb25zXHJcbiAqIEBleGFtcGxlIHsnYSxiLGMnOiAxfVxyXG4gKlxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGRlZXAgV2hldGhlciB0byBmbGF0dGVuIG5lc3RlZCBvYmplY3RzXHJcbiAqXHJcbiAqIEB0b2RvIFRoaW5rIHRvIHByb3ZpZGUgc3VjaCBtZXRob2Qgb24gb2JqZWN0IHByb3RvdHlwZVxyXG4gKlxyXG4gKiBAcmV0dXJuIHtvYmxlY3R9IFNvdXJjZSBzZXQgcGFzc2VkIHtAbGluayBzZXR9XHJcbiAqL1xyXG5mdW5jdGlvbiBzcGxpdEtleXMob2JqLCBkZWVwLCBzZXBhcmF0b3Ipe1xyXG5cdC8vc3dhcCBhcmdzLCBpZiBuZWVkZWRcclxuXHRpZiAoKGRlZXAgfHwgc2VwYXJhdG9yKSAmJiAodHlwZS5pc0Jvb2xlYW4oc2VwYXJhdG9yKSB8fCB0eXBlLmlzU3RyaW5nKGRlZXApIHx8IHR5cGUuaXNSZWdFeHAoZGVlcCkpKSB7XHJcblx0XHR2YXIgdG1wID0gZGVlcDtcclxuXHRcdGRlZXAgPSBzZXBhcmF0b3I7XHJcblx0XHRzZXBhcmF0b3IgPSB0bXA7XHJcblx0fVxyXG5cclxuXHQvL2Vuc3VyZSBzZXBhcmF0b3JcclxuXHRzZXBhcmF0b3IgPSBzZXBhcmF0b3IgPT09IHVuZGVmaW5lZCA/IHNwbGl0S2V5cy5zZXBhcmF0b3IgOiBzZXBhcmF0b3I7XHJcblxyXG5cdHZhciBsaXN0LCB2YWx1ZTtcclxuXHJcblx0Zm9yKHZhciBrZXlzIGluIG9iail7XHJcblx0XHR2YWx1ZSA9IG9ialtrZXlzXTtcclxuXHJcblx0XHRpZiAoZGVlcCAmJiB0eXBlLmlzT2JqZWN0KHZhbHVlKSkgc3BsaXRLZXlzKHZhbHVlLCBkZWVwLCBzZXBhcmF0b3IpO1xyXG5cclxuXHRcdGxpc3QgPSBrZXlzLnNwbGl0KHNlcGFyYXRvcik7XHJcblxyXG5cdFx0aWYgKGxpc3QubGVuZ3RoID4gMSl7XHJcblx0XHRcdGRlbGV0ZSBvYmpba2V5c107XHJcblx0XHRcdGxpc3QuZm9yRWFjaChzZXRLZXkpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0S2V5KGtleSl7XHJcblx0XHQvL2lmIGV4aXN0aW5nIGtleSAtIGV4dGVuZCwgaWYgcG9zc2libGVcclxuXHRcdC8vRklYTUU6IG9ialtrZXldIG1pZ2h0IGJlIG5vdCBhbiBvYmplY3QsIGJ1dCBmdW5jdGlvbiwgZm9yIGV4YW1wbGVcclxuXHRcdGlmICh2YWx1ZSAhPT0gb2JqW2tleV0gJiYgdHlwZS5pc09iamVjdCh2YWx1ZSkgJiYgdHlwZS5pc09iamVjdChvYmpba2V5XSkpIHtcclxuXHRcdFx0b2JqW2tleV0gPSBleHRlbmQoe30sIG9ialtrZXldLCB2YWx1ZSk7XHJcblx0XHR9XHJcblx0XHQvL29yIHJlcGxhY2VcclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRvYmpba2V5XSA9IHZhbHVlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIG9iajtcclxufVxyXG5cclxuXHJcbi8qKiBkZWZhdWx0IHNlcGFyYXRvciAqL1xyXG5zcGxpdEtleXMuc2VwYXJhdG9yID0gL1xccz8sXFxzPy87IiwiLyoqXHJcbiAqIEFwcGVuZCBhbGwgbm90LWV4aXN0aW5nIHByb3BzIHRvIHRoZSBpbml0aWFsIG9iamVjdFxyXG4gKlxyXG4gKiBAcmV0dXJuIHtbdHlwZV19IFtkZXNjcmlwdGlvbl1cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuXHR2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcclxuXHR2YXIgcmVzID0gYXJnc1swXTtcclxuXHR2YXIgbCA9IGFyZ3MubGVuZ3RoO1xyXG5cclxuXHRpZiAodHlwZW9mIHJlcyAhPT0gJ29iamVjdCcpIHRocm93ICBFcnJvcignQmFkIGFyZ3VtZW50Jyk7XHJcblxyXG5cdGZvciAodmFyIGkgPSAxLCBsID0gYXJncy5sZW5ndGgsIG9iajsgaSA8IGw7IGkrKykge1xyXG5cdFx0b2JqID0gYXJnc1tpXTtcclxuXHRcdGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xyXG5cdFx0XHRmb3IgKHZhciBwcm9wIGluIG9iaikge1xyXG5cdFx0XHRcdGlmIChyZXNbcHJvcF0gPT09IHVuZGVmaW5lZCkgcmVzW3Byb3BdID0gb2JqW3Byb3BdO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzO1xyXG59OyIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8qKlxuICogU2ltcGxlIGRyYWdnYWJsZSBjb21wb25lbnRcbiAqXG4gKiBAbW9kdWxlIGRyYWdneVxuICovXG5cblxuLy93b3JrIHdpdGggY3NzXG52YXIgY3NzID0gcmVxdWlyZSgnbXVjc3MvY3NzJyk7XG52YXIgcGFyc2VDU1NWYWx1ZSA9IHJlcXVpcmUoJ211Y3NzL3BhcnNlLXZhbHVlJyk7XG52YXIgc2VsZWN0aW9uID0gcmVxdWlyZSgnbXVjc3Mvc2VsZWN0aW9uJyk7XG52YXIgb2Zmc2V0cyA9IHJlcXVpcmUoJ211Y3NzL29mZnNldCcpO1xudmFyIGdldFRyYW5zbGF0ZSA9IHJlcXVpcmUoJ211Y3NzL3RyYW5zbGF0ZScpO1xudmFyIGludGVyc2VjdCA9IHJlcXVpcmUoJ2ludGVyc2VjdHMnKTtcblxuLy9ldmVudHNcbnZhciBvbiA9IHJlcXVpcmUoJ2VtbXkvb24nKTtcbnZhciBvZmYgPSByZXF1aXJlKCdlbW15L29mZicpO1xudmFyIGVtaXQgPSByZXF1aXJlKCdlbW15L2VtaXQnKTtcbnZhciBFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgZ2V0Q2xpZW50WCA9IHJlcXVpcmUoJ2dldC1jbGllbnQteHknKS54O1xudmFyIGdldENsaWVudFkgPSByZXF1aXJlKCdnZXQtY2xpZW50LXh5JykueTtcblxuLy91dGlsc1xudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpcy1hcnJheScpO1xudmFyIGlzTnVtYmVyID0gcmVxdWlyZSgnbXV0eXBlL2lzLW51bWJlcicpO1xudmFyIGlzU3RyaW5nID0gcmVxdWlyZSgnbXV0eXBlL2lzLXN0cmluZycpO1xudmFyIGlzRm4gPSByZXF1aXJlKCdpcy1mdW5jdGlvbicpO1xudmFyIGRlZmluZVN0YXRlID0gcmVxdWlyZSgnZGVmaW5lLXN0YXRlJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgneHRlbmQvbXV0YWJsZScpO1xudmFyIHJvdW5kID0gcmVxdWlyZSgnbXVtYXRoL3JvdW5kJyk7XG52YXIgYmV0d2VlbiA9IHJlcXVpcmUoJ211bWF0aC9iZXR3ZWVuJyk7XG52YXIgbG9vcCA9IHJlcXVpcmUoJ211bWF0aC9sb29wJyk7XG52YXIgZ2V0VWlkID0gcmVxdWlyZSgnZ2V0LXVpZCcpO1xudmFyIHEgPSByZXF1aXJlKCdxdWVyaWVkJyk7XG5cblxudmFyIHdpbiA9IHdpbmRvdywgZG9jID0gZG9jdW1lbnQsIHJvb3QgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG5cbi8qKlxuICogRHJhZ2dhYmxlIGNvbnRyb2xsZXJzIGFzc29jaWF0ZWQgd2l0aCBlbGVtZW50cy5cbiAqXG4gKiBTdG9yaW5nIHRoZW0gb24gZWxlbWVudHMgaXNcbiAqIC0gbGVhay1wcm9uZSxcbiAqIC0gcG9sbHV0ZXMgZWxlbWVudOKAmXMgbmFtZXNwYWNlLFxuICogLSByZXF1aXJlcyBzb21lIGFydGlmaWNpYWwga2V5IHRvIHN0b3JlLFxuICogLSB1bmFibGUgdG8gcmV0cmlldmUgY29udHJvbGxlciBlYXNpbHkuXG4gKlxuICogVGhhdCBpcyB3aHkgd2Vha21hcC5cbiAqL1xudmFyIGRyYWdnYWJsZUNhY2hlID0gRHJhZ2dhYmxlLmNhY2hlID0gbmV3IFdlYWtNYXA7XG5cblxuXG4vKipcbiAqIE1ha2UgYW4gZWxlbWVudCBkcmFnZ2FibGUuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdGFyZ2V0IEFuIGVsZW1lbnQgd2hldGhlciBpbi9vdXQgb2YgRE9NXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBBbiBkcmFnZ2FibGUgb3B0aW9uc1xuICpcbiAqIEByZXR1cm4ge0hUTUxFbGVtZW50fSBUYXJnZXQgZWxlbWVudFxuICovXG5mdW5jdGlvbiBEcmFnZ2FibGUodGFyZ2V0LCBvcHRpb25zKSB7XG5cdGlmICghKHRoaXMgaW5zdGFuY2VvZiBEcmFnZ2FibGUpKSB7XG5cdFx0cmV0dXJuIG5ldyBEcmFnZ2FibGUodGFyZ2V0LCBvcHRpb25zKTtcblx0fVxuXG5cdHZhciBzZWxmID0gdGhpcztcblxuXHQvL2dldCB1bmlxdWUgaWQgZm9yIGluc3RhbmNlXG5cdC8vbmVlZGVkIHRvIHRyYWNrIGV2ZW50IGJpbmRlcnNcblx0c2VsZi5pZCA9IGdldFVpZCgpO1xuXHRzZWxmLl9ucyA9ICcuZHJhZ2d5XycgKyBzZWxmLmlkO1xuXG5cdC8vc2F2ZSBlbGVtZW50IHBhc3NlZFxuXHRzZWxmLmVsZW1lbnQgPSB0YXJnZXQ7XG5cblx0ZHJhZ2dhYmxlQ2FjaGUuc2V0KHRhcmdldCwgc2VsZik7XG5cblx0Ly9kZWZpbmUgbW9kZSBvZiBkcmFnXG5cdGRlZmluZVN0YXRlKHNlbGYsICdjc3MzJywgc2VsZi5jc3MzKTtcblx0c2VsZi5jc3MzID0gdHJ1ZTtcblxuXHQvL2RlZmluZSBzdGF0ZSBiZWhhdmlvdXJcblx0ZGVmaW5lU3RhdGUoc2VsZiwgJ3N0YXRlJywgc2VsZi5zdGF0ZSk7XG5cblx0Ly9kZWZpbmUgYXhpcyBiZWhhdmlvdXJcblx0ZGVmaW5lU3RhdGUoc2VsZiwgJ2F4aXMnLCBzZWxmLmF4aXMpO1xuXHRzZWxmLmF4aXMgPSBudWxsO1xuXG5cdC8vdGFrZSBvdmVyIG9wdGlvbnNcblx0ZXh0ZW5kKHNlbGYsIG9wdGlvbnMpO1xuXG5cdC8vZGVmaW5lIGhhbmRsZVxuXHRpZiAoIXNlbGYuaGFuZGxlKSB7XG5cdFx0c2VsZi5oYW5kbGUgPSBzZWxmLmVsZW1lbnQ7XG5cdH1cblxuXHQvL3NldHVwIGRyb3BwYWJsZVxuXHRpZiAoc2VsZi5kcm9wcGFibGUpIHtcblx0XHRzZWxmLmluaXREcm9wcGFibGUoKTtcblx0fVxuXG5cdC8vZ28gdG8gaW5pdGlhbCBzdGF0ZVxuXHRzZWxmLnN0YXRlID0gJ2lkbGUnO1xuXG5cdC8vdHJ5IHRvIGNhbGMgb3V0IGJhc2ljIGxpbWl0c1xuXHRzZWxmLnVwZGF0ZSgpO1xufVxuXG5cbi8qKiBJbmhlcml0IGRyYWdnYWJsZSBmcm9tIEVtaXR0ZXIgKi9cbnZhciBwcm90byA9IERyYWdnYWJsZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVtaXR0ZXIucHJvdG90eXBlKTtcblxuXG4vKiogSW5pdCBkcm9wcGFibGUgXCJwbHVnaW5cIiAqL1xucHJvdG8uaW5pdERyb3BwYWJsZSA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdG9uKHNlbGYsICdkcmFnc3RhcnQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdHNlbGYuZHJvcFRhcmdldHMgPSBxLmFsbChzZWxmLmRyb3BwYWJsZSk7XG5cdH0pO1xuXG5cdG9uKHNlbGYsICdkcmFnJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdGlmICghc2VsZi5kcm9wVGFyZ2V0cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZhciBzZWxmUmVjdCA9IG9mZnNldHMoc2VsZi5lbGVtZW50KTtcblxuXHRcdHNlbGYuZHJvcFRhcmdldHMuZm9yRWFjaChmdW5jdGlvbiAoZHJvcFRhcmdldCkge1xuXHRcdFx0dmFyIHRhcmdldFJlY3QgPSBvZmZzZXRzKGRyb3BUYXJnZXQpO1xuXG5cdFx0XHRpZiAoaW50ZXJzZWN0KHNlbGZSZWN0LCB0YXJnZXRSZWN0LCBzZWxmLmRyb3BwYWJsZVRvbGVyYW5jZSkpIHtcblx0XHRcdFx0aWYgKHNlbGYuZHJvcHBhYmxlQ2xhc3MpIHtcblx0XHRcdFx0XHRkcm9wVGFyZ2V0LmNsYXNzTGlzdC5hZGQoc2VsZi5kcm9wcGFibGVDbGFzcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFzZWxmLmRyb3BUYXJnZXQpIHtcblx0XHRcdFx0XHRzZWxmLmRyb3BUYXJnZXQgPSBkcm9wVGFyZ2V0O1xuXG5cdFx0XHRcdFx0ZW1pdChzZWxmLCAnZHJhZ292ZXInLCBkcm9wVGFyZ2V0KTtcblx0XHRcdFx0XHRlbWl0KGRyb3BUYXJnZXQsICdkcmFnb3ZlcicsIHNlbGYpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0aWYgKHNlbGYuZHJvcFRhcmdldCkge1xuXHRcdFx0XHRcdGVtaXQoc2VsZiwgJ2RyYWdvdXQnLCBkcm9wVGFyZ2V0KTtcblx0XHRcdFx0XHRlbWl0KGRyb3BUYXJnZXQsICdkcmFnb3V0Jywgc2VsZik7XG5cblx0XHRcdFx0XHRzZWxmLmRyb3BUYXJnZXQgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChzZWxmLmRyb3BwYWJsZUNsYXNzKSB7XG5cdFx0XHRcdFx0ZHJvcFRhcmdldC5jbGFzc0xpc3QucmVtb3ZlKHNlbGYuZHJvcHBhYmxlQ2xhc3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdG9uKHNlbGYsICdkcmFnZW5kJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdC8vZW1pdCBkcm9wLCBpZiBhbnlcblx0XHRpZiAoc2VsZi5kcm9wVGFyZ2V0KSB7XG5cdFx0XHRlbWl0KHNlbGYuZHJvcFRhcmdldCwgJ2Ryb3AnLCBzZWxmKTtcblx0XHRcdGVtaXQoc2VsZiwgJ2Ryb3AnLCBzZWxmLmRyb3BUYXJnZXQpO1xuXHRcdFx0c2VsZi5kcm9wVGFyZ2V0LmNsYXNzTGlzdC5yZW1vdmUoc2VsZi5kcm9wcGFibGVDbGFzcyk7XG5cdFx0XHRzZWxmLmRyb3BUYXJnZXQgPSBudWxsO1xuXHRcdH1cblx0fSk7XG59O1xuXG5cbi8qKlxuICogRHJhZ2dhYmxlIGJlaGF2aW91clxuICogQGVudW0ge3N0cmluZ31cbiAqIEBkZWZhdWx0IGlzICdpZGxlJ1xuICovXG5wcm90by5zdGF0ZSA9IHtcblx0Ly9pZGxlXG5cdF86IHtcblx0XHRiZWZvcmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0c2VsZi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2RyYWdneS1pZGxlJyk7XG5cblx0XHRcdC8vZW1pdCBkcmFnIGV2dHMgb24gZWxlbWVudFxuXHRcdFx0ZW1pdChzZWxmLmVsZW1lbnQsICdpZGxlJywgbnVsbCwgdHJ1ZSk7XG5cdFx0XHRzZWxmLmVtaXQoJ2lkbGUnKTtcblxuXHRcdFx0c2VsZi5jdXJyZW50SGFuZGxlcyA9IHEuYWxsKHNlbGYuaGFuZGxlKTtcblx0XHRcdHNlbGYuY3VycmVudEhhbmRsZXMuZm9yRWFjaChmdW5jdGlvbiAoaGFuZGxlKSB7XG5cdFx0XHRcdG9uKGhhbmRsZSwgJ21vdXNlZG93bicgKyBzZWxmLl9ucyArICcgdG91Y2hzdGFydCcgKyBzZWxmLl9ucywgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0XHQvL21hcmsgZXZlbnQgYXMgYmVsb25naW5nIHRvIHRoZSBkcmFnZ3lcblx0XHRcdFx0XHRpZiAoIWUuZHJhZ2d5KSB7XG5cdFx0XHRcdFx0XHRlLmRyYWdneSA9IHNlbGY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0Ly9iaW5kIHN0YXJ0IGRyYWcgdG8gZWFjaCBoYW5kbGVcblx0XHRcdG9uKGRvYywgJ21vdXNlZG93bicgKyBzZWxmLl9ucyArICcgdG91Y2hzdGFydCcgKyBzZWxmLl9ucywgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0Ly9pZ25vcmUgbm90IHRoZSBzZWxmIGRyYWdnaWVzXG5cdFx0XHRcdGlmIChlLmRyYWdneSAhPT0gc2VsZikgcmV0dXJuO1xuXG5cdFx0XHRcdC8vaWYgdGFyZ2V0IGlzIGZvY3VzZWQgLSBpZ25vcmUgZHJhZ1xuXHRcdFx0XHRpZiAoZG9jLmFjdGl2ZUVsZW1lbnQgPT09IGUudGFyZ2V0KSByZXR1cm47XG5cblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdC8vbXVsdGl0b3VjaCBoYXMgbXVsdGlwbGUgc3RhcnRzXG5cdFx0XHRcdHNlbGYuc2V0VG91Y2goZSk7XG5cblx0XHRcdFx0Ly91cGRhdGUgbW92ZW1lbnQgcGFyYW1zXG5cdFx0XHRcdHNlbGYudXBkYXRlKGUpO1xuXG5cdFx0XHRcdC8vZ28gdG8gdGhyZXNob2xkIHN0YXRlXG5cdFx0XHRcdHNlbGYuc3RhdGUgPSAndGhyZXNob2xkJztcblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0YWZ0ZXI6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0c2VsZi5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdneS1pZGxlJyk7XG5cblx0XHRcdG9mZihkb2MsIHNlbGYuX25zKTtcblx0XHRcdHNlbGYuY3VycmVudEhhbmRsZXMuZm9yRWFjaChmdW5jdGlvbiAoaGFuZGxlKSB7XG5cdFx0XHRcdG9mZihoYW5kbGUsIHNlbGYuX25zKTtcblx0XHRcdH0pO1xuXHRcdFx0c2VsZi5jdXJyZW50SGFuZGxlcyA9IG51bGw7XG5cblx0XHRcdC8vc2V0IHVwIHRyYWNraW5nXG5cdFx0XHRpZiAoc2VsZi5yZWxlYXNlKSB7XG5cdFx0XHRcdHNlbGYuX3RyYWNraW5nSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRcdHZhciBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0XHRcdHZhciBlbGFwc2VkID0gbm93IC0gc2VsZi50aW1lc3RhbXA7XG5cblx0XHRcdFx0XHQvL2dldCBkZWx0YSBtb3ZlbWVudCBzaW5jZSB0aGUgbGFzdCB0cmFja1xuXHRcdFx0XHRcdHZhciBkWCA9IHNlbGYucHJldlggLSBzZWxmLmZyYW1lWzBdO1xuXHRcdFx0XHRcdHZhciBkWSA9IHNlbGYucHJldlkgLSBzZWxmLmZyYW1lWzFdO1xuXHRcdFx0XHRcdHNlbGYuZnJhbWVbMF0gPSBzZWxmLnByZXZYO1xuXHRcdFx0XHRcdHNlbGYuZnJhbWVbMV0gPSBzZWxmLnByZXZZO1xuXG5cdFx0XHRcdFx0dmFyIGRlbHRhID0gTWF0aC5zcXJ0KGRYICogZFggKyBkWSAqIGRZKTtcblxuXHRcdFx0XHRcdC8vZ2V0IHNwZWVkIGFzIGF2ZXJhZ2Ugb2YgcHJldiBhbmQgY3VycmVudCAocHJldmVudCBkaXYgYnkgemVybylcblx0XHRcdFx0XHR2YXIgdiA9IE1hdGgubWluKHNlbGYudmVsb2NpdHkgKiBkZWx0YSAvICgxICsgZWxhcHNlZCksIHNlbGYubWF4U3BlZWQpO1xuXHRcdFx0XHRcdHNlbGYuc3BlZWQgPSAwLjggKiB2ICsgMC4yICogc2VsZi5zcGVlZDtcblxuXHRcdFx0XHRcdC8vZ2V0IG5ldyBhbmdsZSBhcyBhIGxhc3QgZGlmZlxuXHRcdFx0XHRcdC8vTk9URTogdmVjdG9yIGF2ZXJhZ2UgaXNu4oCZdCB0aGUgc2FtZSBhcyBzcGVlZCBzY2FsYXIgYXZlcmFnZVxuXHRcdFx0XHRcdHNlbGYuYW5nbGUgPSBNYXRoLmF0YW4yKGRZLCBkWCk7XG5cblx0XHRcdFx0XHRzZWxmLmVtaXQoJ3RyYWNrJyk7XG5cblx0XHRcdFx0XHRyZXR1cm4gc2VsZjtcblx0XHRcdFx0fSwgc2VsZi5mcmFtZXJhdGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHR0aHJlc2hvbGQ6IHtcblx0XHRiZWZvcmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0Ly9pZ25vcmUgdGhyZXNob2xkIHN0YXRlLCBpZiB0aHJlc2hvbGQgaXMgbm9uZVxuXHRcdFx0aWYgKGlzWmVyb0FycmF5KHNlbGYudGhyZXNob2xkKSkge1xuXHRcdFx0XHRzZWxmLnN0YXRlID0gJ2RyYWcnO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNlbGYuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnZ3ktdGhyZXNob2xkJyk7XG5cblx0XHRcdC8vZW1pdCBkcmFnIGV2dHMgb24gZWxlbWVudFxuXHRcdFx0c2VsZi5lbWl0KCd0aHJlc2hvbGQnKTtcblx0XHRcdGVtaXQoc2VsZi5lbGVtZW50LCAndGhyZXNob2xkJyk7XG5cblx0XHRcdC8vbGlzdGVuIHRvIGRvYyBtb3ZlbWVudFxuXHRcdFx0b24oZG9jLCAndG91Y2htb3ZlJyArIHNlbGYuX25zICsgJyBtb3VzZW1vdmUnICsgc2VsZi5fbnMsIGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHQvL2NvbXBhcmUgbW92ZW1lbnQgdG8gdGhlIHRocmVzaG9sZFxuXHRcdFx0XHR2YXIgY2xpZW50WCA9IGdldENsaWVudFgoZSwgc2VsZi50b3VjaElkeCk7XG5cdFx0XHRcdHZhciBjbGllbnRZID0gZ2V0Q2xpZW50WShlLCBzZWxmLnRvdWNoSWR4KTtcblx0XHRcdFx0dmFyIGRpZlggPSBzZWxmLnByZXZNb3VzZVggLSBjbGllbnRYO1xuXHRcdFx0XHR2YXIgZGlmWSA9IHNlbGYucHJldk1vdXNlWSAtIGNsaWVudFk7XG5cblx0XHRcdFx0aWYgKGRpZlggPCBzZWxmLnRocmVzaG9sZFswXSB8fCBkaWZYID4gc2VsZi50aHJlc2hvbGRbMl0gfHwgZGlmWSA8IHNlbGYudGhyZXNob2xkWzFdIHx8IGRpZlkgPiBzZWxmLnRocmVzaG9sZFszXSkge1xuXHRcdFx0XHRcdHNlbGYudXBkYXRlKGUpO1xuXHRcdFx0XHRcdHNlbGYuc3RhdGUgPSAnZHJhZyc7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0b24oZG9jLCAnbW91c2V1cCcgKyBzZWxmLl9ucyArICcgdG91Y2hlbmQnICsgc2VsZi5fbnMgKyAnJywgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdC8vZm9yZ2V0IHRvdWNoZXNcblx0XHRcdFx0c2VsZi5yZXNldFRvdWNoKCk7XG5cblx0XHRcdFx0c2VsZi5zdGF0ZSA9ICdpZGxlJztcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRhZnRlcjogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHRzZWxmLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2d5LXRocmVzaG9sZCcpO1xuXG5cdFx0XHRvZmYoZG9jLCBzZWxmLl9ucyk7XG5cdFx0fVxuXHR9LFxuXG5cdGRyYWc6IHtcblx0XHRiZWZvcmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0Ly9yZWR1Y2UgZHJhZ2dpbmcgY2x1dHRlclxuXHRcdFx0c2VsZWN0aW9uLmRpc2FibGUocm9vdCk7XG5cblx0XHRcdHNlbGYuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnZ3ktZHJhZycpO1xuXG5cdFx0XHQvL2VtaXQgZHJhZyBldnRzIG9uIGVsZW1lbnRcblx0XHRcdHNlbGYuZW1pdCgnZHJhZ3N0YXJ0Jyk7XG5cdFx0XHRlbWl0KHNlbGYuZWxlbWVudCwgJ2RyYWdzdGFydCcsIG51bGwsIHRydWUpO1xuXG5cdFx0XHQvL2VtaXQgZHJhZyBldmVudHMgb24gc2VsZlxuXHRcdFx0c2VsZi5lbWl0KCdkcmFnJyk7XG5cdFx0XHRlbWl0KHNlbGYuZWxlbWVudCwgJ2RyYWcnLCBudWxsLCB0cnVlKTtcblxuXHRcdFx0Ly9zdG9wIGRyYWcgb24gbGVhdmVcblx0XHRcdG9uKGRvYywgJ3RvdWNoZW5kJyArIHNlbGYuX25zICsgJyBtb3VzZXVwJyArIHNlbGYuX25zICsgJyBtb3VzZWxlYXZlJyArIHNlbGYuX25zLCBmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0Ly9mb3JnZXQgdG91Y2hlcyAtIGRyYWdlbmQgaXMgY2FsbGVkIG9uY2Vcblx0XHRcdFx0c2VsZi5yZXNldFRvdWNoKCk7XG5cblx0XHRcdFx0Ly9tYW5hZ2UgcmVsZWFzZSBtb3ZlbWVudFxuXHRcdFx0XHRpZiAoc2VsZi5zcGVlZCA+IDEpIHtcblx0XHRcdFx0XHRzZWxmLnN0YXRlID0gJ3JlbGVhc2UnO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0c2VsZi5zdGF0ZSA9ICdpZGxlJztcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vbW92ZSB2aWEgdHJhbnNmb3JtXG5cdFx0XHRvbihkb2MsICd0b3VjaG1vdmUnICsgc2VsZi5fbnMgKyAnIG1vdXNlbW92ZScgKyBzZWxmLl9ucywgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0c2VsZi5kcmFnKGUpO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGFmdGVyOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHRcdC8vZW5hYmxlIGRvY3VtZW50IGludGVyYWN0aXZpdHlcblx0XHRcdHNlbGVjdGlvbi5lbmFibGUocm9vdCk7XG5cblx0XHRcdHNlbGYuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ3ktZHJhZycpO1xuXG5cdFx0XHQvL2VtaXQgZHJhZ2VuZCBvbiBlbGVtZW50LCB0aGlzXG5cdFx0XHRzZWxmLmVtaXQoJ2RyYWdlbmQnKTtcblx0XHRcdGVtaXQoc2VsZi5lbGVtZW50LCAnZHJhZ2VuZCcsIG51bGwsIHRydWUpO1xuXG5cdFx0XHQvL3VuYmluZCBkcmFnIGV2ZW50c1xuXHRcdFx0b2ZmKGRvYywgc2VsZi5fbnMpO1xuXG5cdFx0XHRjbGVhckludGVydmFsKHNlbGYuX3RyYWNraW5nSW50ZXJ2YWwpO1xuXHRcdH1cblx0fSxcblxuXHRyZWxlYXNlOiB7XG5cdFx0YmVmb3JlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHRcdHNlbGYuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnZ3ktcmVsZWFzZScpO1xuXG5cdFx0XHQvL2VudGVyIGFuaW1hdGlvbiBtb2RlXG5cdFx0XHRjbGVhclRpbWVvdXQoc2VsZi5fYW5pbWF0ZVRpbWVvdXQpO1xuXG5cdFx0XHQvL3NldCBwcm9wZXIgdHJhbnNpdGlvblxuXHRcdFx0Y3NzKHNlbGYuZWxlbWVudCwge1xuXHRcdFx0XHQndHJhbnNpdGlvbic6IChzZWxmLnJlbGVhc2VEdXJhdGlvbikgKyAnbXMgZWFzZS1vdXQgJyArIChzZWxmLmNzczMgPyAndHJhbnNmb3JtJyA6ICdwb3NpdGlvbicpXG5cdFx0XHR9KTtcblxuXHRcdFx0Ly9wbGFuIGxlYXZpbmcgYW5pbSBtb2RlXG5cdFx0XHRzZWxmLl9hbmltYXRlVGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZWxmLnN0YXRlID0gJ2lkbGUnO1xuXHRcdFx0fSwgc2VsZi5yZWxlYXNlRHVyYXRpb24pO1xuXG5cblx0XHRcdC8vY2FsYyB0YXJnZXQgcG9pbnQgJiBhbmltYXRlIHRvIGl0XG5cdFx0XHRzZWxmLm1vdmUoXG5cdFx0XHRcdHNlbGYucHJldlggKyBzZWxmLnNwZWVkICogTWF0aC5jb3Moc2VsZi5hbmdsZSksXG5cdFx0XHRcdHNlbGYucHJldlkgKyBzZWxmLnNwZWVkICogTWF0aC5zaW4oc2VsZi5hbmdsZSlcblx0XHRcdCk7XG5cblx0XHRcdHNlbGYuc3BlZWQgPSAwO1xuXHRcdFx0c2VsZi5lbWl0KCd0cmFjaycpO1xuXHRcdH0sXG5cblx0XHRhZnRlcjogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHRzZWxmLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2d5LXJlbGVhc2UnKTtcblxuXHRcdFx0Y3NzKHRoaXMuZWxlbWVudCwge1xuXHRcdFx0XHQndHJhbnNpdGlvbic6IG51bGxcblx0XHRcdH0pO1xuXHRcdH1cblx0fSxcblxuXHRkZXN0cm95OiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdGNsZWFyVGltZW91dChzZWxmLl9hbmltYXRlVGltZW91dCk7XG5cdFx0b2ZmKGRvYywgc2VsZi5fbnMpO1xuXHR9XG59O1xuXG5cbi8qKiBEcmFnIGhhbmRsZXIuIE5lZWRlZCB0byBwcm92aWRlIGRyYWcgbW92ZW1lbnQgZW11bGF0aW9uIHZpYSBBUEkgKi9cbnByb3RvLmRyYWcgPSBmdW5jdGlvbiAoZSkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdHZhciBtb3VzZVggPSBnZXRDbGllbnRYKGUsIHNlbGYudG91Y2hJZHgpLFxuXHRcdG1vdXNlWSA9IGdldENsaWVudFkoZSwgc2VsZi50b3VjaElkeCk7XG5cblx0Ly9jYWxjIG1vdXNlIG1vdmVtZW50IGRpZmZcblx0dmFyIGRpZmZNb3VzZVggPSBtb3VzZVggLSBzZWxmLnByZXZNb3VzZVgsXG5cdFx0ZGlmZk1vdXNlWSA9IG1vdXNlWSAtIHNlbGYucHJldk1vdXNlWTtcblxuXHQvL2Fic29sdXRlIG1vdXNlIGNvb3JkaW5hdGVcblx0dmFyIG1vdXNlQWJzWCA9IG1vdXNlWCArIHdpbi5wYWdlWE9mZnNldCxcblx0XHRtb3VzZUFic1kgPSBtb3VzZVkgKyB3aW4ucGFnZVlPZmZzZXQ7XG5cblx0Ly9jYWxjIHNuaXBlciBvZmZzZXQsIGlmIGFueVxuXHRpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSkge1xuXHRcdHNlbGYuc25pcGVyT2Zmc2V0WCArPSBkaWZmTW91c2VYICogc2VsZi5zbmlwZXJTbG93ZG93bjtcblx0XHRzZWxmLnNuaXBlck9mZnNldFkgKz0gZGlmZk1vdXNlWSAqIHNlbGYuc25pcGVyU2xvd2Rvd247XG5cdH1cblxuXHQvL2NhbGMgbW92ZW1lbnQgeCBhbmQgeVxuXHQvL3Rha2UgYWJzb2x1dGUgcGxhY2luZyBhcyBpdCBpcyB0aGUgb25seSByZWxpYWJsZSB3YXkgKDJ4IHByb3ZlZClcblx0dmFyIHggPSAobW91c2VBYnNYIC0gc2VsZi5pbml0T2Zmc2V0WCkgLSBzZWxmLmlubmVyT2Zmc2V0WCAtIHNlbGYuc25pcGVyT2Zmc2V0WCxcblx0XHR5ID0gKG1vdXNlQWJzWSAtIHNlbGYuaW5pdE9mZnNldFkpIC0gc2VsZi5pbm5lck9mZnNldFkgLSBzZWxmLnNuaXBlck9mZnNldFk7XG5cblx0Ly9tb3ZlIGVsZW1lbnRcblx0c2VsZi5tb3ZlKHgsIHkpO1xuXG5cdC8vc2F2ZSBwcmV2Q2xpZW50WFkgZm9yIGNhbGN1bGF0aW5nIGRpZmZcblx0c2VsZi5wcmV2TW91c2VYID0gbW91c2VYO1xuXHRzZWxmLnByZXZNb3VzZVkgPSBtb3VzZVk7XG5cblx0Ly9lbWl0IGRyYWdcblx0c2VsZi5lbWl0KCdkcmFnJyk7XG5cdGVtaXQoc2VsZi5lbGVtZW50LCAnZHJhZycsIG51bGwsIHRydWUpO1xufTtcblxuXG4vKiogQ3VycmVudCBudW1iZXIgb2YgZHJhZ2dhYmxlIHRvdWNoZXMgKi9cbnZhciB0b3VjaGVzID0gMDtcblxuXG4vKiogTWFuYWdlIHRvdWNoZXMgKi9cbnByb3RvLnNldFRvdWNoID0gZnVuY3Rpb24gKGUpIHtcblx0aWYgKCFlLnRvdWNoZXMgfHwgdGhpcy5pc1RvdWNoZWQoKSkgcmV0dXJuIHRoaXM7XG5cblx0Ly9jdXJyZW50IHRvdWNoIGluZGV4XG5cdHRoaXMudG91Y2hJZHggPSB0b3VjaGVzO1xuXHR0b3VjaGVzKys7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xucHJvdG8ucmVzZXRUb3VjaCA9IGZ1bmN0aW9uICgpIHtcblx0dG91Y2hlcyA9IDA7XG5cdHRoaXMudG91Y2hJZHggPSBudWxsO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbnByb3RvLmlzVG91Y2hlZCA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIHRoaXMudG91Y2hJZHggIT09IG51bGw7XG59O1xuXG5cbi8qKiBJbmRleCB0byBmZXRjaCB0b3VjaCBudW1iZXIgZnJvbSBldmVudCAqL1xucHJvdG8udG91Y2hJZHggPSBudWxsO1xuXG5cbi8qKlxuICogVXBkYXRlIG1vdmVtZW50IGxpbWl0cy5cbiAqIFJlZnJlc2ggc2VsZi53aXRoaW5PZmZzZXRzIGFuZCBzZWxmLmxpbWl0cy5cbiAqL1xucHJvdG8udXBkYXRlID0gZnVuY3Rpb24gKGUpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdC8vaW5pdGlhbCB0cmFuc2xhdGlvbiBvZmZzZXRzXG5cdHZhciBpbml0WFkgPSBzZWxmLmdldENvb3JkcygpO1xuXG5cdC8vY2FsYyBpbml0aWFsIGNvb3Jkc1xuXHRzZWxmLnByZXZYID0gaW5pdFhZWzBdO1xuXHRzZWxmLnByZXZZID0gaW5pdFhZWzFdO1xuXG5cdC8vY29udGFpbmVyIHJlY3QgbWlnaHQgYmUgb3V0c2lkZSB0aGUgdnAsIHNvIGNhbGMgYWJzb2x1dGUgb2Zmc2V0c1xuXHQvL3plcm8tcG9zaXRpb24gb2Zmc2V0cywgd2l0aCB0cmFuc2xhdGlvbigwLDApXG5cdHZhciBzZWxmT2Zmc2V0cyA9IG9mZnNldHMoc2VsZi5lbGVtZW50KTtcblx0c2VsZi5pbml0T2Zmc2V0WCA9IHNlbGZPZmZzZXRzLmxlZnQgLSBzZWxmLnByZXZYO1xuXHRzZWxmLmluaXRPZmZzZXRZID0gc2VsZk9mZnNldHMudG9wIC0gc2VsZi5wcmV2WTtcblx0c2VsZi5vZmZzZXRzID0gc2VsZk9mZnNldHM7XG5cblx0Ly9oYW5kbGUgcGFyZW50IGNhc2Vcblx0dmFyIHdpdGhpbiA9IHNlbGYud2l0aGluO1xuXHRpZiAoc2VsZi53aXRoaW4gPT09ICdwYXJlbnQnKSB7XG5cdFx0d2l0aGluID0gc2VsZi5lbGVtZW50LnBhcmVudE5vZGU7XG5cdH1cblx0d2l0aGluID0gd2l0aGluIHx8IGRvYztcblxuXHQvL2Fic29sdXRlIG9mZnNldHMgb2YgYSBjb250YWluZXJcblx0dmFyIHdpdGhpbk9mZnNldHMgPSBvZmZzZXRzKHdpdGhpbik7XG5cdHNlbGYud2l0aGluT2Zmc2V0cyA9IHdpdGhpbk9mZnNldHM7XG5cblxuXHQvL2NhbGN1bGF0ZSBtb3ZlbWVudCBsaW1pdHMgLSBwaW4gd2lkdGggbWlnaHQgYmUgd2lkZXIgdGhhbiBjb25zdHJhaW50c1xuXHRzZWxmLm92ZXJmbG93WCA9IHNlbGYucGluLndpZHRoIC0gd2l0aGluT2Zmc2V0cy53aWR0aDtcblx0c2VsZi5vdmVyZmxvd1kgPSBzZWxmLnBpbi5oZWlnaHQgLSB3aXRoaW5PZmZzZXRzLmhlaWdodDtcblx0c2VsZi5saW1pdHMgPSB7XG5cdFx0bGVmdDogd2l0aGluT2Zmc2V0cy5sZWZ0IC0gc2VsZi5pbml0T2Zmc2V0WCAtIHNlbGYucGluWzBdIC0gKHNlbGYub3ZlcmZsb3dYIDwgMCA/IDAgOiBzZWxmLm92ZXJmbG93WCksXG5cdFx0dG9wOiB3aXRoaW5PZmZzZXRzLnRvcCAtIHNlbGYuaW5pdE9mZnNldFkgLSBzZWxmLnBpblsxXSAtIChzZWxmLm92ZXJmbG93WSA8IDAgPyAwIDogc2VsZi5vdmVyZmxvd1kpLFxuXHRcdHJpZ2h0OiBzZWxmLm92ZXJmbG93WCA+IDAgPyAwIDogd2l0aGluT2Zmc2V0cy5yaWdodCAtIHNlbGYuaW5pdE9mZnNldFggLSBzZWxmLnBpblsyXSxcblx0XHRib3R0b206IHNlbGYub3ZlcmZsb3dZID4gMCA/IDAgOiB3aXRoaW5PZmZzZXRzLmJvdHRvbSAtIHNlbGYuaW5pdE9mZnNldFkgLSBzZWxmLnBpblszXVxuXHR9O1xuXG5cdC8vcHJlc2V0IGlubmVyIG9mZnNldHNcblx0c2VsZi5pbm5lck9mZnNldFggPSBzZWxmLnBpblswXTtcblx0c2VsZi5pbm5lck9mZnNldFkgPSBzZWxmLnBpblsxXTtcblxuXHR2YXIgc2VsZkNsaWVudFJlY3QgPSBzZWxmLmVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0Ly9pZiBldmVudCBwYXNzZWQgLSB1cGRhdGUgYWNjIHRvIGV2ZW50XG5cdGlmIChlKSB7XG5cdFx0Ly90YWtlIGxhc3QgbW91c2UgcG9zaXRpb24gZnJvbSB0aGUgZXZlbnRcblx0XHRzZWxmLnByZXZNb3VzZVggPSBnZXRDbGllbnRYKGUsIHNlbGYudG91Y2hJZHgpO1xuXHRcdHNlbGYucHJldk1vdXNlWSA9IGdldENsaWVudFkoZSwgc2VsZi50b3VjaElkeCk7XG5cblx0XHQvL2lmIG1vdXNlIGlzIHdpdGhpbiB0aGUgZWxlbWVudCAtIHRha2Ugb2Zmc2V0IG5vcm1hbGx5IGFzIHJlbCBkaXNwbGFjZW1lbnRcblx0XHRzZWxmLmlubmVyT2Zmc2V0WCA9IC1zZWxmQ2xpZW50UmVjdC5sZWZ0ICsgZ2V0Q2xpZW50WChlLCBzZWxmLnRvdWNoSWR4KTtcblx0XHRzZWxmLmlubmVyT2Zmc2V0WSA9IC1zZWxmQ2xpZW50UmVjdC50b3AgKyBnZXRDbGllbnRZKGUsIHNlbGYudG91Y2hJZHgpO1xuXHR9XG5cdC8vaWYgbm8gZXZlbnQgLSBzdXBwb3NlIHBpbi1jZW50ZXJlZCBldmVudFxuXHRlbHNlIHtcblx0XHQvL3Rha2UgbW91c2UgcG9zaXRpb24gJiBpbm5lciBvZmZzZXQgYXMgY2VudGVyIG9mIHBpblxuXHRcdHZhciBwaW5YID0gKHNlbGYucGluWzBdICsgc2VsZi5waW5bMl0gKSAqIDAuNTtcblx0XHR2YXIgcGluWSA9IChzZWxmLnBpblsxXSArIHNlbGYucGluWzNdICkgKiAwLjU7XG5cdFx0c2VsZi5wcmV2TW91c2VYID0gc2VsZkNsaWVudFJlY3QubGVmdCArIHBpblg7XG5cdFx0c2VsZi5wcmV2TW91c2VZID0gc2VsZkNsaWVudFJlY3QudG9wICsgcGluWTtcblx0XHRzZWxmLmlubmVyT2Zmc2V0WCA9IHBpblg7XG5cdFx0c2VsZi5pbm5lck9mZnNldFkgPSBwaW5ZO1xuXHR9XG5cblx0Ly9zZXQgaW5pdGlhbCBraW5ldGljIHByb3BzXG5cdHNlbGYuc3BlZWQgPSAwO1xuXHRzZWxmLmFtcGxpdHVkZSA9IDA7XG5cdHNlbGYuYW5nbGUgPSAwO1xuXHRzZWxmLnRpbWVzdGFtcCA9ICtuZXcgRGF0ZSgpO1xuXHRzZWxmLmZyYW1lID0gW3NlbGYucHJldlgsIHNlbGYucHJldlldO1xuXG5cdC8vc2V0IHNuaXBlciBvZmZzZXRcblx0c2VsZi5zbmlwZXJPZmZzZXRYID0gMDtcblx0c2VsZi5zbmlwZXJPZmZzZXRZID0gMDtcbn07XG5cblxuLyoqXG4gKiBXYXkgb2YgcGxhY2VtZW50OlxuICogLSBwb3NpdGlvbiA9PT0gZmFsc2UgKHNsb3dlciBidXQgbW9yZSBwcmVjaXNlIGFuZCBjcm9zcy1icm93c2VyKVxuICogLSB0cmFuc2xhdGUzZCA9PT0gdHJ1ZSAoZmFzdGVyIGJ1dCBtYXkgY2F1c2UgYmx1cnMgb24gbGludXggc3lzdGVtcylcbiAqL1xucHJvdG8uY3NzMyA9IHtcblx0XzogZnVuY3Rpb24gKCkge1xuXHRcdGNzcyh0aGlzLmVsZW1lbnQsICdwb3NpdGlvbicsICdhYnNvbHV0ZScpO1xuXHRcdHRoaXMuZ2V0Q29vcmRzID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0Ly8gcmV0dXJuIFt0aGlzLmVsZW1lbnQub2Zmc2V0TGVmdCwgdGhpcy5lbGVtZW50Lm9mZnNldFRvcF07XG5cdFx0XHRyZXR1cm4gW3BhcnNlQ1NTVmFsdWUoY3NzKHRoaXMuZWxlbWVudCwnbGVmdCcpKSwgcGFyc2VDU1NWYWx1ZShjc3ModGhpcy5lbGVtZW50LCAndG9wJykpXTtcblx0XHR9O1xuXG5cdFx0dGhpcy5zZXRDb29yZHMgPSBmdW5jdGlvbiAoeCwgeSkge1xuXHRcdFx0Y3NzKHRoaXMuZWxlbWVudCwge1xuXHRcdFx0XHRsZWZ0OiB4LFxuXHRcdFx0XHR0b3A6IHlcblx0XHRcdH0pO1xuXG5cdFx0XHQvL3NhdmUgcHJldiBjb29yZHMgdG8gdXNlIGFzIGEgc3RhcnQgcG9pbnQgbmV4dCB0aW1lXG5cdFx0XHR0aGlzLnByZXZYID0geDtcblx0XHRcdHRoaXMucHJldlkgPSB5O1xuXHRcdH07XG5cdH0sXG5cblx0Ly91bmRlZmluZWQgcGxhY2luZyBpcyB0cmVhdGVkIGFzIHRyYW5zbGF0ZTNkXG5cdHRydWU6IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLmdldENvb3JkcyAgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gZ2V0VHJhbnNsYXRlKHRoaXMuZWxlbWVudCkgfHwgWzAsMF07XG5cdFx0fTtcblxuXHRcdHRoaXMuc2V0Q29vcmRzID0gZnVuY3Rpb24gKHgsIHkpIHtcblx0XHRcdHggPSByb3VuZCh4LCB0aGlzLnByZWNpc2lvbik7XG5cdFx0XHR5ID0gcm91bmQoeSwgdGhpcy5wcmVjaXNpb24pO1xuXG5cdFx0XHRjc3ModGhpcy5lbGVtZW50LCAndHJhbnNmb3JtJywgWyd0cmFuc2xhdGUzZCgnLCB4LCAncHgsJywgeSwgJ3B4LCAwKSddLmpvaW4oJycpKTtcblxuXHRcdFx0Ly9zYXZlIHByZXYgY29vcmRzIHRvIHVzZSBhcyBhIHN0YXJ0IHBvaW50IG5leHQgdGltZVxuXHRcdFx0dGhpcy5wcmV2WCA9IHg7XG5cdFx0XHR0aGlzLnByZXZZID0geTtcblx0XHR9O1xuXHR9XG59O1xuXG5cbi8qKlxuICogUmVzdHJpY3RpbmcgY29udGFpbmVyXG4gKiBAdHlwZSB7RWxlbWVudHxvYmplY3R9XG4gKiBAZGVmYXVsdCBkb2MuZG9jdW1lbnRFbGVtZW50XG4gKi9cbnByb3RvLndpdGhpbiA9IGRvYztcblxuXG4vKiogSGFuZGxlIHRvIGRyYWcgKi9cbnByb3RvLmhhbmRsZTtcblxuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhwcm90bywge1xuXHQvKipcblx0ICogV2hpY2ggYXJlYSBvZiBkcmFnZ2FibGUgc2hvdWxkIG5vdCBiZSBvdXRzaWRlIHRoZSByZXN0cmljdGlvbiBhcmVhLlxuXHQgKiBAdHlwZSB7KEFycmF5fG51bWJlcil9XG5cdCAqIEBkZWZhdWx0IFswLDAsdGhpcy5lbGVtZW50Lm9mZnNldFdpZHRoLCB0aGlzLmVsZW1lbnQub2Zmc2V0SGVpZ2h0XVxuXHQgKi9cblx0cGluOiB7XG5cdFx0c2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChpc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0XHRpZiAodmFsdWUubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRcdFx0dGhpcy5fcGluID0gW3ZhbHVlWzBdLCB2YWx1ZVsxXSwgdmFsdWVbMF0sIHZhbHVlWzFdXTtcblx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZS5sZW5ndGggPT09IDQpIHtcblx0XHRcdFx0XHR0aGlzLl9waW4gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRlbHNlIGlmIChpc051bWJlcih2YWx1ZSkpIHtcblx0XHRcdFx0dGhpcy5fcGluID0gW3ZhbHVlLCB2YWx1ZSwgdmFsdWUsIHZhbHVlXTtcblx0XHRcdH1cblxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3BpbiA9IHZhbHVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2NhbGMgcGluIHBhcmFtc1xuXHRcdFx0dGhpcy5fcGluLndpZHRoID0gdGhpcy5fcGluWzJdIC0gdGhpcy5fcGluWzBdO1xuXHRcdFx0dGhpcy5fcGluLmhlaWdodCA9IHRoaXMuX3BpblszXSAtIHRoaXMuX3BpblsxXTtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAodGhpcy5fcGluKSByZXR1cm4gdGhpcy5fcGluO1xuXG5cdFx0XHQvL3JldHVybmluZyBhdXRvY2FsY3VsYXRlZCBwaW4sIGlmIHByaXZhdGUgcGluIGlzIG5vbmVcblx0XHRcdHZhciBwaW4gPSBbMCwwLCB0aGlzLm9mZnNldHMud2lkdGgsIHRoaXMub2Zmc2V0cy5oZWlnaHRdO1xuXHRcdFx0cGluLndpZHRoID0gdGhpcy5vZmZzZXRzLndpZHRoO1xuXHRcdFx0cGluLmhlaWdodCA9IHRoaXMub2Zmc2V0cy5oZWlnaHQ7XG5cdFx0XHRyZXR1cm4gcGluO1xuXHRcdH1cblx0fSxcblxuXHQvKiogQXZvaWQgaW5pdGlhbCBtb3VzZW1vdmUgKi9cblx0dGhyZXNob2xkOiB7XG5cdFx0c2V0OiBmdW5jdGlvbiAodmFsKSB7XG5cdFx0XHRpZiAoaXNOdW1iZXIodmFsKSkge1xuXHRcdFx0XHR0aGlzLl90aHJlc2hvbGQgPSBbLXZhbCowLjUsIC12YWwqMC41LCB2YWwqMC41LCB2YWwqMC41XTtcblx0XHRcdH0gZWxzZSBpZiAodmFsLmxlbmd0aCA9PT0gMikge1xuXHRcdFx0XHQvL0FycmF5KHcsaClcblx0XHRcdFx0dGhpcy5fdGhyZXNob2xkID0gWy12YWxbMF0qMC41LCAtdmFsWzFdKjAuNSwgdmFsWzBdKjAuNSwgdmFsWzFdKjAuNV07XG5cdFx0XHR9IGVsc2UgaWYgKHZhbC5sZW5ndGggPT09IDQpIHtcblx0XHRcdFx0Ly9BcnJheSh4MSx5MSx4Mix5Milcblx0XHRcdFx0dGhpcy5fdGhyZXNob2xkID0gdmFsO1xuXHRcdFx0fSBlbHNlIGlmIChpc0ZuKHZhbCkpIHtcblx0XHRcdFx0Ly9jdXN0b20gdmFsIGZ1bmNpdG9uXG5cdFx0XHRcdHRoaXMuX3RocmVzaG9sZCA9IHZhbCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fdGhyZXNob2xkID0gWzAsMCwwLDBdO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiB0aGlzLl90aHJlc2hvbGQgfHwgWzAsMCwwLDBdO1xuXHRcdH1cblx0fVxufSk7XG5cblxuXG4vKipcbiAqIEZvciBob3cgbG9uZyB0byByZWxlYXNlIG1vdmVtZW50XG4gKlxuICogQHR5cGUgeyhudW1iZXJ8ZmFsc2UpfVxuICogQGRlZmF1bHQgZmFsc2VcbiAqIEB0b2RvXG4gKi9cbnByb3RvLnJlbGVhc2UgPSBmYWxzZTtcbnByb3RvLnJlbGVhc2VEdXJhdGlvbiA9IDUwMDtcbnByb3RvLnZlbG9jaXR5ID0gMTAwMDtcbnByb3RvLm1heFNwZWVkID0gMjUwO1xucHJvdG8uZnJhbWVyYXRlID0gNTA7XG5cblxuLyoqIFRvIHdoYXQgZXh0ZW50IHJvdW5kIHBvc2l0aW9uICovXG5wcm90by5wcmVjaXNpb24gPSAxO1xuXG5cbi8qKiBEcm9wcGFibGUgcGFyYW1zICovXG5wcm90by5kcm9wcGFibGUgPSBudWxsO1xucHJvdG8uZHJvcHBhYmxlVG9sZXJhbmNlID0gMC41O1xucHJvdG8uZHJvcHBhYmxlQ2xhc3MgPSBudWxsO1xuXG5cbi8qKiBTbG93IGRvd24gbW92ZW1lbnQgYnkgcHJlc3NpbmcgY3RybC9jbWQgKi9cbnByb3RvLnNuaXBlciA9IHRydWU7XG5cblxuLyoqIEhvdyBtdWNoIHRvIHNsb3cgc25pcGVyIGRyYWcgKi9cbnByb3RvLnNuaXBlclNsb3dkb3duID0gLjg1O1xuXG5cbi8qKlxuICogUmVzdHJpY3QgbW92ZW1lbnQgYnkgYXhpc1xuICpcbiAqIEBkZWZhdWx0IHVuZGVmaW5lZFxuICogQGVudW0ge3N0cmluZ31cbiAqL1xucHJvdG8uYXhpcyA9IHtcblx0XzogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMubW92ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG5cdFx0XHR2YXIgbGltaXRzID0gdGhpcy5saW1pdHM7XG5cblx0XHRcdGlmICh0aGlzLnJlcGVhdCkge1xuXHRcdFx0XHR2YXIgdyA9IChsaW1pdHMucmlnaHQgLSBsaW1pdHMubGVmdCk7XG5cdFx0XHRcdHZhciBoID0gKGxpbWl0cy5ib3R0b20gLSBsaW1pdHMudG9wKTtcblx0XHRcdFx0dmFyIG9YID0gLSB0aGlzLmluaXRPZmZzZXRYICsgdGhpcy53aXRoaW5PZmZzZXRzLmxlZnQgLSB0aGlzLnBpblswXSAtIE1hdGgubWF4KDAsIHRoaXMub3ZlcmZsb3dYKTtcblx0XHRcdFx0dmFyIG9ZID0gLSB0aGlzLmluaXRPZmZzZXRZICsgdGhpcy53aXRoaW5PZmZzZXRzLnRvcCAtIHRoaXMucGluWzFdIC0gTWF0aC5tYXgoMCwgdGhpcy5vdmVyZmxvd1kpO1xuXHRcdFx0XHRpZiAodGhpcy5yZXBlYXQgPT09ICd4Jykge1xuXHRcdFx0XHRcdHggPSBsb29wKHggLSBvWCwgdykgKyBvWDtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmICh0aGlzLnJlcGVhdCA9PT0gJ3knKSB7XG5cdFx0XHRcdFx0eSA9IGxvb3AoeSAtIG9ZLCBoKSArIG9ZO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHggPSBsb29wKHggLSBvWCwgdykgKyBvWDtcblx0XHRcdFx0XHR5ID0gbG9vcCh5IC0gb1ksIGgpICsgb1k7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0eCA9IGJldHdlZW4oeCwgbGltaXRzLmxlZnQsIGxpbWl0cy5yaWdodCk7XG5cdFx0XHR5ID0gYmV0d2Vlbih5LCBsaW1pdHMudG9wLCBsaW1pdHMuYm90dG9tKTtcblxuXHRcdFx0dGhpcy5zZXRDb29yZHMoeCwgeSk7XG5cdFx0fTtcblx0fSxcblx0eDogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMubW92ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG5cdFx0XHR2YXIgbGltaXRzID0gdGhpcy5saW1pdHM7XG5cblx0XHRcdGlmICh0aGlzLnJlcGVhdCkge1xuXHRcdFx0XHR2YXIgdyA9IChsaW1pdHMucmlnaHQgLSBsaW1pdHMubGVmdCk7XG5cdFx0XHRcdHZhciBvWCA9IC0gdGhpcy5pbml0T2Zmc2V0WCArIHRoaXMud2l0aGluT2Zmc2V0cy5sZWZ0IC0gdGhpcy5waW5bMF0gLSBNYXRoLm1heCgwLCB0aGlzLm92ZXJmbG93WCk7XG5cdFx0XHRcdHggPSBsb29wKHggLSBvWCwgdykgKyBvWDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHggPSBiZXR3ZWVuKHgsIGxpbWl0cy5sZWZ0LCBsaW1pdHMucmlnaHQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNldENvb3Jkcyh4LCB0aGlzLnByZXZZKTtcblx0XHR9O1xuXHR9LFxuXHR5OiBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5tb3ZlID0gZnVuY3Rpb24gKHgsIHkpIHtcblx0XHRcdHZhciBsaW1pdHMgPSB0aGlzLmxpbWl0cztcblxuXHRcdFx0aWYgKHRoaXMucmVwZWF0KSB7XG5cdFx0XHRcdHZhciBoID0gKGxpbWl0cy5ib3R0b20gLSBsaW1pdHMudG9wKTtcblx0XHRcdFx0dmFyIG9ZID0gLSB0aGlzLmluaXRPZmZzZXRZICsgdGhpcy53aXRoaW5PZmZzZXRzLnRvcCAtIHRoaXMucGluWzFdIC0gTWF0aC5tYXgoMCwgdGhpcy5vdmVyZmxvd1kpO1xuXHRcdFx0XHR5ID0gbG9vcCh5IC0gb1ksIGgpICsgb1k7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR5ID0gYmV0d2Vlbih5LCBsaW1pdHMudG9wLCBsaW1pdHMuYm90dG9tKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zZXRDb29yZHModGhpcy5wcmV2WCwgeSk7XG5cdFx0fTtcblx0fVxufTtcblxuXG4vKiogUmVwZWF0IG1vdmVtZW50IGJ5IG9uZSBvZiBheGlzZXMgKi9cbnByb3RvLnJlcGVhdCA9IGZhbHNlO1xuXG5cbi8qKiBDaGVjayB3aGV0aGVyIGFyciBpcyBmaWxsZWQgd2l0aCB6ZXJvcyAqL1xuZnVuY3Rpb24gaXNaZXJvQXJyYXkoYXJyKSB7XG5cdGlmICghYXJyWzBdICYmICFhcnJbMV0gJiYgIWFyclsyXSAmJiAhYXJyWzNdKSByZXR1cm4gdHJ1ZTtcbn1cblxuXG5cbi8qKiBDbGVhbiBhbGwgbWVtb3J5LXJlbGF0ZWQgdGhpbmdzICovXG5wcm90by5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0c2VsZi5zdGF0ZSA9ICdkZXN0cm95JztcblxuXHRzZWxmLmVsZW1lbnQgPSBudWxsO1xuXHRzZWxmLndpdGhpbiA9IG51bGw7XG59O1xuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBEcmFnZ2FibGU7IiwiLyoqXG4qIEBtb2R1bGUgIHBsYWNlclxuKlxuKiBQbGFjZXMgYW55IGVsZW1lbnQgcmVsYXRpdmUgdG8gYW55IG90aGVyIGVsZW1lbnQgdGhlIHdheSB5b3UgZGVmaW5lXG4qL1xubW9kdWxlLmV4cG9ydHMgPSBwbGFjZTtcblxuLy9UT0RPOiB1c2UgdHJhbnNsYXRlM2QgaW5zdGVhZCBvZiBhYnNvbHV0ZSByZXBvc2l0aW9uaW5nIChvcHRpb24/KVxuLy9UT0RPOiBpbXBsZW1lbnQgYXZvaWRpbmcgc3RyYXRlZ3kgKGdyYXBoaWMgZWRpdG9ycyB1c2UtY2FzZSB3aGVuIHlvdSBuZWVkIHRvIGF2b2lkIHBsYWNpbmcgb3ZlciBzZWxlY3RlZCBlbGVtZW50cylcbi8vVE9ETzogZW5oYW5jZSBiZXN0LXNpZGUgc3RyYXRlZ3k6IGNob29zZSB0aGUgbW9zdCBjbG9zZXN0IHNpZGVcblxudmFyIGNzcyA9IHJlcXVpcmUoJ211Y3NzL2NzcycpO1xudmFyIHNjcm9sbGJhcldpZHRoID0gcmVxdWlyZSgnbXVjc3Mvc2Nyb2xsYmFyJyk7XG52YXIgaXNGaXhlZCA9IHJlcXVpcmUoJ211Y3NzL2lzLWZpeGVkJyk7XG52YXIgb2Zmc2V0cyA9IHJlcXVpcmUoJ211Y3NzL29mZnNldCcpO1xudmFyIGhhc1Njcm9sbCA9IHJlcXVpcmUoJ211Y3NzL2hhcy1zY3JvbGwnKTtcbnZhciBib3JkZXJzID0gcmVxdWlyZSgnbXVjc3MvYm9yZGVyJyk7XG52YXIgbWFyZ2lucyA9IHJlcXVpcmUoJ211Y3NzL21hcmdpbicpO1xudmFyIHEgPSByZXF1aXJlKCdxdWVyaWVkJyk7XG52YXIgc29mdEV4dGVuZCA9IHJlcXVpcmUoJ3NvZnQtZXh0ZW5kJyk7XG52YXIgYWxpZ24gPSByZXF1aXJlKCdhbGlnbmVyJyk7XG5cblxuLy9zaG9ydGN1dHNcbnZhciB3aW4gPSB3aW5kb3csIGRvYyA9IGRvY3VtZW50LCByb290ID0gZG9jLmRvY3VtZW50RWxlbWVudDtcblxuXG4vKipcbiAqIERlZmF1bHQgb3B0aW9uc1xuICovXG52YXIgZGVmYXVsdHMgPSB7XG5cdC8vYW4gZWxlbWVudCB0byBhbGlnbiByZWxhdGl2ZWx5IHRvXG5cdC8vZWxlbWVudFxuXHRyZWxhdGl2ZVRvOiB3aW4sXG5cblx0Ly93aGljaCBzaWRlIHRvIHBsYWNlIGVsZW1lbnRcblx0Ly90L3IvYi9sLCAnY2VudGVyJywgJ21pZGRsZSdcblx0c2lkZTogJ2NlbnRlcicsXG5cblx0LyoqXG5cdCAqIEFuIGFsaWdubWVudCB0cmJsLzAuLjEvY2VudGVyXG5cdCAqXG5cdCAqIEBkZWZhdWx0ICAwXG5cdCAqIEB0eXBlIHsobnVtYmVyfHN0cmluZ3xhcnJheSl9XG5cdCAqL1xuXHRhbGlnbjogMCxcblxuXHQvL3NlbGVjdG9yL25vZGVsaXN0L25vZGUvW3gseV0vd2luZG93L2Z1bmN0aW9uKGVsKVxuXHRhdm9pZDogdW5kZWZpbmVkLFxuXG5cdC8vc2VsZWN0b3Ivbm9kZWxpc3Qvbm9kZS9beCx5XS93aW5kb3cvZnVuY3Rpb24oZWwpXG5cdHdpdGhpbjogdW5kZWZpbmVkLFxuXG5cdC8vbG9vayBmb3IgYmV0dGVyIGJsYWNlbWVudCwgaWYgZG9lc27igJl0IGZpdFxuXHRmaW5kQmVzdFNpZGU6IHRydWVcbn07XG5cblxuLyoqXG4gKiBQbGFjZSBlbGVtZW50IHJlbGF0aXZlIHRvIHRoZSB0YXJnZXQgYnkgdGhlIHNpZGUgJiBwYXJhbXMgcGFzc2VkLlxuICpcbiAqIEBtYWluXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbGVtZW50IEFuIGVsZW1lbnQgdG8gcGxhY2VcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIE9wdGlvbnMgb2JqZWN0XG4gKlxuICogQHJldHVybiB7Ym9vbGVhbn0gVGhlIHJlc3VsdCBvZiBwbGFjZW1lbnQgLSB3aGV0aGVyIHBsYWNpbmcgc3VjY2VlZGVkXG4gKi9cbmZ1bmN0aW9uIHBsYWNlKGVsZW1lbnQsIG9wdGlvbnMpe1xuXHQvL2Vuc3VyZSBlbGVtZW50XG5cdGVsZW1lbnQgPSBxKGVsZW1lbnQpO1xuXG5cdC8vaW5oZXJpdCBkZWZhdWx0c1xuXHRvcHRpb25zID0gc29mdEV4dGVuZChvcHRpb25zLCBkZWZhdWx0cyk7XG5cblx0Ly9lbnN1cmUgZWxlbWVudHNcblx0aWYgKCFvcHRpb25zLnJlbGF0aXZlVG8pIHtcblx0XHRvcHRpb25zLnJlbGF0aXZlVG8gPSBxKG9wdGlvbnMucmVsYXRpdmVUbywgZWxlbWVudCkgfHwgd2luO1xuXHR9XG5cdGlmICghb3B0aW9ucy53aXRoaW4pIHtcblx0XHRvcHRpb25zLndpdGhpbiA9IHEob3B0aW9ucy53aXRoaW4sIGVsZW1lbnQpO1xuXHR9XG5cblx0Ly9UT0RPOiBxdWVyeSBhdm9pZGFibGVzXG5cdC8vIG9wdGlvbnMuYXZvaWQgPSBxKGVsZW1lbnQsIG9wdGlvbnMuYXZvaWQsIHRydWUpO1xuXG5cblx0Ly9zZXQgdGhlIHNhbWUgcG9zaXRpb24gYXMgdGhlIHRhcmdldCBvciBhYnNvbHV0ZVxuXHRpZiAob3B0aW9ucy5yZWxhdGl2ZVRvIGluc3RhbmNlb2YgRWxlbWVudCAmJiBpc0ZpeGVkKG9wdGlvbnMucmVsYXRpdmVUbykpIHtcblx0XHRlbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcblx0fVxuXHRlbHNlIHtcblx0XHRlbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0fVxuXG5cblx0Ly9lbHNlIHBsYWNlIGFjY29yZGluZyB0byB0aGUgcG9zaXRpb25cblx0dmFyIHNpZGUgPSBvcHRpb25zLmZpbmRCZXN0U2lkZSAmJiBvcHRpb25zLndpdGhpbiA/IGdldEJlc3RTaWRlKGVsZW1lbnQsIG9wdGlvbnMpIDogb3B0aW9ucy5zaWRlO1xuXG5cdHBsYWNlQnlTaWRlW3NpZGVdKGVsZW1lbnQsIG9wdGlvbnMpO1xuXG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59XG5cblxuLyoqXG4gKiBTZXQgb2YgcG9zaXRpb25pbmcgZnVuY3Rpb25zXG4gKiBAZW51bSB7RnVuY3Rpb259XG4gKiBAcGFyYW0ge0VsZW1lbnR9IHBsYWNlZSBFbGVtZW50IHRvIHBsYWNlXG4gKiBAcGFyYW0ge29iamVjdH0gdGFyZ2V0IE9mZnNldHMgcmVjdGFuZ2xlIChhYnNvbHV0ZSBwb3NpdGlvbilcbiAqIEBwYXJhbSB7b2JqZWN0fSBpZ25vcmUgU2lkZXMgdG8gYXZvaWQgZW50ZXJpbmcgKHVzdWFsbHksIGFscmVhZHkgdHJpZWQpXG4gKi9cbnZhciBwbGFjZUJ5U2lkZSA9IHtcblx0Y2VudGVyOiBmdW5jdGlvbihwbGFjZWUsIG9wdHMpe1xuXHRcdC8vIGNvbnNvbGUubG9nKCdwbGFjZSBjZW50ZXInKTtcblxuXHRcdC8vZ2V0IHJlbGF0aXZlVG8gJiB3aXRoaW4gcmVjdGFuZ2xlc1xuXHRcdHZhciBwbGFjZXJSZWN0ID0gb2Zmc2V0cyhvcHRzLnJlbGF0aXZlVG8pO1xuXHRcdHZhciBwYXJlbnRSZWN0ID0gZ2V0UGFyZW50UmVjdChwbGFjZWUub2Zmc2V0UGFyZW50KTtcblxuXG5cdFx0Ly9hbGlnbiBjZW50ZXJlZFxuXHRcdHZhciBhbCA9IG9wdHMuYWxpZ247XG5cdFx0aWYgKCEoYWwgaW5zdGFuY2VvZiBBcnJheSkpIHtcblx0XHRcdGlmICgvLC8udGVzdChhbCkpIHtcblx0XHRcdFx0YWwgPSBhbC5zcGxpdCgvXFxzKixcXHMqLyk7XG5cdFx0XHRcdGFsID0gW3BhcnNlRmxvYXQoYWxbMF0pLCBwYXJzZUZsb2F0KGFsWzFdKV07XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmICgvdG9wfGJvdHRvbXxtaWRkbGUvLnRlc3QoYWwpKSBhbCA9IFsuNSwgYWxdO1xuXHRcdFx0ZWxzZSBhbCA9IFthbCwgLjVdO1xuXHRcdH1cblxuXHRcdGFsaWduKFtvcHRzLnJlbGF0aXZlVG8sIHBsYWNlZV0sIGFsKTtcblxuXG5cdFx0Ly9hcHBseSBsaW1pdHNcblx0XHRpZiAob3B0cy53aXRoaW4pIHtcblx0XHRcdHRyaW1Qb3NpdGlvblkocGxhY2VlLCBvcHRzLndpdGhpbiwgcGFyZW50UmVjdCk7XG5cdFx0XHR0cmltUG9zaXRpb25YKHBsYWNlZSwgb3B0cy53aXRoaW4sIHBhcmVudFJlY3QpO1xuXHRcdH1cblxuXG5cdFx0Ly91cGQgb3B0aW9uc1xuXHRcdG9wdHMuc2lkZSA9ICdjZW50ZXInO1xuXHR9LFxuXG5cdGxlZnQ6IGZ1bmN0aW9uKHBsYWNlZSwgb3B0cyl7XG5cdFx0Ly8gY29uc29sZS5sb2coJ3BsYWNlIGxlZnQnKVxuXG5cdFx0dmFyIHBhcmVudCA9IHBsYWNlZS5vZmZzZXRQYXJlbnQ7XG5cblx0XHR2YXIgcGxhY2VyUmVjdCA9IG9mZnNldHMob3B0cy5yZWxhdGl2ZVRvKTtcblx0XHR2YXIgcGFyZW50UmVjdCA9IGdldFBhcmVudFJlY3QocGFyZW50KTtcblxuXHRcdC8vY29ycmVjdCBib3JkZXJzXG5cdFx0Y29udHJhY3RSZWN0KHBhcmVudFJlY3QsIGJvcmRlcnMocGFyZW50KSk7XG5cblxuXHRcdC8vcGxhY2UgbGVmdCAoc2V0IGNzcyByaWdodCBiZWNhdXNlIHBsYWNlZSB3aWR0aCBtYXkgY2hhbmdlKVxuXHRcdGNzcyhwbGFjZWUsIHtcblx0XHRcdHJpZ2h0OiBwYXJlbnRSZWN0LnJpZ2h0IC0gcGxhY2VyUmVjdC5sZWZ0LFxuXHRcdFx0bGVmdDogJ2F1dG8nXG5cdFx0fSk7XG5cblx0XHQvL3BsYWNlIHZlcnRpY2FsbHkgcHJvcGVybHlcblx0XHRhbGlnbihbb3B0cy5yZWxhdGl2ZVRvLCBwbGFjZWVdLCBbbnVsbCwgb3B0cy5hbGlnbl0pO1xuXG5cblx0XHQvL2FwcGx5IGxpbWl0c1xuXHRcdGlmIChvcHRzLndpdGhpbikgdHJpbVBvc2l0aW9uWShwbGFjZWUsIG9wdHMud2l0aGluLCBwYXJlbnRSZWN0KTtcblxuXG5cdFx0Ly91cGQgb3B0aW9uc1xuXHRcdG9wdHMuc2lkZSA9ICdsZWZ0Jztcblx0fSxcblxuXHRyaWdodDogZnVuY3Rpb24gKHBsYWNlZSwgb3B0cykge1xuXHRcdC8vIGNvbnNvbGUubG9nKCdwbGFjZSByaWdodCcpXG5cblxuXHRcdC8vZ2V0IHJlbGF0aXZlVG8gJiB3aXRoaW4gcmVjdGFuZ2xlc1xuXHRcdHZhciBwbGFjZXJSZWN0ID0gb2Zmc2V0cyhvcHRzLnJlbGF0aXZlVG8pO1xuXHRcdHZhciBwYXJlbnRSZWN0ID0gZ2V0UGFyZW50UmVjdChwbGFjZWUub2Zmc2V0UGFyZW50KTtcblxuXHRcdC8vY29ycmVjdCBib3JkZXJzXG5cdFx0Y29udHJhY3RSZWN0KHBhcmVudFJlY3QsIGJvcmRlcnMocGxhY2VlLm9mZnNldFBhcmVudCkpO1xuXG5cblx0XHQvL3BsYWNlIHJpZ2h0XG5cdFx0Y3NzKHBsYWNlZSwge1xuXHRcdFx0bGVmdDogcGxhY2VyUmVjdC5yaWdodCAtIHBhcmVudFJlY3QubGVmdCxcblx0XHRcdHJpZ2h0OiAnYXV0bycsXG5cdFx0fSk7XG5cblxuXHRcdC8vcGxhY2UgdmVydGljYWxseSBwcm9wZXJseVxuXHRcdGFsaWduKFtvcHRzLnJlbGF0aXZlVG8sIHBsYWNlZV0sIFtudWxsLCBvcHRzLmFsaWduXSk7XG5cblxuXHRcdC8vYXBwbHkgbGltaXRzXG5cdFx0aWYgKG9wdHMud2l0aGluKSB0cmltUG9zaXRpb25ZKHBsYWNlZSwgb3B0cy53aXRoaW4sIHBhcmVudFJlY3QpO1xuXG5cblx0XHQvL3VwZCBvcHRpb25zXG5cdFx0b3B0cy5zaWRlID0gJ3JpZ2h0Jztcblx0fSxcblxuXHR0b3A6IGZ1bmN0aW9uKHBsYWNlZSwgb3B0cyl7XG5cdFx0Ly8gY29uc29sZS5sb2coJ3BsYWNlIHRvcCcpO1xuXG5cdFx0dmFyIHBhcmVudCA9IHBsYWNlZS5vZmZzZXRQYXJlbnQ7XG5cdFx0dmFyIHBsYWNlclJlY3QgPSBvZmZzZXRzKG9wdHMucmVsYXRpdmVUbyk7XG5cdFx0dmFyIHBhcmVudFJlY3QgPSBnZXRQYXJlbnRSZWN0KHBsYWNlZS5vZmZzZXRQYXJlbnQpO1xuXG5cblx0XHQvL2NvcnJlY3QgYm9yZGVyc1xuXHRcdGNvbnRyYWN0UmVjdChwYXJlbnRSZWN0LCBib3JkZXJzKHBhcmVudCkpO1xuXG5cblx0XHQvL3BsYWNlIHZlcnRpY2FsbHkgdG9wLXNpZGVcblx0XHRjc3MocGxhY2VlLCB7XG5cdFx0XHRib3R0b206IHBhcmVudFJlY3QuYm90dG9tIC0gcGxhY2VyUmVjdC50b3AsXG5cdFx0XHR0b3A6ICdhdXRvJ1xuXHRcdH0pO1xuXG5cblx0XHQvL3BsYWNlIGhvcml6b250YWxseSBwcm9wZXJseVxuXHRcdGFsaWduKFtvcHRzLnJlbGF0aXZlVG8sIHBsYWNlZV0sIFtvcHRzLmFsaWduXSk7XG5cblxuXHRcdC8vYXBwbHkgbGltaXRzXG5cdFx0aWYgKG9wdHMud2l0aGluKSB0cmltUG9zaXRpb25YKHBsYWNlZSwgb3B0cy53aXRoaW4sIHBhcmVudFJlY3QpO1xuXG5cblx0XHQvL3VwZCBvcHRpb25zXG5cdFx0b3B0cy5zaWRlID0gJ3RvcCc7XG5cdH0sXG5cblx0Ym90dG9tOiBmdW5jdGlvbihwbGFjZWUsIG9wdHMpe1xuXHRcdC8vIGNvbnNvbGUubG9nKCdwbGFjZSBib3R0b20nKTtcblxuXHRcdC8vZ2V0IHJlbGF0aXZlVG8gJiB3aXRoaW4gcmVjdGFuZ2xlc1xuXHRcdHZhciBwbGFjZXJSZWN0ID0gb2Zmc2V0cyhvcHRzLnJlbGF0aXZlVG8pO1xuXHRcdHZhciBwYXJlbnRSZWN0ID0gZ2V0UGFyZW50UmVjdChwbGFjZWUub2Zmc2V0UGFyZW50KTtcblxuXG5cdFx0Ly9jb3JyZWN0IGJvcmRlcnNcblx0XHRjb250cmFjdFJlY3QocGFyZW50UmVjdCwgYm9yZGVycyhwbGFjZWUub2Zmc2V0UGFyZW50KSk7XG5cblxuXHRcdC8vcGxhY2UgYm90dG9tXG5cdFx0Y3NzKHBsYWNlZSwge1xuXHRcdFx0dG9wOiBwbGFjZXJSZWN0LmJvdHRvbSAtIHBhcmVudFJlY3QudG9wLFxuXHRcdFx0Ym90dG9tOiAnYXV0bycsXG5cdFx0fSk7XG5cblxuXHRcdC8vcGxhY2UgaG9yaXpvbnRhbGx5IHByb3Blcmx5XG5cdFx0YWxpZ24oW29wdHMucmVsYXRpdmVUbywgcGxhY2VlXSwgW29wdHMuYWxpZ25dKTtcblxuXG5cdFx0Ly9hcHBseSBsaW1pdHNcblx0XHRpZiAob3B0cy53aXRoaW4pIHRyaW1Qb3NpdGlvblgocGxhY2VlLCBvcHRzLndpdGhpbiwgcGFyZW50UmVjdCk7XG5cblxuXHRcdC8vdXBkIG9wdGlvbnNcblx0XHRvcHRzLnNpZGUgPSAnYm90dG9tJztcblx0fVxufTtcblxuXG4vKipcbiAqIEZpbmQgdGhlIG1vc3QgYXBwcm9wcmlhdGUgc2lkZSB0byBwbGFjZSBlbGVtZW50XG4gKi9cbmZ1bmN0aW9uIGdldEJlc3RTaWRlIChwbGFjZWUsIG9wdHMpIHtcblx0dmFyIGluaXRTaWRlID0gb3B0cy5zaWRlO1xuXG5cdHZhciB3aXRoaW5SZWN0ID0gb2Zmc2V0cyhvcHRzLndpdGhpbiksXG5cdFx0cGxhY2VlUmVjdCA9IG9mZnNldHMocGxhY2VlKSxcblx0XHRwbGFjZXJSZWN0ID0gb2Zmc2V0cyhvcHRzLnJlbGF0aXZlVG8pO1xuXG5cdGNvbnRyYWN0UmVjdCh3aXRoaW5SZWN0LCBib3JkZXJzKG9wdHMud2l0aGluKSk7XG5cblx0dmFyIHBsYWNlZU1hcmdpbnMgPSBtYXJnaW5zKHBsYWNlZSk7XG5cblx0Ly9yZWN0IG9mIFwiaG90XCIgYXJlYSAoYXZhaWxhYmxlIHNwYWNlcyBmcm9tIHBsYWNlciB0byBjb250YWluZXIpXG5cdHZhciBob3RSZWN0ID0ge1xuXHRcdHRvcDogcGxhY2VyUmVjdC50b3AgLSB3aXRoaW5SZWN0LnRvcCxcblx0XHRib3R0b206IHdpdGhpblJlY3QuYm90dG9tIC0gcGxhY2VyUmVjdC5ib3R0b20sXG5cdFx0bGVmdDogcGxhY2VyUmVjdC5sZWZ0IC0gd2l0aGluUmVjdC5sZWZ0LFxuXHRcdHJpZ2h0OiB3aXRoaW5SZWN0LnJpZ2h0IC0gcGxhY2VyUmVjdC5yaWdodFxuXHR9O1xuXG5cdC8vcmVjdCBvZiBhdmFpbGFibGUgc3BhY2VzXG5cdHZhciBhdmFpbFNwYWNlID0ge1xuXHRcdHRvcDogaG90UmVjdC50b3AgLSBwbGFjZWVSZWN0LmhlaWdodCAtIHBsYWNlZU1hcmdpbnMudG9wIC0gcGxhY2VlTWFyZ2lucy5ib3R0b20sXG5cdFx0Ym90dG9tOiBob3RSZWN0LmJvdHRvbSAtIHBsYWNlZVJlY3QuaGVpZ2h0IC0gcGxhY2VlTWFyZ2lucy50b3AgLSBwbGFjZWVNYXJnaW5zLmJvdHRvbSxcblx0XHRsZWZ0OiBob3RSZWN0LmxlZnQgLSBwbGFjZWVSZWN0LndpZHRoIC0gcGxhY2VlTWFyZ2lucy5sZWZ0IC0gcGxhY2VlTWFyZ2lucy5yaWdodCxcblx0XHRyaWdodDogaG90UmVjdC5yaWdodCAtIHBsYWNlZVJlY3Qud2lkdGggLSBwbGFjZWVNYXJnaW5zLmxlZnQgLSBwbGFjZWVNYXJnaW5zLnJpZ2h0XG5cdH07XG5cblx0Ly9UT0RPOlxuXHQvL2lmIGF0IGxlYXN0IG9uZSBhdm9pZGFibGUgZWwgd2l0aGluIHRoZSBob3QgYXJlYVxuXHQvL2dldCBzcGVjaWZpYyBsaW1pdHMgZm9yIHRoZSBzaWRlIChiZXNpZGVzIHRoZSBgd2l0aGluYCByZXN0cmljdG9yKVxuXHQvL2FuZCBpZiBsaW1pdHMgYXJlIHRvbyB0aWdodCwgaWdub3JlIHRoZSBzaWRlXG5cblxuXHQvL2lmIGZpdHMgaW5pdGlhbCBzaWRlLCByZXR1cm4gaXRcblx0aWYgKGF2YWlsU3BhY2VbaW5pdFNpZGVdID49IDApIHJldHVybiBpbml0U2lkZTtcblxuXHQvL2lmIG5vbmUgb2Ygc2lkZXMgZml0LCByZXR1cm4gY2VudGVyXG5cdGlmIChhdmFpbFNwYWNlLnRvcCA8IDAgJiYgYXZhaWxTcGFjZS5ib3R0b20gPCAwICYmIGF2YWlsU3BhY2UubGVmdCA8IDAgJiYgYXZhaWxTcGFjZS5yaWdodCA8IDApIHJldHVybiAnY2VudGVyJztcblxuXHQvL2Vsc2UgZmluZCB0aGUgbW9zdCBmcmVlIHNpZGUgd2l0aGluIG90aGVyc1xuXHR2YXIgbWF4U2lkZSA9IGluaXRTaWRlLCBtYXhTcGFjZSA9IGF2YWlsU3BhY2VbbWF4U2lkZV07XG5cdGZvciAodmFyIHNpZGUgaW4gYXZhaWxTcGFjZSkge1xuXHRcdGlmIChhdmFpbFNwYWNlW3NpZGVdID4gbWF4U3BhY2UpIHtcblx0XHRcdG1heFNpZGUgPSBzaWRlOyBtYXhTcGFjZSA9IGF2YWlsU3BhY2VbbWF4U2lkZV07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG1heFNpZGU7XG59XG5cblxuXG4vKiogY29udHJhY3QgcmVjdCAxIHdpdGggcmVjdCAyICovXG5mdW5jdGlvbiBjb250cmFjdFJlY3QocmVjdCwgcmVjdDIpe1xuXHQvL2NvcnJlY3QgcmVjdDJcblx0cmVjdC5sZWZ0ICs9IHJlY3QyLmxlZnQ7XG5cdHJlY3QucmlnaHQgLT0gcmVjdDIucmlnaHQ7XG5cdHJlY3QuYm90dG9tIC09IHJlY3QyLmJvdHRvbTtcblx0cmVjdC50b3AgKz0gcmVjdDIudG9wO1xuXHRyZXR1cm4gcmVjdDtcbn1cblxuXG4vKiogYXBwbHkgbGltaXRzIHJlY3RhbmdsZSB0byB0aGUgcG9zaXRpb24gb2YgYW4gZWxlbWVudCAqL1xuZnVuY3Rpb24gdHJpbVBvc2l0aW9uWShwbGFjZWUsIHdpdGhpbiwgcGFyZW50UmVjdCl7XG5cdHZhciBwbGFjZWVSZWN0ID0gb2Zmc2V0cyhwbGFjZWUpO1xuXHR2YXIgd2l0aGluUmVjdCA9IG9mZnNldHMod2l0aGluKTtcblx0dmFyIHBsYWNlZU1hcmdpbnMgPSBtYXJnaW5zKHBsYWNlZSk7XG5cblx0Y29udHJhY3RSZWN0KHdpdGhpblJlY3QsIGJvcmRlcnMod2l0aGluKSk7XG5cblx0aWYgKHdpdGhpblJlY3QudG9wID4gcGxhY2VlUmVjdC50b3AgLSBwbGFjZWVNYXJnaW5zLnRvcCkge1xuXHRcdGNzcyhwbGFjZWUsIHtcblx0XHRcdHRvcDogd2l0aGluUmVjdC50b3AgLSBwYXJlbnRSZWN0LnRvcCxcblx0XHRcdGJvdHRvbTogJ2F1dG8nXG5cdFx0fSk7XG5cdH1cblxuXHRlbHNlIGlmICh3aXRoaW5SZWN0LmJvdHRvbSA8IHBsYWNlZVJlY3QuYm90dG9tICsgcGxhY2VlTWFyZ2lucy5ib3R0b20pIHtcblx0XHRjc3MocGxhY2VlLCB7XG5cdFx0XHR0b3A6ICdhdXRvJyxcblx0XHRcdGJvdHRvbTogcGFyZW50UmVjdC5ib3R0b20gLSB3aXRoaW5SZWN0LmJvdHRvbVxuXHRcdH0pO1xuXHR9XG59XG5mdW5jdGlvbiB0cmltUG9zaXRpb25YKHBsYWNlZSwgd2l0aGluLCBwYXJlbnRSZWN0KXtcblx0dmFyIHBsYWNlZVJlY3QgPSBvZmZzZXRzKHBsYWNlZSk7XG5cdHZhciB3aXRoaW5SZWN0ID0gb2Zmc2V0cyh3aXRoaW4pO1xuXHR2YXIgcGxhY2VlTWFyZ2lucyA9IG1hcmdpbnMocGxhY2VlKTtcblxuXHRjb250cmFjdFJlY3Qod2l0aGluUmVjdCwgYm9yZGVycyh3aXRoaW4pKTtcblxuXHRpZiAod2l0aGluUmVjdC5sZWZ0ID4gcGxhY2VlUmVjdC5sZWZ0IC0gcGxhY2VlTWFyZ2lucy5sZWZ0KSB7XG5cdFx0Y3NzKHBsYWNlZSwge1xuXHRcdFx0bGVmdDogd2l0aGluUmVjdC5sZWZ0IC0gcGFyZW50UmVjdC5sZWZ0LFxuXHRcdFx0cmlnaHQ6ICdhdXRvJ1xuXHRcdH0pO1xuXHR9XG5cblx0ZWxzZSBpZiAod2l0aGluUmVjdC5yaWdodCA8IHBsYWNlZVJlY3QucmlnaHQgKyBwbGFjZWVNYXJnaW5zLnJpZ2h0KSB7XG5cdFx0Y3NzKHBsYWNlZSwge1xuXHRcdFx0bGVmdDogJ2F1dG8nLFxuXHRcdFx0cmlnaHQ6IHBhcmVudFJlY3QucmlnaHQgLSB3aXRoaW5SZWN0LnJpZ2h0XG5cdFx0fSk7XG5cdH1cbn1cblxuXG4vKipcbiAqIFJldHVybiBvZmZzZXRzIHJlY3RhbmdsZSBmb3IgYW4gZWxlbWVudC9hcnJheS9hbnkgdGFyZ2V0IHBhc3NlZC5cbiAqIEkuIGUuIG5vcm1hbGl6ZSBvZmZzZXRzIHJlY3RcbiAqXG4gKiBAcGFyYW0geyp9IGVsIEVsZW1lbnQsIHNlbGVjdG9yLCB3aW5kb3csIGRvY3VtZW50LCByZWN0LCBhcnJheVxuICpcbiAqIEByZXR1cm4ge29iamVjdH0gT2Zmc2V0cyByZWN0YW5nbGVcbiAqL1xuZnVuY3Rpb24gZ2V0UGFyZW50UmVjdCh0YXJnZXQpe1xuXHR2YXIgcmVjdDtcblxuXHQvL2hhbmRsZSBzcGVjaWFsIHN0YXRpYyBib2R5IGNhc2Vcblx0aWYgKHRhcmdldCA9PT0gZG9jLmJvZHkgfHwgdGFyZ2V0ID09PSByb290ICYmIGdldENvbXB1dGVkU3R5bGUodGFyZ2V0KS5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpe1xuXHRcdHJlY3QgPSB7XG5cdFx0XHRsZWZ0OiAwLFxuXHRcdFx0cmlnaHQ6IHdpbi5pbm5lcldpZHRoIC0gKGhhc1Njcm9sbC55KCkgPyBzY3JvbGxiYXJXaWR0aCA6IDApLFxuXHRcdFx0d2lkdGg6IHdpbi5pbm5lcldpZHRoLFxuXHRcdFx0dG9wOiAwLFxuXHRcdFx0Ym90dG9tOiB3aW4uaW5uZXJIZWlnaHQgLSAoaGFzU2Nyb2xsLngoKSA/IHNjcm9sbGJhcldpZHRoIDogMCksXG5cdFx0XHRoZWlnaHQ6IHdpbi5pbm5lckhlaWdodFxuXHRcdH07XG5cdH1cblx0ZWxzZSB7XG5cdFx0cmVjdCA9IG9mZnNldHModGFyZ2V0KTtcblx0fVxuXG5cdHJldHVybiByZWN0O1xufSIsIi8qKlxyXG4gKiBAbW9kdWxlICBxdWVyaWVkXHJcbiAqL1xyXG5cclxuXHJcbnZhciBkb2MgPSByZXF1aXJlKCdnZXQtZG9jJyk7XHJcbnZhciBxID0gcmVxdWlyZSgnLi9saWIvJyk7XHJcblxyXG5cclxuLyoqXHJcbiAqIERldGVjdCB1bnN1cHBvcnRlZCBjc3M0IGZlYXR1cmVzLCBwb2x5ZmlsbCB0aGVtXHJcbiAqL1xyXG5cclxuLy9kZXRlY3QgYDpzY29wZWBcclxudHJ5IHtcclxuXHRkb2MucXVlcnlTZWxlY3RvcignOnNjb3BlJyk7XHJcbn1cclxuY2F0Y2ggKGUpIHtcclxuXHRxLnJlZ2lzdGVyRmlsdGVyKCdzY29wZScsIHJlcXVpcmUoJy4vbGliL3BzZXVkb3Mvc2NvcGUnKSk7XHJcbn1cclxuXHJcblxyXG4vL2RldGVjdCBgOmhhc2BcclxudHJ5IHtcclxuXHRkb2MucXVlcnlTZWxlY3RvcignOmhhcycpO1xyXG59XHJcbmNhdGNoIChlKSB7XHJcblx0cS5yZWdpc3RlckZpbHRlcignaGFzJywgcmVxdWlyZSgnLi9saWIvcHNldWRvcy9oYXMnKSk7XHJcblxyXG5cdC8vcG9seWZpbGxlZCA6aGFzIHJlcXVpcmVzIGFydGlmaWNpYWwgOm5vdCB0byBtYWtlIGA6bm90KDpoYXMoLi4uKSlgLlxyXG5cdHEucmVnaXN0ZXJGaWx0ZXIoJ25vdCcsIHJlcXVpcmUoJy4vbGliL3BzZXVkb3Mvbm90JykpO1xyXG59XHJcblxyXG5cclxuLy9kZXRlY3QgYDpyb290YFxyXG50cnkge1xyXG5cdGRvYy5xdWVyeVNlbGVjdG9yKCc6cm9vdCcpO1xyXG59XHJcbmNhdGNoIChlKSB7XHJcblx0cS5yZWdpc3RlckZpbHRlcigncm9vdCcsIHJlcXVpcmUoJy4vbGliL3BzZXVkb3Mvcm9vdCcpKTtcclxufVxyXG5cclxuXHJcbi8vZGV0ZWN0IGA6bWF0Y2hlc2BcclxudHJ5IHtcclxuXHRkb2MucXVlcnlTZWxlY3RvcignOm1hdGNoZXMnKTtcclxufVxyXG5jYXRjaCAoZSkge1xyXG5cdHEucmVnaXN0ZXJGaWx0ZXIoJ21hdGNoZXMnLCByZXF1aXJlKCcuL2xpYi9wc2V1ZG9zL21hdGNoZXMnKSk7XHJcbn1cclxuXHJcblxyXG4vKiogSGVscGVyIG1ldGhvZHMgKi9cclxucS5tYXRjaGVzID0gcmVxdWlyZSgnLi9saWIvcHNldWRvcy9tYXRjaGVzJyk7XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBxOyIsInZhciBEcmFnZ2FibGUgPSByZXF1aXJlKCdkcmFnZ3knKTtcclxudmFyIGVtaXQgPSByZXF1aXJlKCdlbW15L2VtaXQnKTtcclxudmFyIG9uID0gcmVxdWlyZSgnZW1teS9vbicpO1xyXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ211dHlwZS9pcy1hcnJheScpO1xyXG52YXIgaXNTdHJpbmcgPSByZXF1aXJlKCdtdXR5cGUvaXMtc3RyaW5nJyk7XHJcbnZhciBpc09iamVjdCA9IHJlcXVpcmUoJ211dHlwZS9pcy1vYmplY3QnKTtcclxudmFyIHEgPSByZXF1aXJlKCdxdWVyaWVkJyk7XHJcbnZhciBleHRlbmQgPSByZXF1aXJlKCd4dGVuZC9tdXRhYmxlJyk7XHJcbnZhciBpbmhlcml0ID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcclxudmFyIEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKTtcclxudmFyIGJldHdlZW4gPSByZXF1aXJlKCdtdW1hdGgvYmV0d2VlbicpO1xyXG52YXIgc3BsaXRLZXlzID0gcmVxdWlyZSgnc3BsaXQta2V5cycpO1xyXG52YXIgY3NzID0gcmVxdWlyZSgnbXVjc3MvY3NzJyk7XHJcbnZhciBwYWRkaW5ncyA9IHJlcXVpcmUoJ211Y3NzL3BhZGRpbmcnKTtcclxudmFyIGJvcmRlcnMgPSByZXF1aXJlKCdtdWNzcy9ib3JkZXInKTtcclxudmFyIG1hcmdpbnMgPSByZXF1aXJlKCdtdWNzcy9tYXJnaW4nKTtcclxudmFyIG9mZnNldHMgPSByZXF1aXJlKCdtdWNzcy9vZmZzZXQnKTtcclxudmFyIHBhcnNlQ1NTVmFsdWUgPSByZXF1aXJlKCdtdWNzcy9wYXJzZS12YWx1ZScpO1xyXG5cclxuXHJcbnZhciBkb2MgPSBkb2N1bWVudCwgd2luID0gd2luZG93LCByb290ID0gZG9jLmRvY3VtZW50RWxlbWVudDtcclxuXHJcblxyXG4vKipcclxuICogTWFrZSBhbiBlbGVtZW50IHJlc2l6YWJsZS5cclxuICpcclxuICogTm90ZSB0aGF0IHdlIGRvbuKAmXQgbmVlZCBhIGNvbnRhaW5lciBvcHRpb25cclxuICogYXMgYXJiaXRyYXJ5IGNvbnRhaW5lciBpcyBlbXVsYXRhYmxlIHZpYSBmYWtlIHJlc2l6YWJsZS5cclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBSZXNpemFibGUgKGVsLCBvcHRpb25zKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHRpZiAoIShzZWxmIGluc3RhbmNlb2YgUmVzaXphYmxlKSkge1xyXG5cdFx0cmV0dXJuIG5ldyBSZXNpemFibGUoZWwsIG9wdGlvbnMpO1xyXG5cdH1cclxuXHJcblx0c2VsZi5lbGVtZW50ID0gZWw7XHJcblxyXG5cdGV4dGVuZChzZWxmLCBvcHRpb25zKTtcclxuXHJcblx0c2VsZi5jcmVhdGVIYW5kbGVzKCk7XHJcblxyXG5cdC8vYmluZCBldmVudCwgaWYgYW55XHJcblx0aWYgKHNlbGYucmVzaXplKSB7XHJcblx0XHRzZWxmLm9uKCdyZXNpemUnLCBzZWxmLnJlc2l6ZSk7XHJcblx0fVxyXG59XHJcblxyXG5pbmhlcml0KFJlc2l6YWJsZSwgRW1pdHRlcik7XHJcblxyXG5cclxudmFyIHByb3RvID0gUmVzaXphYmxlLnByb3RvdHlwZTtcclxuXHJcblxyXG4vKiogQ3JlYXRlIGhhbmRsZXMgYWNjb3JkaW5nIHRvIG9wdGlvbnMgKi9cclxucHJvdG8uY3JlYXRlSGFuZGxlcyA9IGZ1bmN0aW9uICgpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdC8vaW5pdCBoYW5kbGVzXHJcblx0dmFyIGhhbmRsZXM7XHJcblxyXG5cdC8vcGFyc2UgdmFsdWVcclxuXHRpZiAoaXNBcnJheShzZWxmLmhhbmRsZXMpKSB7XHJcblx0XHRoYW5kbGVzID0ge307XHJcblx0XHRmb3IgKHZhciBpID0gc2VsZi5oYW5kbGVzLmxlbmd0aDsgaS0tOyl7XHJcblx0XHRcdGhhbmRsZXNbc2VsZi5oYW5kbGVzW2ldXSA9IG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG5cdGVsc2UgaWYgKGlzU3RyaW5nKHNlbGYuaGFuZGxlcykpIHtcclxuXHRcdGhhbmRsZXMgPSB7fTtcclxuXHRcdHZhciBhcnIgPSBzZWxmLmhhbmRsZXMubWF0Y2goLyhbc3duZV0rKS9nKTtcclxuXHRcdGZvciAodmFyIGkgPSBhcnIubGVuZ3RoOyBpLS07KXtcclxuXHRcdFx0aGFuZGxlc1thcnJbaV1dID0gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcblx0ZWxzZSBpZiAoaXNPYmplY3Qoc2VsZi5oYW5kbGVzKSkge1xyXG5cdFx0aGFuZGxlcyA9IHNlbGYuaGFuZGxlcztcclxuXHR9XHJcblx0Ly9kZWZhdWx0IHNldCBvZiBoYW5kbGVzIGRlcGVuZHMgb24gcG9zaXRpb24uXHJcblx0ZWxzZSB7XHJcblx0XHR2YXIgcG9zaXRpb24gPSBnZXRDb21wdXRlZFN0eWxlKHNlbGYuZWxlbWVudCkucG9zaXRpb247XHJcblx0XHR2YXIgZGlzcGxheSA9IGdldENvbXB1dGVkU3R5bGUoc2VsZi5lbGVtZW50KS5kaXNwbGF5O1xyXG5cdFx0Ly9pZiBkaXNwbGF5IGlzIGlubGluZS1saWtlIC0gcHJvdmlkZSBvbmx5IHRocmVlIGhhbmRsZXNcclxuXHRcdC8vaXQgaXMgcG9zaXRpb246IHN0YXRpYyBvciBkaXNwbGF5OiBpbmxpbmVcclxuXHRcdGlmICgvaW5saW5lLy50ZXN0KGRpc3BsYXkpIHx8IC9zdGF0aWMvLnRlc3QocG9zaXRpb24pKXtcclxuXHRcdFx0aGFuZGxlcyA9IHtcclxuXHRcdFx0XHRzOiBudWxsLFxyXG5cdFx0XHRcdHNlOiBudWxsLFxyXG5cdFx0XHRcdGU6IG51bGxcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdC8vZW5zdXJlIHBvc2l0aW9uIGlzIG5vdCBzdGF0aWNcclxuXHRcdFx0Y3NzKHNlbGYuZWxlbWVudCwgJ3Bvc2l0aW9uJywgJ3JlbGF0aXZlJyk7XHJcblx0XHR9XHJcblx0XHQvL2Vsc2UgLSBhbGwgaGFuZGxlc1xyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGhhbmRsZXMgPSB7XHJcblx0XHRcdFx0czogbnVsbCxcclxuXHRcdFx0XHRzZTogbnVsbCxcclxuXHRcdFx0XHRlOiBudWxsLFxyXG5cdFx0XHRcdG5lOiBudWxsLFxyXG5cdFx0XHRcdG46IG51bGwsXHJcblx0XHRcdFx0bnc6IG51bGwsXHJcblx0XHRcdFx0dzogbnVsbCxcclxuXHRcdFx0XHRzdzogbnVsbFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly9jcmVhdGUgcHJvcGVyIG51bWJlciBvZiBoYW5kbGVzXHJcblx0dmFyIGhhbmRsZTtcclxuXHRmb3IgKHZhciBkaXJlY3Rpb24gaW4gaGFuZGxlcykge1xyXG5cdFx0aGFuZGxlc1tkaXJlY3Rpb25dID0gc2VsZi5jcmVhdGVIYW5kbGUoaGFuZGxlc1tkaXJlY3Rpb25dLCBkaXJlY3Rpb24pO1xyXG5cdH1cclxuXHJcblx0Ly9zYXZlIGhhbmRsZXMgZWxlbWVudHNcclxuXHRzZWxmLmhhbmRsZXMgPSBoYW5kbGVzO1xyXG59XHJcblxyXG5cclxuLyoqIENyZWF0ZSBoYW5kbGUgZm9yIHRoZSBkaXJlY3Rpb24gKi9cclxucHJvdG8uY3JlYXRlSGFuZGxlID0gZnVuY3Rpb24oaGFuZGxlLCBkaXJlY3Rpb24pe1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHJcblx0dmFyIGVsID0gc2VsZi5lbGVtZW50O1xyXG5cclxuXHQvL21ha2UgaGFuZGxlIGVsZW1lbnRcclxuXHRpZiAoIWhhbmRsZSkge1xyXG5cdFx0aGFuZGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblx0XHRoYW5kbGUuY2xhc3NMaXN0LmFkZCgncmVzaXphYmxlLWhhbmRsZScpO1xyXG5cdH1cclxuXHJcblx0Ly9pbnNlcnQgaGFuZGxlIHRvIHRoZSBlbGVtZW50XHJcblx0c2VsZi5lbGVtZW50LmFwcGVuZENoaWxkKGhhbmRsZSk7XHJcblxyXG5cdC8vc2F2ZSBkaXJlY3Rpb25cclxuXHRoYW5kbGUuZGlyZWN0aW9uID0gZGlyZWN0aW9uO1xyXG5cclxuXHQvL21ha2UgaGFuZGxlIGRyYWdnYWJsZVxyXG5cdHZhciBkcmFnZ3kgPSBuZXcgRHJhZ2dhYmxlKGhhbmRsZSwge1xyXG5cdFx0d2l0aGluOiBzZWxmLndpdGhpbixcclxuXHRcdC8vIGNzczM6IGZhbHNlLFxyXG5cdFx0dGhyZXNob2xkOiBzZWxmLnRocmVzaG9sZCxcclxuXHRcdGF4aXM6IC9eW25zXSQvLnRlc3QoZGlyZWN0aW9uKSA/ICd5JyA6IC9eW3dlXSQvLnRlc3QoZGlyZWN0aW9uKSA/ICd4JyA6ICdib3RoJ1xyXG5cdH0pO1xyXG5cclxuXHRkcmFnZ3kub24oJ2RyYWdzdGFydCcsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRzZWxmLm0gPSBtYXJnaW5zKGVsKTtcclxuXHRcdHNlbGYuYiA9IGJvcmRlcnMoZWwpO1xyXG5cdFx0c2VsZi5wID0gcGFkZGluZ3MoZWwpO1xyXG5cclxuXHRcdC8vcGFyc2UgaW5pdGlhbCBvZmZzZXRzXHJcblx0XHR2YXIgcyA9IGdldENvbXB1dGVkU3R5bGUoZWwpO1xyXG5cdFx0c2VsZi5vZmZzZXRzID0gW3BhcnNlQ1NTVmFsdWUocy5sZWZ0KSwgcGFyc2VDU1NWYWx1ZShzLnRvcCldO1xyXG5cclxuXHRcdC8vZml4IHRvcC1sZWZ0IHBvc2l0aW9uXHJcblx0XHRjc3MoZWwsIHtcclxuXHRcdFx0bGVmdDogc2VsZi5vZmZzZXRzWzBdLFxyXG5cdFx0XHR0b3A6IHNlbGYub2Zmc2V0c1sxXVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly9yZWNhbGMgYm9yZGVyLWJveFxyXG5cdFx0aWYgKGdldENvbXB1dGVkU3R5bGUoZWwpLmJveFNpemluZyA9PT0gJ2JvcmRlci1ib3gnKSB7XHJcblx0XHRcdHNlbGYucC50b3AgPSAwO1xyXG5cdFx0XHRzZWxmLnAuYm90dG9tID0gMDtcclxuXHRcdFx0c2VsZi5wLmxlZnQgPSAwO1xyXG5cdFx0XHRzZWxmLnAucmlnaHQgPSAwO1xyXG5cdFx0XHRzZWxmLmIudG9wID0gMDtcclxuXHRcdFx0c2VsZi5iLmJvdHRvbSA9IDA7XHJcblx0XHRcdHNlbGYuYi5sZWZ0ID0gMDtcclxuXHRcdFx0c2VsZi5iLnJpZ2h0ID0gMDtcclxuXHRcdH1cclxuXHJcblx0XHQvL3NhdmUgaW5pdGlhbCBzaXplXHJcblx0XHRzZWxmLnNpemUgPSBbZWwub2Zmc2V0V2lkdGggLSBzZWxmLmIubGVmdCAtIHNlbGYuYi5yaWdodCAtIHNlbGYucC5sZWZ0IC0gc2VsZi5wLnJpZ2h0LCBlbC5vZmZzZXRIZWlnaHQgLSBzZWxmLmIudG9wIC0gc2VsZi5iLmJvdHRvbSAtIHNlbGYucC50b3AgLSBzZWxmLnAuYm90dG9tXTtcclxuXHJcblx0XHQvL2NhbGMgbGltaXRzIChtYXggaGVpZ2h0L3dpZHRoKVxyXG5cdFx0aWYgKHNlbGYud2l0aGluKSB7XHJcblx0XHRcdHZhciBwbyA9IG9mZnNldHMoc2VsZi53aXRoaW4pO1xyXG5cdFx0XHR2YXIgbyA9IG9mZnNldHMoZWwpO1xyXG5cdFx0XHRzZWxmLmxpbWl0cyA9IFtcclxuXHRcdFx0XHRvLmxlZnQgLSBwby5sZWZ0ICsgc2VsZi5zaXplWzBdLFxyXG5cdFx0XHRcdG8udG9wIC0gcG8udG9wICsgc2VsZi5zaXplWzFdLFxyXG5cdFx0XHRcdHBvLnJpZ2h0IC0gby5yaWdodCArIHNlbGYuc2l6ZVswXSxcclxuXHRcdFx0XHRwby5ib3R0b20gLSBvLmJvdHRvbSArIHNlbGYuc2l6ZVsxXV07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRzZWxmLmxpbWl0cyA9IFs5OTk5LCA5OTk5LCA5OTk5LCA5OTk5XTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly9wcmVzZXQgbW91c2UgY3Vyc29yXHJcblx0XHRjc3Mocm9vdCwge1xyXG5cdFx0XHQnY3Vyc29yJzogZGlyZWN0aW9uICsgJy1yZXNpemUnXHJcblx0XHR9KTtcclxuXHJcblx0XHQvL2NsZWFyIGN1cnNvcnNcclxuXHRcdGZvciAodmFyIGggaW4gc2VsZi5oYW5kbGVzKXtcclxuXHRcdFx0Y3NzKHNlbGYuaGFuZGxlc1toXSwgJ2N1cnNvcicsIG51bGwpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHRkcmFnZ3kub24oJ2RyYWcnLCBmdW5jdGlvbihlKXtcclxuXHRcdHZhciBjb29yZHMgPSBkcmFnZ3kuZ2V0Q29vcmRzKCk7XHJcblxyXG5cdFx0Ly9jaGFuZ2Ugd2lkdGgvaGVpZ2h0IHByb3Blcmx5XHJcblx0XHRzd2l0Y2ggKGRpcmVjdGlvbikge1xyXG5cdFx0XHRjYXNlICdzZSc6XHJcblx0XHRcdGNhc2UgJ3MnOlxyXG5cdFx0XHRjYXNlICdlJzpcclxuXHRcdFx0XHRjc3MoZWwsIHtcclxuXHRcdFx0XHRcdHdpZHRoOiBiZXR3ZWVuKHNlbGYuc2l6ZVswXSArIGNvb3Jkc1swXSwgMCwgc2VsZi5saW1pdHNbMl0pLFxyXG5cdFx0XHRcdFx0aGVpZ2h0OiBiZXR3ZWVuKHNlbGYuc2l6ZVsxXSArIGNvb3Jkc1sxXSwgMCwgc2VsZi5saW1pdHNbM10pXHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgJ253JzpcclxuXHRcdFx0Y2FzZSAnbic6XHJcblx0XHRcdGNhc2UgJ3cnOlxyXG5cdFx0XHRcdGNzcyhlbCwge1xyXG5cdFx0XHRcdFx0d2lkdGg6IGJldHdlZW4oc2VsZi5zaXplWzBdIC0gY29vcmRzWzBdLCAwLCBzZWxmLmxpbWl0c1swXSksXHJcblx0XHRcdFx0XHRoZWlnaHQ6IGJldHdlZW4oc2VsZi5zaXplWzFdIC0gY29vcmRzWzFdLCAwLCBzZWxmLmxpbWl0c1sxXSlcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0Ly8gLy9zdWJ0cmFjdCB0L2wgb24gY2hhbmdlZCBzaXplXHJcblx0XHRcdFx0dmFyIGRpZlggPSBzZWxmLnNpemVbMF0gKyBzZWxmLmIubGVmdCArIHNlbGYuYi5yaWdodCArIHNlbGYucC5sZWZ0ICsgc2VsZi5wLnJpZ2h0IC0gZWwub2Zmc2V0V2lkdGg7XHJcblx0XHRcdFx0dmFyIGRpZlkgPSBzZWxmLnNpemVbMV0gKyBzZWxmLmIudG9wICsgc2VsZi5iLmJvdHRvbSArIHNlbGYucC50b3AgKyBzZWxmLnAuYm90dG9tIC0gZWwub2Zmc2V0SGVpZ2h0O1xyXG5cclxuXHRcdFx0XHRjc3MoZWwsIHtcclxuXHRcdFx0XHRcdGxlZnQ6IHNlbGYub2Zmc2V0c1swXSArIGRpZlgsXHJcblx0XHRcdFx0XHR0b3A6IHNlbGYub2Zmc2V0c1sxXSArIGRpZllcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnbmUnOlxyXG5cdFx0XHRcdGNzcyhlbCwge1xyXG5cdFx0XHRcdFx0d2lkdGg6IGJldHdlZW4oc2VsZi5zaXplWzBdICsgY29vcmRzWzBdLCAwLCBzZWxmLmxpbWl0c1syXSksXHJcblx0XHRcdFx0XHRoZWlnaHQ6IGJldHdlZW4oc2VsZi5zaXplWzFdIC0gY29vcmRzWzFdLCAwLCBzZWxmLmxpbWl0c1sxXSlcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0Ly9zdWJ0cmFjdCB0L2wgb24gY2hhbmdlZCBzaXplXHJcblx0XHRcdFx0dmFyIGRpZlkgPSBzZWxmLnNpemVbMV0gKyBzZWxmLmIudG9wICsgc2VsZi5iLmJvdHRvbSArIHNlbGYucC50b3AgKyBzZWxmLnAuYm90dG9tIC0gZWwub2Zmc2V0SGVpZ2h0O1xyXG5cclxuXHRcdFx0XHRjc3MoZWwsIHtcclxuXHRcdFx0XHRcdHRvcDogc2VsZi5vZmZzZXRzWzFdICsgZGlmWVxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzdyc6XHJcblx0XHRcdFx0Y3NzKGVsLCB7XHJcblx0XHRcdFx0XHR3aWR0aDogYmV0d2VlbihzZWxmLnNpemVbMF0gLSBjb29yZHNbMF0sIDAsIHNlbGYubGltaXRzWzBdKSxcclxuXHRcdFx0XHRcdGhlaWdodDogYmV0d2VlbihzZWxmLnNpemVbMV0gKyBjb29yZHNbMV0sIDAsIHNlbGYubGltaXRzWzNdKVxyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0XHQvL3N1YnRyYWN0IHQvbCBvbiBjaGFuZ2VkIHNpemVcclxuXHRcdFx0XHR2YXIgZGlmWCA9IHNlbGYuc2l6ZVswXSArIHNlbGYuYi5sZWZ0ICsgc2VsZi5iLnJpZ2h0ICsgc2VsZi5wLmxlZnQgKyBzZWxmLnAucmlnaHQgLSBlbC5vZmZzZXRXaWR0aDtcclxuXHJcblx0XHRcdFx0Y3NzKGVsLCB7XHJcblx0XHRcdFx0XHRsZWZ0OiBzZWxmLm9mZnNldHNbMF0gKyBkaWZYXHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vdHJpZ2dlciBjYWxsYmFja3NcclxuXHRcdGVtaXQoc2VsZiwgJ3Jlc2l6ZScpO1xyXG5cdFx0ZW1pdChlbCwgJ3Jlc2l6ZScpO1xyXG5cclxuXHRcdGRyYWdneS5zZXRDb29yZHMoMCwwKTtcclxuXHR9KTtcclxuXHJcblx0ZHJhZ2d5Lm9uKCdkcmFnZW5kJywgZnVuY3Rpb24oKXtcclxuXHRcdC8vY2xlYXIgY3Vyc29yICYgcG9pbnRlci1ldmVudHNcclxuXHRcdGNzcyhyb290LCB7XHJcblx0XHRcdCdjdXJzb3InOiBudWxsXHJcblx0XHR9KTtcclxuXHJcblx0XHQvL2dldCBiYWNrIGN1cnNvcnNcclxuXHRcdGZvciAodmFyIGggaW4gc2VsZi5oYW5kbGVzKXtcclxuXHRcdFx0Y3NzKHNlbGYuaGFuZGxlc1toXSwgJ2N1cnNvcicsIHNlbGYuaGFuZGxlc1toXS5kaXJlY3Rpb24gKyAnLXJlc2l6ZScpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHQvL2FwcGVuZCBzdHlsZXNcclxuXHRjc3MoaGFuZGxlLCBoYW5kbGVTdHlsZXNbZGlyZWN0aW9uXSk7XHJcblx0Y3NzKGhhbmRsZSwgJ2N1cnNvcicsIGRpcmVjdGlvbiArICctcmVzaXplJyk7XHJcblxyXG5cdC8vYXBwZW5kIHByb3BlciBjbGFzc1xyXG5cdGhhbmRsZS5jbGFzc0xpc3QuYWRkKCdyZXNpemFibGUtaGFuZGxlLScgKyBkaXJlY3Rpb24pO1xyXG5cclxuXHRyZXR1cm4gaGFuZGxlO1xyXG59O1xyXG5cclxuXHJcbi8qKiBkZWNvbnN0cnVjdG9yIC0gcmVtb3ZlcyBhbnkgbWVtb3J5IGJpbmRpbmdzICovXHJcbnByb3RvLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XHJcblx0Ly9yZW1vdmUgYWxsIGhhbmRsZXNcclxuXHRmb3IgKHZhciBoTmFtZSBpbiB0aGlzLmhhbmRsZXMpe1xyXG5cdFx0dGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuaGFuZGxlc1toTmFtZV0pO1xyXG5cdFx0dGhpcy5oYW5kbGVzW2hOYW1lXS5kcmFnZ2FibGUuZGVzdHJveSgpO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vcmVtb3ZlIHJlZmVyZW5jZXNcclxuXHR0aGlzLmVsZW1lbnQgPSBudWxsO1xyXG59O1xyXG5cclxuXHJcbnZhciB3ID0gMTA7XHJcblxyXG5cclxuLyoqIFRocmVzaG9sZCBzaXplICovXHJcbnByb3RvLnRocmVzaG9sZCA9IHc7XHJcblxyXG5cclxuLyoqIFN0eWxlcyBmb3IgaGFuZGxlcyAqL1xyXG52YXIgaGFuZGxlU3R5bGVzID0gc3BsaXRLZXlzKHtcclxuXHQnZSx3LG4scyxudyxuZSxzdyxzZSc6IHtcclxuXHRcdCdwb3NpdGlvbic6ICdhYnNvbHV0ZSdcclxuXHR9LFxyXG5cdCdlLHcnOiB7XHJcblx0XHQndG9wLCBib3R0b20nOjAsXHJcblx0XHQnd2lkdGgnOiB3XHJcblx0fSxcclxuXHQnZSc6IHtcclxuXHRcdCdsZWZ0JzogJ2F1dG8nLFxyXG5cdFx0J3JpZ2h0JzogLXcvMlxyXG5cdH0sXHJcblx0J3cnOiB7XHJcblx0XHQncmlnaHQnOiAnYXV0bycsXHJcblx0XHQnbGVmdCc6IC13LzJcclxuXHR9LFxyXG5cdCdzJzoge1xyXG5cdFx0J3RvcCc6ICdhdXRvJyxcclxuXHRcdCdib3R0b20nOiAtdy8yXHJcblx0fSxcclxuXHQnbic6IHtcclxuXHRcdCdib3R0b20nOiAnYXV0bycsXHJcblx0XHQndG9wJzogLXcvMlxyXG5cdH0sXHJcblx0J24scyc6IHtcclxuXHRcdCdsZWZ0LCByaWdodCc6IDAsXHJcblx0XHQnaGVpZ2h0Jzogd1xyXG5cdH0sXHJcblx0J253LG5lLHN3LHNlJzoge1xyXG5cdFx0J3dpZHRoJzogdyxcclxuXHRcdCdoZWlnaHQnOiB3LFxyXG5cdFx0J3otaW5kZXgnOiAxXHJcblx0fSxcclxuXHQnbncnOiB7XHJcblx0XHQndG9wLCBsZWZ0JzogLXcvMixcclxuXHRcdCdib3R0b20sIHJpZ2h0JzogJ2F1dG8nXHJcblx0fSxcclxuXHQnbmUnOiB7XHJcblx0XHQndG9wLCByaWdodCc6IC13LzIsXHJcblx0XHQnYm90dG9tLCBsZWZ0JzogJ2F1dG8nXHJcblx0fSxcclxuXHQnc3cnOiB7XHJcblx0XHQnYm90dG9tLCBsZWZ0JzogLXcvMixcclxuXHRcdCd0b3AsIHJpZ2h0JzogJ2F1dG8nXHJcblx0fSxcclxuXHQnc2UnOiB7XHJcblx0XHQnYm90dG9tLCByaWdodCc6IC13LzIsXHJcblx0XHQndG9wLCBsZWZ0JzogJ2F1dG8nXHJcblx0fVxyXG59LCB0cnVlKTtcclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIEBtb2R1bGUgcmVzaXphYmxlXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IFJlc2l6YWJsZTsiXX0=

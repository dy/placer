require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var css = require('mucss');
var m = require('mumath');

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
	var toRect = css.offsets(relativeTo);
	for (var i = els.length, el, s; i--;){
		el = els[i];

		//ignore self
		if (el === relativeTo) continue;

		s = getComputedStyle(el);

		//ensure element is at least relative, if it is static
		if (s.position === 'static') css(el, 'position', 'relative');


		//include margins
		var placeeMargins = css.margins(el);

		//get relativeTo & parent rectangles
		var parent = el.offsetParent || win;
		var parentRect = css.offsets(parent);
		var parentPaddings = css.paddings(parent);
		var parentBorders = css.borders(parent);

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
},{"mucss":15,"mumath":16}],2:[function(require,module,exports){
var icicle = require('icicle');


/** environment guarant */
var $ = typeof jQuery === 'undefined' ? undefined : jQuery;
var doc = typeof document === 'undefined' ? undefined : document;
var win = typeof window === 'undefined' ? undefined : window;


/** Lists of methods */
var onNames = ['on', 'bind', 'addEventListener', 'addListener'];
var oneNames = ['one', 'once', 'addOnceEventListener', 'addOnceListener'];
var offNames = ['off', 'unbind', 'removeEventListener', 'removeListener'];
var emitNames = ['emit', 'trigger', 'fire', 'dispatchEvent'];

/** Locker flags */
var emitFlag = emitNames[0], onFlag = onNames[0], oneFlag = onNames[0], offFlag = offNames[0];


/**
 * @constructor
 *
 * Main EventEmitter interface.
 * Wraps any target passed to an Emitter interface
 */
function Emmy(target){
	if (!target) return;

	//create emitter methods on target, if none
	if (!getMethodOneOf(target, onNames)) target.on = EmmyPrototype.on.bind(target);
	if (!getMethodOneOf(target, offNames)) target.off = EmmyPrototype.off.bind(target);
	if (!getMethodOneOf(target, oneNames)) target.one = target.once = EmmyPrototype.one.bind(target);
	if (!getMethodOneOf(target, emitNames)) target.emit = EmmyPrototype.emit.bind(target);

	return target;
}


/** Make DOM objects be wrapped as jQuery objects, if jQuery is enabled */
var EmmyPrototype = Emmy.prototype;


/**
 * Return target’s method one of the passed in list, if target is eventable
 * Use to detect whether target has some fn
 */
function getMethodOneOf(target, list){
	var result;
	for (var i = 0, l = list.length; i < l; i++) {
		result = target[list[i]];
		if (result) return result;
	}
}


/** Set of target callbacks, {target: [cb1, cb2, ...]} */
var targetCbCache = new WeakMap;


/**
* Bind fn to the target
* @todo  recognize jquery object
* @chainable
*/
EmmyPrototype.on =
EmmyPrototype.addEventListener = function(evt, fn){
	var target = this;

	//walk by list of instances
	if (fn instanceof Array){
		for (var i = fn.length; i--;){
			EmmyPrototype.on.call(target, evt, fn[i]);
		}
		return target;
	}

	//target events
	var onMethod = getMethodOneOf(target, onNames);

	//use target event system, if possible
	//avoid self-recursions from the outside
	if (onMethod && onMethod !== EmmyPrototype.on) {
		//if it’s frozen - ignore call
		if (icicle.freeze(target, onFlag + evt)){
			onMethod.call(target, evt, fn);
			icicle.unfreeze(target, onFlag + evt);
		}
		else {
			return target;
		}
	}

	saveCallback(target, evt, fn);

	return target;
};


/**
 * Add callback to the list of callbacks associated with target
 */
function saveCallback(target, evt, fn){
	//ensure callbacks array for target exists
	if (!targetCbCache.has(target)) targetCbCache.set(target, {});
	var targetCallbacks = targetCbCache.get(target);

	(targetCallbacks[evt] = targetCallbacks[evt] || []).push(fn);
}


/**
 * Add an event listener that will be invoked once and then removed.
 *
 * @return {Emmy}
 * @chainable
 */
EmmyPrototype.once =
EmmyPrototype.one = function(evt, fn){
	var target = this;

	//walk by list of instances
	if (fn instanceof Array){
		for (var i = fn.length; i--;){
			EmmyPrototype.one.call(target, evt, fn[i]);
		}
		return target;
	}

	//target events
	var oneMethod = getMethodOneOf(target, oneNames);

	//use target event system, if possible
	//avoid self-recursions from the outside
	if (oneMethod && oneMethod !== EmmyPrototype.one) {
		if (icicle.freeze(target, oneFlag + evt)){
			//use target event system, if possible
			oneMethod.call(target, evt, fn);
			saveCallback(target, evt, fn);
			icicle.unfreeze(target, oneFlag + evt);
		}

		else {
			return target;
		}
	}

	//wrap callback to once-call
	function cb() {
		EmmyPrototype.off.call(target, evt, fn);
		fn.apply(target, arguments);
	}

	cb.fn = fn;

	//bind wrapper default way
	EmmyPrototype.on.call(target, evt, cb);

	return target;
};


/**
* Bind fn to a target
* @chainable
*/
EmmyPrototype.off =
EmmyPrototype.removeListener =
EmmyPrototype.removeAllListeners =
EmmyPrototype.removeEventListener = function (evt, fn){
	var target = this;

	//unbind all listeners passed
	if (fn instanceof Array){
		for (var i = fn.length; i--;){
			EmmyPrototype.off.call(target, evt, fn[i]);
		}
		return target;
	}


	//unbind all listeners if no fn specified
	if (fn === undefined) {
		var callbacks = targetCbCache.get(target);
		if (!callbacks) return target;
		//unbind all if no evtRef defined
		if (evt === undefined) {
			for (var evtName in callbacks) {
				EmmyPrototype.off.call(target, evtName, callbacks[evtName]);
			}
		}
		else if (callbacks[evt]) {
			EmmyPrototype.off.call(target, evt, callbacks[evt]);
		}
		return target;
	}


	//target events
	var offMethod = getMethodOneOf(target, offNames);

	//use target event system, if possible
	//avoid self-recursion from the outside
	if (offMethod && offMethod !== EmmyPrototype.off) {
		if (icicle.freeze(target, offFlag + evt)){
			offMethod.call(target, evt, fn);
			icicle.unfreeze(target, offFlag + evt);
		}
		//if it’s frozen - ignore call
		else {
			return target;
		}
	}


	//Forget callback
	//ignore if no event specified
	if (!targetCbCache.has(target)) return target;

	var evtCallbacks = targetCbCache.get(target)[evt];

	if (!evtCallbacks) return target;

	//remove specific handler
	for (var i = 0; i < evtCallbacks.length; i++) {
		if (evtCallbacks[i] === fn || evtCallbacks[i].fn === fn) {
			evtCallbacks.splice(i, 1);
			break;
		}
	}

	return target;
};



/**
* Event trigger
* @chainable
*/
EmmyPrototype.emit =
EmmyPrototype.dispatchEvent = function(eventName, data, bubbles){
	var target = this, emitMethod, evt = eventName;
	if (!target) return;

	//Create proper event for DOM objects
	if (target.nodeType || target === doc || target === win) {
		//NOTE: this doesnot bubble on disattached elements

		if (eventName instanceof Event) {
			evt = eventName;
		} else {
			evt =  document.createEvent('CustomEvent');
			evt.initCustomEvent(eventName, bubbles, true, data);
		}

		// var evt = new CustomEvent(eventName, { detail: data, bubbles: bubbles })

		emitMethod = target.dispatchEvent;
	}

	//create event for jQuery object
	else if ($ && target instanceof $) {
		//TODO: decide how to pass data
		var evt = $.Event( eventName, data );
		evt.detail = data;
		emitMethod = bubbles ? targte.trigger : target.triggerHandler;
	}

	//Target events
	else {
		emitMethod = getMethodOneOf(target, emitNames);
	}


	//use locks to avoid self-recursion on objects wrapping this method (e. g. mod instances)
	if (emitMethod && emitMethod !== EmmyPrototype.emit) {
		if (icicle.freeze(target, emitFlag + eventName)) {
			//use target event system, if possible
			emitMethod.call(target, evt, data, bubbles);
			icicle.unfreeze(target, emitFlag + eventName);
			return target;
		}
		//if event was frozen - perform normal callback
	}


	//fall back to default event system
	//ignore if no event specified
	if (!targetCbCache.has(target)) return target;

	var evtCallbacks = targetCbCache.get(target)[evt];

	if (!evtCallbacks) return target;

	//copy callbacks to fire because list can be changed in some handler
	var fireList = evtCallbacks.slice();
	for (var i = 0; i < fireList.length; i++ ) {
		fireList[i] && fireList[i].call(target, {
			detail: data,
			type: eventName
		});
	}

	return target;
};


/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

EmmyPrototype.listeners = function(evt){
	var callbacks = targetCbCache.get(this);
	return callbacks && callbacks[evt] || [];
};


/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

EmmyPrototype.hasListeners = function(evt){
	return !!EmmyPrototype.listeners.call(this, evt).length;
};



/** Static aliases for old API compliance */
Emmy.bindStaticAPI = function(){
	var self = this, proto = self.prototype;

	for (var name in proto) {
		if (proto[name]) self[name] = createStaticBind(name);
	}

	function createStaticBind(methodName){
		return function(a, b, c, d){
			var res = proto[methodName].call(a,b,c,d);
			return res === a ? self : res;
		};
	}
};
Emmy.bindStaticAPI();


/** @module muevents */
module.exports = Emmy;
},{"icicle":3}],3:[function(require,module,exports){
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
},{}],4:[function(require,module,exports){
var matches = require('matches-selector');
var eachCSV = require('each-csv');
var Emitter = require('emmy');
var str = require('mustring');
var type = require('mutypes');


var isString = type.isString;
var isElement = type.isElement;
var isArrayLike = type.isArrayLike;
var has = type.has;
var unprefixize = str.unprefixize;
var upper = str.upper;


var global = (1, eval)('this');
var doc = global.document;


/** Separator to specify events, e.g. click-1 (means interval=1 planned callback of click) */
var evtSeparator = '-';


/* ------------------------------ C O N S T R U C T O R ------------------------------ */


/**
 * @constructor
 * @module enot
 *
 * Mixins any object passed.
 * Implements EventEmitter interface.
 * Static methods below are useful for an old API.
 */
function Enot(target){
	if (!target) return target;

	//mixin any object passed
	for (var meth in EnotPrototype){
		target[meth] = EnotPrototype[meth];
	}

	return target;
}

var EnotPrototype = Enot.prototype = Object.create(Emitter.prototype);



/* -----------------------------------  O  N  ---------------------------------------- */


/**
 * Listed reference binder (comma-separated references)
 *
 * @alias addEventListener
 * @alias bind
 * @chainable
 */
EnotPrototype.addEventListener =
EnotPrototype.on = function(evtRefs, fn){
	var target = this;

	//if no target specified
	if (isString(target)) {
		fn = evtRefs;
		evtRefs = target;
		target = null;
	}

	//no events passed
	if (!evtRefs) return target;

	//in bulk events passed
	if (type.isObject(evtRefs)){
		for (var evtRef in evtRefs){
			EnotPrototype.on.call(target, evtRef, evtRefs[evtRef]);
		}

		return target;
	}

	eachCSV(evtRefs, function(evtRef){
		_on(target, evtRef, fn);
	});

	return target;
};


/**
 * Listed ref binder with :one modifier
 *
 * @chainable
 */
EnotPrototype.once =
EnotPrototype.one = function(evtRefs, fn){
	var target = this;

	//append ':one' to each event from the references passed
	var processedRefs = '';
	eachCSV(evtRefs, function(item){
		processedRefs += item + ':one, ';
	});
	processedRefs = processedRefs.slice(0, -2);

	return EnotPrototype.on.call(target, processedRefs, fn);
};




/**
 * Bind single reference (no comma-declared references).
 *
 * @param {*} target A target to relate reference, `document` by default.
 * @param {string} evtRef Event reference, like `click:defer` etc.
 * @param {Function} fn Callback.
 */
function _on(target, evtRef, fn) {
	//ignore empty fn
	if (!fn) return target;

	var evtObj = parseReference(target, evtRef);

	var targets = evtObj.targets;

	//ignore not bindable sources
	if (!targets) return target;

	//iterate list of targets
	if (isArrayLike(targets)) {
		for (var i = targets.length; i--;){
			// _on(targets[i], evtObj.evt, fn);
			Emitter.on(targets[i], evtObj.evt, getModifiedFn(target, fn, targets[i], evtObj.evt, evtObj.modifiers));
		}

		return target;
	}

	//target is one indeed
	var newTarget = targets;
	// console.log('on', newTarget, evtObj.evt, evtObj.modifiers)
	Emitter.on(newTarget, evtObj.evt, getModifiedFn(target, fn, newTarget, evtObj.evt, evtObj.modifiers));

	return target;
}



/* -----------------------------------  O  F  F  ------------------------------------- */


/**
 * Listed reference unbinder
 *
 * @alias removeEventListener
 * @alias unbind
 * @chainable
 */
EnotPrototype.removeEventListener =
EnotPrototype.removeListener =
EnotPrototype.removeAllListeners =
EnotPrototype.off = function(evtRefs, fn){
	var target = this;

	//if no target specified
	if (isString(target)) {
		fn = evtRefs;
		evtRefs = target;
		target = null;
	}

	//unbind all events
	if(!evtRefs) {
		Emitter.off(target);
	}

	//in bulk events passed
	else if (type.isObject(evtRefs)){
		for (var evtRef in evtRefs){
			EnotPrototype.off.call(target, evtRef, evtRefs[evtRef]);
		}
	}

	else {
		eachCSV(evtRefs, function(evtRef){
			_off(target, evtRef, fn);
		});
	}

	return target;
};


/**
 * Single reference unbinder
 *
 * @param {Element} target Target to unbind event, optional
 * @param {string} evtRef Event notation
 * @param {Function} fn callback
 */
function _off(target, evtRef, fn){
	var evtObj = parseReference(target, evtRef);
	var targets = evtObj.targets;
	var targetFn = fn;

	if (!targets) return target;

	//iterate list of targets
	if (isArrayLike(targets)) {
		for (var i = targets.length; i--;){
			//FIXME: check whether it is possible to use Emitter.off straightforwardly
			_off(targets[i], evtObj.evt, fn, true);
		}

		return target;
	}

	var newTarget = targets;

	//clear planned calls for an event
	if (dfdCalls[evtObj.evt]) {
		for (var i = 0; i < dfdCalls[evtObj.evt].length; i++){
			if (intervalCallbacks[dfdCalls[evtObj.evt][i]] === fn)
				Emitter.off(newTarget, evtObj.evt + evtSeparator + dfdCalls[evtObj.evt][i]);
		}
	}

	//unbind all
	if (!fn) {
		Emitter.off(newTarget, evtObj.evt);
	}

	//unbind all callback modified variants
	else {
		var modifiedFns = getModifiedFns(fn, newTarget, evtObj.evt);
		for (var i = modifiedFns.length, unbindCb; i--;){
			unbindCb = modifiedFns.pop();
			Emitter.off(newTarget, evtObj.evt, unbindCb);
		}
	}
}


/**
 * Dispatch event to any target.
 *
 * @alias trigger
 * @alias fire
 * @alias dispatchEvent
 * @chainable
 */
EnotPrototype.dispatchEvent =
EnotPrototype.emit = function(evtRefs, data, bubbles){
	var target = this;

	//if no target specified
	if (isString(target)) {
		bubbles = data;
		data = evtRefs;
		evtRefs = target;
		target = null;
	}

	//just fire straight event passed
	if (evtRefs instanceof Event) {
		Emitter.emit(target, evtRefs, data, bubbles);
		return target;
	}

	if (!evtRefs) return target;

	eachCSV(evtRefs, function(evtRef){
		var evtObj = parseReference(target, evtRef);

		if (!evtObj.evt) return target;

		return applyModifiers(function(){
			var target = evtObj.targets;

			if (!target) return target;

			//iterate list of targets
			if (isArrayLike(target)) {
				for (var i = target.length; i--;){
					Emitter.emit(target[i], evtObj.evt, data, bubbles);
				}
			}

			//fire single target
			else {
				// console.log('emit', target, evtObj.evt)
				Emitter.emit(target, evtObj.evt, data, bubbles);
			}

		}, evtObj.evt, evtObj.modifiers)();
	});

	return target;
};



/* -------------------------------- M O D I F I E R S -------------------------------- */


/** @type {Object} Keys shortcuts */
var keyDict = {
	'ENTER': 13,
	'ESCAPE': 27,
	'TAB': 9,
	'ALT': 18,
	'CTRL': 17,
	'SHIFT': 16,
	'SPACE': 32,
	'PAGE_UP': 33,
	'PAGE_DOWN': 34,
	'END': 35,
	'HOME': 36,
	'LEFT': 37,
	'UP': 38,
	'RIGHT': 39,
	'DOWN': 40,

	'F1': 112,
	'F2': 113,
	'F3': 114,
	'F4': 115,
	'F5': 116,
	'F6': 117,
	'F7': 118,
	'F8': 119,
	'F9': 120,
	'F10': 121,
	'F11': 122,
	'F12': 123,

	'LEFT_MOUSE': 1,
	'RIGHT_MOUSE': 3,
	'MIDDLE_MOUSE': 2
};


/** Return code to stop event chain */
var DENY_EVT_CODE = 1;


/** list of available event modifiers */
Enot.modifiers = {};


/** call callback once */
//TODO: think up the way to use Emmy.one instead
Enot.modifiers['once'] =
Enot.modifiers['one'] = function(evt, fn, emptyArg, sourceFn){
	var cb = function(e){
		var result = fn && fn.call(this, e);
		//FIXME: `this` is not necessarily has `off`
		// console.log('off', fn, Emitter.listeners(this, evt)[0] === sourceFn)
		result !== DENY_EVT_CODE && Enot.off(this, evt, sourceFn);
		return result;
	};
	return cb;
};


/**
 * filter keys
 * @alias keypass
 * @alias mousepass
 *
*/

Enot.modifiers['filter'] =
Enot.modifiers['pass'] = function(evt, fn, keys){
	keys = keys.split(commaSplitRe).map(upper);

	var cb = function(e){
		var pass = false, key;
		for (var i = keys.length; i--;){
			key = keys[i];
			var which = 'originalEvent' in e ? e.originalEvent.which : e.which;
			if ((key in keyDict && keyDict[key] == which) || which == key){
				pass = true;
				return fn.call(this, e);
			}
		}
		return DENY_EVT_CODE;
	};
	return cb;
};


/**
 * white-filter target
 * @alias live
 */
Enot.modifiers['on'] =
Enot.modifiers['delegate'] = function(evtName, fn, selector){
	// console.log('del', selector)
	var cb = function(evt){
		var el = evt.target;

		//filter document/object/etc
		if (!isElement(el)) return DENY_EVT_CODE;

		//intercept bubbling event by delegator
		while (el && el !== doc && el !== this) {
			if (matches(el, selector)) {
				//set proper current el
				evt.delegateTarget = el;
				// evt.currentTarget = el;
				//NOTE: PhantomJS && IE8 fails on this
				// Object.defineProperty(evt, 'currentTarget', {
				// 	get: function(){
				// 		return el;
				// 	}
				// });
				return fn.call(this, evt);
			}
			el = el.parentNode;
		}

		return DENY_EVT_CODE;
	};

	return cb;
};


/**
 * black-filter target
 */
Enot.modifiers['not'] = function(evt, fn, selector){
	var cb = function(e){
		var target = e.target;

		//traverse each node from target to holder and filter if event happened within banned element
		while (target) {
			if (target === doc || target === this) {
				return fn.call(this, e);
			}
			if (matches(target, selector)) return DENY_EVT_CODE;
			target = target.parentNode;
		}

		return DENY_EVT_CODE;
	};
	return cb;
};


var throttleCache = new WeakMap();


/**
 * throttle call
 */
Enot.modifiers['throttle'] = function(evt, fn, interval){
	interval = parseFloat(interval);
	// console.log('thro', evt, fn, interval)
	var cb = function(e){
		return Enot.throttle.call(this, fn, interval, e);
	};

	return cb;
};
Enot.throttle = function(fn, interval, e){
	// console.log('thro cb')
	var self = this;

	//FIXME: multiple throttles may interfere on target (key throttles by id)
	if (throttleCache.get(self)) return DENY_EVT_CODE;
	else {
		var result = fn.call(self, e);
		if (result === DENY_EVT_CODE) return result;
		throttleCache.set(self, setTimeout(function(){
			fn.call(self, e);
			clearInterval(throttleCache.get(self));
			throttleCache.delete(self);
		}, interval));
	}
};


/**
 * List of postponed calls intervals, keyed by evt name
 * @example
 * {click: 1,
 * track: 2}
 */
var dfdCalls = {};


/**
 * List of callbacks for intervals
 * To check passed off callback
 * To avoid unbinding all
 *
 * @example
 * {
 *  1: fn,
 *  2: fnRef
 * }
 */
var intervalCallbacks = {};


/**
 * Defer call - afnet Nms after real method/event
 *
 * @alias postpone
 * @param  {string}   evt   Event name
 * @param  {Function} fn    Handler
 * @param  {number|string}   delay Number of ms to wait
 * @param  {Function|string} sourceFn Source (unmodified) callback
 * @alias async
 * @return {Function}         Modified handler
 */
Enot.modifiers['after'] =
Enot.modifiers['defer'] = function(evt, fn, delay, sourceFn){
	delay = parseFloat(delay) || 0;

	var cb = function(e){
		var self = this;

		//plan fire of this event after N ms
		var interval = setTimeout(function(){
			var evtName =  evt + evtSeparator + interval;

			//fire once planned evt
			Emitter.emit(self, evtName, {sourceEvent: e});
			Emitter.off(self, evtName);

			//forget interval
			var idx = dfdCalls[evt].indexOf(interval);
			if (idx > -1) dfdCalls[evt].splice(idx, 1);
			intervalCallbacks[interval] = null;
		}, delay);

		//bind :one fire of this event
		Emitter.on(self, evt + evtSeparator + interval, sourceFn);

		//save planned interval for an evt
		(dfdCalls[evt] = dfdCalls[evt] || []).push(interval);

		//save callback for interval
		intervalCallbacks[interval] = sourceFn;

		return interval;
	};

	return cb;
};



/* --------------------------  H  E  L  P  E  R  S ----------------------------------- */


/** @type {RegExp} Use as `.split(commaSplitRe)` */
var commaSplitRe = /\s*,\s*/;


/**
 * Return parsed event object from event reference.
 *
 * @param  {Element|Object}   target   A target to parse (optional)
 * @param  {string}   string   Event notation
 * @param  {Function} callback Handler
 * @return {Object}            Result of parsing: {evt, modifiers, targets}
 */
function parseReference(target, string) {
	var result = {};

	//get event name - the first token from the end
	var eventString = string.match(/[\w\.\:\$\-]+(?:\:[\w\.\:\-\$]+(?:\(.+\))?)*$/)[0];

	//remainder is a target reference - parse target
	string = string.slice(0, -eventString.length).trim();
	result.targets = parseTarget(target, string);

	//parse modifiers
	var eventParams = unprefixize(eventString, 'on').split(':');

	//get event name
	result.evt = eventParams.shift();
	result.modifiers = eventParams.sort(function(a,b){
		//one should go last because it turns off passed event
		return /^one/.test(a) ? 1 : a > b ? 1 : -1;
	});

	return result;
}


/** @type {string} Reference to a self target members, e. g. `'@a click'` */
var selfReference = '@';


/**
 * Retrieve source element from string
 * @param  {Element|Object} target A target to relate to
 * @param  {string}         str    Target reference
 * @return {*}                     Resulting target found
 */
function parseTarget(target, str) {
	//make target global, if none
	if (!target) target = doc;

	// console.log('parseTarget `' + str + '`', target)
	if (!str){
		return target;
	}

	//try to query selector in DOM environment
	if (/^[.#[]/.test(str)) {
		if (!isElement(target)) target = doc;
		return target.querySelectorAll(str);
	}

	//return self reference
	else if (/^this\./.test(str)){
		return getProperty(target, str.slice(5));
	}
	else if(str[0] === selfReference){
		return getProperty(target, str.slice(1));
	}

	else if(str === 'this') return target;
	else if(str === selfReference) return target;

	else if(/^body|^html/.test(str)) {
		return doc.querySelectorAll(str);
	}
	else if(str === 'root') return doc.documentElement;
	else if(str === 'window') return global;

	//return global variable
	else {
		return getProperty(global, str);
	}
}


/**
 * Get property defined by dot notation in string.
 * @param  {Object} holder   Target object where to look property up
 * @param  {string} propName Dot notation, like 'this.a.b.c'
 * @return {[type]}          [description]
 */
function getProperty(holder, propName){
	var propParts = propName.split('.');
	var result = holder, lastPropName;
	while ((lastPropName = propParts.shift()) !== undefined) {
		if (!has(result, lastPropName)) return undefined;
		result = result[lastPropName];
	}
	return result;
}


/** Per-callback target cache */
var targetsCache = new WeakMap();


/** Get modified fn taking into account all possible specific case params
 *
 * Fn has a dict of targets
 * Target has a dict of events
 * Event has a list of modified-callbacks
 */
function getModifiedFn(initialTarget, fn, target, evt, modifiers){
	if (!fn) return fn;

	var targetFn = fn;

	if (!initialTarget) initialTarget = target;

	targetFn = getRedirector(targetFn);

	var modifierFns = getModifiedFns(targetFn, target, evt);

	//save callback
	var modifiedCb = applyModifiers(targetFn, evt, modifiers);

	//rebind context, if targets differs
	if (initialTarget !== target) {
		//FIXME: simplify bind here - it is too weighty
		modifiedCb = modifiedCb.bind(initialTarget);
	}
	modifierFns.push(modifiedCb);

	return modifiedCb;
}


/**
 * Return dict of a modified fns for an fn, keyed by modifiers
 */
function getModifiedFns(targetFn, target, evt){
	targetFn = getRedirector(targetFn);

	//fn has a set of targets (contexts)
	var targetsDict = targetsCache.get(targetFn);
	if (!targetsDict) {
		//FIXME: think about flattening this
		targetsDict = new WeakMap();
		targetsCache.set(targetFn, targetsDict);
	}

	//target has a set of events (bound events)
	var eventsDict = targetsDict.get(target);
	if (!eventsDict) {
		eventsDict = {};
		targetsDict.set(target, eventsDict);
	}

	//each event bound has a list of modified cbs (not dict due to we don’t need dict cause off always for all modified cbs)
	var modifiersList = eventsDict[evt];
	if (!modifiersList) {
		modifiersList = [];
		eventsDict[evt] = modifiersList;
	}

	return modifiersList;
}


/**
 * Apply event modifiers to string.
 * Returns wrapped fn.
 *
 * @param  {Function}   fn   Source function to be transformed
 * @param  {string}   evt   Event name to pass to modifiers
 * @param  {Array}   modifiers   List of string chunks representing modifiers
 * @return {Function}   Callback with applied modifiers
 */
function applyModifiers(fn, evt, modifiers){
	var targetFn = fn;

	modifiers.forEach(function(modifier){
		//parse params to pass to modifier
		var modifierName = modifier.split('(')[0];
		var modifierParams = modifier.slice(modifierName.length + 1, -1);

		if (Enot.modifiers[modifierName]) {
			//create new context each call
			targetFn = Enot.modifiers[modifierName](evt, targetFn, modifierParams, fn);
		}
	});

	return targetFn;
}


/** set of redirect functions keyed by redirect cb
 * They’re context independent so we can keep them in memory
 */
var redirectSet = {};


/**
 * Return redirection statements handler.
 *
 * @param    {string}   redirectTo   Redirect declaration (other event notation)
 * @return   {function}   Callback which fires redirects
 */
function getRedirector(redirectTo){
	//return non-plain redirector
	if (!type.isPlain(redirectTo)) return redirectTo;

	//return redirector, if exists
	if (redirectSet[redirectTo]) return redirectSet[redirectTo];

	//create redirector
	var cb = function(e){
		var self = this;
		eachCSV(redirectTo, function(evt){
			if (defaultRedirectors[evt]) defaultRedirectors[evt].call(self, e);
			Enot.emit(self, evt, e.detail, e.bubbles);
		});
	};

	//save redirect fn to cache
	redirectSet[redirectTo] = cb;

	return cb;
}


/**
 * Utility callbacks shortcuts
 */
var defaultRedirectors = {
	preventDefault: function (e) {
		e.preventDefault && e.preventDefault();
	},
	stopPropagation: function (e) {
		e.stopPropagation && e.stopPropagation();
	},
	stopImmediatePropagation: function (e) {
		e.stopImmediatePropagation && e.stopImmediatePropagation();
	},
	noop: function(){}
};



/** Static aliases for old API compliance */
Emitter.bindStaticAPI.call(Enot);


/** @module enot */
module.exports = Enot;
},{"each-csv":5,"emmy":2,"matches-selector":14,"mustring":9,"mutypes":17}],5:[function(require,module,exports){
module.exports = eachCSV;

/** match every comma-separated element ignoring 1-level parenthesis, e.g. `1,2(3,4),5` */
var commaMatchRe = /(,[^,]*?(?:\([^()]+\)[^,]*)?)(?=,|$)/g;

/** iterate over every item in string */
function eachCSV(str, fn){
	if (!str) return;

	//force string be primitive
	str += '';

	var list = (',' + str).match(commaMatchRe) || [''];
	for (var i = 0; i < list.length; i++) {
		// console.log(matchStr)
		var matchStr = list[i].trim();
		if (matchStr[0] === ',') matchStr = matchStr.slice(1);
		matchStr = matchStr.trim();
		fn(matchStr, i);
	}
};
},{}],6:[function(require,module,exports){
/**
 * Simple math utils.
 * @module  mumath
 */

module.exports = {
	between: decorate(between),
	isBetween: decorate(isBetween),
	toPrecision: decorate(toPrecision),
	getPrecision: decorate(getPrecision)
};


/**
 * Get fn wrapped with array/object attrs recognition
 *
 * @return {Function} Target function
 */
function decorate(fn){
	return function(a){
		var args = arguments;
		if (a instanceof Array) {
			var result = new Array(a.length), slice;
			for (var i = 0; i < a.length; i++){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = args[j] instanceof Array ? args[j][i] : args[j];
					val = val || 0;
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
					val = val || 0;
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
}


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

function between(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max);
}


/**
 * Whether element is between left & right including
 *
 * @param {number} a
 * @param {number} left
 * @param {number} right
 *
 * @return {Boolean}
 */

function isBetween(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
}


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

function toPrecision(value, step) {
	step = parseFloat(step);
	if (step === 0) return value;
	value = Math.round(value / step) * step;
	return parseFloat(value.toFixed(getPrecision(step)));
}


/**
 * Get precision from float:
 *
 * @example
 * 1.1 → 1, 1234 → 0, .1234 → 4
 *
 * @param {number} n
 *
 * @return {number} decimap places
 */

function getPrecision(n){
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
}

},{}],7:[function(require,module,exports){
var type = require('mutypes');
var str = require('mustring');
var eachCSV = require('each-csv');

var has = type.has;
var isArray = type.isArray;
var isString = type.isString;
var isFn = type.isFn;
var isElement = type.isElement;
var isNumber = type.isNumber;
var isObject = type.isObject;
var isBool = type.isBool;
var dashed = str.dashed;

module.exports = {
	value: parseValue,
	attribute: parseAttr,
	typed: parseTyped,
	object: parseObject,
	list: parseList,
	stringify: stringify
};

//parse attribute from the target
function parseAttr(target, name, example){
	var result;

	//parse attr value
	if (!has(target, name)) {
		if (has(target, 'attributes')) {
			var dashedPropName = str.dashed(name);

			var attrs = target.attributes,
				attr = attrs[name] || attrs['data-' + name] || attrs[dashedPropName] || attrs['data-' + dashedPropName];

			if (attr) {
				var attrVal = attr.value;
				// console.log('parseAttr', name, propType)
				//fn on-attribute
				// if (/^on/.test(name)) {
				// 	target[name] = new Function(attrVal);
				// }

				//detect based on type
				// else {
					target[name] = parseTyped(attrVal, example);
				// }
			}
		}
	}

	return result;
}

//returns value from string with correct type except for array
//TODO: write tests for this fn
function parseValue(str){
	var v;
	// console.log('parse', str)
	if (/true/i.test(str)) {
		return true;
	} else if (/false/i.test(str)) {
		return false;
	} else if (!/[^\d\.\-]/.test(str) && !isNaN(v = parseFloat(str))) {
		return v;
	} else if (/\{/.test(str)){
		try {
			return JSON.parse(str);
		} catch (e) {
			return str;
		}
	}
	return str;
}

//parse value according to the type passed
function parseTyped(value, type){
	var res;
	// console.log('parse typed', value, type)
	if (isArray(type)) {
		res = parseList(value);
	} else if (isNumber(type)) {
		res = parseFloat(value);
	} else if (isBool(type)){
		res = !/^(false|off|0)$/.test(value);
	} else if (isFn(type)){
		res = value; //new Function(value);
	} else if (isString(type)){
		res = value;
	} else if (isObject(type)) {
		res = parseObject(value);
	} else {
		if (isString(value) && !value.length) res = true;
		else res = parseValue(value);
	}

	return res;
}

function parseObject(str){
	if (str[0] !== '{') str = '{' + str + '}';
	try {
		return JSON.parse(str);
	} catch (e) {
		return {};
	}
}

//returns array parsed from string
function parseList(str){
	if (!isString(str)) return [parseValue(str)];

	//clean str from spaces/array rudiments
	str = str.trim();
	if (str[0] === '[') str = str.slice(1);
	if (str.length > 1 && str[str.length - 1] === ']') str = str.slice(0,-1);

	var result = [];
	eachCSV(str, function(value) {
		result.push(parseValue(value));
	});

	return result;
}

//stringify any element passed, useful for attribute setting
function stringify(el){
	if (!el) {
		return '' + el;
	} if (isArray(el)){
		//return comma-separated array
		return el.join(',');
	} else if (isElement(el)){
		//return id/name/proper selector
		return el.id;

		//that way is too heavy
		// return selector(el)
	} else if (isObject(el)){
		//serialize json
		return JSON.stringify(el);
	} else if (isFn(el)){
		//return fn body
		var src = el.toString();
		el.slice(src.indexOf('{') + 1, src.lastIndexOf('}'));
	} else {
		return el.toString();
	}
}
},{"each-csv":8,"mustring":9,"mutypes":17}],8:[function(require,module,exports){
module.exports=require(5)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\enot\\node_modules\\each-csv\\index.js":5}],9:[function(require,module,exports){
module.exports = {
	camel:camel,
	dashed:dashed,
	upper:upper,
	lower:lower,
	capfirst:capfirst,
	unprefixize:unprefixize
};

//camel-case → CamelCase
function camel(str){
	return str && str.replace(/-[a-z]/g, function(match, position){
		return upper(match[1])
	})
}

//CamelCase → camel-case
function dashed(str){
	return str && str.replace(/[A-Z]/g, function(match, position){
		return (position ? '-' : '') + lower(match)
	})
}

//uppercaser
function upper(str){
	return str.toUpperCase();
}

//lowercasify
function lower(str){
	return str.toLowerCase();
}

//aaa → Aaa
function capfirst(str){
	str+='';
	if (!str) return str;
	return upper(str[0]) + str.slice(1);
}

// onEvt → envt
function unprefixize(str, pf){
	return (str.slice(0,pf.length) === pf) ? lower(str.slice(pf.length)) : str;
}
},{}],10:[function(require,module,exports){
/** @module  st8 */
module.exports = applyState;


var enot = require('enot');
var type = require('mutypes');
var eachCSV = require('each-csv');
var extend = require('extend');
var icicle = require('icicle');


//externs
var isObject = type.isObject;
var has = type.has;
var isFn = type.isFn;
var isPlain = type.isPlain;
var isString = type.isString;

var eOn = enot.on;
var eOff = enot.off;


//tech names
var createdCallbackName = 'created';
var enterCallbackName = 'before';
var leaveCallbackName = 'after';
var initCallbackName = 'init';
var changedCallbackName = 'changed';
var setterName = 'set';
var getterName = 'get';
var remainderStateName = '_';


/** values keyed by target */
var valuesCache = new WeakMap();

/** As far properties can change it’s behaviour dynamically, we have to keep real states somewhere */
var statesCache = new WeakMap();

/** set of initial (root) prop values - we need it in resetting value */
var propsCache = new WeakMap();

/** list of dependencies for the right init order */
var depsCache = new WeakMap();

/** map of callbacks active on target */
var activeCallbacks = new WeakMap();

/** set of native properties per target */
var ignoreCache = new WeakMap();

/** set of target prop setters */
var settersCache = new WeakMap();


/**
 * Apply state to a target
 *
 * @property {*} target Any object to apply state descriptor
 * @property {object} props An object - set of properties
 * @property {(object|undefined)} ignoreProps Native properties or alike -
 *                                            blacklisted items which should be ignored
 */
function applyState(target, props, ignoreProps){
	// console.log('applyState', props)

	//create target private storage
	if (!statesCache.has(target)) statesCache.set(target, {});
	if (!activeCallbacks.has(target)) activeCallbacks.set(target, {});
	if (!ignoreCache.has(target)) ignoreCache.set(target, ignoreProps || {});
	if (!settersCache.has(target)) settersCache.set(target, {});
	if (!propsCache.has(target)) propsCache.set(target, {});

	flattenKeys(props, true);

	//calc dependencies, e.g. b depends on a = {b: {a: true}, a: {}}
	var deps = {};
	depsCache.set(target, deps);

	for (var propName in props){
		//ignore native props
		if (has(Object, propName)) continue;

		//ignore lc props
		//FIXME: maybe it’s better to pass them externally
		if (propName === createdCallbackName || propName === initCallbackName){
			continue;
		}

		deps[propName] = deps[propName] || {};

		var prop = props[propName];
		if (isObject(prop)) {
			for (var stateName in prop){
				var innerProps = prop[stateName];
				//pass non-object inner props
				if (!isObject(innerProps)) continue;

				for (var innerPropName in innerProps){
					if (isStateTransitionName(innerPropName) || innerPropName === propName) continue;

					var innerProp = innerProps[innerPropName];

					//save parent prop as a dependency for inner prop
					(deps[innerPropName] = deps[innerPropName] || {})[propName] = true;

					//save stringy inner prop as a dependece for the prop
					if (isString(innerProp)) (deps[propName] = deps[propName] || {})[innerProp] = true;

					//stub property on target with proper type (avoid uninited calls of inner methods)
					if (!has(target, innerPropName) && !has(props, innerPropName)) {
						if (isFn(innerProp)) target[innerPropName] = noop;
					}

				}
			}
		}
	}

	//create accessors
	createProps(target, props);


	//init values
	for (propName in deps){
		// console.log('init default', propName)
		initProp(target, propName);
	}

	return target;
}


/** create accessor on target for every stateful property */
//TODO: getect init fact via existing value in storage (throw away storage objects)
function createProps(target, props){
	var deps = depsCache.get(target);
	var ignoreProps = ignoreCache.get(target);

	//create prototypal values
	var protoValues = {}, initialStates = {};
	for (var propName in deps){
		//set proto value - property value, if it is not descriptor
		if (!isObject(props[propName])){
			protoValues[propName] = props[propName];
		}

		//save initial property
		if (has(props, propName)) propsCache.get(target)[propName] = prop;
	}


	//if new values - set prototypes
	if (!valuesCache.has(target)) {
		valuesCache.set(target, Object.create(protoValues));
	}

	//if existing values - just set new values, appending new prototypes
	else {
		var values = valuesCache.get(target);

		//append new value to the prototypes
		for (propName in protoValues){
			//FIXME: get proto in a more relizable way
			var valuesProto = values.__proto__;
			if (!has(valuesProto, propName)) valuesProto[propName] = protoValues[propName];
		}
	}


	for (var name in deps) {
		var prop = props[name];

		//set initial property states as prototypes
		statesCache.get(target)[name] = Object.create(isObject(prop) ? prop : null);


		//set initialization lock in order to detect first set call
		icicle.freeze(target, initCallbackName + name);

		//create fake setters for ignorable props
		if (ignoreProps[name]) {
			createSetter(target, name);
			continue;
		}

		//save initial value
		if (has(target, name)/* && !has(valuesCache.get(target),name)*/) {
			valuesCache.get(target)[name] = target[name];
		}

		//set accessors for all props, not the object ones only: some plain property may be dependent on other property’s state, so it has to be intercepted in getter and the stateful property inited beforehead
		Object.defineProperty(target, name, {
			configurable: true,
			get: (function(target, name){
				return function(){
					// console.group('get ', name)
					var propState = statesCache.get(target)[name];
					//init, if is not
					initProp(target, name);

					var values = valuesCache.get(target);
					var value = values[name];


					//getting prop value just returns it’s real value
					var getResult = callState(target, propState[getterName], value);
					value = getResult === undefined ? values[name] : getResult;

					// console.groupEnd();
					return value;
				};
			})(target, name),

			set: createSetter(target, name)
		});
	}
}


/**
 * create & save setter on target
 * @todo optimize setter create for diffirent kind of descriptor
 */
var inSetValues = new WeakMap();
function createSetter(target, name){
	var setter = function(value){
		// console.group('set', name, value)
		// console.log('set', name, value)
		var propState = statesCache.get(target)[name];
		var targetValues = valuesCache.get(target);

		//init, if is not
		initProp(target, name);
		var oldValue = targetValues[name];

		//1. apply setter to value
		var setResult;

		if (icicle.freeze(target, setterName + name)) {
			if (icicle.freeze(target, setterName + name + value)) {
				// console.log('set', name, value)

				try {
					setResult = callState(target, propState[setterName], value, oldValue);
				} catch (e){
					throw e;
				}

				icicle.unfreeze(target, setterName + name + value);
				icicle.unfreeze(target, setterName + name);

				//self.value could've changed here because of inner set calls
				if (inSetValues.has(target)) {
					setResult = inSetValues.get(target);
					// console.log('redirected value', setResult)
					inSetValues.delete(target);
				}

				if (setResult !== undefined) value = setResult;

				else {
					//redirect in set
					if (targetValues[name] !== oldValue) {
						// console.groupEnd();
						return;
					}
				}

			}
		}
		else {
			inSetValues.set(target, value);
		}


		//ignore leaving absent initial state
		var initLock = icicle.unfreeze(target, initCallbackName + name);
		if (!initLock) {
			//Ignore not changed value
			if (value === oldValue) {
				// console.groupEnd()
				return;
			}

			//leaving an old state unbinds all events of the old state
			var oldState = has(propState, oldValue) ? propState[oldValue] : propState[remainderStateName];

			if (icicle.freeze(target, leaveCallbackName + oldState)) {
				//try to enter new state (if redirect happens)
				var leaveResult = leaveState(target, oldState, value, oldValue);

				//redirect mod, if returned any but self
				if (leaveResult !== undefined && leaveResult !== value) {
					//ignore entering falsy state
					if (leaveResult === false) {
					}
					//enter new result
					else {
						target[name] = leaveResult;
					}

					// console.groupEnd()
					return icicle.unfreeze(target, leaveCallbackName + oldState);
				}

				icicle.unfreeze(target, leaveCallbackName + oldState);

				//ignore redirect
				if (targetValues[name] !== oldValue) {
					// console.groupEnd()
					return;
				}

				unapplyProps(target, oldState);
			}

		}

		//save new self value
		// targetValues[name] = value;
		applyValue(target, name, value);
		// console.log('set succeeded', name, value)

		var newStateName = has(propState, value) ? value : remainderStateName;
		if (icicle.freeze(target, name + newStateName)) {
			//new state applies new props: binds events, sets values
			var newState = propState[newStateName];

			applyProps(target, newState);

			//try to enter new state (if redirect happens)
			var enterResult = callState(target, newState, value, oldValue);

			//redirect mod, if returned any but self
			if (enterResult !== undefined && enterResult !== value) {
				//ignore entering falsy state
				if (enterResult === false) {
					target[name] = oldValue;
				}
				//enter new result
				else {
					target[name] = enterResult;
				}

				// console.groupEnd()
				return icicle.unfreeze(target, name + newStateName);
			}

			icicle.unfreeze(target, name + newStateName);
		}


		//4. call changed
		if (value !== oldValue || (initLock && value !== undefined))
			callState(target, propState[changedCallbackName], value, oldValue);

		// console.groupEnd()
	};

	//save setter
	settersCache.get(target)[name] = setter;

	return setter;
}


/** property initializer */
function initProp(target, name){
	var deps = depsCache.get(target);
	if (!deps[name]) return;

	var propState = statesCache.get(target)[name];

	var targetValues = valuesCache.get(target);
	// console.log('init', name, 'dependent on', deps[name]);

	//mark dependency as resolved (ignore next init calls)
	var propDeps = deps[name];
	deps[name] = null;

	//init dependens things beforehead
	for (var depPropName in propDeps){
		if (propDeps[depPropName]) {
			// console.log('redirect init to', depPropName)
			initProp(target, depPropName);
		}
	}

	//handle init procedure
	var initResult, beforeInit = targetValues[name];


	//run initialize procedure
	if (isFn(propState[initCallbackName])) {
		initResult = propState[initCallbackName].call(target, beforeInit);
	}
	else if (isObject(propState[initCallbackName]) && has(propState[initCallbackName],enterCallbackName)) {
		initResult = callState(target, propState[initCallbackName], beforeInit);
	}
	else {
		initResult = beforeInit !== undefined ? beforeInit : propState[initCallbackName];
	}

	//if result is undefined - keep initial value
	if (initResult === undefined) initResult = beforeInit;

	//handle init redirect
	if (targetValues[name] !== beforeInit) return;

	//presave target value (someone wants to get it beforehead)
	valuesCache.get(target)[name] = initResult;

	var isIgnored = ignoreCache.get(target)[name];

	if (!isIgnored)	{
		target[name] = initResult;
	} else {
		//call fake ignored setter
		settersCache.get(target)[name](initResult);
	}
}


/** set value on target */
function applyValue(target, name, value){
	valuesCache.get(target)[name] = value;

	//don't bind noop values
	//FIXME: write test for this (dropdown.js use-case) - there’s still extra-binding or redundant noop
	if (value === noop) return;

	bindValue(target, name, value);
}

function bindValue(target, name, value){
	if (isString(value) || isFn(value)) {
		// console.log('assign', name, value)
		//make sure context is kept bound to the target
		if (isFn(value)) {
			value = value.bind(target);
			activeCallbacks.get(target)[name] = value;
		}

		eOn(target, name, value);
	}
}


/** take over properties by target */
function applyProps(target, props){
	if (!isObject(props)) return;

	for (var name in props){
		// console.group('apply prop', name)
		if (isStateTransitionName(name)) continue;

		var value = props[name];
		var state = statesCache.get(target)[name];

		//extendify descriptor value
		if (isObject(value)){
			extend(state, value);
		}

		else {
			//if some fn was unbound but is going to be rebind
			if (value === valuesCache.get(target)[name]){
				bindValue(target, name, value);
			}

			//FIXME: merge with the same condition in init
			if (!ignoreCache.get(target)[name])	{
				target[name] = value;
			} else {
				//call fake ignored setter
				settersCache.get(target)[name](value);
			}
		}
		// console.groupEnd();
	}
}

/** unbind state declared props */
function unapplyProps(target, props){
	if (!isObject(props)) return;

	for (var name in props){
		// console.log('unbind', name)
		if (isStateTransitionName[name]) continue;

		var propValue = props[name];
		var state = statesCache.get(target)[name];
		var values = valuesCache.get(target);

		//delete extended descriptor
		if (isObject(propValue)){
			for (var propName in propValue){
				delete state[propName];
			}
		}

		else {
			if (isString(propValue) || isFn(propValue)) {
				//unbind fn value
				// console.log('off', name)
				if (isFn(propValue)) {
					var callbacks = activeCallbacks.get(target);
					if (callbacks[name]) {
						propValue = callbacks[name];
						callbacks[name] = null;
					}
				}
				eOff(target, name, propValue);
			}

			//set value to the root initial one, if such
			if (has(propsCache.get(target), name) && !state.constructor)
				delete values[name];
		}
	}
}


/** try to enter a state property, like set/get/init/etc */
function callState(target, state, a1, a2) {
	//undefined state (like no init meth)
	if (state === undefined) {
		return a1;
	}

	//init: 123
	else if (isPlain(state)) {
		//FIXME: this guy is questionable (return state)
		return state;
	}

	//init: function(){}
	else if (isFn(state)) {
		return state.call(target, a1, a2);
	}

	else if (isObject(state)) {
		//init: {before: function(){}}
		if (isFn(state[enterCallbackName])) {
			return state[enterCallbackName].call(target, a1, a2);
		}
		//init: {before: 123}
		else {
			return state[enterCallbackName];
		}
	}

	//init: document.createElement('div')
	return state;
}


/** try to leave state: call after with new state name passed */
function leaveState(target, state, a){
	// console.log('leave', state)
	if (!state) return a;

	if (!state[leaveCallbackName]) {
		return state[leaveCallbackName];
	}

	if (isFn(state[leaveCallbackName])) {
		return state[leaveCallbackName].call(target, a)
	}
}

function noop(){}

function isStateTransitionName(name){
	if (name === enterCallbackName || name === leaveCallbackName) return true;
}


/**
 * Disentangle listed keys
 *
 * @param {object} set An object with key including listed declarations
 * @example {'a,b,c': 1}
 *
 * @param {boolean} deep Whether to flatten nested objects
 *
 * @return {oblect} Source set passed {@link set}
 */
function flattenKeys(set, deep){
	for(var keys in set){
		var value = set[keys];

		if (deep && isObject(value)) flattenKeys(value, deep);

		if (/,/.test(keys)){
			delete set[keys];
			eachCSV(keys, setKey);
		}
	}

	function setKey(key){
		//if existing key - extend, if possible
		if (isObject(value) && isObject(set[key]) && value !== set[key]) {
			set[key] = extend({}, set[key], value);
		}
		//or replace
		else {
			set[key] = value;
		}
	}

	return set;
}


/** make sure there’re no references to the target, so there’re no memory leaks */
function unapplyState(target, props){
	//TODO
}
},{"each-csv":11,"enot":4,"extend":13,"icicle":12,"mutypes":17}],11:[function(require,module,exports){
module.exports=require(5)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\enot\\node_modules\\each-csv\\index.js":5}],12:[function(require,module,exports){
module.exports=require(3)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\emmy\\node_modules\\icicle\\index.js":3}],13:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	"use strict";
	if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	"use strict";
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if (typeof target !== "object" && typeof target !== "function" || target == undefined) {
			target = {};
	}

	for (; i < length; ++i) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],14:[function(require,module,exports){
'use strict';

var proto = Element.prototype;
var vendor = proto.matches
  || proto.matchesSelector
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

module.exports = match;

/**
 * Match `el` to `selector`.
 *
 * @param {Element} el
 * @param {String} selector
 * @return {Boolean}
 * @api public
 */

function match(el, selector) {
  if (vendor) return vendor.call(el, selector);
  var nodes = el.parentNode.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] == el) return true;
  }
  return false;
}
},{}],15:[function(require,module,exports){
module.exports = css;


var win = window, doc = document, root = doc.documentElement, body = doc.body;


/** Get clean style. */
var fakeStyle = doc.createElement('div').style;


/** Detect vendor prefix. */
var prefix = css.prefix = (function() {
	var regex = /^(webkit|moz|ms|O|khtml)[A-Z]/, prop;
	for (prop in fakeStyle) {
		if (regex.test(prop)) {
			return prop.match(regex)[1];
		}
	}
	return '';
}());


/** Prevent you know what. */
function pd(e){
	e.preventDefault();
}


/**
 * Disable or Enable any selection possibilities for an element.
 *
 * @param    {Element}   $el   Target to make unselectable.
 */

css.disableSelection = function($el){
	css($el, {
		'user-select': 'none',
		'user-drag': 'none',
		'touch-callout': 'none'
	});
	$el.setAttribute('unselectable', 'on');
	$el.addEventListener('selectstart', pd);
};
css.enableSelection = function($el){
	css($el, {
		'user-select': null,
		'user-drag': null,
		'touch-callout': null
	});
	$el.removeAttribute('unselectable');
	$el.removeEventListener('selectstart', pd);
};


/**
 * Return paddings of an element.
 *
 * @param    {Element}   $el   An element to calc paddings.
 * @return   {Object}   Paddings object `{top:n, bottom:n, left:n, right:n}`.
 */

css.paddings = function($el){
	if ($el === win) return new Rect();

	if (!($el instanceof Element)) throw Error('Argument is not an element');

	var style = win.getComputedStyle($el);

	return new Rect(
		parseCSSValue(style.paddingLeft),
		parseCSSValue(style.paddingTop),
		parseCSSValue(style.paddingRight),
		parseCSSValue(style.paddingBottom)
	);
};


/**
 * Return margins of an element.
 *
 * @param    {Element}   $el   An element which to calc margins.
 * @return   {Object}   Paddings object `{top:n, bottom:n, left:n, right:n}`.
 */

css.margins = function($el){
	if ($el === win) return new Rect();

	if (!($el instanceof Element)) throw Error('Argument is not an element');

	var style = win.getComputedStyle($el);

	return new Rect(
		parseCSSValue(style.marginLeft),
		parseCSSValue(style.marginTop),
		parseCSSValue(style.marginRight),
		parseCSSValue(style.marginBottom)
	);
};


/**
 * Return border widths of an element
 */
css.borders = function($el){
	if ($el === win) return new Rect;

	if (!($el instanceof Element)) throw Error('Argument is not an element');

	var style = win.getComputedStyle($el);

	return new Rect(
		parseCSSValue(style.borderLeftWidth),
		parseCSSValue(style.borderTopWidth),
		parseCSSValue(style.borderRightWidth),
		parseCSSValue(style.borderBottomWidth)
	);
};


/** Returns parsed css value. */
function parseCSSValue(str){
	str += '';
	return parseFloat(str.slice(0,-2)) || 0;
}
css.parseValue = parseCSSValue;


/**
 * Return absolute offsets of any target passed
 *
 * @param    {Element|window}   el   A target. Pass window to calculate viewport offsets
 * @return   {Object}   Offsets object with trbl, fromBottom, fromLeft.
 */

css.offsets = function(el){
	if (!el) throw Error('Bad argument');

	//calc client rect
	var cRect, result;

	//return vp offsets
	if (el === win) {
		result = new Rect(
			win.pageXOffset,
			win.pageYOffset
		);

		result.width = win.innerWidth - (css.hasScrollY() ? css.scrollbar : 0),
		result.height = win.innerHeight - (css.hasScrollX() ? css.scrollbar : 0)
		result.right = result.left + result.width;
		result.bottom = result.top + result.height;

		return result;
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
	var isFixed = css.isFixed(el);
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


/**
 * Detect whether element is placed to fixed container or fixed itself.
 *
 * @param {(Element|Object)} el Element to detect fixedness.
 *
 * @return {boolean} Whether element is nested.
 */

css.isFixed = function (el) {
	var parentEl = el;

	//window is fixed, btw
	if (el === win) return true;

	//unlike the doc
	if (el === doc) return false;

	while (parentEl) {
		if (win.getComputedStyle(parentEl).position === 'fixed') return true;
		parentEl = parentEl.offsetParent;
	}
	return false;
};


/**
 * Apply styles to an element. This is the module exports.
 *
 * @param    {Element}   el   An element to apply styles.
 * @param    {Object|string}   obj   Set of style rules or string to get style rule.
 */

function css(el, obj){
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
}


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


/**
 * Calc sb width
 *
 * @return {number} in pixels
 */
// Create the measurement node
var scrollDiv = doc.createElement("div");
css(scrollDiv,{
	width: 100,
	height: 100,
	overflow: 'scroll',
	position: 'absolute',
	top: -9999,
});
root.appendChild(scrollDiv);

/** the scrollbar width */
css.scrollbar = scrollDiv.offsetWidth - scrollDiv.clientWidth;

// Delete fake DIV
root.removeChild(scrollDiv);



/** window scrollbar detectors */
css.hasScrollX = function(){
	return win.innerHeight > root.clientHeight;
};
css.hasScrollY = function(){
	return win.innerWidth > root.clientWidth;
};


/** simple rect stub  */
function Rect(l,t,r,b,w,h){
	this.top=t||0;
	this.bottom=b||0;
	this.left=l||0;
	this.right=r||0;
	if (w!==undefined) this.width=w||this.right-this.left;
	if (h!==undefined) this.height=h||this.bottom-this.top;
}

css.Rect = Rect;
},{}],16:[function(require,module,exports){
/**
 * Simple math utils.
 * @module  mumath
 */

module.exports = {
	between: wrap(between),
	isBetween: wrap(isBetween),
	toPrecision: wrap(toPrecision),
	getPrecision: getPrecision,
	min: wrap(Math.min),
	max: wrap(Math.max),
	add: wrap(function(a,b){return a+b}),
	sub: wrap(function(a,b){return a-b})
};


/**
 * Get fn wrapped with array/object attrs recognition
 *
 * @return {Function} Target function
 */
function wrap(fn){
	return function(a){
		var args = arguments;
		if (a instanceof Array) {
			var result = new Array(a.length), slice;
			for (var i = 0; i < a.length; i++){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = args[j] instanceof Array ? args[j][i] : args[j];
					val = val || 0;
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
					val = val || 0;
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
}


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

function between(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max);
}


/**
 * Whether element is between left & right including
 *
 * @param {number} a
 * @param {number} left
 * @param {number} right
 *
 * @return {Boolean}
 */

function isBetween(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
}



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

function toPrecision(value, step) {
	step = parseFloat(step);
	if (step === 0) return value;
	value = Math.round(value / step) * step;
	return parseFloat(value.toFixed(getPrecision(step)));
}


/**
 * Get precision from float:
 *
 * @example
 * 1.1 → 1, 1234 → 0, .1234 → 4
 *
 * @param {number} n
 *
 * @return {number} decimap places
 */

function getPrecision(n){
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
}

},{}],17:[function(require,module,exports){
/**
* Trivial types checkers.
* Because there’re no common lib for that ( lodash_ is a fatguy)
*/
//TODO: make main use as `is.array(target)`

module.exports = {
	has: has,
	isObject: isObject,
	isFn: isFn,
	isString: isString,
	isNumber: isNumber,
	isBoolean: isBool,
	isPlain: isPlain,
	isArray: isArray,
	isArrayLike: isArrayLike,
	isElement: isElement,
	isPrivateName: isPrivateName,
	isRegExp: isRegExp
};

var win = typeof window === 'undefined' ? this : window;
var doc = typeof document === 'undefined' ? null : document;

//speedy impl,ementation of `in`
//NOTE: `!target[propName]` 2-3 orders faster than `!(propName in target)`
function has(a, b){
	if (!a) return false;
	//NOTE: this causes getter fire
	if (a[b]) return true;
	return b in a;
	// return a.hasOwnProperty(b);
}

//isPlainObject
function isObject(a){
	var Ctor, result;

	if (isPlain(a) || isArray(a) || isElement(a) || isFn(a)) return false;

	// avoid non `Object` objects, `arguments` objects, and DOM elements
	if (
		//FIXME: this condition causes weird behaviour if a includes specific valueOf or toSting
		// !(a && ('' + a) === '[object Object]') ||
		(!has(a, 'constructor') && (Ctor = a.constructor, isFn(Ctor) && !(Ctor instanceof Ctor))) ||
		!(typeof a === 'object')
		) {
		return false;
	}
	// In most environments an object's own properties are iterated before
	// its inherited properties. If the last iterated property is an object's
	// own property then there are no inherited enumerable properties.
	for(var key in a) {
		result = key;
	};

	return typeof result == 'undefined' || has(a, result);
}

function isFn(a){
	return !!(a && a.apply);
}

function isString(a){
	return typeof a === 'string' || a instanceof String;
}

function isNumber(a){
	return typeof a === 'number' || a instanceof Number;
}

function isBool(a){
	return typeof a === 'boolean' || a instanceof Boolean;
}

function isPlain(a){
	return !a || isString(a) || isNumber(a) || isBool(a);
}

function isArray(a){
	return a instanceof Array;
}

//FIXME: add tests from http://jsfiddle.net/ku9LS/1/
function isArrayLike(a){
	return isArray(a) || (a && !isString(a) && !a.nodeType && a != win && !isFn(a) && typeof a.length === 'number');
}

function isElement(target){
	return doc && target instanceof HTMLElement;
}

function isPrivateName(n){
	return n[0] === '_' && n.length > 1;
}

function isRegExp(target){
	return target instanceof RegExp;
}
},{}],18:[function(require,module,exports){
module.exports=require(4)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\enot\\index.js":4,"each-csv":19,"emmy":20,"matches-selector":22,"mustring":23,"mutypes":17}],19:[function(require,module,exports){
module.exports=require(5)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\enot\\node_modules\\each-csv\\index.js":5}],20:[function(require,module,exports){
module.exports=require(2)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\emmy\\index.js":2,"icicle":21}],21:[function(require,module,exports){
module.exports=require(3)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\emmy\\node_modules\\icicle\\index.js":3}],22:[function(require,module,exports){
module.exports=require(14)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\matches-selector\\index.js":14}],23:[function(require,module,exports){
module.exports=require(9)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\mustring\\index.js":9}],24:[function(require,module,exports){
module.exports=require(15)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\mucss\\index.js":15}],25:[function(require,module,exports){
module.exports=require(7)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\muparse\\index.js":7,"each-csv":26,"mustring":27,"mutypes":17}],26:[function(require,module,exports){
module.exports=require(5)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\enot\\node_modules\\each-csv\\index.js":5}],27:[function(require,module,exports){
module.exports=require(9)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\mustring\\index.js":9}],28:[function(require,module,exports){
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
},{}],29:[function(require,module,exports){
var type = require('mutypes');
var extend = require('extend');

module.exports = splitKeys;


/**
 * Disentangle listed keys
 *
 * @param {Object} obj An object with key including listed declarations
 * @example {'a,b,c': 1}
 *
 * @param {boolean} deep Whether to flatten nested objects
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
},{"extend":30,"mutypes":17}],30:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	'use strict';
	if (!obj || toString.call(obj) !== '[object Object]') {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	'use strict';
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],31:[function(require,module,exports){
module.exports=require(10)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\st8\\index.js":10,"each-csv":32,"enot":18,"extend":13,"icicle":33,"mutypes":17}],32:[function(require,module,exports){
module.exports=require(5)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\enot\\node_modules\\each-csv\\index.js":5}],33:[function(require,module,exports){
module.exports=require(3)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\draggy\\node_modules\\emmy\\node_modules\\icicle\\index.js":3}],34:[function(require,module,exports){
module.exports=require(28)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\resizable\\node_modules\\soft-extend\\index.js":28}],35:[function(require,module,exports){
var slice = [].slice;

module.exports = function (selector, multiple) {
  var ctx = this === window ? document : this;

  return (typeof selector == 'string')
    ? (multiple) ? slice.call(ctx.querySelectorAll(selector), 0) : ctx.querySelector(selector)
    : (selector instanceof Node || selector === window || !selector.length) ? (multiple ? [selector] : selector) : slice.call(selector, 0);
};
},{}],"draggy":[function(require,module,exports){
var type = require('mutypes');
var css = require('mucss');
var m = require('mumath');
var state = require('st8');
var parse = require('muparse');
var Emitter = require('emmy');
var Enot = require('enot');
var getEl = require('query-relative');

var win = window,
	doc = document,
	root = doc.documentElement;


/**
 * Draggy mod - makes any element draggable
 *
 * @module draggy
 * @constructor
 *
 * @return {Element} Target element
 */
module.exports = Draggy;



/* ------------------------------------ I N I T -------------------------------------- */


function Draggy(target, options){
	this.element = target;
	this.element.draggy = this;

	options = options || {};

	//parse attributes of targret
	var prop, parseResult;
	for (var propName in Draggy.options){
		//parse attribute, if no option passed
		if (options[propName] === undefined){
			prop = Draggy.options[propName];
			options[propName] = parse.attribute(target, propName, prop && prop.init !== undefined ? prop.init : prop);
		}

		//declare initial value
		if (options[propName] !== undefined) {
			this[propName] = options[propName];
		}
	}


	//holder for params while drag
	this.dragparams = {
		//initial offset from the `within` in 0-position
		initOffsetX: undefined,
		initOffsetY: undefined,

		//click offsets
		innerOffsetX: 0,
		innerOffsetY: 0,

		//dragstert initial client x and y
		initClientX: 0,
		initClientY: 0,

		//previous position on the screen
		prevClientX: 0,
		prevClientY: 0,

		//tracking params
		velocity: 0,
		angle: 0,

		//[clientX, clientY] for the last track
		frame: undefined,
		timestamp: undefined,

		//container absolute offsets
		containerOffsetX: 0,
		containerOffsetY: 0
	};


	//apply params
	state(this, Draggy.options);


	//update limits, if draggy is in the content already
	if (document.contains(this.element)){
		this.updateLimits();
	}
}



/* ---------------------------------- O P T I O N S ---------------------------------- */


Draggy.options = {
	/** Restricting container
	 * @type {Element|object}
	 * @default root
	 */
	within: {
		init: function(init){
			return init;
		},
		set: function(within){
			var res;

			//catch predefined parent reference string
			if (within === undefined) {
				res = this.element.parentNode;
			}
			else if (!within) return within;
			else {
				res = getEl(within, this.element);
			}

			if (res === document) res = root;

			return res;
		}
	},


	/** Which area of draggable should not be outside the restriction area.
	 * False value means center by the self rect
	 * @type {(Array|number|false)}
	 * @default this
	 */
	pin: {
		set: function(value){
			if (type.isArray(value)){
				if (value.length === 2){
					return [value[0], value[1], value[0], value[1]];
				} else if (value.length === 4){
					return value;
				}
			}

			else if (type.isNumber(value)){
				return [value, value, value, value];
			}

			return value;
		},

		get: function(value){
			//return the whole size if no value defined
			if (!value)	return [0,0,this.element.offsetWidth, this.element.offsetHeight];

			return value;
		}
	},


	/** Clone object for dragging */
	ghost: false,


	/** How fast to move when released
	 */
	velocity: 2000,
	maxVelocity: 100,


	/** For how long to release movement
	 *
	 * @type {(number|false)}
	 * @default false
	 * @todo
	 */
	release: false,


	/** Initial drag ignore area
	 *
	 * @type {(Array(4)|Array(2)|Function|number)}
	 */
	threshold: {
		init: 0,

		//return array[x,y,x,y]
		get: function(val){
			if (type.isFn(val)){
				return val();
			} else {
				return val;
			}
		},

		set: function(val){
			if (type.isNumber(val)){
				return [-val*.5, -val*.5, val*.5, val*.5];
			} else if (val.length === 2){
				//Array(w,h)
				return [-val[0]*.5, -val[1]*.5, val[0]*.5, val[1]*.5];
			} else if(val.length === 4){
				//Array(x1,y1,x2,y2)
				return val;
			} else if (type.isFn(val)){
				//custom val funciton
				return val;
			} else {
				return [0,0,0,0];
			}
		}
	},


	/** Autoscroll on reaching the border of the screen */
	autoscroll: false,


	/** To what extent round position */
	precision: 1,


	/** slow down movement by pressing ctrl/cmd */
	sniper: true,


	/** how much is slower sniper drag */
	sniperSpeed: .15,


	/** Restrict movement by axis
	 *
	 * @default undefined
	 * @enum {string}
	 */
	axis: {
		x: {
			//ignore setting y
			y: {
				set: function(){
					return 0;
				}
			}
			// threshold: {
			// 	get: function(val){
			// 		val = Draggable.fn.threshold.get(val);
			// 		val[1] = -9999;
			// 		val[3] = 9999;
			// 		return val;
			// 	}
			// }
		},
		y: {
			x: {
				//ignore setting x
				set: function(){
					return 0;
				}
			}
			// threshold: {
			// 	get: function(val){
			// 		val = Draggable.fn.threshold.get(val);
			// 		val[0] = -9999;
			// 		val[2] = 9999;
			// 		return val;
			// 	}
			// }
		},
		_: {

		}
	},


	/** Repeat position by one of axis
	 * @enum {string}
	 * @default undefined
	 */
	repeat: {
		undefined: null,
		both: null,
		x: null,
		y: null,
		_: function(){
			//TODO
			//vector passed
			if (this.repeat instanceof Array){
				if (this.repeat.length){
					if (this.repeat[0] && this.repeat[1])
						return "both";
					else if (this.repeat[0])
						return "x";
					else if (this.repeat[1])
						return "y";
				}

			//just repeat any possible way
			} else if (this.repeat === true){
				return this.axis

			//unrecognized value passed
			} else {
				return undefined;
			}
		}
	},


	/** Hide cursor on drag (reduce clutter) */
	hideCursor: false,

	/**
	 * Position
	 */
	x: {
		init: 0,
		set: function(value){
			var limits = this.limits;
			value = m.between(value, limits.left, limits.right);
			//snap to pixels
			return Math.round(value);
		},
		changed: function(value, old){
			if (this.freeze) return;
			css(this.element,
				'transform',
				['translate3d(', value, 'px,', this.y, 'px, 0)'].join(''));
		}
	},
	y: {
		init: 0,
		set: function(value){
			var limits = this.limits;
			value = m.between(value, limits.top, limits.bottom);
			//snap to pixels
			return Math.round(value);
		},
		changed: function(value){
			if (this.freeze) return;
			css(this.element,
				'transform',
				['translate3d(', this.x, 'px,', value, 'px, 0)'].join(''));
		}
	},


	/** Ignore position change */
	freeze: false,


	/**
	 * Limits representing current drag area
	 *
	 * @type {Object}
	 * @todo  make it work
	 */
	limits: {
		init: function(){
			return {top:-9999, bottom:9999, left: -9999, right:9999};
		}
	},


	/**
	* State of drag.
	* @enum {string}
	* @default is 'idle'
	*/
	dragstate: {
		/** idle state */
		_: {
			before: function(){
				this.emit('idle');

				//enable document interavtivity
				css.enableSelection(root);
				if (this.hideCursor) css(root, {"cursor": null});
			},
			'@element touchstart, @element mousedown': function(e){
				e.preventDefault();

				//don’t start double drag (if draggable is within other draggable)
				if (e.target.draggy !== this) return;
				// e.stopPropagation();

				//init drag params
				this.initDragparams(e);

				//do drag on empty threshold
				this.dragstate = 'threshold';

				//with zero-threshold move picker to the point of click
				if (isZero(this.threshold)) {
					this.doDrag(e);
				}
			},

			/** Track kinetic movement */
			track: function(){
				var params = this.dragparams;

				//set initial kinetic props
				params.velocity = 0;
				params.amplitude = 0;
				params.angle = 0;
				params.frame = [params.prevClientX, params.prevClientY];
				params.timestamp = +new Date();
				this.emit('track:defer');
			},

			after: function(){
				//init tracking, if release defined
				this.release && this.track();
			}
		},

		//track velocity
		'threshold, drag': {
			track: function(){
				var params = this.dragparams;

				var now = +new Date;
				var elapsed = now - params.timestamp;

				//get delta movement since the last track
				var deltaX = params.prevClientX - params.frame[0];
				var deltaY = params.prevClientY - params.frame[1];
				params.frame[0] = params.prevClientX;
				params.frame[1] = params.prevClientY;

				var delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

				//get speec (prevent div by zero)
				var v = this.velocity * delta / (1 + elapsed);
				params.velocity = 0.6 * v + 0.4 * params.velocity;

				//get angle
				params.angle = 0.7 * Math.atan2(deltaY, deltaX) + 0.2 * params.angle + 0.1 * Math.atan2(params.frame[0] - params.initClientX, params.frame[1] - params.initClientY);

				this.emit('track:after(20)');
			}
		},

		threshold: {
			before: function(){
				this.emit('threshold');

				//ignore threshold state, if threshold is none
				if (isZero(this.threshold)) return 'drag';
			},

			//update position onmove
			'document touchmove, document mousemove': function(e){
				e.preventDefault();

				//compare movement to the threshold
				var params = this.dragparams;
				var clientX = getClientX(e);
				var clientY = getClientY(e);
				var difX = params.initClientX - clientX;
				var difY = params.initClientY - clientY;

				if (difX < this.threshold[0] || difX > this.threshold[2] || difY < this.threshold[1] || difY > this.threshold[3]) {
					this.initDragparams(e);

					this.dragstate = 'drag';
				}
			},

			//stop drag onleave
			'document touchend, document mouseup, document mouseleave': function(e){
				e.preventDefault();

				this.dragstate = 'idle';
			},

			after: function(){
				//reduce dragging clutter
				css.disableSelection(root);
				if (this.hideCursor) css(root, {"cursor": "none"});
			}
		},

		drag: {
			before: function(){
				css.disableSelection(this.element);

				//emit drag evts
				Emitter.emit(this.element, 'dragstart', null, true)
				.emit(this.element, 'drag', null, true);

				this.emit('dragstart').emit('drag');
			},

			//update position onmove
			'document touchmove, document mousemove': function(e){
				e.preventDefault();
				// e.stopPropagation();

				this.doDrag(e);
			},

			//stop drag onleave
			'document touchend, document mouseup, document mouseleave': function(e){
				e.preventDefault();
				// e.stopPropagation();


				if (this.dragparams.velocity > 1) {
					this.dragstate = 'release';
					return;
				}

				this.dragstate = 'idle';
			},

			after: function(){
				css.enableSelection(this.element);
				Emitter.emit(this.element, 'dragend', null, true);

				this.emit('dragend');
			}
		},

		//inertional moving
		release: {
			before: function(){
				css(this.element, {
					'transition': this.release + 'ms ease-out transform'
				});
				var params = this.dragparams;

				//calc target point & animate to it
				this.x += params.velocity * Math.cos(params.angle);
				this.y += params.velocity * Math.sin(params.angle);

				//release release after 1ms (animation)
				this.emit('stop:after(' + this.release + ')');
			},

			//stop movement
			stop: function (){
				this.dragstate = 'idle';
			},

			after: function(){
				css(this.element, {
					'transition': null
				});

				//remove planned stopping
				this.off('stop');
			}
		}
	},


	/** Callbacks */
	drag: undefined,
	dragstart: undefined,
	dragend: undefined,
	dragrelease: undefined
};



/* ------------------------------    A    P    I    ---------------------------------- */


var DraggyProto = Draggy.prototype;

Enot(DraggyProto);


/** Set drag params for the initial drag */
DraggyProto.initDragparams = function(e){
	//prepare limits & pin for drag session
	this.updateLimits();

	// console.log('---initDragparams')

	var params = this.dragparams;

	//set initial position - have to go after updating limits
	params.prevClientX = getClientX(e);
	params.prevClientY = getClientY(e);

	//if drag started outside the element - align the element centered by pin (excl threshold case)
	if (e.target === this.element) {
		params.innerOffsetX = e.offsetX;
		params.innerOffsetY = e.offsetY;
	}
	else if (this.dragstate === 'threshold'){
		var offsets = this.element.getBoundingClientRect();
		params.innerOffsetX = params.prevClientX - offsets.left;
		params.innerOffsetY = params.prevClientY - offsets.top;
	}
	else {
		params.innerOffsetX = this.pin[0] / 2 + this.pin[2] / 2;
		params.innerOffsetY = this.pin[1] / 2 + this.pin[3] / 2;
	}

	//set initial client x & y
	params.initClientX = params.prevClientX;
	params.initClientY = params.prevClientY;

	return this;
};

DraggyProto.doDrag = function(e){
	// console.log('dodrag')
	var params = this.dragparams;

	var x = getClientX(e),
		y = getClientY(e);
	this.x = x + win.pageXOffset - params.initOffsetX - params.innerOffsetX - params.containerOffsetX;

	this.y = y + win.pageYOffset - params.initOffsetY - params.innerOffsetY - params.containerOffsetY;

	//save dragparams for the next drag call
	params.prevClientX = x;
	params.prevClientY = y;

	//emit drag
	Emitter.emit(this.element, 'drag', null, true);
	this.emit('drag');

	return this;
};


/** Actualize self limits & container offsets */
DraggyProto.updateLimits = function(){
	var within = this.within;
	var pin = this.pin;
	var params = this.dragparams;

	//parse translate x & y
	//they are needed to get real initial offsets on drag start
	var translateStr = this.element.style.transform;
	var m1 = /-?\b[\d\.]+/.exec(translateStr);
	var tx = parseFloat(m1[0]);
	translateStr = translateStr.slice(m1.index + m1[0].length);
	var m2 =  /-?\b[\d\.]+/.exec(translateStr);
	var ty = parseFloat(m2[0]);


	var selfOffsets = css.offsets(this.element);

	//initial offsets from the `limitEl`, 0-translation (only first init)
	params.initOffsetX = selfOffsets.left - tx;
	params.initOffsetY = selfOffsets.top - ty;

	//ignore undefined restriction container
	if (!within) return;

	var containerOffsets = css.offsets(within);
	var paddings = css.paddings(within);


	//initial container offsets from page
	params.containerOffsetX = containerOffsets.left;
	params.containerOffsetY = containerOffsets.top;


	//correct init offsets
	params.initOffsetX -= containerOffsets.left;
	params.initOffsetY -= containerOffsets.top;

	//save limits && offsets
	this.limits = {
		left: -pin[0] - params.initOffsetX + paddings.left,
		top: -pin[1] - params.initOffsetY + paddings.top,
		right: -params.initOffsetX + containerOffsets.width - pin[2] - paddings.right,
		bottom: -params.initOffsetY + containerOffsets.height - pin[3] - paddings.bottom
	};
};


/** deconstructor - removes any memory bindings */
DraggyProto.destroy = function(){
	//TODO: unbind all events

	//remove references
	this.element.draggy = null;
	this.element = null;
};



/* ---------------------------------- H E L P E R S ---------------------------------- */


/** Check whether arr is filled with zeros */
function isZero(arr){
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}


/**
 * get clientY/clientY from event
 *
 * @param {Event} e Event raised, like mousemove
 *
 * @return {number} Coordinate relative to the screen
 */
function getClientY(e){
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientY;
	}

	// mouse event
	return e.clientY;
}
function getClientX(e){
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientX;
	}

	// mouse event
	return e.clientX;
}
},{"emmy":2,"enot":4,"mucss":15,"mumath":6,"muparse":7,"mutypes":17,"query-relative":undefined,"st8":10}],"placer":[function(require,module,exports){
/**
* @module  placer
*
* Places any element relative to any other element the way you define
*/
module.exports = place;

//TODO: fix draggy in safari
//TODO: fix for IE8
//TODO: fix resizable/draggable tests in firefox
//TODO: use translate3d instead of absolute repositioning (option?)
//TODO: implement avoiding strategy (at least one use-case)
//TODO: enhance best-side strategy: choose the most closest side

var type = require('mutypes');
var css = require('mucss');
var q = require('query-relative');
var softExtend = require('soft-extend');
var m = require('mumath');
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
	options.relativeTo = options.relativeTo && q(options.relativeTo, element) || win;
	options.within = options.within && q(options.within, element);


	//TODO: query avoidables
	// options.avoid = q(options.avoid, element, true);


	//set the same position as the target’s one or absolute
	if (type.isElement(options.relativeTo) && css.isFixed(options.relativeTo)) {
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
		var placerRect = css.offsets(opts.relativeTo);
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

		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(parent);

		//correct borders
		includeBorders(parentRect, parent);


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
		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);

		//correct borders
		includeBorders(parentRect, placee.offsetParent);


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
		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//correct borders
		includeBorders(parentRect, parent);


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
		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//correct borders
		includeBorders(parentRect, placee.offsetParent);


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


/** Find the most appropriate side to place element */
function getBestSide(placee, opts) {
	var initSide = opts.side;

	var withinRect = css.offsets(opts.within),
		placeeRect = css.offsets(placee),
		placerRect = css.offsets(opts.relativeTo);

	includeBorders(withinRect, opts.within);

	//rect of "hot" areas
	var hotRect = {
		top: placerRect.top - withinRect.top,
		bottom: withinRect.bottom - placerRect.bottom,
		left: placerRect.left - withinRect.left,
		right: withinRect.right - placerRect.right
	};

	//rect of available spaces
	var availSpace = {
		top: hotRect.top - placeeRect.height,
		bottom: hotRect.bottom - placeeRect.height,
		left: hotRect.left - placeeRect.width,
		right: hotRect.right - placeeRect.width
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



/** include borders in offsets */
//FIXME: think of outskirting borders detection to offsets (inner/outer offsets)
function includeBorders(rect, el){
	//correct borders
	var borders = css.borders(el);
	rect.left += borders.left;
	rect.right -= borders.right;
	rect.bottom -= borders.bottom;
	rect.top += borders.top;
	return rect;
}


/** apply limits rectangle to the position of an element */
function trimPositionY(placee, within, parentRect){
	var placeeRect = css.offsets(placee);
	var withinRect = css.offsets(within);
	includeBorders(withinRect, within);

	if (withinRect.top > placeeRect.top) {
		css(placee, {
			top: withinRect.top - parentRect.top,
			bottom: 'auto'
		});
	}

	else if (withinRect.bottom < placeeRect.bottom) {
		css(placee, {
			top: 'auto',
			bottom: parentRect.bottom - withinRect.bottom
		});
	}
}
function trimPositionX(placee, within, parentRect){
	var placeeRect = css.offsets(placee);
	var withinRect = css.offsets(within);
	includeBorders(withinRect, within);

	if (withinRect.left > placeeRect.left) {
		css(placee, {
			left: withinRect.left - parentRect.left,
			right: 'auto'
		});
	}

	else if (withinRect.right < placeeRect.right) {
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
			right: win.innerWidth - (css.hasScrollY() ? css.scrollbar : 0),
			width: win.innerWidth,
			top: 0,
			bottom: win.innerHeight - (css.hasScrollX() ? css.scrollbar : 0),
			height: win.innerHeight
		};
	}
	else {
		rect = css.offsets(target);
	}

	return rect;
}
},{"aligner":1,"mucss":15,"mumath":16,"mutypes":17,"query-relative":undefined,"soft-extend":34}],"query-relative":[function(require,module,exports){
var doc = document, root = doc.documentElement;


var _q = require('tiny-element');
var matches = require('matches-selector');


//TODO: detect inner parenthesis, like :closest(:not(abc))
//TODO: make target be able to be array
//TODO: multiple result (at least one use-case)


module.exports = q;


/**
 * Query selector including initial pseudos
 *
 * @param {string} str A query string
 * @param {Element} target A query context element
 *
 * @return {[type]} [description]
 */
function q(str, target, multiple) {

	//if target is undefined, perform usual global query
	if (!target) target = root;

	//treat empty string as a target itself
	if (!str){
		return target;
	}


	// console.group('q', str, target);

	var m, result;

	//detect whether query includes special pseudos
	if (m = /:(parent|closest|next|prev)(?:\(([^\)]*)\))?/.exec(str)) {
		var pseudo = m[1], idx = m.index, param = m[2], token = m[0];

		//1. pre-query
		if (idx) {
			//FIXME: ensure that single select is enough here
			target = _q.call(target, str.slice(0, idx));
		}


		//2. query
		result = pseudos[pseudo](target, param);
		if (!result) {
			// console.groupEnd();
			return null;
		}


		//2.1 if str starts with >, add scoping
		var strRest = str.slice(idx + token.length).trim();
		if (strRest[0] === '>') {
			if (scopeAvail) {
				strRest = ':scope ' + strRest;
			}
			//fake selector via fake id on selected element
			else {
				var id = result.getAttribute('id');
				if (!id) result.setAttribute('id', id = genId());

				strRest = '#' + id + strRest;
			}
		}


		//3. Post-query or die
		result = q(strRest, result, multiple);
	}

	//make default query
	else {
		result = _q.call(target, str, multiple);
	}

	// console.groupEnd();
	return result;
}



//detect :scope
var scopeAvail = true;
try {
	doc.querySelector(':scope');
}
//scope isn’t supported
catch (e){
	scopeAvail = false;
}

/** generate unique id for selector */
var counter = Date.now() % 1e9;
function genId(e, q){
	return '__p' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
}


/** Custom :pseudos */
var pseudos = q.pseudos = {
	/** Get parent, if any */
	parent: function(e, q){
		var res = e.parentNode;
		return res === doc ? e : res;
	},

	/**
	* Get closest parent matching selector (or self)
	*/
	closest: function(e, q){
		if (!q || matches(e, q)) return e;
		while ((e = e.parentNode) !== doc) {
			if (!q || matches(e, q)) return e;
		}
	},

	/**
	 * Find the prev sibling matching selector
	 */
	prev: function(e, q){
		while (e = e.previousSibling) {
			if (e.nodeType !== 1) continue;
			if (!q || matches(e, q)) return e;
		}
	},

	/**
	 * Get the next sibling matching selector
	 */
	next: function(e, q){
		while (e = e.nextSibling) {
			if (e.nodeType !== 1) continue;
			if (!q || matches(e, q)) return e;
		}
	}
};
},{"matches-selector":14,"tiny-element":35}],"resizable":[function(require,module,exports){
var css = require('mucss');
var Draggable = require('draggy');
var state = require('st8');
var Enot = require('enot');
var splitKeys = require('split-keys');
var parse = require('muparse');
var type = require('mutypes');
var softExtend = require('soft-extend');
var qel = require('tiny-element');


/** Shortcuts */
var doc = document, win = window, root = doc.documentElement;


/**
 * Resizable class
 *
 * @constructor
 */
function Resizable(el, options){
	var constr = this.constructor;

	//bind controller
	this.element = el;
	this.element.resizable = this;

	//ensure options
	options = options || {};

	//read attributes on targret, extend options
	var prop, parseResult;
	for (var propName in constr.options){
		//parse attribute, if no option passed
		if (options[propName] === undefined){
			prop = constr.options[propName];
			options[propName] = parse.attribute(el, propName, prop && prop.init !== undefined ? prop.init : prop);
		}

		//declare initial value
		if (options[propName] !== undefined) {
			this[propName] = options[propName];
		}
	}

	//apply params
	state(this, constr.options);
}


/**
 * Defaults
 */
Resizable.options = {
	/** restrict resizing within the container */
	within: {
		init: function(val){
			var res;
			//defaultly restrictor is parent container
			if (val === undefined) {
				res = this.element.parentNode;
			}
			//unless null is separately stated
			else if (val !== null) {
				res = qel(val);
			}

			return res;
		}
	},

	/**
	 * list/array/object of direction-keyed handles
	 * @enum {string}
	 */
	handles: {
		init: function(val){
			//set of handles
			var handles, style = getComputedStyle(this.element);

			//parse value
			if (type.isArray(val)){
				handles = {};
				for (var i = val.length; i--;){
					handles[val[i]] = null;
				}
			}
			else if (type.isString(val)){
				handles = {};
				var arr = val.split(/\s?,\s?/);
				for (var i = arr.length; i--;){
					handles[arr[i]] = null;
				}
			}
			else if (type.isObject(val)) {
				handles = val;
			}
			//default set of handles depends on position.
			else {
				var pos = style.position;
				//if position is absolute - all
				if (pos !== 'static'){
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
				//else - only three
				else {
					handles = {
						s: null,
						se: null,
						e: null
					};
				}

			}


			//create proper number of handles
			var handle;
			for (var direction in handles){
				//ensure handle
				handle = handles[direction];
				if (!handle) {
					handle = document.createElement('div');
				}
				handles[direction] = handle;

				//insert handle to the element
				this.element.appendChild(handle);

				//configure handle
				this.configureHandle(handle, direction);
			}

			return handles;
		}
	},

	/** proper class to append to handle */
	handleClass: 'handle',

	/** callbacks */
	resize: undefined
};


var proto = Resizable.prototype;


/** predefined handles draggable options */
var w = 10;
Resizable.handleOptions = splitKeys({
	'n,s': {
		axis: 'y'
	},
	'w,e':{
		axis: 'x'
	},
	'e,w,n,s,nw,ne,sw,se':{
		sniper: false,
		pin: w/2,
		within: null,
		threshold: w/2,
		dragstart: function(e){
			var res = this.resizable,
				el = res.element;

			res.m = css.margins(el);
			res.b = css.borders(el);
			res.p = css.paddings(el);

			//parse initial offsets
			var s = getComputedStyle(el);
			res.offsets = [css.parseValue(s.left), css.parseValue(s.top)];

			//fix top-left position
			css(el, {
				left: res.offsets[0],
				top: res.offsets[1]
			});

			//recalc border-box
			if (getComputedStyle(el).boxSizing === 'border-box') {
				res.p.top = 0;
				res.p.bottom = 0;
				res.p.left = 0;
				res.p.right = 0;
				res.b.top = 0;
				res.b.bottom = 0;
				res.b.left = 0;
				res.b.right = 0;
			}

			//save initial size
			res.size = [el.offsetWidth - res.b.left - res.b.right - res.p.left - res.p.right, el.offsetHeight - res.b.top - res.b.bottom - res.p.top - res.p.bottom];

			//calc limits (max height/width)
			if (res.within) {
				var po = css.offsets(res.within);
				var o = css.offsets(el);
				res.limits = [
					o.left - po.left + res.size[0],
					o.top - po.top + res.size[1],
					po.right - o.right + res.size[0],
					po.bottom - o.bottom + res.size[1]];
			} else {
				res.limits = [-9999, -9999, 9999, 9999];
			}


			//preset mouse cursor
			css(root, {
				'cursor': this.direction + '-resize'
			});

			//clear cursors
			for (var h in res.handles){
				css(res.handles[h], 'cursor', null);
			}
		},
		drag: function(e){
			var res = this.resizable,
				el = res.element;

			//change width & height to accord to the new position of handle
			this.resize();

			//FIXME: doubtful solution
			this.x = 0;
			this.y = 0;

			//trigger callbacks
			res.emit('resize', e);
			Enot.emit(el, 'resize', e);
		},
		dragend: function(){
			var res = this.resizable,
				el = res.element;

			//undisable selection
			css.enableSelection(root);

			//clear cursor & pointer-events
			css(root, {
				'cursor': null
			});
			//get back cursors
			for (var h in res.handles){
				css(res.handles[h], 'cursor', res.handles[h].draggy.direction + '-resize');
			}
		}
	},
	'se,s,e': {
		resize: function(){
			var res = this.resizable,
				el = res.element;

			css(el, {
				width: Math.min(Math.max(res.size[0] + this.x, 0), res.limits[2]),
				height: Math.min(Math.max(res.size[1] + this.y, 0), res.limits[3])
			});
		}
	},
	'nw,n,w': {
		resize: function(e){
			var res = this.resizable,
				el = res.element;

			css(el, {
				width: Math.min(Math.max(res.size[0] - this.x, 0), res.limits[0]),
				height: Math.min(Math.max(res.size[1] - this.y, 0), res.limits[1])
			});

			//subtract t/l on changed size
			var difX = res.size[0] + res.b.left + res.b.right + res.p.left + res.p.right - el.offsetWidth;
			var difY = res.size[1] + res.b.top + res.b.bottom + res.p.top + res.p.bottom - el.offsetHeight;

			css(el, {
				left: res.offsets[0] + difX,
				top: res.offsets[1] + difY
			});
		}
	},
	'ne': {
		resize: function(){
			var res = this.resizable,
				el = res.element;

			css(el, {
				width: Math.min(Math.max(res.size[0] + this.x, 0), res.limits[2]),
				height: Math.min(Math.max(res.size[1] - this.y, 0), res.limits[1])
			});

			//subtract t/l on changed size
			var difY = res.size[1] + res.b.top + res.b.bottom + res.p.top + res.p.bottom - el.offsetHeight;

			css(el, {
				top: res.offsets[1] + difY
			});
		}
	},
	'sw': {
		resize: function(){
			var res = this.resizable,
				el = res.element;

			css(el, {
				width: Math.min(Math.max(res.size[0] - this.x, 0), res.limits[0]),
				height: Math.min(Math.max(res.size[1] + this.y, 0), res.limits[3])
			});

			//subtract t/l on changed size
			var difX = res.size[0] + res.b.left + res.b.right + res.p.left + res.p.right - el.offsetWidth;

			css(el, {
				left: res.offsets[0] + difX
			});
		}
	}
}, true);


/** handles styles */
Resizable.handleStyles = splitKeys({
	'e,w,n,s,nw,ne,sw,se':{
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


/** Create handle for the direction */
proto.configureHandle = function(handle, direction){
	var opts = Resizable.handleOptions;
	var styles = Resizable.handleStyles;

	//make handle draggable
	var draggy = new Draggable(handle, opts[direction]);

	//save direction
	draggy.direction = direction;

	//append uninited options
	softExtend(draggy, opts[direction]);

	//save resizable reference
	draggy.resizable = this;

	//append styles
	css(handle, styles[direction]);
	css(handle, 'cursor', direction + '-resize');

	//append proper class
	handle.classList.add(this.handleClass);

	return handle;
};


/** deconstructor - removes any memory bindings */
proto.destroy = function(){
	//remove all handles
	for (var hName in this.handles){
		this.element.removeChild(this.handles[hName]);
	}

	//remove references
	this.element.resizable = null;
	this.element = null;
};


/** Make self eventable */
Enot(proto);



/**
 * @module resizable
 */
module.exports = Resizable;
},{"draggy":undefined,"enot":18,"mucss":24,"muparse":25,"mutypes":17,"soft-extend":28,"split-keys":29,"st8":31,"tiny-element":35}]},{},[]);

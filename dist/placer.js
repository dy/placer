!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.place=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
//TODO: implement avoiding strategy (graphic editors use-case when you need to avoid placing over selected elements)
//TODO: enhance best-side strategy: choose the most closest side

var type = require('mutype');
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
	options.relativeTo = options.relativeTo && q(element, options.relativeTo) || win;
	options.within = options.within && q(element, options.within);

	//TODO: query avoidables
	// options.avoid = q(element, options.avoid, true);


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
		contractRect(parentRect, css.borders(parent));


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
		contractRect(parentRect, css.borders(placee.offsetParent));


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
		contractRect(parentRect, css.borders(parent));


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
		contractRect(parentRect, css.borders(placee.offsetParent));


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

	contractRect(withinRect, css.borders(opts.within));

	var placeeMargins = css.margins(placee);

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
	var placeeRect = css.offsets(placee);
	var withinRect = css.offsets(within);
	var placeeMargins = css.margins(placee);

	contractRect(withinRect, css.borders(within));

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
	var placeeRect = css.offsets(placee);
	var withinRect = css.offsets(within);
	var placeeMargins = css.margins(placee);

	contractRect(withinRect, css.borders(within));

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
},{"aligner":2,"mucss":5,"mumath":6,"mutype":7,"query-relative":8,"soft-extend":9}],2:[function(require,module,exports){
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
},{"mucss":5,"mumath":3}],3:[function(require,module,exports){
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
	sub: wrap(function(a,b){return a-b}),
	div: wrap(function(a,b){return a/b}),
	mul: wrap(function(a,b){return a*b}),
	mod: wrap(function(a,b){return a%b}),
	floor: wrap(function(a){return Math.floor(a)}),
	ceil: wrap(function(a){return Math.ceil(a)}),
	round: wrap(function(a){return Math.round(a)})
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

},{}],4:[function(require,module,exports){
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
},{}],5:[function(require,module,exports){
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
},{}],6:[function(require,module,exports){
module.exports=require(3)
},{"c:\\Users\\dmitry\\Dropbox\\Projects\\placer\\node_modules\\aligner\\node_modules\\mumath\\index.js":3}],7:[function(require,module,exports){
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
	isRegExp: isRegExp,
	isEmpty: isEmpty
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

function isEmpty(a){
	if (!a) return true;
	for (var k in a) {
		return false;
	}
	return true;
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
},{}],8:[function(require,module,exports){
var doc = document, root = doc.documentElement;


var _q = require('tiny-element');
var matches = require('matches-selector');


//TODO: detect inner parenthesis, like :closest(:not(abc))

/**
 * @module query-relative
 */
module.exports = function(targets, str, multiple){
	var res = q(targets,str);
	return !multiple && isList(res) ? res[0] : res;
};


/**
 * Query selector including initial pseudos, return list
 *
 * @param {string} str A query string
 * @param {Element}? target A query context element
 *
 * @return {[type]} [description]
 */
function q(targets, str) {
	//no target means global target
	if (typeof targets === 'string') {
		str = targets;
		targets = doc;
	}

	//if targets is undefined, perform usual global query
	if (!targets) targets = this;

	//treat empty string as a target itself
	if (!str){
		// console.groupEnd();
		return targets;
	}

	//filter window etc non-queryable objects
	if (targets === window) targets === doc;
	else if (!(targets instanceof Node) && !isList(targets)) {
		// console.groupEnd();
		return targets;
	}


	var m, result;
	// console.group(targets, str, isList(targets))

	//detect whether query includes special pseudos
	if (m = /:(parent|closest|next|prev|root)(?:\(([^\)]*)\))?/.exec(str)) {
		var pseudo = m[1], idx = m.index, param = m[2], token = m[0];

		//1. pre-query
		if (idx) {
			targets = queryList(targets, str.slice(0, idx), true);
		}

		//2. query
		result = transformSet(targets, pseudos[pseudo], param);
		if (!result) {
			// console.groupEnd();
			return null;
		}
		if (isList(result) && !result.length) return result;

		//2.1 if rest str starts with >, add scoping
		var strRest = str.slice(idx + token.length).trim();
		if (strRest[0] === '>') {
			if (scopeAvail) {
				strRest = ':scope ' + strRest;
			}
			//fake selector via fake id on selected element
			else {
				var id = genId();
				transformSet(result, function(el, id){ el.setAttribute('data-__qr', id); }, id);

				strRest = '[data-__qr' + id + ']' + strRest;
			}
		}

		//3. Post-query or die
		result = q(result, strRest);
	}

	//make default query
	else {
		result = queryList(targets, str);
	}

	// console.groupEnd();
	return result;
}

/** Query elements from a list of targets, return list of queried items */
function queryList (targets, query) {
	if (isList(targets)) {
		return transformSet(targets, function(item, query){
			return _q.call(item, query, true);
		}, query);
	}
	//q single
	else return _q.call(targets, query, true);
}


/** Apply transformaion function on each element from a list, return resulting set */
function transformSet(list, fn, arg) {
	var res = [];
	if (!isList(list)) list = [list];
	for (var i = list.length, el, chunk; i--;) {
		el = list[i];
		if (el) {
			chunk = fn(el, arg);
			if (chunk) res = [].concat(chunk, res);
		}
	}
	return res;
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
	return (Math.random() * 1e9 >>> 0) + (counter++);
}


/** Custom :pseudos */
var pseudos = {
	/** Get parent, if any */
	parent: function(e, q){
		//root el is considered the topmost
		if (e === doc) return root;
		var res = e.parentNode;
		return res === doc ? e : res;
	},

	/**
	* Get closest parent matching selector (or self)
	*/
	closest: function(e, q){
		//root el is considered the topmost
		if (e === doc) return root;
		if (!q || (q instanceof Node ? e == q : matches(e, q))) return e;
		while ((e = e.parentNode) !== doc) {
			if (!q || (q instanceof Node ? e == q : matches(e, q))) return e;
		}
	},

	/**
	 * Find the prev sibling matching selector
	 */
	prev: function(e, q){
		while (e = e.previousSibling) {
			if (e.nodeType !== 1) continue;
			if (!q || (q instanceof Node ? e == q : matches(e, q))) return e;
		}
	},

	/**
	 * Get the next sibling matching selector
	 */
	next: function(e, q){
		while (e = e.nextSibling) {
			if (e.nodeType !== 1) continue;
			if (!q || (q instanceof Node ? e == q : matches(e, q))) return e;
		}
	},

	/**
	 * Get root for any request
	 */
	root: function(){
		return root;
	}
};


/** simple list checker */
function isList(a){
	return a instanceof Array || a instanceof NodeList;
}



//export pseudos
exports.closest = pseudos.closest;
exports.parent = pseudos.parent;
exports.next = pseudos.next;
exports.prev = pseudos.prev;
},{"matches-selector":4,"tiny-element":10}],9:[function(require,module,exports){
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
},{}],10:[function(require,module,exports){
var slice = [].slice;

module.exports = function (selector, multiple) {
  var ctx = this === window ? document : this;

  return (typeof selector == 'string')
    ? (multiple) ? slice.call(ctx.querySelectorAll(selector), 0) : ctx.querySelector(selector)
    : (selector instanceof Node || selector === window || !selector.length) ? (multiple ? [selector] : selector) : slice.call(selector, 0);
};
},{}]},{},[1])(1)
});
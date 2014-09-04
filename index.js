/**
* @module  placer
*
* Places any element relative to any other element the way you define
*/
module.exports = place;

var type = require('mutypes');
var css = require('mucss');

var win = window, doc = document, root = doc.documentElement, body = doc.body;

/**
 * Default options
 */

var defaults = {
	//source to align relatively to
	//element/{x,y}/[x,y]/
	relativeTo: window,

	//which side to palce element
	//t/r/b/l, 'center' ( === undefined),
	side: 'center',

	/**
	 * side to align: trbl/0..1
	 *
	 * @default  0
	 * @type {(number|string)}
	 */
	align: 0,

	//selector/nodelist/node/[x,y]/window/function(el)
	avoid: undefined,

	//selector/nodelist/node/[x,y]/window/function(el)
	within: window
};


/**
 * Set of position placers
 * @enum {Function}
 * @param {Element} placee Element to place
 * @param {object} rect Offsets rectangle (absolute position)
 */

var placeBySide = {
	center: function(placee, rect, within, align){
		var center = [(rect.left + rect.right) *.5, (rect.bottom + rect.top) *.5];
		var width = placee.offsetWidth;
		var height = placee.offsetHeight;
		css(placee, {
			top: (center[1] - height*.5),
			left: (center[0] - width*.5)
		});
	},

	left: function(el, rect){

	},

	right: function(el, rect){

	},

	top: function(placee, rect, within, align){
		var width = placee.offsetWidth;
		var height = placee.offsetHeight;
		var parent = placee.offsetParent;
		var parentHeight = parent.offsetHeight;

		//get reliable parent height
		//body & html with position:static tend to set bottom:0 as a viewport bottom
		//so take height for a vp height
		if (parent === body || parent === root && win.getComputedStyle(parent).position === 'static') parentHeight = win.innerHeight;
		css(placee, {
			left: Math.max(Math.min(rect.left + rect.width*align - width*align, within.right - width), within.left),
			bottom: parentHeight - rect.top,
			top: 'auto'
		});
	},

	bottom: function(placee, rect, within, align){
		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

		css(placee, {
			//clamp position by min/max
			left: Math.max(Math.min(rect.left + rect.width*align - width*align, within.right - width), within.left),
			top: rect.bottom,
			bottom: 'auto'
		});
	}
};


/**
 * Place element relative to the target by the side & params passed.
 *
 * @param {Element} element An element to place
 * @param {object} options Options object
 *
 * @return {boolean} The result of placement - whether placing succeeded
 */

function place(element, options){
	options = options || {};

	var relativeTo = options.relativeTo || defaults.relativeTo;
	var within = options.within || defaults.within;
	var side = options.side || defaults.side;
	var align = getAlign(options.align !== undefined ? options.align : defaults.align);


	//set the position as of the target
	if (css.isFixed(relativeTo)) element.style.position = 'fixed';
	else element.style.position = 'absolute';


	//place according to the position
	placeBySide[side](element,
		getRect(relativeTo),
		getRect(within), align);


	return element;
}


/**
 * Return offsets rectangle of an element
 *
 * @param {*} el Element, selector, window, document, rect, array
 *
 * @return {object} Offsets rectangle
 */

function getRect(target){
	var rect;
	if (target === win) {
		rect = {
			top: 0,
			left: 0,
			right: win.innerWidth,
			bottom: win.innerHeight
		};
	}
	else if (type.isElement(target)) {
		rect = css.offsets(target);
	}
	else if (type.isString(target)){
		var targetEl = document.querySelector(target);
		if (!targetEl) throw Error('No element queried by `' + target + '`');

		rect = css.offsets(targetEl);
	}

	return rect;
}


/**
 * Alignment setter
 *
 * @param {string|number} value Convert any value passed to float 0..1
 */

function getAlign(value){
	if (!value) return 0;

	if (type.isString(value)) {
		switch (value) {
			case 'left':
			case 'top':
				return 0;
			case 'right':
			case 'bottom':
				return 1;
		}
	}
	var num = parseFloat(value);

	return num !== undefined ? num : 0.5;
}